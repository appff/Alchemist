import { exec } from 'child_process';
import { platform } from 'os';
import { PROVIDERS } from '@/providers';
import { saveApiKeyForProvider } from '../utils/env.js';

export type AuthState =
  | 'idle'
  | 'provider_select'
  | 'oauth_waiting'
  | 'code_input'
  | 'api_key_input'
  | 'complete'
  | 'error';

type AuthChangeListener = () => void;

/** Auth flow type for a given provider */
type AuthFlowType = 'oauth' | 'api_key';

function getAuthFlowType(providerId: string): AuthFlowType {
  switch (providerId) {
    case 'anthropic':
    case 'google':
    case 'openai':
      return 'oauth';
    default:
      return 'api_key';
  }
}

function openUrl(url: string): void {
  const os = platform();
  switch (os) {
    case 'darwin':
      exec(`open "${url}"`);
      break;
    case 'win32':
      exec(`start "" "${url}"`);
      break;
    default:
      exec(`xdg-open "${url}"`);
      break;
  }
}

export class AuthController {
  private stateValue: AuthState = 'idle';
  private messageValue = '';
  private selectedProviderValue: string | null = null;
  private readonly onError: (message: string) => void;
  private readonly onChange?: AuthChangeListener;
  private oauthVerifier: string | null = null;

  constructor(onError: (message: string) => void, onChange?: AuthChangeListener) {
    this.onError = onError;
    this.onChange = onChange;
  }

  get authState(): AuthState {
    return this.stateValue;
  }

  getState(): AuthState {
    return this.stateValue;
  }

  getMessage(): string {
    return this.messageValue;
  }

  getSelectedProvider(): string | null {
    return this.selectedProviderValue;
  }

  isInAuthFlow(): boolean {
    return this.stateValue !== 'idle';
  }

  startAuthFlow(): void {
    this.stateValue = 'provider_select';
    this.messageValue = '';
    this.selectedProviderValue = null;
    this.emitChange();
  }

  handleProviderSelect(providerId: string | null): void {
    if (!providerId) {
      this.resetState();
      return;
    }

    this.selectedProviderValue = providerId;
    const flowType = getAuthFlowType(providerId);

    switch (flowType) {
      case 'oauth':
        this.startOAuthFlow(providerId);
        break;
      case 'api_key':
        this.stateValue = 'api_key_input';
        this.messageValue = '';
        this.emitChange();
        break;
    }
  }

  handleCodeInput(code: string): void {
    if (!code.trim()) {
      return;
    }

    if (!this.selectedProviderValue) {
      this.setError('No provider selected.');
      return;
    }

    // Exchange the authorization code for tokens
    this.messageValue = 'Exchanging authorization code for tokens...';
    this.emitChange();

    // Attempt to exchange the code via the auth module
    void this.exchangeOAuthCode(this.selectedProviderValue, code.trim());
  }

  handleApiKeyInput(apiKey: string | null): void {
    if (!apiKey || !this.selectedProviderValue) {
      this.resetState();
      return;
    }

    const saved = saveApiKeyForProvider(this.selectedProviderValue, apiKey);
    if (saved) {
      const provider = PROVIDERS.find((p) => p.id === this.selectedProviderValue);
      const displayName = provider?.displayName ?? this.selectedProviderValue;
      this.stateValue = 'complete';
      this.messageValue = `API key saved for ${displayName}.`;
      this.emitChange();
      // Auto-return to idle after a short delay
      setTimeout(() => {
        this.resetState();
      }, 1500);
    } else {
      this.setError('Failed to save API key.');
    }
  }

  handleLogout(providerId?: string): void {
    const targetProvider = providerId ?? this.selectedProviderValue;
    void this.performLogout(targetProvider);
  }

  private async performLogout(targetProvider: string | null | undefined): Promise<void> {
    if (targetProvider) {
      try {
        const { clearCredentials } = await import('../auth/index.js');
        clearCredentials(targetProvider);
      } catch {
        // Auth module not available - nothing to clear
      }
      const provider = PROVIDERS.find((p) => p.id === targetProvider);
      const displayName = provider?.displayName ?? targetProvider;
      this.messageValue = `Credentials cleared for ${displayName}.`;
    } else {
      this.messageValue = 'No provider specified for logout.';
    }
    this.stateValue = 'complete';
    this.emitChange();
    setTimeout(() => this.resetState(), 1500);
  }

  cancelAuthFlow(): void {
    this.resetState();
  }

  private startOAuthFlow(providerId: string): void {
    try {
      void this.beginOAuth(providerId);
    } catch {
      this.stateValue = 'code_input';
      this.messageValue = 'OAuth module not available. Please paste your authorization code:';
      this.emitChange();
    }
  }

