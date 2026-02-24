# Rebalancing Strategies

Reference guide for portfolio rebalancing approaches, trade generation logic, and tax-efficient execution.

## Strategy Definitions

### 1. Threshold Strategy (`rebalance_strategy: threshold`)

Rebalance when any asset class drifts beyond the configured threshold from its target.

**Configuration:**
```yaml
rebalance_strategy: threshold
rebalance_threshold: 5     # Trigger when any class drifts ±5% absolute
```

**Trigger logic:**
- For each asset class: drift = |current_weight - target_weight|
- If ANY drift > rebalance_threshold → rebalancing is recommended
- Only the drifted classes need adjustment; classes within threshold are left alone

**Pros:** Responsive to market moves, prevents extreme drift
**Cons:** May trigger too frequently in volatile markets
**Best for:** Active investors comfortable with periodic trading

### 2. Calendar Strategy (`rebalance_strategy: calendar`)

Rebalance on a fixed schedule regardless of drift.

**Configuration:**
```yaml
rebalance_strategy: calendar
rebalance_calendar: quarterly    # quarterly / semi-annual / annual
```

**Schedule definitions:**
- `quarterly`: Every 3 months (Jan, Apr, Jul, Oct)
- `semi-annual`: Every 6 months (Jan, Jul)
- `annual`: Once per year (Jan)

**Trigger logic:**
- Check last rebalance date from Transactions table (most recent SELL+BUY pair on same day)
- If no rebalance found, use portfolio `created` date
- If elapsed time exceeds the calendar period → rebalancing is recommended
- Rebalance ALL classes back to target, not just drifted ones

**Pros:** Predictable, low maintenance, reduces over-trading
**Cons:** May allow significant drift between rebalance dates
**Best for:** Passive, long-term investors

### 3. Band Strategy (`rebalance_strategy: band`)

Uses inner and outer bands around each target allocation.

**Configuration:**
```yaml
rebalance_strategy: band
rebalance_band_inner: 3     # No action if drift within ±3%
rebalance_band_outer: 8     # Mandatory rebalance if drift exceeds ±8%
```

**Trigger logic:**
- For each asset class, calculate drift = |current_weight - target_weight|
- drift ≤ inner_band → **No action** (within tolerance)
- inner_band < drift ≤ outer_band → **Optional rebalance** (flag as advisory)
- drift > outer_band → **Mandatory rebalance** (flag as urgent)

**Pros:** Reduces unnecessary trading while catching extreme drift
**Cons:** More complex to configure
**Best for:** Sophisticated investors who want nuanced control

## Trade Generation Algorithm

### Step 1: Calculate Required Adjustments

For each asset class that needs rebalancing:
```
target_value = target_weight / 100 × total_portfolio_value
current_value = SUM(market_value of holdings in class)
adjustment = target_value - current_value
```

- If adjustment > 0 → need to BUY (class is underweight)
- If adjustment < 0 → need to SELL (class is overweight)

### Step 2: Select Specific Holdings for Sells

When an asset class is overweight, select which holdings to sell.

**Priority order for sells (tax-optimized):**
1. **Tax-loss lots first**: Lots with unrealized losses (realizes losses for tax benefit)
2. **Long-term gain lots next**: Lots held > 365 days (lower tax rate)
3. **Short-term gain lots last**: Lots held ≤ 365 days (highest tax rate)

Within each priority tier, sell lots with the smallest gains first (minimize tax impact).

**For tax-deferred/tax-free accounts**: Skip tax optimization, use FIFO.

### Step 3: Select Specific Holdings for Buys

When an asset class is underweight, determine what to buy.

**Priority order for buys:**
1. **Add to existing holdings**: If the portfolio already holds an ETF or stock in the underweight class, add more shares to that position
2. **Suggest new broad ETF**: If no existing holding in the class, suggest the most common ETF:
   - US Equity → VTI
   - International Equity → VXUS
   - Fixed Income → BND
   - Alternatives → GLD or VNQ
   - Cash → SGOV

### Step 4: Round to Whole Shares

Convert dollar amounts to shares using current prices.
Round to nearest whole share (or allow fractional for crypto).
Adjust final amounts to ensure all trades balance.

## Cash Flow Rebalancing

When the user mentions depositing new cash, prefer cash flow rebalancing over selling.

**Algorithm:**
1. Calculate current drift for each asset class
2. Allocate new cash entirely to underweight classes, proportional to their deficit:
   ```
   class_deficit = MAX(0, target_value - current_value)
   total_deficit = SUM(all class deficits)
   class_allocation = new_cash × (class_deficit / total_deficit)
   ```
3. If new cash > total_deficit, allocate excess proportionally to targets
4. Result: Reduced drift with zero sells (no tax events)

**When to recommend cash flow rebalancing:**
- When the portfolio needs rebalancing AND the user has new cash to invest
- When sells would trigger significant short-term capital gains
- Always present as an alternative alongside traditional rebalancing

## Rebalancing Cost Analysis

For each proposed trade set, calculate:

| Cost Component | Formula |
|---------------|---------|
| **Transaction fees** | SUM(estimated fees per trade) — often $0 for major brokers |
| **Tax cost (sells)** | SUM(realized_gain × tax_rate) for each sell lot |
| **Tax benefit (loss harvesting)** | SUM(realized_loss × tax_rate) for loss lots |
| **Net tax impact** | Tax cost - Tax benefit |
| **Total rebalancing cost** | Transaction fees + Net tax impact |
| **Drift reduction** | SUM(|drift_before| - |drift_after|) for all classes |
| **Cost per 1% drift reduction** | Total cost / Drift reduction |

Present a cost-benefit summary so the user can decide if rebalancing is worthwhile.

## Rebalancing Frequency Guidelines

| Portfolio Size | Recommended Strategy | Rationale |
|---------------|---------------------|-----------|
| < $50K | Calendar (annual) | Minimize transaction costs |
| $50K–$500K | Threshold (5%) or Calendar (semi-annual) | Balance responsiveness and costs |
| $500K–$2M | Threshold (3-5%) or Band (3%/8%) | Tighter control, tax-aware |
| > $2M | Band (2%/5%) with tax optimization | Maximum precision, tax efficiency critical |

## Special Considerations

### Wash Sale Avoidance
When selling at a loss for rebalancing, do NOT buy a "substantially identical" security within 30 days.
- Selling VXUS at a loss → do NOT buy IXUS (substantially identical international ETF)
- Selling VTI at a loss → OK to buy VOO (S&P 500 is not identical to Total Market)
- Selling AAPL at a loss → do NOT buy AAPL within 30 days

### Rebalancing Across Multiple Portfolios
If the user has multiple portfolios (e.g., taxable + IRA):
- Prefer rebalancing in tax-advantaged accounts first (no tax impact)
- Use taxable account only for remaining adjustments
- Consider the combined allocation across all portfolios

### Minimum Trade Size
Skip trades smaller than $100 or 1 share — the rebalancing benefit is negligible.
Note skipped trades in the output as "Below minimum trade threshold."
