import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko, resolveCoinId } from './coingecko-api.js';
import { formatToolResult } from '../types.js';

const CryptoTokenInfoInputSchema = z.object({
  coin_id: z
    .string()
    .describe(
      "CoinGecko coin ID or common symbol. Examples: 'bitcoin', 'ethereum', 'solana'"
    ),
});

export const getCryptoTokenInfo = new DynamicStructuredTool({
  name: 'get_crypto_token_info',
  description: `Retrieves comprehensive cryptocurrency token information including description, categories, supply metrics (circulating, total, max), fully diluted valuation, all-time high/low, genesis date, community metrics (Twitter followers, Reddit subscribers, Telegram members), developer activity (GitHub stars, forks, commits), and relevant links. Use for tokenomics analysis, social/community evaluation, and token research.`,
  schema: CryptoTokenInfoInputSchema,
  func: async (input) => {
    const coinId = await resolveCoinId(input.coin_id);

    const { data, url } = await callCoinGecko(
      `/coins/${coinId}`,
      {
        localization: 'false',
        tickers: 'false',
        community_data: 'true',
        developer_data: 'true',
        sparkline: 'false',
      }
    );

    const coin = data as Record<string, unknown>;
    const marketData = (coin.market_data || {}) as Record<string, unknown>;
    const communityData = (coin.community_data || {}) as Record<string, unknown>;
    const developerData = (coin.developer_data || {}) as Record<string, unknown>;
    const links = (coin.links || {}) as Record<string, unknown>;

    // Extract price data from nested currency objects
    const extractUsd = (field: unknown): unknown => {
      if (field && typeof field === 'object' && 'usd' in (field as Record<string, unknown>)) {
        return (field as Record<string, unknown>).usd;
      }
      return null;
    };

    const result = {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      description: typeof (coin.description as Record<string, string>)?.en === 'string'
        ? (coin.description as Record<string, string>).en.slice(0, 500)
        : null,
      categories: coin.categories,
      market_cap_rank: coin.market_cap_rank,
      genesis_date: coin.genesis_date,
      hashing_algorithm: coin.hashing_algorithm,
      market_data: {
        current_price_usd: extractUsd(marketData.current_price),
        market_cap_usd: extractUsd(marketData.market_cap),
        total_volume_usd: extractUsd(marketData.total_volume),
        fully_diluted_valuation_usd: extractUsd(marketData.fully_diluted_valuation),
        circulating_supply: marketData.circulating_supply,
        total_supply: marketData.total_supply,
        max_supply: marketData.max_supply,
        ath_usd: extractUsd(marketData.ath),
        ath_date: (marketData.ath_date as Record<string, string>)?.usd || null,
        ath_change_percentage_usd: extractUsd(marketData.ath_change_percentage),
        atl_usd: extractUsd(marketData.atl),
        atl_date: (marketData.atl_date as Record<string, string>)?.usd || null,
        price_change_24h: marketData.price_change_24h,
        price_change_percentage_24h: marketData.price_change_percentage_24h,
        price_change_percentage_7d: marketData.price_change_percentage_7d,
        price_change_percentage_30d: marketData.price_change_percentage_30d,
        price_change_percentage_1y: marketData.price_change_percentage_1y,
      },
      community: {
        twitter_followers: communityData.twitter_followers ?? null,
        reddit_subscribers: communityData.reddit_subscribers ?? null,
        reddit_active_accounts_48h: communityData.reddit_accounts_active_48h ?? null,
        telegram_channel_user_count: communityData.telegram_channel_user_count ?? null,
      },
      developer: {
        github_forks: developerData.forks ?? null,
        github_stars: developerData.stars ?? null,
        github_subscribers: developerData.subscribers ?? null,
        github_total_issues: developerData.total_issues ?? null,
        github_closed_issues: developerData.closed_issues ?? null,
        github_pull_requests_merged: developerData.pull_requests_merged ?? null,
        commit_count_4_weeks: developerData.commit_count_4_weeks ?? null,
      },
      links: {
        homepage: Array.isArray(links.homepage)
          ? (links.homepage as string[]).filter(Boolean)
          : [],
        blockchain_site: Array.isArray(links.blockchain_site)
          ? (links.blockchain_site as string[]).filter(Boolean).slice(0, 3)
          : [],
        repos: (links.repos_url as Record<string, string[]>)?.github?.filter(Boolean) || [],
        twitter: (links as Record<string, string>).twitter_screen_name || null,
        subreddit: (links as Record<string, string>).subreddit_url || null,
      },
    };

    return formatToolResult(result, [url]);
  },
});
