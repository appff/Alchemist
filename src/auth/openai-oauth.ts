import { saveCredentials, type OAuthCredentials } from './credentials.js';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const DEVICE_USERCODE_URL = 'https://auth.openai.com/api/accounts/deviceauth/usercode';
const DEVICE_TOKEN_URL = 'https://auth.openai.com/api/accounts/deviceauth/token';
const DEVICE_VERIFICATION_URL = 'https://auth.openai.com/codex/device';
const DEVICE_CALLBACK_URI = 'https://auth.openai.com/deviceauth/callback';

export interface OpenAIDeviceAuthResponse {
  verificationUrl: string;
  userCode: string;
  deviceAuthId: string;
  interval: number;
}

export async function startOpenAIDeviceAuth(): Promise<OpenAIDeviceAuthResponse> {
  const response = await fetch(DEVICE_USERCODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI device auth failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    device_auth_id: string;
    user_code: string;
    interval: string;
  };

  return {
    verificationUrl: DEVICE_VERIFICATION_URL,
    userCode: data.user_code,
    deviceAuthId: data.device_auth_id,
    interval: parseInt(data.interval, 10) || 5,
  };
}

export async function pollOpenAIToken(
  deviceAuthId: string,
  userCode: string,
  interval: number
): Promise<{ authorizationCode: string; codeVerifier: string }> {
  const pollInterval = Math.max(interval, 5) * 1000;
  const maxAttempts = 180; // 15 minutes at 5s intervals

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const response = await fetch(DEVICE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_auth_id: deviceAuthId,
        user_code: userCode,
      }),
    });

    if (response.status === 403 || response.status === 404) {
      // Still pending, continue polling
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI device token poll failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      authorization_code: string;
      code_challenge: string;
      code_verifier: string;
    };

    return {
      authorizationCode: data.authorization_code,
      codeVerifier: data.code_verifier,
    };
  }

  throw new Error('OpenAI device authorization timed out (15 minutes)');
}

export async function exchangeOpenAICode(
  authCode: string,
  codeVerifier: string
): Promise<{ idToken: string; accessToken: string; refreshToken: string }> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: DEVICE_CALLBACK_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI code exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    id_token: string;
    access_token: string;
    refresh_token: string;
  };

  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

export async function obtainOpenAIApiKey(idToken: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id: CLIENT_ID,
      requested_token: 'openai-api-key',
      subject_token: idToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API key exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function refreshOpenAIToken(refreshToken: string): Promise<OAuthCredentials> {
  // Step 1: Refresh to get new tokens
  const refreshResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!refreshResponse.ok) {
    const text = await refreshResponse.text();
    throw new Error(`OpenAI token refresh failed (${refreshResponse.status}): ${text}`);
  }

  const refreshData = (await refreshResponse.json()) as {
    id_token: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Step 2: Exchange the new id_token for an API key
  const apiKey = await obtainOpenAIApiKey(refreshData.id_token);

  const creds: OAuthCredentials = {
    provider: 'openai',
    accessToken: apiKey,
    refreshToken: refreshData.refresh_token,
    expiresAt: Date.now() + (refreshData.expires_in ?? 3600) * 1000,
  };

  saveCredentials('openai', creds);
  return creds;
}

/**
 * Full device auth flow: poll → exchange code → get API key → save credentials.
 * Returns the OAuthCredentials with the API key as accessToken.
 */
export async function completeOpenAIDeviceAuth(
  deviceAuthId: string,
  userCode: string,
  interval: number
): Promise<OAuthCredentials> {
  // Poll until user authorizes
  const { authorizationCode, codeVerifier } = await pollOpenAIToken(
    deviceAuthId,
    userCode,
    interval
  );

  // Exchange authorization code for tokens
  const { idToken, refreshToken } = await exchangeOpenAICode(authorizationCode, codeVerifier);

  // Exchange id_token for an API key
  const apiKey = await obtainOpenAIApiKey(idToken);

  const creds: OAuthCredentials = {
    provider: 'openai',
    accessToken: apiKey,
    refreshToken,
    expiresAt: Date.now() + 3600 * 1000, // Default 1 hour
  };

  saveCredentials('openai', creds);
  return creds;
}
