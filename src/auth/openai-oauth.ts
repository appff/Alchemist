import crypto from 'crypto';
import { saveCredentials, type OAuthCredentials } from './credentials.js';

/**
 * OpenAI OAuth via Codex CLI flow.
 * Parameters match openai/codex (Rust) and opencode-openai-codex-auth exactly.
 */

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const ISSUER = 'https://auth.openai.com';
const AUTHORIZE_URL = `${ISSUER}/oauth/authorize`;
const TOKEN_URL = `${ISSUER}/oauth/token`;
const CALLBACK_PORT = 1455;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/auth/callback`;
const SCOPE = 'openid profile email offline_access';

export interface OpenAIOAuthResult {
  url: string;
  verifier: string;
  state: string;
}

/**
 * Generate PKCE pair matching codex CLI (64 random bytes → base64url verifier).
 */
function generatePKCE(): { verifier: string; challenge: string } {
  // codex CLI: 64 random bytes → base64url (86 chars)
  const verifier = crypto.randomBytes(64).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * Start OpenAI PKCE OAuth flow.
 * Parameters match codex CLI and opencode-openai-codex-auth plugin.
 */
export async function startOpenAIOAuth(): Promise<OpenAIOAuthResult> {
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(32).toString('base64url');

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  url.searchParams.set('audience', 'https://api.openai.com/v1');
  url.searchParams.set('id_token_add_organizations', 'true');
  url.searchParams.set('codex_cli_simplified_flow', 'true');
  url.searchParams.set('originator', 'codex_cli_rs');

  return { url: url.toString(), verifier, state };
}

/**
 * Exchange authorization code for tokens.
 * Matches codex CLI exchange_code_for_tokens exactly.
 */
export async function exchangeOpenAICode(
  code: string,
  verifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error('OpenAI code exchange: missing access_token or refresh_token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh an expired access token.
 * Matches opencode-openai-codex-auth plugin.
 */
export async function refreshOpenAIToken(refreshToken: string): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error('OpenAI token refresh: missing access_token or refresh_token');
  }

  const creds: OAuthCredentials = {
    provider: 'openai',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  saveCredentials('openai', creds);
  return creds;
}

export const OPENAI_CALLBACK_PORT = CALLBACK_PORT;
