import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko } from './coingecko-api.js';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const CryptoAlertsInputSchema = z.object({
  limit: z
    .number()
    .min(10)
    .max(100)
    .default(50)
    .describe('Number of top tokens to scan (default 50, max 100).'),
});

interface AlertToken {
  coin_id: string;
  name: string;
  symbol: string;
  price: number;
  change_24h_pct: number;
  volume_24h: number;
  market_cap: number;
}

export const getCryptoAlerts = new DynamicStructuredTool({
  name: 'get_crypto_alerts',
  description: `Scans the crypto market for notable events and alerts. Identifies top gainers (>10%), top losers (>10%), volume spikes, and coins near all-time highs. Also fetches the Fear & Greed Index. Use for market-wide monitoring and opportunity discovery.`,
  schema: CryptoAlertsInputSchema,
  func: async (input) => {
    const sourceUrls: string[] = [];

    // Fetch top tokens by market cap
    const { data: marketsData, url: marketsUrl } = await callCoinGecko('/coins/markets', {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: String(input.limit),
      sparkline: 'false',
      price_change_percentage: '24h,7d',
    });
    sourceUrls.push(marketsUrl);

    const markets = marketsData as unknown as Array<Record<string, unknown>>;
    if (!Array.isArray(markets)) {
      return formatToolResult({ error: 'Failed to fetch market data' }, sourceUrls);
    }

    // Categorize tokens
    const topGainers: AlertToken[] = [];
    const topLosers: AlertToken[] = [];
    const nearAth: AlertToken[] = [];

    for (const coin of markets) {
      const change24h = coin.price_change_percentage_24h as number | null;
      const price = coin.current_price as number;
      const ath = coin.ath as number | undefined;

      const token: AlertToken = {
        coin_id: coin.id as string,
        name: coin.name as string,
        symbol: (coin.symbol as string).toUpperCase(),
        price,
        change_24h_pct: change24h ? Math.round(change24h * 100) / 100 : 0,
        volume_24h: coin.total_volume as number,
        market_cap: coin.market_cap as number,
      };

      if (change24h !== null) {
        if (change24h >= 10) {
          topGainers.push(token);
        } else if (change24h <= -10) {
          topLosers.push(token);
        }
      }

      // Near ATH (within 5%)
      if (ath && price >= ath * 0.95) {
        nearAth.push(token);
      }
    }

    // Sort by magnitude
    topGainers.sort((a, b) => b.change_24h_pct - a.change_24h_pct);
    topLosers.sort((a, b) => a.change_24h_pct - b.change_24h_pct);

    // Fetch Fear & Greed Index from Alternative.me
    let fearGreed: { value: number; classification: string } | null = null;
    try {
      const response = await fetch('https://api.alternative.me/fng/?limit=1');
      if (response.ok) {
        const fngData = await response.json() as { data?: Array<{ value: string; value_classification: string }> };
        if (fngData.data && fngData.data.length > 0) {
          fearGreed = {
            value: parseInt(fngData.data[0].value, 10),
            classification: fngData.data[0].value_classification,
          };
          sourceUrls.push('https://api.alternative.me/fng/');
        }
      }
    } catch (error) {
      logger.warn(`[CryptoAlerts] Failed to fetch Fear & Greed Index: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Compute market summary
    const totalMarketCap = markets.reduce((sum, c) => sum + ((c.market_cap as number) || 0), 0);
    const totalVolume = markets.reduce((sum, c) => sum + ((c.total_volume as number) || 0), 0);
    const avgChange = markets.reduce((sum, c) => sum + ((c.price_change_percentage_24h as number) || 0), 0) / markets.length;

    const notableEvents: string[] = [];
    if (fearGreed) {
      if (fearGreed.value <= 20) notableEvents.push(`Extreme Fear (${fearGreed.value}) — potential buying opportunity`);
      if (fearGreed.value >= 80) notableEvents.push(`Extreme Greed (${fearGreed.value}) — market may be overheated`);
    }
    if (topGainers.length >= 5) notableEvents.push(`${topGainers.length} tokens with >10% gains — broad rally`);
    if (topLosers.length >= 5) notableEvents.push(`${topLosers.length} tokens with >10% losses — broad selloff`);
    if (Math.abs(avgChange) > 5) notableEvents.push(`Market-wide average move of ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)}%`);

    const result = {
      market_fear_greed: fearGreed,
      market_summary: {
        tokens_scanned: markets.length,
        total_market_cap: totalMarketCap,
        total_24h_volume: totalVolume,
        avg_24h_change_pct: Math.round(avgChange * 100) / 100,
      },
      top_gainers: topGainers.slice(0, 10),
      top_losers: topLosers.slice(0, 10),
      near_all_time_high: nearAth,
      notable_events: notableEvents,
    };

    return formatToolResult(result, sourceUrls);
  },
});
