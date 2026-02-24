import { generatePKCE } from './pkce.js';
import { saveCredentials, type OAuthCredentials } from './credentials.js';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTH_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference';

export async function startAnthropicOAuth(): Promise<{ url: string; verifier: string }> {
  const { verifier, challenge } = generatePKCE();

  const url = new URL(AUTH_URL);
  url.searchParams.set('code', 'true');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', verifier);

  return {
    url: url.toString(),
    verifier,
  };
}

export async function exchangeAnthropicCode(
  code: string,
  verifier: string
): Promise<OAuthCredentials> {
  // Code format from callback: "{code}#{state}" - split on # to get code and state
  const splits = code.split('#');
  const authCode = splits[0];
  const state = splits.length > 1 ? splits[1] : undefined;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: authCode,
      state,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const creds: OAuthCredentials = {
    provider: 'anthropic',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveCredentials('anthropic', creds);
  return creds;
}

export async function refreshAnthropicToken(refreshToken: string): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const creds: OAuthCredentials = {
    provider: 'anthropic',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveCredentials('anthropic', creds);
  return creds;
}
