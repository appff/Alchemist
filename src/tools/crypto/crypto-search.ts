import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Import crypto sub-tools directly (avoid circular deps with index.ts)
import { getCryptoPrice } from './crypto-price.js';
import { getCryptoHistoricalPrices } from './crypto-historical.js';
import { getCryptoTokenInfo } from './crypto-token-info.js';
import { getCryptoMarketOverview } from './crypto-market-overview.js';
import { getCryptoProtocolTvl } from './crypto-protocol-tvl.js';
import { getCryptoProtocolRevenue } from './crypto-protocol-revenue.js';
import { getCryptoYields } from './crypto-yields.js';
import { getCryptoOnchain } from './crypto-onchain.js';
import { getCryptoSentiment } from './crypto-sentiment.js';
import { getCryptoTechnical } from './crypto-technical.js';
import { getCryptoDerivatives } from './crypto-derivatives.js';
import { getCryptoCorrelation } from './crypto-correlation.js';
import { getCryptoMonitor } from './crypto-monitor.js';
import { getCryptoAlerts } from './crypto-alerts.js';

// All crypto sub-tools available for routing
const CRYPTO_TOOLS: StructuredToolInterface[] = [
  getCryptoPrice,
  getCryptoHistoricalPrices,
  getCryptoTokenInfo,
  getCryptoMarketOverview,
  getCryptoProtocolTvl,
  getCryptoProtocolRevenue,
  getCryptoYields,
  getCryptoOnchain,
  getCryptoSentiment,
  getCryptoTechnical,
  getCryptoDerivatives,
  getCryptoCorrelation,
  getCryptoMonitor,
  getCryptoAlerts,
];

// Create a map for quick tool lookup by name
const CRYPTO_TOOL_MAP = new Map(CRYPTO_TOOLS.map(t => [t.name, t]));

// Build the router system prompt
function buildCryptoRouterPrompt(): string {
  return `You are a crypto data routing assistant.
Current date: ${getCurrentDate()}

Given a user query about cryptocurrency or DeFi data, call the appropriate tool(s).

## Guidelines

1. **Token Resolution**: Convert common symbols to CoinGecko IDs:
   - BTC → bitcoin, ETH → ethereum, SOL → solana, AVAX → avalanche-2
   - ADA → cardano, DOT → polkadot, MATIC → matic-network
   - LINK → chainlink, UNI → uniswap, AAVE → aave
   - DOGE → dogecoin, XRP → ripple, BNB → binancecoin

2. **Protocol Resolution**: Convert names to DeFiLlama slugs:
   - Uniswap → uniswap, Aave → aave, Lido → lido, MakerDAO → makerdao
   - Compound → compound-finance, Curve → curve-finance, GMX → gmx

3. **Tool Selection**:
   - Price check → get_crypto_price
   - Historical prices/charts/trend → get_crypto_historical_prices
   - Token details/tokenomics/supply → get_crypto_token_info
   - Market overview/top coins/trending → get_crypto_market_overview
   - Protocol TVL → get_crypto_protocol_tvl
   - Protocol fees/revenue → get_crypto_protocol_revenue
   - DeFi yields/APY/lending rates → get_crypto_yields
   - On-chain holder data/whale analysis → get_crypto_onchain (requires token contract address)
   - Market sentiment/Fear & Greed → get_crypto_sentiment
   - Social metrics/community data → get_crypto_sentiment (with coin_id)
   - Technical analysis/indicators (SMA, RSI, MACD, Bollinger) → get_crypto_technical
   - Derivatives/futures/perpetuals/open interest/funding rates → get_crypto_derivatives
   - Comprehensive token analysis → get_crypto_price + get_crypto_token_info
   - Full sentiment analysis → get_crypto_sentiment + get_crypto_price
   - Full technical + price analysis → get_crypto_technical + get_crypto_price
   - Derivatives market overview → get_crypto_derivatives (no coin_symbol)
   - Correlation between two assets → get_crypto_correlation (crypto-to-crypto or crypto-to-stock)
   - Monitor multiple coins / watchlist → get_crypto_monitor (batch price check with alerts)
   - Market scan / top movers / alerts → get_crypto_alerts (scans top tokens for notable events)
   - DeFi protocol analysis → get_crypto_protocol_tvl + get_crypto_protocol_revenue
   - Portfolio risk analysis → get_crypto_correlation + get_crypto_monitor

4. **Efficiency**:
   - For comparisons between tokens, call the same tool for each token
   - Use get_crypto_token_info when user asks "tell me about X" or "what is X"
   - Combine price + token_info for investment research queries
   - For DeFi protocol deep dives, combine TVL + revenue + yields

Call the appropriate tool(s) now.`;
}

// Input schema for the crypto_search tool
const CryptoSearchInputSchema = z.object({
  query: z.string().describe('Natural language query about cryptocurrency or DeFi data'),
});

/**
 * Create a crypto_search tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to crypto sub-tools.
 * Follows the exact same pattern as createFinancialSearch.
 */
export function createCryptoSearch(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'crypto_search',
    description: `Intelligent agentic search for cryptocurrency and DeFi data. Takes a natural language query and automatically routes to appropriate crypto data tools. Use for:
- Cryptocurrency prices (current and historical)
- Token information (supply, market cap, FDV, categories, links)
- Technical analysis (SMA, RSI, MACD, Bollinger Bands)
- Derivatives data (futures, perpetuals, open interest, funding rates)
- Cross-asset correlation (crypto-to-crypto or crypto-to-stock)
- Real-time monitoring and price alerts for multiple coins
- Market-wide alerts (top movers, Fear & Greed, volume spikes)
- DeFi protocol TVL (Total Value Locked)
- Protocol fees and revenue
- DeFi yields and APY
- Market overview (top tokens, trending, dominance)
- Crypto market comparisons
- Tokenomics analysis`,
    schema: CryptoSearchInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with crypto tools bound (native tool calling)
      onProgress?.('Searching...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildCryptoRouterPrompt(),
        tools: CRYPTO_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = toolCalls.map(tc => formatSubToolName(tc.name));
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = CRYPTO_TOOL_MAP.get(tc.name);
            if (!tool) {
              throw new Error(`Tool '${tc.name}' not found`);
            }
            const rawResult = await tool.invoke(tc.args);
            const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            const parsed = JSON.parse(result);
            return {
              tool: tc.name,
              args: tc.args,
              data: parsed.data,
              sourceUrls: parsed.sourceUrls || [],
              error: null,
            };
          } catch (error) {
            return {
              tool: tc.name,
              args: tc.args,
              data: null,
              sourceUrls: [],
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      // 4. Combine results
      const successfulResults = results.filter((r) => r.error === null);
      const failedResults = results.filter((r) => r.error !== null);

      // Collect all source URLs
      const allUrls = results.flatMap((r) => r.sourceUrls);

      // Build combined data structure
      const combinedData: Record<string, unknown> = {};

      for (const result of successfulResults) {
        // Use tool name as key, or tool_coinId for multiple calls to same tool
        const coinId = (result.args as Record<string, unknown>).coin_id as string | undefined;
        const protocol = (result.args as Record<string, unknown>).protocol as string | undefined;
        const identifier = coinId || protocol;
        const key = identifier ? `${result.tool}_${identifier}` : result.tool;
        combinedData[key] = result.data;
      }

      // Add errors if any
      if (failedResults.length > 0) {
        combinedData._errors = failedResults.map((r) => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
      }

      return formatToolResult(combinedData, allUrls);
    },
  });
}
