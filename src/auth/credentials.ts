import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface OAuthCredentials {
  provider: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
}

interface CredentialsStore {
  [provider: string]: OAuthCredentials;
}

const CREDENTIALS_DIR = join(homedir(), '.dexter');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');

function readStore(): CredentialsStore {
  if (!existsSync(CREDENTIALS_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeStore(store: CredentialsStore): void {
  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export function saveCredentials(provider: string, creds: OAuthCredentials): void {
  const store = readStore();
  store[provider] = creds;
  writeStore(store);
}

export function loadCredentials(provider: string): OAuthCredentials | null {
  const store = readStore();
  return store[provider] ?? null;
}

export function clearCredentials(provider: string): void {
  const store = readStore();
  delete store[provider];
  writeStore(store);
}

export function hasValidCredentials(provider: string): boolean {
  const creds = loadCredentials(provider);
  if (!creds) return false;
  // Consider valid if we have tokens (refresh can extend expired access tokens)
  return !!(creds.accessToken && creds.refreshToken);
}
