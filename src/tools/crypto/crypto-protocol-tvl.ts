import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callDeFiLlama } from './defillama-api.js';
import { formatToolResult } from '../types.js';

const CryptoProtocolTvlInputSchema = z.object({
  protocol: z
    .string()
    .describe(
      "DeFi protocol name (slug). Examples: 'aave', 'uniswap', 'lido', 'makerdao', 'compound-finance', 'curve-finance'"
    ),
  include_history: z
    .boolean()
    .default(false)
    .describe(
      'Whether to include historical TVL data points. Defaults to false (current TVL only).'
    ),
});

export const getCryptoProtocolTvl = new DynamicStructuredTool({
  name: 'get_crypto_protocol_tvl',
  description: `Retrieves Total Value Locked (TVL) data for a DeFi protocol from DeFiLlama, including breakdown by chain. Optionally includes historical TVL data. Use for evaluating protocol adoption, comparing DeFi protocols, and ecosystem analysis.`,
  schema: CryptoProtocolTvlInputSchema,
  func: async (input) => {
    const urls: string[] = [];
    const slug = input.protocol.toLowerCase().trim();

    // Fetch protocol details (includes current TVL + chain breakdown)
    const { data: protocolData, url: protocolUrl } = await callDeFiLlama(
      `/protocol/${slug}`
    );
    urls.push(protocolUrl);

    const protocol = protocolData as Record<string, unknown>;

    // Extract chain TVLs from currentChainTvls
    const chainTvls = (protocol.currentChainTvls || {}) as Record<string, number>;

    // Calculate total TVL from chain breakdown (more reliable than top-level tvl field)
    // Filter out staking/pool2/borrowed variants
    const coreChainTvls: Record<string, number> = {};
    let totalTvl = 0;
    for (const [chain, tvl] of Object.entries(chainTvls)) {
      if (!chain.includes('-') && typeof tvl === 'number') {
        coreChainTvls[chain] = Math.round(tvl);
        totalTvl += tvl;
      }
    }

    const result: Record<string, unknown> = {
      protocol: slug,
      name: protocol.name,
      tvl_usd: Math.round(totalTvl),
      category: protocol.category,
      chains: protocol.chains,
      chain_tvls: coreChainTvls,
      description: protocol.description,
      url: protocol.url,
      twitter: protocol.twitter,
      change_1d_pct: protocol.change_1d,
      change_7d_pct: protocol.change_7d,
      change_1m_pct: protocol.change_1m,
    };

    // Optionally fetch historical TVL
    if (input.include_history) {
      try {
        const { data: histData, url: histUrl } = await callDeFiLlama(
          `/tvl/${slug}`,
          {},
          { cacheable: true }
        );
        urls.push(histUrl);

        const histArray = histData as unknown as Array<{ date: number; totalLiquidityUSD: number }>;
        if (Array.isArray(histArray)) {
          // Sample to avoid massive payloads: take weekly data points
          const sampled = histArray.filter((_, i) => i % 7 === 0 || i === histArray.length - 1);
          result.tvl_history = sampled.map((d) => ({
            date: new Date(d.date * 1000).toISOString().split('T')[0],
            tvl_usd: Math.round(d.totalLiquidityUSD),
          }));
        }
      } catch {
        result.tvl_history = [];
      }
    }

    return formatToolResult(result, urls);
  },
});
