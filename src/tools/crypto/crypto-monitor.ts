import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko, resolveCoinId } from './coingecko-api.js';
import { formatToolResult } from '../types.js';

const CryptoMonitorInputSchema = z.object({
  coin_ids: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe(
      "Array of CoinGecko coin IDs or symbols to monitor (max 10). Examples: ['bitcoin', 'ethereum', 'solana']"
    ),
  thresholds: z
    .record(z.string(), z.object({
      above: z.number().optional().describe('Alert if price is above this value (USD)'),
      below: z.number().optional().describe('Alert if price is below this value (USD)'),
    }))
    .optional()
    .describe(
      "Optional price thresholds per coin_id. Example: { 'bitcoin': { above: 100000, below: 50000 } }"
    ),
});

interface MonitorEntry {
  coin_id: string;
  price: number;
  change_24h_pct: number | null;
  volume_24h: number | null;
  market_cap: number | null;
  alerts: string[];
}

export const getCryptoMonitor = new DynamicStructuredTool({
  name: 'get_crypto_monitor',
  description: `Monitors multiple cryptocurrencies simultaneously, checking for notable price conditions. Reports current prices, 24h changes, and generates alerts for significant moves (>5%), threshold breaches, and volume spikes. Use for portfolio monitoring and watchlist tracking.`,
  schema: CryptoMonitorInputSchema,
  func: async (input) => {
    // Resolve all coin IDs
    const resolvedIds = await Promise.all(
      input.coin_ids.map((id) => resolveCoinId(id))
    );
    const idList = resolvedIds.join(',');

    // Batch fetch current prices via /coins/markets (richer data than /simple/price)
    const { data, url } = await callCoinGecko('/coins/markets', {
      vs_currency: 'usd',
      ids: idList,
      order: 'market_cap_desc',
      per_page: '10',
      sparkline: 'false',
      price_change_percentage: '24h',
    });

    const markets = data as unknown as Array<Record<string, unknown>>;
    if (!Array.isArray(markets)) {
      return formatToolResult({ error: 'Failed to fetch market data' }, [url]);
    }

    // Build lookup from original input → resolved ID for threshold matching
    const inputToResolved = new Map<string, string>();
    for (let i = 0; i < input.coin_ids.length; i++) {
      inputToResolved.set(input.coin_ids[i].toLowerCase(), resolvedIds[i]);
    }

    const entries: MonitorEntry[] = markets.map((coin) => {
      const coinId = coin.id as string;
      const price = coin.current_price as number;
      const change24h = coin.price_change_percentage_24h as number | null;
      const volume24h = coin.total_volume as number | null;
      const marketCap = coin.market_cap as number | null;

      const alerts: string[] = [];

      // Check 24h change significance
      if (change24h !== null) {
        if (Math.abs(change24h) > 10) {
          alerts.push(`Major ${change24h > 0 ? 'gain' : 'loss'}: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}% in 24h`);
        } else if (Math.abs(change24h) > 5) {
          alerts.push(`Significant ${change24h > 0 ? 'gain' : 'loss'}: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}% in 24h`);
        }
      }

      // Check user-provided thresholds
      if (input.thresholds) {
        // Find the threshold entry matching this coin (by original input or resolved ID)
        for (const [key, threshold] of Object.entries(input.thresholds)) {
          const resolvedKey = inputToResolved.get(key.toLowerCase());
          if (resolvedKey === coinId || key.toLowerCase() === coinId) {
            if (threshold.above !== undefined && price > threshold.above) {
              alerts.push(`Price $${price.toLocaleString()} is ABOVE threshold $${threshold.above.toLocaleString()}`);
            }
            if (threshold.below !== undefined && price < threshold.below) {
              alerts.push(`Price $${price.toLocaleString()} is BELOW threshold $${threshold.below.toLocaleString()}`);
            }
          }
        }
      }

      // ATH check
      const ath = coin.ath as number | undefined;
      if (ath && price >= ath * 0.95) {
        alerts.push(price >= ath ? 'At ALL-TIME HIGH' : `Within 5% of ATH ($${ath.toLocaleString()})`);
      }

      return {
        coin_id: coinId,
        price,
        change_24h_pct: change24h ? Math.round(change24h * 100) / 100 : null,
        volume_24h: volume24h,
        market_cap: marketCap,
        alerts,
      };
    });

    const alertCount = entries.reduce((sum, e) => sum + e.alerts.length, 0);

    const result = {
      monitored: entries.length,
      total_alerts: alertCount,
      coins: entries,
    };

    return formatToolResult(result, [url]);
  },
});
