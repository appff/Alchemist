import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko } from './coingecko-api.js';
import { formatToolResult } from '../types.js';

const CryptoDerivativesInputSchema = z.object({
  coin_symbol: z
    .string()
    .optional()
    .describe(
      "Optional coin symbol to filter derivatives (e.g. 'BTC', 'ETH'). If omitted, returns top derivatives across all coins."
    ),
});

interface DerivativeTicker {
  symbol: string;
  base: string;
  target: string;
  trade_url: string | null;
  contract_type: string;
  last: number;
  open_interest_usd: number;
  funding_rate: number;
  index: number;
  spread: number;
  h24_volume: number;
  converted_volume: Record<string, number>;
  expired_at: string | null;
  market: { name: string; identifier: string };
}

interface DerivativesExchange {
  name: string;
  id: string;
  open_interest_btc: number;
  trade_volume_24h_btc: string;
  number_of_perpetual_pairs: number;
  number_of_futures_pairs: number;
  year_established: number | null;
}

export const getCryptoDerivatives = new DynamicStructuredTool({
  name: 'get_crypto_derivatives',
  description: `Fetches cryptocurrency derivatives data including perpetual futures, open interest, funding rates, and spreads. Also includes exchange-level derivatives statistics. Useful for analyzing leveraged positions, market sentiment, and funding costs.`,
  schema: CryptoDerivativesInputSchema,
  func: async (input) => {
    const urls: string[] = [];

    // 1. Fetch derivatives tickers
    const { data: tickersRaw, url: tickersUrl } = await callCoinGecko(
      '/derivatives',
      {},
      { cacheable: false }
    );
    urls.push(tickersUrl);

    let tickers = tickersRaw as unknown as DerivativeTicker[];
    if (!Array.isArray(tickers)) {
      return formatToolResult({ error: 'Unexpected derivatives data format' }, urls);
    }

    // Filter by symbol if provided
    if (input.coin_symbol) {
      const symbol = input.coin_symbol.toUpperCase();
      tickers = tickers.filter(
        (t) =>
          t.base?.toUpperCase() === symbol ||
          t.symbol?.toUpperCase().includes(symbol)
      );
    }

    // Take top 20 by open interest
    const topTickers = tickers
      .sort((a, b) => (b.open_interest_usd || 0) - (a.open_interest_usd || 0))
      .slice(0, 20)
      .map((t) => ({
        symbol: t.symbol,
        exchange: t.market?.name || 'Unknown',
        contract_type: t.contract_type,
        last_price: t.last,
        index_price: t.index,
        spread_pct: t.spread != null ? Math.round(t.spread * 10000) / 10000 : null,
        funding_rate: t.funding_rate != null ? Math.round(t.funding_rate * 10000) / 10000 : null,
        open_interest_usd: t.open_interest_usd ? Math.round(t.open_interest_usd) : null,
        volume_24h_usd: t.converted_volume?.usd ? Math.round(t.converted_volume.usd) : null,
      }));

    // 2. Fetch derivatives exchanges
    let topExchanges: {
      name: string;
      open_interest_btc: number;
      volume_24h_btc: number;
      perpetual_pairs: number;
      futures_pairs: number;
    }[] = [];

    try {
      const { data: exchangesRaw, url: exchangesUrl } = await callCoinGecko(
        '/derivatives/exchanges',
        { per_page: 10, order: 'open_interest_btc_desc' },
        { cacheable: true }
      );
      urls.push(exchangesUrl);

      const exchanges = exchangesRaw as unknown as DerivativesExchange[];
      if (Array.isArray(exchanges)) {
        topExchanges = exchanges.slice(0, 10).map((e) => ({
          name: e.name,
          open_interest_btc: e.open_interest_btc || 0,
          volume_24h_btc: parseFloat(e.trade_volume_24h_btc) || 0,
          perpetual_pairs: e.number_of_perpetual_pairs || 0,
          futures_pairs: e.number_of_futures_pairs || 0,
        }));
      }
    } catch {
      // Non-critical — proceed without exchange data
    }

    // 3. Aggregate stats
    const totalOpenInterest = topTickers.reduce(
      (sum, t) => sum + (t.open_interest_usd || 0),
      0
    );
    const avgFundingRate =
      topTickers.filter((t) => t.funding_rate !== null).length > 0
        ? topTickers
            .filter((t) => t.funding_rate !== null)
            .reduce((sum, t) => sum + t.funding_rate!, 0) /
          topTickers.filter((t) => t.funding_rate !== null).length
        : null;

    const result = {
      filter: input.coin_symbol?.toUpperCase() || 'ALL',
      summary: {
        total_contracts_shown: topTickers.length,
        total_open_interest_usd: Math.round(totalOpenInterest),
        avg_funding_rate: avgFundingRate !== null ? Math.round(avgFundingRate * 10000) / 10000 : null,
        funding_sentiment:
          avgFundingRate === null
            ? 'unknown'
            : avgFundingRate > 0.0001
              ? 'bullish (longs paying shorts)'
              : avgFundingRate < -0.0001
                ? 'bearish (shorts paying longs)'
                : 'neutral',
      },
      top_contracts: topTickers,
      top_exchanges: topExchanges,
    };

    return formatToolResult(result, urls);
  },
});
