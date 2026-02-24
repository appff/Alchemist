import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko, resolveCoinId } from './coingecko-api.js';
import { callApi } from '../finance/api.js';
import { formatToolResult } from '../types.js';

const CryptoCorrelationInputSchema = z.object({
  asset_a: z
    .string()
    .describe(
      "First asset: CoinGecko coin ID or symbol (e.g. 'bitcoin', 'ETH')"
    ),
  asset_b: z
    .string()
    .describe(
      "Second asset: CoinGecko coin ID/symbol OR a stock ticker (e.g. 'AAPL', 'SPY'). Stock tickers require FINANCIAL_DATASETS_API_KEY."
    ),
  days: z
    .union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)])
    .describe('Number of days to compute correlation over.'),
});

/** Detect whether an identifier looks like a stock ticker (all uppercase, 1-5 letters). */
function looksLikeStockTicker(id: string): boolean {
  return /^[A-Z]{1,5}$/.test(id.trim());
}

/** Compute daily log-returns from an array of prices. */
function dailyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    } else {
      returns.push(0);
    }
  }
  return returns;
}

/** Pearson correlation coefficient between two equal-length arrays. */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/** Interpret a correlation coefficient. */
function interpretCorrelation(r: number): string {
  const abs = Math.abs(r);
  const direction = r >= 0 ? 'positive' : 'negative';
  if (abs >= 0.7) return `strong ${direction}`;
  if (abs >= 0.3) return `moderate ${direction}`;
  if (abs >= 0.1) return `weak ${direction}`;
  return 'negligible';
}

/** Fetch daily prices from CoinGecko market_chart. Returns array of daily close prices. */
async function fetchCryptoPrices(coinId: string, days: number): Promise<{ prices: number[]; urls: string[] }> {
  const resolved = await resolveCoinId(coinId);
  const { data, url } = await callCoinGecko(
    `/coins/${resolved}/market_chart`,
    { vs_currency: 'usd', days },
    { cacheable: days >= 30 }
  );

  const rawPrices = (data as { prices?: number[][] }).prices || [];
  return {
    prices: rawPrices.map(([, price]) => price),
    urls: [url],
  };
}

/** Fetch daily stock prices from Financial Datasets API. Returns array of close prices. */
async function fetchStockPrices(ticker: string, days: number): Promise<{ prices: number[]; urls: string[] }> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, url } = await callApi('/prices/', {
    ticker: ticker.toUpperCase(),
    interval: 'day',
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  });

  const prices = data.prices as Array<{ close: number }> | undefined;
  if (!prices || prices.length === 0) {
    throw new Error(`No stock price data returned for ${ticker}. Ensure FINANCIAL_DATASETS_API_KEY is set.`);
  }

  return {
    prices: prices.map((p) => p.close),
    urls: [url],
  };
}

export const getCryptoCorrelation = new DynamicStructuredTool({
  name: 'get_crypto_correlation',
  description: `Computes the Pearson correlation coefficient between two assets based on daily returns over a specified period. Supports crypto-to-crypto and crypto-to-stock correlations. Useful for portfolio diversification analysis.`,
  schema: CryptoCorrelationInputSchema,
  func: async (input) => {
    const sourceUrls: string[] = [];
    const isStockB = looksLikeStockTicker(input.asset_b);

    // Fetch prices for both assets
    let pricesA: number[];
    let pricesB: number[];

    try {
      const resultA = await fetchCryptoPrices(input.asset_a, input.days);
      pricesA = resultA.prices;
      sourceUrls.push(...resultA.urls);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: `Failed to fetch prices for ${input.asset_a}: ${msg}` }, sourceUrls);
    }

    try {
      if (isStockB) {
        const resultB = await fetchStockPrices(input.asset_b, input.days);
        pricesB = resultB.prices;
        sourceUrls.push(...resultB.urls);
      } else {
        const resultB = await fetchCryptoPrices(input.asset_b, input.days);
        pricesB = resultB.prices;
        sourceUrls.push(...resultB.urls);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return formatToolResult({
        error: `Failed to fetch prices for ${input.asset_b}: ${msg}`,
        note: isStockB ? 'Stock data requires FINANCIAL_DATASETS_API_KEY.' : undefined,
      }, sourceUrls);
    }

    // Compute daily returns
    const returnsA = dailyReturns(pricesA);
    const returnsB = dailyReturns(pricesB);

    // Align to the shorter series
    const len = Math.min(returnsA.length, returnsB.length);
    const alignedA = returnsA.slice(returnsA.length - len);
    const alignedB = returnsB.slice(returnsB.length - len);

    if (len < 5) {
      return formatToolResult({
        error: 'Not enough overlapping data points to compute a meaningful correlation.',
        data_points_a: returnsA.length,
        data_points_b: returnsB.length,
      }, sourceUrls);
    }

    // Overall correlation
    const correlation = pearsonCorrelation(alignedA, alignedB);

    // Rolling 30-day correlation if period >= 90
    let rollingCorrelation: Array<{ offset: number; correlation: number }> | undefined;
    if (input.days >= 90 && len >= 30) {
      rollingCorrelation = [];
      const windowSize = 30;
      for (let i = 0; i <= len - windowSize; i += 7) {
        const windowA = alignedA.slice(i, i + windowSize);
        const windowB = alignedB.slice(i, i + windowSize);
        rollingCorrelation.push({
          offset: i,
          correlation: Math.round(pearsonCorrelation(windowA, windowB) * 1000) / 1000,
        });
      }
    }

    const result = {
      asset_a: input.asset_a,
      asset_b: input.asset_b,
      asset_b_type: isStockB ? 'stock' : 'crypto',
      period_days: input.days,
      data_points: len,
      correlation: Math.round(correlation * 1000) / 1000,
      interpretation: interpretCorrelation(correlation),
      rolling_correlation: rollingCorrelation,
    };

    return formatToolResult(result, sourceUrls);
  },
});
