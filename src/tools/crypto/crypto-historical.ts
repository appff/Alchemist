import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko, resolveCoinId } from './coingecko-api.js';
import { formatToolResult } from '../types.js';

const CryptoHistoricalInputSchema = z.object({
  coin_id: z
    .string()
    .describe(
      "CoinGecko coin ID or common symbol. Examples: 'bitcoin', 'ethereum', 'solana'"
    ),
  vs_currency: z
    .enum(['usd', 'eur', 'btc', 'eth'])
    .default('usd')
    .describe("Currency to price against. Defaults to 'usd'."),
  days: z
    .union([
      z.literal(1),
      z.literal(7),
      z.literal(14),
      z.literal(30),
      z.literal(90),
      z.literal(180),
      z.literal(365),
      z.literal('max'),
    ])
    .describe(
      "Number of days of historical data. Options: 1, 7, 14, 30, 90, 180, 365, 'max'."
    ),
});

export const getCryptoHistoricalPrices = new DynamicStructuredTool({
  name: 'get_crypto_historical_prices',
  description: `Retrieves historical cryptocurrency price and volume data over a specified period. Returns timestamped price and volume arrays. Useful for trend analysis, performance tracking, and price chart data.`,
  schema: CryptoHistoricalInputSchema,
  func: async (input) => {
    const coinId = await resolveCoinId(input.coin_id);

    // Historical data for fully closed periods is cacheable
    const { data, url } = await callCoinGecko(
      `/coins/${coinId}/market_chart`,
      {
        vs_currency: input.vs_currency,
        days: input.days,
      },
      { cacheable: typeof input.days === 'number' && input.days >= 30 }
    );

    const rawPrices = (data as { prices?: number[][] }).prices || [];
    const rawVolumes = (data as { total_volumes?: number[][] }).total_volumes || [];

    // Convert [timestamp_ms, value] arrays to readable objects
    const prices = rawPrices.map(([ts, price]) => ({
      timestamp: new Date(ts).toISOString(),
      price: Math.round(price * 100) / 100,
    }));

    const volumes = rawVolumes.map(([ts, volume]) => ({
      timestamp: new Date(ts).toISOString(),
      volume: Math.round(volume),
    }));

    const result = {
      coin_id: coinId,
      vs_currency: input.vs_currency,
      days: input.days,
      data_points: prices.length,
      prices,
      total_volumes: volumes,
    };

    return formatToolResult(result, [url]);
  },
});
