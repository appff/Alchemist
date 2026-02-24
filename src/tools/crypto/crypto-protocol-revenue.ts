import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callDeFiLlama } from './defillama-api.js';
import { formatToolResult } from '../types.js';

const CryptoProtocolRevenueInputSchema = z.object({
  protocol: z
    .string()
    .describe(
      "DeFi protocol name (slug). Examples: 'aave', 'uniswap', 'lido', 'makerdao', 'gmx'"
    ),
});

export const getCryptoProtocolRevenue = new DynamicStructuredTool({
  name: 'get_crypto_protocol_revenue',
  description: `Retrieves protocol fee and revenue data from DeFiLlama. Shows total fees collected and protocol revenue (fees retained by the protocol vs paid to LPs/stakers). Use for protocol profitability analysis, comparing protocol business models, and evaluating fee generation.`,
  schema: CryptoProtocolRevenueInputSchema,
  func: async (input) => {
    const slug = input.protocol.toLowerCase().trim();

    const { data, url } = await callDeFiLlama(
      `/summary/fees/${slug}`,
      {},
      { useFeesBase: true }
    );

    const feesData = data as Record<string, unknown>;

    const result = {
      protocol: slug,
      name: feesData.name || slug,
      total_fees_24h_usd: feesData.total24h,
      total_fees_7d_usd: feesData.total7d,
      total_fees_30d_usd: feesData.total30d,
      total_fees_all_time_usd: feesData.totalAllTime,
      revenue_24h_usd: feesData.revenue24h,
      revenue_7d_usd: feesData.revenue7d,
      revenue_30d_usd: feesData.revenue30d,
      revenue_all_time_usd: feesData.revenueAllTime,
      category: feesData.category,
      chains: feesData.chains,
      methodology: feesData.methodology,
    };

    return formatToolResult(result, [url]);
  },
});
