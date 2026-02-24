# Tax Lot Rules

Reference for US tax rules applicable to portfolio management, tax-lot accounting, tax-loss harvesting, and wash sale avoidance.

## Holding Period Classification

### Short-Term vs Long-Term

| Holding Period | Classification | Federal Tax Rate (2024-2025) |
|---------------|---------------|------------------------------|
| ≤ 365 days | Short-term capital gain | Ordinary income rate (up to 37%) |
| ≥ 366 days | Long-term capital gain | 0%, 15%, or 20% depending on income |

**Calculation:** holding_period = sale_date - purchase_date (in calendar days).
- The purchase date itself does NOT count
- The sale date DOES count
- Example: Bought Jan 1, sold Jan 2 of next year = 366 days = Long-term

### Tax Rate Reference

Default rates stored in `~/.dexter/portfolios/config.md`:

| Rate | Config Key | Default | Description |
|------|-----------|---------|-------------|
| Short-term capital gains | `tax_rate_short_term` | 37% | Top marginal rate |
| Long-term capital gains | `tax_rate_long_term` | 15% | Most common bracket |
| Qualified dividends | `tax_rate_qualified_dividend` | 15% | Same as LTCG |
| Non-qualified dividends | (same as short-term) | 37% | Ordinary income |

Users should adjust these to match their actual tax bracket.

### Account Type Tax Treatment

| Account Type (`tax_type`) | Capital Gains Tax | Dividend Tax | Notes |
|---------------------------|-------------------|-------------|-------|
| `taxable` | Yes — ST/LT rates apply | Yes | Full tax analysis applicable |
| `tax-deferred` (IRA/401k) | No — taxed at withdrawal | No | Skip all tax analysis, note "Tax-deferred: no immediate tax impact" |
| `tax-free` (Roth IRA) | No — tax-free growth | No | Skip all tax analysis, note "Tax-free: no tax impact" |

## Lot Selection Methods

When selling shares, the lot selection method determines which specific shares are sold, directly affecting the tax impact.

### FIFO (First In, First Out) — Default

Sell the oldest lots first.

**Sort:** Holdings by purchase date ascending.
**Best for:** Simple, consistent tracking; no special optimization.

### LIFO (Last In, First Out)

Sell the newest lots first.

**Sort:** Holdings by purchase date descending.
**Best for:** When recent purchases have higher cost basis (minimizes gains).

### HIFO (Highest In, First Out)

Sell lots with the highest cost basis first.

**Sort:** Holdings by cost_basis descending.
**Best for:** Minimizing realized capital gains (or maximizing losses for harvesting).

### Specific Identification

User selects exact lot(s) to sell by lot ID.

**Best for:** Maximum control over tax outcomes. Required for optimal tax-loss harvesting.

### Lot Selection Decision Guide

| Goal | Recommended Method |
|------|--------------------|
| Minimize taxes on gains | HIFO |
| Maximize tax-loss harvesting | Choose lots with largest losses |
| Convert to long-term before selling | Wait for lots approaching 366 days |
| Simple default | FIFO |
| User has specific preference | Specific Identification |

## Tax-Loss Harvesting (TLH)

### What It Is

Selling investments at a loss to offset capital gains elsewhere, reducing overall tax liability. The proceeds are reinvested in a similar (but not identical) security to maintain market exposure.

### TLH Opportunity Identification

Scan all lots in the portfolio:

```
For each lot:
  unrealized_gain_loss = (current_price - cost_basis) × shares
  if unrealized_gain_loss < 0:
    → This is a TLH candidate
    tax_savings = |unrealized_gain_loss| × applicable_tax_rate
```

**Priority ranking of TLH candidates:**
1. Largest potential tax savings first (|loss| × rate)
2. Short-term losses are more valuable (offset at 37% vs 15%)
3. Consider lot size — larger lots provide more meaningful savings

### TLH Threshold

Only recommend harvesting when:
- Unrealized loss > $100 (skip trivial losses)
- Tax savings > $25 (not worth the effort otherwise)
- No wash sale conflict exists (see below)

### Replacement Security Rules

After selling at a loss, immediately buy a **replacement security** that:
1. Maintains similar market exposure (same asset class)
2. Is NOT "substantially identical" to avoid wash sale (see below)
3. Has similar risk/return characteristics

**Replacement mapping:**

| Sold at Loss | Replacement Options | Reason |
|-------------|-------------------|--------|
| VTI (Total Market) | ITOT, SCHB, VOO | Different index/provider |
| VOO (S&P 500) | IVV, SPLG, VTI | Different provider or broader index |
| VXUS (Intl) | IXUS, EFA+VWO | Different provider |
| BND (Total Bond) | AGG, SCHZ | Different provider |
| SPY (S&P 500) | IVV, VOO, SPLG | Different provider |
| QQQ (NASDAQ-100) | QQQM, VGT | Different share class or tech ETF |
| AAPL (individual) | XLK (sector ETF) | Maintains tech exposure |
| MSFT (individual) | XLK (sector ETF) | Maintains tech exposure |
| Any individual stock | Sector ETF | Maintains sector exposure |
| GLD (gold) | IAU, GLDM | Different gold trust |

### Annual Loss Limit

- Capital losses first offset capital gains (unlimited)
- Excess losses up to $3,000/year can offset ordinary income
- Remaining losses carry forward to future years indefinitely

### TLH Calendar Awareness

