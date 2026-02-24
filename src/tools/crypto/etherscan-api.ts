import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.etherscan.io/api';

/** Simple rate limiter: track last call time to respect ~5 calls/sec free tier */
let lastCallTime = 0;
const MIN_INTERVAL_MS = 220; // ~4.5 calls/sec to stay safely under 5/sec

export interface EtherscanApiResponse {
  data: Record<string, unknown>;
  url: string;
}

/**
 * Call the Etherscan API.
 * Requires ETHERSCAN_API_KEY env var for most endpoints.
 */
export async function callEtherscan(
  module: string,
  action: string,
  params?: Record<string, string>
): Promise<EtherscanApiResponse> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[Etherscan API] ETHERSCAN_API_KEY is not set. ' +
      'Get a free key at https://etherscan.io/apis and add ETHERSCAN_API_KEY to your .env file.'
    );
  }

  // Rate limit: wait if needed
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastCallTime = Date.now();

  const url = new URL(BASE_URL);
  url.searchParams.set('module', module);
  url.searchParams.set('action', action);
  url.searchParams.set('apikey', apiKey);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }
  }

  const label = `${module}/${action}`;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Etherscan API] network error: ${label} — ${message}`);
    throw new Error(`[Etherscan API] request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[Etherscan API] error: ${label} — ${detail}`);
    throw new Error(`[Etherscan API] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[Etherscan API] parse error: ${label} — ${detail}`);
    throw new Error(`[Etherscan API] request failed: ${detail}`);
  });

  // Etherscan returns { status: "1", message: "OK", result: ... } on success
  // and { status: "0", message: "NOTOK", result: "error message" } on failure
  if (data.status === '0' && data.message === 'NOTOK') {
    throw new Error(`[Etherscan API] ${label}: ${data.result}`);
  }

  return { data, url: url.toString() };
}
