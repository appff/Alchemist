import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko } from './coingecko-api.js';
import { formatToolResult } from '../types.js';

const CryptoMarketOverviewInputSchema = z.object({
  category: z
    .enum(['all', 'trending'])
    .default('all')
    .describe(
      "Market overview category. 'all' returns top tokens by market cap. 'trending' returns currently trending tokens."
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(20)
    .describe('Number of tokens to return for top tokens view. Defaults to 20. Max 50.'),
});

export const getCryptoMarketOverview = new DynamicStructuredTool({
  name: 'get_crypto_market_overview',
  description: `Retrieves crypto market overview including global market data (total market cap, BTC/ETH dominance, active cryptocurrencies) and top tokens by market cap or trending tokens. Use for broad market analysis, screening, and understanding market conditions.`,
  schema: CryptoMarketOverviewInputSchema,
  func: async (input) => {
    const urls: string[] = [];

    // Fetch global market data
    const { data: globalRaw, url: globalUrl } = await callCoinGecko('/global', {});
    urls.push(globalUrl);
    const globalData = (globalRaw as { data?: Record<string, unknown> }).data || globalRaw;

    const global = {
      total_market_cap_usd: (globalData.total_market_cap as Record<string, number>)?.usd || null,
      total_volume_24h_usd: (globalData.total_volume as Record<string, number>)?.usd || null,
      btc_dominance_pct: (globalData.market_cap_percentage as Record<string, number>)?.btc || null,
      eth_dominance_pct: (globalData.market_cap_percentage as Record<string, number>)?.eth || null,
      active_cryptocurrencies: globalData.active_cryptocurrencies,
      market_cap_change_24h_pct: globalData.market_cap_change_percentage_24h_usd,
    };

    let tokens: unknown[] = [];

    if (input.category === 'trending') {
      const { data: trendingRaw, url: trendingUrl } = await callCoinGecko(
        '/search/trending',
        {}
      );
      urls.push(trendingUrl);
      const coins = (trendingRaw as { coins?: Array<{ item: Record<string, unknown> }> }).coins || [];
      tokens = coins.map((c, i) => {
        const item = c.item;
        return {
          rank: i + 1,
          id: item.id,
          symbol: (item.symbol as string)?.toUpperCase(),
          name: item.name,
          market_cap_rank: item.market_cap_rank,
          price_btc: item.price_btc,
        };
      });
    } else {
      const { data: marketsRaw, url: marketsUrl } = await callCoinGecko('/coins/markets', {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: input.limit,
        page: 1,
        sparkline: 'false',
        price_change_percentage: '24h,7d',
      });
      urls.push(marketsUrl);
      const markets = marketsRaw as unknown as Array<Record<string, unknown>>;
      if (Array.isArray(markets)) {
        tokens = markets.map((m) => ({
          rank: m.market_cap_rank,
          id: m.id,
          symbol: (m.symbol as string)?.toUpperCase(),
          name: m.name,
          price_usd: m.current_price,
          market_cap_usd: m.market_cap,
          volume_24h_usd: m.total_volume,
          change_24h_pct: m.price_change_percentage_24h,
          change_7d_pct: m.price_change_percentage_7d_in_currency,
        }));
      }
    }

    const result = {
      category: input.category,
      global,
      tokens,
    };

    return formatToolResult(result, urls);
  },
});