- **December**: Prime TLH season — review all losses before year-end
- **January**: Wash sale window from December sales ends ~Jan 30
- **After big drops**: Market corrections create TLH opportunities across many positions

## Wash Sale Rule

### Definition

A **wash sale** occurs when you sell a security at a loss and purchase a "substantially identical" security within 30 days before or after the sale. The loss is disallowed for tax purposes.

### The 61-Day Window

```
|--- 30 days before sale ---|--- SALE DATE ---|--- 30 days after sale ---|
|         WASH SALE WINDOW (61 days total)                               |
```

Any purchase of substantially identical securities within this window triggers a wash sale.

### "Substantially Identical" Securities

**ARE substantially identical (wash sale applies):**
- Same stock/ETF (buy AAPL, sell AAPL at loss, buy AAPL again)
- Same ETF from different share class (GOOG and GOOGL are considered identical)
- Convertible securities on the same underlying
- Options on the same underlying

**Are NOT substantially identical (safe to buy):**
- Different index ETFs tracking different indices (VTI vs VOO — debatable but generally accepted)
- Sector ETF vs individual stock (sell AAPL at loss, buy XLK — safe)
- Different companies in same sector (sell AAPL at loss, buy MSFT — safe)
- ETFs from different providers tracking same index — **gray area, be cautious**
  - Conservative view: VTI and ITOT could be considered identical
  - Aggressive view: Different funds, different providers = not identical
  - Recommendation: Use clearly different indices to be safe

**Safe replacement pairs (conservative):**

| Loss Sale | Safe Replacement | Why Safe |
|-----------|-----------------|----------|
| VTI (CRSP US Total Market) | VOO (S&P 500) | Different index |
| SPY (S&P 500) | VTI (Total Market) | Different index |
| Individual stock | Sector ETF | Clearly different |
| VXUS (FTSE ex-US) | EFA (MSCI EAFE) | Different index, different scope |
| BND (US Agg) | BNDX (Intl Bond) | Different market |

### Wash Sale Consequences

If a wash sale occurs:
- The disallowed loss is added to the cost basis of the replacement security
- The holding period of the original lot carries over to the replacement
- The loss is NOT permanently lost — it's deferred

**Example:**
- Buy AAPL 100 shares @ $150 (lot-001)
- Sell AAPL 100 shares @ $130 → $2,000 loss
- Buy AAPL 100 shares @ $135 within 30 days (lot-002)
- Result: $2,000 loss disallowed. Lot-002 cost basis = $135 + $20 = $155

### Wash Sale Detection Algorithm

When proposing a SELL at loss during rebalancing or TLH:

```
1. Check Transactions table for recent BUYs of same/identical ticker
   within 30 days BEFORE the proposed sell date
2. If rebalancing plan includes BUY of same/identical ticker
   within 30 days AFTER the proposed sell date → warn

If either condition is true:
  → Flag: "⚠ Wash sale warning: {TICKER} purchase within 30-day window"
  → Suggest waiting 31 days or using a non-identical replacement
```

## Dividend Tax Treatment

### Qualified vs Non-Qualified Dividends

| Type | Tax Rate | Requirements |
|------|----------|-------------|
| Qualified | Long-term capital gains rate (15%) | Holding > 60 days within 121-day window around ex-date |
| Non-qualified (ordinary) | Ordinary income rate (37%) | Does not meet holding requirement |

**Simplification for Dexter:** If a holding has been in the portfolio > 90 days, assume qualified dividends. If < 90 days, flag as potentially non-qualified.

### REIT Dividends

Most REIT dividends are non-qualified (taxed as ordinary income, up to 37%).
However, 20% QBI deduction may apply, effectively reducing rate to ~29.6%.
Flag REIT holdings (VNQ, SCHH, O, AMT, PLD, etc.) with note about ordinary income treatment.

### International Dividend Withholding

International ETFs (VXUS, EFA, VWO, etc.) may have foreign tax withheld.
- Typical withholding: 10-15% by foreign governments
- Can be claimed as Foreign Tax Credit on US return
- Note in dividend analysis: "Foreign tax credit may be available"

## Year-End Tax Planning Checklist

When user asks for tax analysis near year-end (October-December):

```
Year-End Tax Planning:
- [ ] 1. Review all unrealized losses for TLH candidates
- [ ] 2. Check for lots approaching long-term status (close to 366 days)
- [ ] 3. Review realized gains YTD — are there losses to offset?
- [ ] 4. Check for wash sale conflicts with recent 30-day purchases
- [ ] 5. Estimate total tax liability (gains - losses - $3,000 deduction)
- [ ] 6. Identify replacement securities for any harvested positions
- [ ] 7. Consider charitable giving of appreciated lots (avoid capital gains entirely)
```

## Tax-Efficient Asset Location

When user has multiple account types, suggest optimal placement:

| Asset Type | Best Account | Reason |
|-----------|-------------|--------|
| High-growth stocks | Roth IRA | Tax-free growth maximizes value |
| REITs | Tax-deferred (IRA/401k) | Non-qualified dividends avoid high tax |
| Bonds (taxable) | Tax-deferred (IRA/401k) | Interest taxed as ordinary income |
| International stocks | Taxable | Foreign tax credit only available here |
| Index ETFs (low turnover) | Taxable | Tax-efficient, low distributions |
| Actively traded positions | Tax-deferred | Shields frequent gains from tax |
| Municipal bonds | Taxable | Already tax-exempt |
