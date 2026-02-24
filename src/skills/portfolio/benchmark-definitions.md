# Benchmark Definitions

Reference for portfolio benchmarks. Use this to select appropriate benchmarks and calculate blended benchmark returns.

## Pre-Defined Benchmarks

### Broad Market

| Ticker | Name | Asset Class | Use Case |
|--------|------|-------------|----------|
| SPY | S&P 500 ETF | US Large Cap | Default benchmark for US equity portfolios |
| VOO | Vanguard S&P 500 | US Large Cap | Alternative S&P 500 tracker |
| VTI | Vanguard Total Market | US Total Market | Broader US market including mid/small cap |
| QQQ | NASDAQ-100 ETF | US Growth/Tech | Tech-heavy or growth-oriented portfolios |
| IWM | Russell 2000 ETF | US Small Cap | Small-cap focused portfolios |

### International

| Ticker | Name | Asset Class | Use Case |
|--------|------|-------------|----------|
| VXUS | Vanguard Total Intl | Global ex-US | International allocation benchmark |
| EFA | iShares EAFE | Developed ex-US | Developed markets benchmark |
| VWO | Vanguard EM | Emerging Markets | EM allocation benchmark |
| ACWI | iShares All Country | Global | Global all-country benchmark |
| VT | Vanguard Total World | Global | Total world market benchmark |

### Fixed Income

| Ticker | Name | Asset Class | Use Case |
|--------|------|-------------|----------|
| AGG | iShares US Agg Bond | US Bonds | Default bond benchmark |
| BND | Vanguard Total Bond | US Bonds | Alternative bond benchmark |
| TLT | iShares 20+ Yr Treasury | Long Treasury | Long-duration bond benchmark |
| HYG | iShares High Yield | High Yield | High-yield bond benchmark |

### Multi-Asset / Blended

| Name | Composition | Use Case |
|------|-------------|----------|
| 60/40 Portfolio | SPY:60, AGG:40 | Classic balanced portfolio benchmark |
| 80/20 Growth | SPY:80, AGG:20 | Growth-tilted balanced benchmark |
| 40/60 Conservative | SPY:40, AGG:60 | Conservative balanced benchmark |
| Global 60/40 | VT:60, BND:40 | Global balanced benchmark |
| All-Weather | SPY:30, TLT:40, GLD:7.5, DBC:7.5, VXUS:15 | Ray Dalio-inspired benchmark |
| Three-Fund | VTI:50, VXUS:30, BND:20 | Bogleheads three-fund benchmark |

## Custom Benchmark Format

Custom benchmarks are specified in the portfolio YAML frontmatter as:

```yaml
custom_benchmark_weights: "SPY:60,AGG:40"
```

Rules:
- Comma-separated `TICKER:WEIGHT` pairs
- Weights must sum to 100
- Each component must be a valid ticker queryable via `financial_search`

## Benchmark Selection Guide

Choose benchmark based on portfolio characteristics:

| Portfolio Type | Recommended Benchmark | Rationale |
|---------------|----------------------|-----------|
| US stocks only | SPY | Standard US large cap |
| US + International | VT or ACWI | Global equity exposure |
| Growth / Tech heavy | QQQ | Tech/growth weighting match |
| Small cap focus | IWM | Appropriate size benchmark |
| Balanced (stocks + bonds) | SPY:60,AGG:40 | Matches typical 60/40 allocation |
| Conservative | SPY:40,AGG:60 | Matches conservative allocation |
| All-weather / diversified | Custom blend | Match to target allocation |
| Crypto-included | Custom blend | No standard benchmark; blend equity + crypto index |

## How to Fetch Benchmark Data

### Single-Ticker Benchmark

Use `financial_search` with query:
```
"[BENCHMARK_TICKER] price performance returns YTD 1-year"
```

Extract: price, YTD return %, 1-year return %, day change %

For key ratios (volatility, dividend yield):
```
"[BENCHMARK_TICKER] key ratios"
```

### Blended Benchmark

For custom benchmarks like `SPY:60,AGG:40`:

1. Fetch each component's return data individually via `financial_search`
2. Calculate blended return: SUM(component_return × component_weight / 100)
3. Calculate blended day change: SUM(component_day_change × component_weight / 100)

**Example calculation:**
- SPY return: +25.0%, weight: 60% → contribution: +15.0%
- AGG return: +4.2%, weight: 40% → contribution: +1.68%
- Blended return: +16.68%

## Benchmark Comparison Metrics

When comparing portfolio to benchmark, calculate:

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **Excess Return** | portfolio_return - benchmark_return | Positive = outperformance |
| **Tracking Error** | StdDev(monthly excess returns) × √12 | Lower = closer to benchmark |
| **Information Ratio** | Excess Return / Tracking Error | >0.5 good, >1.0 excellent |
| **Up Capture** | portfolio_up_months_avg / benchmark_up_months_avg × 100 | >100 = captures more upside |
| **Down Capture** | portfolio_down_months_avg / benchmark_down_months_avg × 100 | <100 = protects on downside |
| **Active Share** | 0.5 × SUM(\|portfolio_weight_i - benchmark_weight_i\|) | Higher = more active |

### Interpretation Guide

- **Excess Return > 0** with **low Tracking Error**: Consistent outperformance (ideal)
- **Excess Return > 0** with **high Tracking Error**: Outperforming but volatile (risky)
- **Up Capture > 100**, **Down Capture < 100**: Best scenario — more upside, less downside
- **Information Ratio > 0.5**: Skilled active management
- **Active Share > 60%**: Truly active portfolio (not closet indexing)
