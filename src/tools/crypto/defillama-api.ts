import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.llama.fi';
const YIELDS_BASE_URL = 'https://yields.llama.fi';
const FEES_BASE_URL = 'https://fees.llama.fi';

export interface DeFiLlamaApiResponse {
  data: Record<string, unknown>;
  url: string;
}

/**
 * Call the DeFiLlama API with optional caching.
 * DeFiLlama requires no API key.
 */
export async function callDeFiLlama(
  endpoint: string,
  params?: Record<string, string | number | string[] | undefined>,
  options?: { cacheable?: boolean; useYieldsBase?: boolean; useFeesBase?: boolean }
): Promise<DeFiLlamaApiResponse> {
  const safeParams = params || {};
  const label = describeRequest(endpoint, safeParams);

  if (options?.cacheable) {
    const cached = readCache(`defillama${endpoint}`, safeParams);
    if (cached) {
      return cached as DeFiLlamaApiResponse;
    }
  }

  const baseUrl = options?.useFeesBase ? FEES_BASE_URL : options?.useYieldsBase ? YIELDS_BASE_URL : BASE_URL;
  const url = new URL(`${baseUrl}${endpoint}`);

  for (const [key, value] of Object.entries(safeParams)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[DeFiLlama API] network error: ${label} — ${message}`);
    throw new Error(`[DeFiLlama API] request failed for ${label}: ${message}`);
  }

  if (response.status === 404) {
    throw new Error(`[DeFiLlama API] Protocol not found: ${label}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[DeFiLlama API] error: ${label} — ${detail}`);
    throw new Error(`[DeFiLlama API] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[DeFiLlama API] parse error: ${label} — ${detail}`);
    throw new Error(`[DeFiLlama API] request failed: ${detail}`);
  });

  if (options?.cacheable) {
    writeCache(`defillama${endpoint}`, safeParams, data, url.toString());
  }

  return { data, url: url.toString() };
}
