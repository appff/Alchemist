import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko, resolveCoinId } from './coingecko-api.js';
import { formatToolResult } from '../types.js';

const CryptoPriceInputSchema = z.object({
  coin_id: z
    .string()
    .describe(
      "CoinGecko coin ID or common symbol. Examples: 'bitcoin', 'ethereum', 'BTC', 'ETH', 'solana'"
    ),
  vs_currency: z
    .enum(['usd', 'eur', 'btc', 'eth'])
    .default('usd')
    .describe("Currency to price against. Defaults to 'usd'."),
});

export const getCryptoPrice = new DynamicStructuredTool({
  name: 'get_crypto_price',
  description: `Fetches current cryptocurrency price with market cap, 24h trading volume, and price change percentages (24h, 7d, 30d). Use for quick price checks and market snapshots.`,
  schema: CryptoPriceInputSchema,
  func: async (input) => {
    const coinId = await resolveCoinId(input.coin_id);
    const vs = input.vs_currency;

    const { data, url } = await callCoinGecko('/simple/price', {
      ids: coinId,
      vs_currencies: vs,
      include_market_cap: 'true',
      include_24hr_vol: 'true',
      include_24hr_change: 'true',
      include_last_updated_at: 'true',
    });

    const coinData = (data as Record<string, Record<string, unknown>>)[coinId];
    if (!coinData) {
      return formatToolResult({ error: `No data found for '${input.coin_id}'` }, [url]);
    }

    // Fetch additional change data (7d, 30d) from /coins/markets
    let change7d: number | null = null;
    let change30d: number | null = null;
    try {
      const { data: marketsData } = await callCoinGecko('/coins/markets', {
        vs_currency: vs,
        ids: coinId,
        price_change_percentage: '7d,30d',
      });
      const markets = marketsData as unknown as Array<Record<string, unknown>>;
      if (Array.isArray(markets) && markets.length > 0) {
        change7d = markets[0].price_change_percentage_7d_in_currency as number | null;
        change30d = markets[0].price_change_percentage_30d_in_currency as number | null;
      }
    } catch {
      // Non-critical — proceed without 7d/30d data
    }

    const result = {
      coin_id: coinId,
      vs_currency: vs,
      price: coinData[vs],
      market_cap: coinData[`${vs}_market_cap`],
      volume_24h: coinData[`${vs}_24h_vol`],
      change_24h_pct: coinData[`${vs}_24h_change`],
      change_7d_pct: change7d,
      change_30d_pct: change30d,
      last_updated: coinData.last_updated_at
        ? new Date((coinData.last_updated_at as number) * 1000).toISOString()
        : null,
    };

    return formatToolResult(result, [url]);
  },
});
