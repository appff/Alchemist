import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callCoinGecko, resolveCoinId } from './coingecko-api.js';
import { formatToolResult } from '../types.js';

const CryptoTechnicalInputSchema = z.object({
  coin_id: z
    .string()
    .describe(
      "CoinGecko coin ID or common symbol. Examples: 'bitcoin', 'ethereum', 'BTC', 'ETH', 'solana'"
    ),
  vs_currency: z
    .enum(['usd', 'eur', 'btc', 'eth'])
    .default('usd')
    .describe("Currency to price against. Defaults to 'usd'."),
  period: z
    .union([
      z.literal(1),
      z.literal(7),
      z.literal(14),
      z.literal(30),
      z.literal(90),
      z.literal(180),
      z.literal(365),
    ])
    .describe('Number of days for OHLC data. Options: 1, 7, 14, 30, 90, 180, 365.'),
});

// ── Technical indicator helpers ──────────────────────────────────────────

/** Compute Simple Moving Average over the last `period` values. */
function computeSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Compute Relative Strength Index (Wilder's smoothed, 14-period default).
 * Returns null if there aren't enough data points.
 */
function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  // Seed with first `period` changes
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smooth over remaining data
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Compute MACD (12, 26, 9).
 * Returns { macd, signal, histogram } or null.
 */
function computeMACD(
  closes: number[],
  fastLen = 12,
  slowLen = 26,
  signalLen = 9
): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < slowLen + signalLen) return null;

  const emaCalc = (data: number[], len: number): number[] => {
    const k = 2 / (len + 1);
    const ema: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  };

  const emaFast = emaCalc(closes, fastLen);
  const emaSlow = emaCalc(closes, slowLen);

  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = emaCalc(macdLine.slice(slowLen - 1), signalLen);

  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalLine[signalLine.length - 1];

  return {
    macd: Math.round(macdVal * 100) / 100,
    signal: Math.round(signalVal * 100) / 100,
    histogram: Math.round((macdVal - signalVal) * 100) / 100,
  };
}

/** Compute Bollinger Bands (20-period, 2 std dev). */
function computeBollingerBands(
  closes: number[],
  period = 20,
  stdDevMult = 2
): { upper: number; middle: number; lower: number; bandwidth: number } | null {
  if (closes.length < period) return null;

  const slice = closes.slice(-period);
  const mean = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = mean + stdDevMult * stdDev;
  const lower = mean - stdDevMult * stdDev;

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(mean * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    bandwidth: mean !== 0 ? Math.round(((upper - lower) / mean) * 10000) / 100 : 0,
  };
}

// ── Tool definition ──────────────────────────────────────────────────────

export const getCryptoTechnical = new DynamicStructuredTool({
  name: 'get_crypto_technical',
  description: `Computes technical indicators for a cryptocurrency from OHLC data: SMA (20/50), RSI (14), MACD (12,26,9), and Bollinger Bands (20,2). Useful for technical analysis, trend detection, and identifying overbought/oversold conditions.`,
  schema: CryptoTechnicalInputSchema,
  func: async (input) => {
    const coinId = await resolveCoinId(input.coin_id);

    const { data, url } = await callCoinGecko(
      `/coins/${coinId}/ohlc`,
      {
        vs_currency: input.vs_currency,
        days: input.period,
      },
      { cacheable: input.period >= 30 }
    );

    // CoinGecko OHLC returns [[timestamp, open, high, low, close], ...]
    const ohlc = data as unknown as number[][];
    if (!Array.isArray(ohlc) || ohlc.length === 0) {
      return formatToolResult({ error: `No OHLC data found for '${input.coin_id}'` }, [url]);
    }

    const closes = ohlc.map((c) => c[4]);
    const currentPrice = closes[closes.length - 1];

    // Compute indicators
    const sma20 = computeSMA(closes, 20);
    const sma50 = computeSMA(closes, 50);
    const rsi = computeRSI(closes, 14);
    const macd = computeMACD(closes);
    const bollinger = computeBollingerBands(closes);

    // Build interpretation signals
    const signals: string[] = [];
    if (sma20 !== null) {
      signals.push(currentPrice > sma20 ? 'Price above SMA20 (bullish)' : 'Price below SMA20 (bearish)');
    }
    if (sma50 !== null) {
      signals.push(currentPrice > sma50 ? 'Price above SMA50 (bullish)' : 'Price below SMA50 (bearish)');
    }
    if (sma20 !== null && sma50 !== null) {
      signals.push(sma20 > sma50 ? 'Golden cross pattern (SMA20 > SMA50)' : 'Death cross pattern (SMA20 < SMA50)');
    }
    if (rsi !== null) {
      if (rsi > 70) signals.push(`RSI ${rsi.toFixed(1)} — overbought`);
      else if (rsi < 30) signals.push(`RSI ${rsi.toFixed(1)} — oversold`);
      else signals.push(`RSI ${rsi.toFixed(1)} — neutral`);
    }
    if (macd) {
      signals.push(macd.histogram > 0 ? 'MACD histogram positive (bullish momentum)' : 'MACD histogram negative (bearish momentum)');
    }
    if (bollinger) {
      if (currentPrice > bollinger.upper) signals.push('Price above upper Bollinger Band (potential reversal down)');
      else if (currentPrice < bollinger.lower) signals.push('Price below lower Bollinger Band (potential reversal up)');
      else signals.push('Price within Bollinger Bands');
    }

    const result = {
      coin_id: coinId,
      vs_currency: input.vs_currency,
      period_days: input.period,
      data_points: ohlc.length,
      current_price: Math.round(currentPrice * 100) / 100,
      indicators: {
        sma_20: sma20 !== null ? Math.round(sma20 * 100) / 100 : null,
        sma_50: sma50 !== null ? Math.round(sma50 * 100) / 100 : null,
        rsi_14: rsi !== null ? Math.round(rsi * 100) / 100 : null,
        macd,
        bollinger_bands: bollinger,
      },
      signals,
    };

    return formatToolResult(result, [url]);
  },
});
