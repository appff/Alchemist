import crypto from 'crypto';
import { startCallbackServer } from './callback-server.js';
import { saveCredentials, type OAuthCredentials } from './credentials.js';

// Antigravity (Google internal IDE) OAuth credentials — enables Gemini 3.x model access
// via sandbox Cloud Code Assist endpoints (matching opencode-antigravity-auth plugin)
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALLBACK_PORT = 51121;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/oauth-callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
];

export interface GoogleAuthResult {
  url: string;
  verifier: string;
  state: string;
}

export async function startGoogleOAuth(): Promise<GoogleAuthResult> {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');

  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  return { url: url.toString(), verifier, state };
}

export async function exchangeGoogleCode(
  code: string,
  verifier: string,
): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const creds: OAuthCredentials = {
    provider: 'google',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveCredentials('google', creds);
  return creds;
}

export async function refreshGoogleToken(refreshToken: string): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const creds: OAuthCredentials = {
    provider: 'google',
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveCredentials('google', creds);
  return creds;
}

export const GOOGLE_CALLBACK_PORT = CALLBACK_PORT;
