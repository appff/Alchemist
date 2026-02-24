# Goal-Based Allocation Templates

Reference file for goal-based investing workflows (Workflow L, N, O).

---

## Template Selection Matrix

Select a template based on investment horizon and risk tolerance:

| Horizon \ Risk | Conservative | Moderate | Aggressive |
|----------------|-------------|----------|------------|
| Short (< 3 years) | conservative-short | moderate-short | aggressive-short |
| Medium (3–10 years) | conservative-medium | moderate-medium | aggressive-medium |
| Long (> 10 years) | conservative-long | moderate-long | aggressive-long |

### Horizon Derivation

```
years_remaining = (target_date - today) / 365
if years_remaining < 3  → short
if 3 ≤ years_remaining ≤ 10 → medium
if years_remaining > 10 → long
```

---

## Short-Term Templates (< 3 Years)

### conservative-short

| Asset Class | Target % |
|-------------|----------|
| Cash | 40 |
| Fixed Income | 45 |
| US Equity | 10 |
| International Equity | 5 |

- **Expected annual return**: 3–4%
- **Use case**: Emergency fund, near-term purchase (car, wedding)
- **Max drawdown tolerance**: ≤ 5%

### moderate-short

| Asset Class | Target % |
|-------------|----------|
| Cash | 20 |
| Fixed Income | 45 |
| US Equity | 25 |
| International Equity | 10 |

- **Expected annual return**: 4–5%
- **Use case**: Down payment savings (1–2 years), short-term goal
- **Max drawdown tolerance**: ≤ 10%

### aggressive-short

| Asset Class | Target % |
|-------------|----------|
| Cash | 10 |
| Fixed Income | 30 |
| US Equity | 40 |
| International Equity | 15 |
| Alternatives | 5 |

- **Expected annual return**: 5–7%
- **Use case**: Short-term growth target, higher risk acceptance
- **Max drawdown tolerance**: ≤ 15%

---

## Medium-Term Templates (3–10 Years)

### conservative-medium

| Asset Class | Target % |
|-------------|----------|
| Cash | 10 |
| Fixed Income | 40 |
| US Equity | 30 |
| International Equity | 15 |
| Alternatives | 5 |

- **Expected annual return**: 5–6%
- **Use case**: Home down payment (5+ years), education funding
- **Max drawdown tolerance**: ≤ 15%

### moderate-medium

| Asset Class | Target % |
|-------------|----------|
| Cash | 5 |
| Fixed Income | 25 |
| US Equity | 40 |
| International Equity | 20 |
| Alternatives | 10 |

- **Expected annual return**: 7–8%
- **Use case**: General wealth building, mid-term milestones
- **Max drawdown tolerance**: ≤ 25%

### aggressive-medium

| Asset Class | Target % |
|-------------|----------|
| Fixed Income | 15 |
| US Equity | 45 |
| International Equity | 25 |
| Alternatives | 10 |
| Crypto | 5 |

- **Expected annual return**: 8–10%
- **Use case**: Growth-focused mid-term goals
- **Max drawdown tolerance**: ≤ 35%

---

## Long-Term Templates (> 10 Years)

### conservative-long

| Asset Class | Target % |
|-------------|----------|
| Cash | 5 |
| Fixed Income | 30 |
| US Equity | 35 |
| International Equity | 20 |
| Alternatives | 10 |

- **Expected annual return**: 7–8%
- **Use case**: Conservative retirement, wealth preservation with growth
- **Max drawdown tolerance**: ≤ 25%

### moderate-long

| Asset Class | Target % |
|-------------|----------|
| Fixed Income | 15 |
| US Equity | 45 |
| International Equity | 25 |
| Alternatives | 10 |
| Crypto | 5 |

- **Expected annual return**: 8–10%
- **Use case**: Retirement, long-term wealth building
- **Max drawdown tolerance**: ≤ 35%

### aggressive-long

| Asset Class | Target % |
|-------------|----------|
| Fixed Income | 5 |
| US Equity | 50 |
| International Equity | 25 |
| Alternatives | 10 |
| Crypto | 10 |

- **Expected annual return**: 10–12%
- **Use case**: Aggressive retirement, maximum growth
- **Max drawdown tolerance**: ≤ 45%

---

## Glide Path Rules

As the target date approaches, automatically shift to more conservative templates:

| Years Remaining | Action |
|-----------------|--------|
| > 10 | Maintain current template (no change) |
| 7–10 | Shift one risk level down (e.g., aggressive-long → moderate-long) |
| 3–7 | Shift to medium-term template at same or lower risk level |
| 1–3 | Shift to conservative-short regardless of original risk |
| < 1 | Capital preservation mode: Cash 60%, Fixed Income 35%, US Equity 5% |

### Glide Path Application

When Workflow N (Goal-Based Rebalancing) runs:

1. Calculate `years_remaining = (target_date - today) / 365`
2. Look up the glide path rule for `years_remaining`
3. Determine the **adjusted template** based on the rule
4. If adjusted template differs from current `allocation_template`:
   - Show the transition: "{current_template} → {adjusted_template}"
   - Present the new target allocation alongside current holdings
   - Generate rebalancing trades to move toward the adjusted target
5. If no change needed, proceed with current template targets

### Capital Preservation Mode (< 1 Year)

When the goal is less than 1 year away, override any template with:

| Asset Class | Target % |
|-------------|----------|
| Cash | 60 |
| Fixed Income | 35 |
| US Equity | 5 |

This protects accumulated gains as the target date nears.

---

## Goal Type Defaults

When the user does not specify a risk tolerance, use these defaults based on goal type:

| Goal Type | Default Template | Rationale |
|-----------|-----------------|-----------|
| retirement | aggressive-long | Long horizon allows recovery from drawdowns |
| education | moderate-long | Moderate growth with controlled risk |
| home | moderate-medium | Balanced approach for 5–10 year horizon |
| emergency | conservative-short | Capital preservation is priority |
| travel | moderate-short | Short horizon with modest growth |
| general | moderate-(horizon) | Use moderate risk at the derived horizon |

The default can always be overridden by the user's explicit risk tolerance choice.