  private async beginOAuth(providerId: string): Promise<void> {
    try {
      if (providerId === 'google') {
        await this.beginGoogleOAuth(providerId);
      } else if (providerId === 'openai') {
        await this.beginOpenAIOAuth(providerId);
      } else {
        await this.beginAnthropicOAuth(providerId);
      }
    } catch {
      this.stateValue = 'api_key_input';
      this.messageValue = 'OAuth not available. Enter your API key instead:';
      this.emitChange();
    }
  }

  private async beginAnthropicOAuth(providerId: string): Promise<void> {
    const authModule = await import('../auth/index.js');
    const { url, verifier } = await authModule.startAnthropicOAuth();
    this.oauthVerifier = verifier;
    openUrl(url);
    this.stateValue = 'code_input';
    this.messageValue = 'Browser opened. After authorizing, paste the code here:';
    this.emitChange();
  }

  private async beginGoogleOAuth(providerId: string): Promise<void> {
    const { startGoogleOAuth, exchangeGoogleCode, GOOGLE_CALLBACK_PORT } = await import('../auth/index.js');
    const { startCallbackServer } = await import('../auth/callback-server.js');

    const { url, verifier, state } = await startGoogleOAuth();

    this.stateValue = 'oauth_waiting';
    this.messageValue = 'Browser opened. Waiting for Google authorization...';
    this.emitChange();

    openUrl(url);

    try {
      const { code } = await startCallbackServer(GOOGLE_CALLBACK_PORT, state);
      const creds = await exchangeGoogleCode(code, verifier);
      if (creds.accessToken) {
        const provider = PROVIDERS.find((p) => p.id === providerId);
        this.stateValue = 'complete';
        this.messageValue = `Authenticated with ${provider?.displayName ?? providerId} successfully.`;
        this.emitChange();
        setTimeout(() => this.resetState(), 1500);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google OAuth failed.';
      this.setError(msg);
    }
  }

  private async beginOpenAIOAuth(providerId: string): Promise<void> {
    const {
      startOpenAIOAuth,
      exchangeOpenAICode,
      saveCredentials,
      OPENAI_CALLBACK_PORT,
    } = await import('../auth/index.js');
    const { startCallbackServer } = await import('../auth/callback-server.js');

    const { url, verifier, state } = await startOpenAIOAuth();

    this.stateValue = 'oauth_waiting';
    this.messageValue = 'Browser opened. Waiting for OpenAI authorization...';
    this.emitChange();

    openUrl(url);

    try {
      const { code } = await startCallbackServer(OPENAI_CALLBACK_PORT);
      const { accessToken, refreshToken, expiresIn } = await exchangeOpenAICode(code, verifier);

      saveCredentials('openai', {
        provider: 'openai',
        accessToken,
        refreshToken,
        expiresAt: Date.now() + (expiresIn ?? 3600) * 1000,
      });

      const provider = PROVIDERS.find((p) => p.id === providerId);
      this.stateValue = 'complete';
      this.messageValue = `Authenticated with ${provider?.displayName ?? providerId} successfully.`;
      this.emitChange();
      setTimeout(() => this.resetState(), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OpenAI OAuth failed.';
      this.setError(msg);
    }
  }

  private async exchangeOAuthCode(providerId: string, code: string): Promise<void> {
    try {
      const authModule = await import('../auth/index.js');
      if (authModule.exchangeAnthropicCode) {
        if (!this.oauthVerifier) {
          this.setError('OAuth PKCE verifier not found. Please restart the auth flow.');
          return;
        }
        const { accessToken } = await authModule.exchangeAnthropicCode(code, this.oauthVerifier);
        this.oauthVerifier = null;
        const saved = saveApiKeyForProvider(providerId, accessToken);
        if (saved) {
          const provider = PROVIDERS.find((p) => p.id === providerId);
          this.stateValue = 'complete';
          this.messageValue = `Authenticated with ${provider?.displayName ?? providerId} successfully.`;
          this.emitChange();
          setTimeout(() => this.resetState(), 1500);
        } else {
          this.setError('Failed to save credentials.');
        }
      } else {
        this.setError('OAuth exchange function not available.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth code exchange failed.';
      this.setError(msg);
    }
  }

  private setError(message: string): void {
    this.stateValue = 'error';
    this.messageValue = message;
    this.onError(message);
    this.emitChange();
    setTimeout(() => {
      this.resetState();
    }, 2000);
  }

  private resetState(): void {
    this.stateValue = 'idle';
    this.messageValue = '';
    this.selectedProviderValue = null;
    this.oauthVerifier = null;
    this.emitChange();
  }

  private emitChange(): void {
    this.onChange?.();
  }
}
