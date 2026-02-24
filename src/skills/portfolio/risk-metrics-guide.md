# Risk Metrics Computation Guide

Reference for calculating portfolio risk metrics. All formulas and approximation methods used by the portfolio skill.

## Value at Risk (VaR)

### Parametric VaR (Primary Method)

Uses the assumption of normally distributed returns.

**Step 1: Estimate position-level volatility**

For each holding, obtain annualized volatility:
- Use `financial_search` query `"[TICKER] key ratios"` → extract beta
- Estimate position volatility: position_vol = beta × benchmark_vol
- Default benchmark volatility (SPY): 15% annualized
- If beta unavailable, use asset class defaults:

| Asset Class | Default Beta | Estimated Annualized Vol |
|-------------|-------------|-------------------------|
| US Equity (large cap) | 1.0 | 15% |
| US Equity (small cap) | 1.3 | 20% |
| US Equity (growth/tech) | 1.2 | 18% |
| International Equity (developed) | 0.9 | 14% |
| International Equity (emerging) | 1.1 | 20% |
| Fixed Income (total bond) | 0.0 | 5% |
| Fixed Income (long treasury) | 0.0 | 12% |
| Fixed Income (high yield) | 0.3 | 10% |
| Alternatives (gold) | 0.0 | 15% |
| Alternatives (REITs) | 0.8 | 18% |
| Alternatives (commodities) | 0.3 | 20% |
| Cash | 0.0 | 0.5% |
| Crypto (BTC) | 1.5 | 60% |
| Crypto (ETH) | 1.8 | 75% |
| Crypto (altcoins) | 2.0 | 90% |

**Step 2: Estimate correlation matrix**

Use asset-class-level correlation approximations:

|  | US Eq | Intl Eq | Fix Inc | Gold | REITs | Crypto |
|--|-------|---------|---------|------|-------|--------|
| **US Equity** | 1.00 | 0.75 | -0.20 | 0.05 | 0.60 | 0.30 |
| **Intl Equity** | 0.75 | 1.00 | -0.10 | 0.10 | 0.50 | 0.25 |
| **Fixed Income** | -0.20 | -0.10 | 1.00 | 0.30 | 0.15 | -0.10 |
| **Gold** | 0.05 | 0.10 | 0.30 | 1.00 | 0.10 | 0.10 |
| **REITs** | 0.60 | 0.50 | 0.15 | 0.10 | 1.00 | 0.20 |
| **Crypto** | 0.30 | 0.25 | -0.10 | 0.10 | 0.20 | 1.00 |

For holdings within the same asset class:
- Same sector: correlation = 0.75
- Different sector: correlation = 0.50
- Same holding (multiple lots): correlation = 1.00

**Step 3: Calculate portfolio variance**

Group holdings by asset class. For each class:
- class_weight = SUM(position_weights in class)
- class_vol = weighted average of position vols in class

Portfolio variance:
```
σ²_p = Σ_i Σ_j (w_i × w_j × σ_i × σ_j × ρ_ij)
```
Where:
- w_i, w_j = asset class weights
- σ_i, σ_j = asset class volatilities
- ρ_ij = correlation between classes i and j

Portfolio volatility: σ_p = √(σ²_p)

**Step 4: Calculate VaR**

| VaR Metric | Formula |
|-----------|---------|
| Daily VaR (95%) | portfolio_value × σ_p / √252 × 1.645 |
| Daily VaR (99%) | portfolio_value × σ_p / √252 × 2.326 |
| Weekly VaR (95%) | Daily VaR (95%) × √5 |
| Monthly VaR (95%) | Daily VaR (95%) × √21 |
| Annual VaR (95%) | portfolio_value × σ_p × 1.645 |

**Interpretation guide:**
- Daily VaR (95%) = $X,XXX means: "On 95% of trading days, you should not lose more than $X,XXX"
- If VaR / portfolio_value > 3%: Elevated daily risk
- If VaR / portfolio_value > 5%: High daily risk — consider risk reduction

### Conditional VaR (CVaR / Expected Shortfall)

Estimates the expected loss when VaR is breached (tail risk).

For normal distribution:
```
CVaR (95%) ≈ VaR (95%) × 1.22
CVaR (99%) ≈ VaR (99%) × 1.15
```

This is an approximation. Note in output that actual tail risk may be higher due to fat tails in financial returns.

## Portfolio Beta

**Weighted beta calculation:**
```
β_portfolio = Σ (w_i × β_i)
```
Where w_i = position weight, β_i = position beta.

**Interpretation:**
| Beta Range | Meaning |
|-----------|---------|
| β < 0.5 | Defensive — less volatile than market |
| 0.5 ≤ β < 0.8 | Low volatility |
| 0.8 ≤ β < 1.2 | Market-like volatility |
| 1.2 ≤ β < 1.5 | Aggressive — more volatile than market |
| β ≥ 1.5 | High risk — significantly more volatile |

## Max Drawdown Estimation

### From Transaction History (Preferred)

If the portfolio has sufficient transaction history (> 3 months):

1. Reconstruct portfolio value at each transaction date:
   - Start with first transaction cost
   - At each subsequent transaction, recalculate total value
   - Between transactions, interpolate using market returns (beta × benchmark return)

2. Scan the value series:
   ```
   running_max = -∞
   max_drawdown = 0
   for each value_point:
     running_max = MAX(running_max, value_point)
     drawdown = (value_point - running_max) / running_max
     max_drawdown = MIN(max_drawdown, drawdown)
   ```

3. Report max_drawdown as percentage (negative number)

