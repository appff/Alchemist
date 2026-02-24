import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Hardcoded map for common ticker symbols → CoinGecko IDs.
 * Avoids an extra search API call for well-known tokens.
 */
const SYMBOL_TO_ID: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  ada: 'cardano',
  dot: 'polkadot',
  avax: 'avalanche-2',
  matic: 'matic-network',
  pol: 'matic-network',
  link: 'chainlink',
  uni: 'uniswap',
  aave: 'aave',
  atom: 'cosmos',
  near: 'near',
  apt: 'aptos',
  sui: 'sui',
  arb: 'arbitrum',
  op: 'optimism',
  mkr: 'maker',
  snx: 'synthetix-network-token',
  comp: 'compound-governance-token',
  crv: 'curve-dao-token',
  ldo: 'lido-dao',
  doge: 'dogecoin',
  shib: 'shiba-inu',
  xrp: 'ripple',
  bnb: 'binancecoin',
  trx: 'tron',
  ton: 'the-open-network',
  ltc: 'litecoin',
  bch: 'bitcoin-cash',
  xlm: 'stellar',
  algo: 'algorand',
  ftm: 'fantom',
  fil: 'filecoin',
  icp: 'internet-computer',
  vet: 'vechain',
  hbar: 'hedera-hashgraph',
  mana: 'decentraland',
  sand: 'the-sandbox',
  axs: 'axie-infinity',
  grt: 'the-graph',
  enj: 'enjincoin',
  render: 'render-token',
  inj: 'injective-protocol',
  sei: 'sei-network',
  stx: 'blockstack',
  rune: 'thorchain',
  cake: 'pancakeswap-token',
  pepe: 'pepe',
  wif: 'dogwifcoin',
  bonk: 'bonk',
  jup: 'jupiter-exchange-solana',
  wbtc: 'wrapped-bitcoin',
  weth: 'weth',
  usdt: 'tether',
  usdc: 'usd-coin',
  dai: 'dai',
};

/**
 * Resolve a user-provided coin identifier to a CoinGecko ID.
 * Accepts: CoinGecko slug ("bitcoin"), ticker symbol ("BTC"), or mixed case.
 * Falls back to the CoinGecko search API for unknown tokens.
 */
export async function resolveCoinId(input: string): Promise<string> {
  const normalized = input.toLowerCase().trim();

  // Direct match on known IDs (user already passed a slug)
  if (Object.values(SYMBOL_TO_ID).includes(normalized)) {
    return normalized;
  }

  // Symbol lookup
  if (SYMBOL_TO_ID[normalized]) {
    return SYMBOL_TO_ID[normalized];
  }

  // Strip common suffixes like "-USD"
  const stripped = normalized.replace(/-usd$/i, '');
  if (SYMBOL_TO_ID[stripped]) {
    return SYMBOL_TO_ID[stripped];
  }

  // Fallback: search CoinGecko
  try {
    const url = `${BASE_URL}/search?query=${encodeURIComponent(normalized)}`;
    const response = await fetch(url, { headers: buildHeaders() });
    if (response.ok) {
      const data = await response.json();
      const coins = data.coins as Array<{ id: string; symbol: string; name: string }>;
      if (coins && coins.length > 0) {
        return coins[0].id;
      }
    }
  } catch {
    // Fall through to using the input as-is
  }

  // Last resort: return as-is and let CoinGecko return a 404
  return normalized;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) {
    headers['x-cg-demo-api-key'] = apiKey;
  }
  return headers;
}

export interface CoinGeckoApiResponse {
  data: Record<string, unknown>;
  url: string;
}

/**
 * Call the CoinGecko API with optional caching.
 * Follows the same pattern as src/tools/finance/api.ts.
 */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Call the CoinGecko API with optional caching and exponential backoff retry.
 * Retries on rate limits (429) and server errors (5xx) up to MAX_RETRIES times.
 */
export async function callCoinGecko(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  options?: { cacheable?: boolean }
): Promise<CoinGeckoApiResponse> {
  const label = describeRequest(endpoint, params);

  // Check local cache first
  if (options?.cacheable) {
    const cached = readCache(`coingecko${endpoint}`, params);
    if (cached) {
      return cached as CoinGeckoApiResponse;
    }
  }

  const url = new URL(`${BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      logger.warn(`[CoinGecko API] retrying ${label} in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), { headers: buildHeaders() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[CoinGecko API] network error: ${label} — ${message}`);
      lastError = new Error(`[CoinGecko API] request failed for ${label}: ${message}`);
      continue;
    }

    // Retry on rate limit
    if (response.status === 429) {
      logger.warn('[CoinGecko API] rate limited — consider setting COINGECKO_API_KEY');
      lastError = new Error('[CoinGecko API] Rate limited. Try again in a moment.');
      continue;
    }

    // Retry on server errors
    if (response.status >= 500) {
      const detail = `${response.status} ${response.statusText}`;
      logger.warn(`[CoinGecko API] server error: ${label} — ${detail}`);
      lastError = new Error(`[CoinGecko API] server error: ${detail}`);
      continue;
    }

    // Don't retry on 404 — it's a definitive "not found"
    if (response.status === 404) {
      throw new Error(`[CoinGecko API] Resource not found: ${label}`);
    }

    if (!response.ok) {
      const detail = `${response.status} ${response.statusText}`;
      logger.error(`[CoinGecko API] error: ${label} — ${detail}`);
      throw new Error(`[CoinGecko API] request failed: ${detail}`);
    }

    const data = await response.json().catch(() => {
      const detail = `invalid JSON (${response.status} ${response.statusText})`;
      logger.error(`[CoinGecko API] parse error: ${label} — ${detail}`);
      throw new Error(`[CoinGecko API] request failed: ${detail}`);
    });

    if (options?.cacheable) {
      writeCache(`coingecko${endpoint}`, params, data, url.toString());
    }

    return { data, url: url.toString() };
  }

  throw lastError || new Error(`[CoinGecko API] request failed after ${MAX_RETRIES + 1} attempts: ${label}`);
}
