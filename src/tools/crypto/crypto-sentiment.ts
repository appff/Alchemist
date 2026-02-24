import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko, resolveCoinId } from './coingecko-api.js';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const CryptoSentimentInputSchema = z.object({
  coin_id: z
    .string()
    .optional()
    .describe(
      "Optional CoinGecko coin ID or symbol for token-specific sentiment. Examples: 'bitcoin', 'ETH', 'solana'"
    ),
  include_fear_greed: z
    .boolean()
    .default(true)
    .describe('Whether to include the Crypto Fear & Greed Index. Defaults to true.'),
});

interface FearGreedEntry {
  value: string;
  value_classification: string;
  timestamp: string;
}

export const getCryptoSentiment = new DynamicStructuredTool({
  name: 'get_crypto_sentiment',
  description: `Fetches crypto market sentiment data including the Fear & Greed Index (with 30-day trend) and token-specific social metrics (Twitter followers, Reddit subscribers, Telegram members). Use for gauging market mood and community health.`,
  schema: CryptoSentimentInputSchema,
  func: async (input) => {
    const urls: string[] = [];
    const result: Record<string, unknown> = {};

    // 1. Fetch Fear & Greed Index
    if (input.include_fear_greed) {
      try {
        const fngUrl = 'https://api.alternative.me/fng/?limit=30';
        urls.push(fngUrl);
        const response = await fetch(fngUrl, {
          headers: { accept: 'application/json' },
        });

        if (response.ok) {
          const fngData = await response.json();
          const entries = fngData.data as FearGreedEntry[];

          if (Array.isArray(entries) && entries.length > 0) {
            const current = entries[0];
            const currentValue = parseInt(current.value, 10);

            // Calculate 7-day trend
            const last7 = entries.slice(0, 7);
            const avg7d = last7.reduce((s, e) => s + parseInt(e.value, 10), 0) / last7.length;
            const trendDirection = currentValue > avg7d ? 'improving' : currentValue < avg7d ? 'worsening' : 'stable';

            result.fear_greed = {
              value: currentValue,
              classification: current.value_classification,
              trend_7d: {
                direction: trendDirection,
                average: Math.round(avg7d),
                current_vs_average: Math.round(currentValue - avg7d),
              },
              history_30d: entries.slice(0, 10).map((e) => ({
                value: parseInt(e.value, 10),
                classification: e.value_classification,
                date: new Date(parseInt(e.timestamp, 10) * 1000).toISOString().split('T')[0],
              })),
            };
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[Sentiment] Fear & Greed fetch failed: ${message}`);
        result.fear_greed = { error: 'Failed to fetch Fear & Greed Index' };
      }
    }

    // 2. Fetch token-specific social/community metrics
    if (input.coin_id) {
      try {
        const coinId = await resolveCoinId(input.coin_id);
        const { data, url } = await callCoinGecko(`/coins/${coinId}`, {
          localization: 'false',
          tickers: 'false',
          market_data: 'false',
          community_data: 'true',
          developer_data: 'false',
          sparkline: 'false',
        });
        urls.push(url);

        const coin = data as Record<string, unknown>;
        const communityData = (coin.community_data || {}) as Record<string, unknown>;
        const sentimentUp = coin.sentiment_votes_up_percentage as number | null;
        const sentimentDown = coin.sentiment_votes_down_percentage as number | null;

        result.social_metrics = {
          coin_id: coinId,
          name: coin.name,
          symbol: coin.symbol,
          twitter_followers: communityData.twitter_followers ?? null,
          reddit_subscribers: communityData.reddit_subscribers ?? null,
          reddit_active_accounts_48h: communityData.reddit_accounts_active_48h ?? null,
          telegram_members: communityData.telegram_channel_user_count ?? null,
          coingecko_sentiment: sentimentUp != null ? {
            up_percentage: sentimentUp,
            down_percentage: sentimentDown,
          } : null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.social_metrics = { error: `Failed to fetch social data for '${input.coin_id}': ${message}` };
      }
    }

    // 3. Build sentiment summary
    const summaryParts: string[] = [];

    if (result.fear_greed && !(result.fear_greed as Record<string, unknown>).error) {
      const fg = result.fear_greed as Record<string, unknown>;
      summaryParts.push(
        `Market Fear & Greed Index: ${fg.value}/100 (${fg.classification}), trend is ${(fg.trend_7d as Record<string, unknown>).direction}.`
      );
    }

    if (result.social_metrics && !(result.social_metrics as Record<string, unknown>).error) {
      const sm = result.social_metrics as Record<string, unknown>;
      const parts: string[] = [];
      if (sm.twitter_followers) parts.push(`${Number(sm.twitter_followers).toLocaleString()} Twitter followers`);
      if (sm.reddit_subscribers) parts.push(`${Number(sm.reddit_subscribers).toLocaleString()} Reddit subscribers`);
      if (sm.telegram_members) parts.push(`${Number(sm.telegram_members).toLocaleString()} Telegram members`);
      if (parts.length > 0) {
        summaryParts.push(`${sm.name} community: ${parts.join(', ')}.`);
      }
    }

    if (summaryParts.length > 0) {
      result.sentiment_summary = summaryParts.join(' ');
    }

    return formatToolResult(result, urls);
  },
});
