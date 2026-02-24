import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callDeFiLlama } from './defillama-api.js';
import { formatToolResult } from '../types.js';

const CryptoYieldsInputSchema = z.object({
  protocol: z
    .string()
    .optional()
    .describe(
      "Filter by protocol name. Examples: 'aave-v3', 'compound-v3', 'lido', 'rocket-pool'"
    ),
  chain: z
    .string()
    .optional()
    .describe("Filter by chain. Examples: 'Ethereum', 'Arbitrum', 'Solana', 'Base'"),
  token: z
    .string()
    .optional()
    .describe("Filter by token symbol in pool. Examples: 'ETH', 'USDC', 'WBTC'"),
  min_tvl_usd: z
    .number()
    .optional()
    .default(1000000)
    .describe('Minimum TVL in USD to filter low-liquidity pools. Defaults to $1,000,000.'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(20)
    .describe('Number of pools to return. Defaults to 20. Max 50.'),
});

export const getCryptoYields = new DynamicStructuredTool({
  name: 'get_crypto_yields',
  description: `Retrieves DeFi yield/APY data from DeFiLlama across protocols and chains. Filter by protocol, chain, or token symbol. Returns pools sorted by TVL. Use for finding yield opportunities, comparing lending rates, staking yields, and DeFi yield analysis.`,
  schema: CryptoYieldsInputSchema,
  func: async (input) => {
    // Fetch all pools from DeFiLlama yields API
    const { data: rawData, url } = await callDeFiLlama('/pools', {}, { useYieldsBase: true });

    const allPools = (rawData as { data?: unknown[] }).data || rawData;
    if (!Array.isArray(allPools)) {
      return formatToolResult({ error: 'Unexpected response format from yields API' }, [url]);
    }

    // Apply filters
    let filtered = allPools as Array<Record<string, unknown>>;

    // Filter by minimum TVL
    if (input.min_tvl_usd) {
      filtered = filtered.filter(
        (p) => typeof p.tvlUsd === 'number' && p.tvlUsd >= input.min_tvl_usd!
      );
    }

    // Filter by protocol
    if (input.protocol) {
      const proto = input.protocol.toLowerCase();
      filtered = filtered.filter(
        (p) => typeof p.project === 'string' && p.project.toLowerCase().includes(proto)
      );
    }

    // Filter by chain
    if (input.chain) {
      const chain = input.chain.toLowerCase();
      filtered = filtered.filter(
        (p) => typeof p.chain === 'string' && p.chain.toLowerCase() === chain
      );
    }

    // Filter by token symbol in pool
    if (input.token) {
      const token = input.token.toUpperCase();
      filtered = filtered.filter(
        (p) => typeof p.symbol === 'string' && p.symbol.toUpperCase().includes(token)
      );
    }

    // Sort by TVL descending, take top N
    filtered.sort((a, b) => ((b.tvlUsd as number) || 0) - ((a.tvlUsd as number) || 0));
    const limited = filtered.slice(0, input.limit);

    const pools = limited.map((p) => ({
      pool_id: p.pool,
      project: p.project,
      chain: p.chain,
      symbol: p.symbol,
      tvl_usd: Math.round(p.tvlUsd as number),
      apy: p.apy != null ? Math.round((p.apy as number) * 100) / 100 : null,
      apy_base: p.apyBase != null ? Math.round((p.apyBase as number) * 100) / 100 : null,
      apy_reward: p.apyReward != null ? Math.round((p.apyReward as number) * 100) / 100 : null,
      il_risk: p.ilRisk === 'yes' || p.ilRisk === true,
      stable_coin: p.stablecoin || false,
    }));

    const result = {
      total_matching_pools: filtered.length,
      pools_returned: pools.length,
      filters_applied: {
        protocol: input.protocol || null,
        chain: input.chain || null,
        token: input.token || null,
        min_tvl_usd: input.min_tvl_usd,
      },
      pools,
    };

    return formatToolResult(result, [url]);
  },
});