### From Beta (Fallback)

If insufficient history:
```
estimated_max_dd = portfolio_beta × benchmark_reference_dd
```

Benchmark reference max drawdowns (recent history):
| Period | SPY Max DD | Notes |
|--------|-----------|-------|
| 2020 COVID | -34% | Sharp but short recovery |
| 2022 Bear | -25% | Rate hike cycle |
| 2018 Q4 | -20% | Fed tightening scare |
| Historical avg | -30% | Typical bear market |

Use -30% as the reference for estimation.

## Sharpe Ratio

```
Sharpe = (R_p - R_f) / σ_p
```
Where:
- R_p = portfolio annualized return
- R_f = risk-free rate (from config.md, default 4.5%)
- σ_p = portfolio annualized volatility

**Interpretation:**
| Sharpe | Quality |
|--------|---------|
| < 0 | Underperforming risk-free rate |
| 0–0.5 | Poor risk-adjusted return |
| 0.5–1.0 | Acceptable |
| 1.0–1.5 | Good |
| 1.5–2.0 | Very good |
| > 2.0 | Excellent (verify data — may be too short a period) |

## Sortino Ratio

```
Sortino = (R_p - R_f) / σ_downside
```

**Downside deviation** measures only negative returns relative to a minimum acceptable return (MAR = risk-free rate).

**Estimation from portfolio volatility:**
```
σ_downside ≈ σ_p × 0.7
```

Rationale: Empirically, about 55-65% of total variance comes from downside moves for equity portfolios. The √(0.55) ≈ 0.74 factor is simplified to 0.7.

For bond-heavy portfolios (>50% fixed income): use 0.6 multiplier.
For crypto-heavy portfolios (>20% crypto): use 0.8 multiplier.

**Interpretation:** Sortino should be higher than Sharpe (since it only penalizes downside). Sortino > 2.0 is strong.

## Concentration Metrics

### Herfindahl-Hirschman Index (HHI)

```
HHI = Σ (w_i)²
```
Where w_i = position weight as decimal (not percentage).

| HHI | Interpretation | Effective Positions |
|-----|---------------|-------------------|
| < 0.05 | Highly diversified | > 20 effective |
| 0.05–0.10 | Well diversified | 10-20 effective |
| 0.10–0.25 | Moderately concentrated | 4-10 effective |
| 0.25–0.50 | Concentrated | 2-4 effective |
| > 0.50 | Highly concentrated | < 2 effective |

**Effective number of positions:** 1 / HHI
This represents how many equal-weight positions would produce the same HHI.

### Position Concentration Limits

| Rule | Threshold | Action |
|------|-----------|--------|
| Single stock > 10% | Critical | Recommend trim |
| Single stock > 5% | Warning | Monitor |
| Top 3 holdings > 50% | Warning | Review diversification |
| Top 5 holdings > 70% | Critical | Recommend broadening |
| Any sector > limit | Critical | Recommend sector rotation |
| Any sector > 80% of limit | Warning | Monitor |

## Correlation Analysis

### When to Flag Correlation Risk

- Two individual stocks in same sector with combined weight > 10%: Flag as "High correlation pair"
- More than 40% of portfolio in single sector: Flag as "Sector concentration risk"
- Bond + equity correlation turning positive (unusual): Flag as "Diversification benefit may be reduced"

### Recommended Actions for Correlation Issues

| Issue | Recommendation |
|-------|---------------|
| Two correlated stocks > 10% combined | Replace one with sector ETF |
| Single sector > 35% | Trim and add underweight sectors |
| All equity, no bonds | Add 10-20% fixed income for diversification |
| All US, no international | Add 15-25% international for geographic diversification |
| High crypto allocation (>10%) | Reduce to 5% or less for risk management |

## Stress Test Scenarios

When presenting risk analysis, estimate impact of these scenarios:

| Scenario | US Equity | Intl Equity | Bonds | Gold | Crypto | Description |
|----------|-----------|-------------|-------|------|--------|-------------|
| Market Crash (-20%) | -20% | -22% | +5% | +10% | -35% | 2020-style sudden drop |
| Rate Hike Cycle | -15% | -12% | -10% | -5% | -25% | 2022-style tightening |
| Recession | -30% | -25% | +10% | +15% | -50% | Prolonged economic downturn |
| Inflation Spike | -10% | -8% | -15% | +20% | -10% | Stagflation scenario |
| Recovery Rally | +25% | +20% | -5% | -10% | +50% | Post-bottom recovery |

**Portfolio stress test:**
```
scenario_impact = Σ (w_i × scenario_return_i)
```

Present: "In a {scenario} scenario, your portfolio could move approximately {scenario_impact}%"

## Risk Score Summary

Compute an overall risk score (1-10) for the portfolio:

| Factor | Low Risk (1-3) | Medium Risk (4-6) | High Risk (7-10) |
|--------|---------------|-------------------|-------------------|
| Portfolio Beta | < 0.7 | 0.7–1.2 | > 1.2 |
| HHI | < 0.10 | 0.10–0.25 | > 0.25 |
| Crypto Weight | < 3% | 3–10% | > 10% |
| Single Stock Max | < 5% | 5–15% | > 15% |
| Daily VaR / Value | < 1.5% | 1.5–3% | > 3% |

Overall score = average of factor scores, rounded.

| Score | Label |
|-------|-------|
| 1-2 | Very Conservative |
| 3-4 | Conservative |
| 5-6 | Moderate |
| 7-8 | Aggressive |
| 9-10 | Very Aggressive |
