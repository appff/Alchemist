---
name: portfolio
description: >
  Comprehensive portfolio tracking and rebalancing system with fund-manager grade analytics.
  Triggers when user asks about portfolio management, holdings, performance tracking, rebalancing,
  risk analysis, tax-loss harvesting, "/portfolio" commands, asset allocation, goal-based investing,
  financial goals, goal tracking, glide path, "/portfolio goal", or investment portfolio operations.
  Supports multiple portfolios stored as markdown files with full transaction history, tax-lot
  tracking, goal-based planning, and professional-grade metrics.
---

# Portfolio Management Skill

## Portfolio File Location

All portfolio files are stored in `~/.dexter/portfolios/`.
- Global config: `~/.dexter/portfolios/config.md`
- Each portfolio: `~/.dexter/portfolios/{name}.md`

## Command Router

Parse the user's intent and route to the appropriate workflow:

| User Intent | Workflow |
|------------|----------|
| `/portfolio` or "show my portfolios" | Workflow A: Portfolio Overview |
| `/portfolio add <ticker> <shares> <price>` or "bought X shares of Y" | Workflow B: Add Position |
| `/portfolio sell <ticker> <shares> <price>` or "sold X shares of Y" | Workflow C: Record Sale |
| `/portfolio init [name]` or "create a new portfolio" | Workflow I: Initialize Portfolio |
| `/portfolio performance` or "how is my portfolio doing" | Workflow D: Performance Analysis |
| `/portfolio rebalance` or "rebalancing suggestions" | Workflow E: Rebalancing |
| `/portfolio risk` or "portfolio risk analysis" | Workflow F: Risk Analysis |
| `/portfolio tax` or "tax loss harvesting" | Workflow G: Tax Analysis |
| `/portfolio dividend` or "dividend income" | Workflow H: Dividend Analysis |
| `/portfolio compare` or "compare to benchmark" | Workflow J: Benchmark Comparison |
| `/portfolio allocation` or "asset allocation" | Workflow K: Allocation Analysis |
| `/portfolio goal new` or "set a financial goal" | Workflow L: Goal Initialization |
| `/portfolio goal [name]` or "how is my goal going" | Workflow M: Goal Progress Tracking |
| `/portfolio goals` or "show all my goals" | Workflow M: All Goals Overview |
| `/portfolio rebalance --goal [name]` | Workflow N: Goal-Based Rebalancing |
| `/portfolio goal plan [name]` or "goal planning" | Workflow O: Goal Planning |

**Natural language triggers (Korean):**
- "내 포트폴리오 보여줘" → Workflow A
- "애플 50주 185달러에 샀어" → Workflow B
- "테슬라 10주 팔았어" → Workflow C
- "새 포트폴리오 만들어줘" → Workflow I
- "포트폴리오 성과 분석해줘" → Workflow D
- "리밸런싱 해야 하나?" → Workflow E
- "은퇴 목표 만들어줘" → Workflow L
- "내 목표 진행 상황 보여줘" → Workflow M
- "목표 기반으로 리밸런싱 해줘" → Workflow N
- "목표 달성 계획 분석해줘" → Workflow O
- "내 모든 목표 보여줘" → Workflow M (all)

---

## Portfolio Markdown File Schema

### YAML Frontmatter

```yaml
---
name: Main Portfolio
currency: USD
benchmark: SPY
created: 2025-01-15
rebalance_strategy: threshold
rebalance_threshold: 5
tax_type: taxable
---
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Y | Portfolio display name |
| `currency` | string | Y | Base currency (USD, KRW, EUR) |
| `benchmark` | string | N | Benchmark ticker (default: SPY) |
| `created` | date | Y | Creation date |
| `rebalance_strategy` | enum | N | threshold / calendar / band (default: threshold) |
| `rebalance_threshold` | number | N | Drift tolerance % (default: 5) |
| `tax_type` | enum | Y | taxable / tax-deferred / tax-free |
| `goals` | list | N | Linked goal names (e.g., [retirement, education]) |

### Holdings Table

| Column | Description |
|--------|-------------|
| Ticker | Stock/ETF/Crypto symbol |
| Shares | Quantity held (decimals allowed for crypto/fractional) |
| Cost Basis | Per-share purchase price for this lot |
| Date | Purchase date (YYYY-MM-DD) |
| Sector | Sector classification |
| Asset Class | US Equity / International Equity / Fixed Income / Alternatives / Cash / Crypto |
| Account Lot | Tax lot identifier (lot-001, lot-002...) |

### Transactions Table

| Column | Description |
|--------|-------------|
| Date | Transaction date (YYYY-MM-DD) |
| Type | BUY / SELL / DIVIDEND / SPLIT / TRANSFER_IN / TRANSFER_OUT |
| Ticker | Symbol |
| Shares | Quantity |
| Price | Per-share price |
| Fees | Transaction fees |
| Lot | Tax lot identifier |
| Notes | Optional memo |

### Dividends Table

| Column | Description |
|--------|-------------|
| Date | Payment date |
| Ticker | Symbol |
| Amount | Total dividend amount received |
| Shares | Shares received if DRIP (0 if cash) |
| Reinvested | yes / no |

---

## Goal File Schema

Goal files are stored in `~/.dexter/portfolios/goals/{name}.md`.

### YAML Frontmatter

```yaml
---
name: retirement
type: retirement
target_amount: 2000000
target_date: 2045-06-01
annual_return_target: 8.5
monthly_contribution: 2000
risk_tolerance: aggressive
horizon: long
linked_portfolios: [main, retirement-ira]
allocation_template: aggressive-long
currency: USD
created: 2026-02-24
---
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Y | Goal identifier (lowercase, no spaces) |
| `type` | enum | Y | retirement / education / home / emergency / travel / general |
| `target_amount` | number | Y | Target dollar amount |
| `target_date` | date | Y | Target completion date (YYYY-MM-DD) |
| `annual_return_target` | number | N | Required annual return % (auto-calculated) |
| `monthly_contribution` | number | N | Planned monthly contribution (default: 0) |
| `risk_tolerance` | enum | Y | conservative / moderate / aggressive |
| `horizon` | enum | N | short / medium / long (auto-derived from target_date) |
| `linked_portfolios` | list | Y | Portfolio names funding this goal |
| `allocation_template` | string | N | Template from goal-templates.md (auto-selected) |
| `currency` | string | N | Currency (default: USD) |
| `created` | date | Y | Creation date |

### Progress History Table

| Column | Description |
|--------|-------------|
| Date | Snapshot date (YYYY-MM-DD) |
| Portfolio Value | Combined value of linked portfolios |
| Cumulative Contributions | Total contributions to date |
| On Track | Yes / At Risk / Behind |

### Milestones Table

| Column | Description |
|--------|-------------|
| Target % | Milestone percentage (25%, 50%, 75%, 100%) |
| Amount | Dollar amount for this milestone |
| Date Reached | Date milestone was reached (empty if not yet) |
| Notes | Auto-generated or user notes |

---

## Workflow I: Initialize Portfolio

### Checklist
```
Initialize Portfolio Progress:
- [ ] Step 1: Get portfolio name and type from user
- [ ] Step 2: Set target allocation
- [ ] Step 3: Create portfolio file
- [ ] Step 4: Create or update config
- [ ] Step 5: Confirm creation
```

### Step 1: Gather Information

Ask the user for (provide sensible defaults):
- **Portfolio name** (default: "main")
- **Tax type**: taxable / tax-deferred (IRA/401k) / tax-free (Roth) (default: taxable)
- **Currency** (default: USD)
- **Benchmark** (default: SPY)
- **Rebalancing strategy** (default: threshold at 5%)
- **Link to goal** (optional): If the user mentions a goal (e.g., "for my retirement goal"), link this portfolio to that goal

If the user doesn't specify, use defaults and proceed.

### Step 2: Target Allocation

Offer preset templates or let user customize. Present these options:

**Aggressive Growth (80/20):**
| Asset Class | Target % |
|-------------|----------|
| US Equity | 50 |
| International Equity | 30 |
| Fixed Income | 15 |
| Alternatives | 5 |

**Balanced (60/40):**
| Asset Class | Target % |
|-------------|----------|
| US Equity | 35 |
| International Equity | 25 |
| Fixed Income | 30 |
| Alternatives | 5 |
| Cash | 5 |

**Conservative (40/60):**
| Asset Class | Target % |
|-------------|----------|
| US Equity | 20 |
| International Equity | 20 |
| Fixed Income | 45 |
| Alternatives | 5 |
| Cash | 10 |

**All-Weather (Ray Dalio inspired):**
| Asset Class | Target % |
|-------------|----------|
| US Equity | 30 |
| International Equity | 15 |
| Fixed Income | 40 |
| Alternatives | 15 |

**Custom:** Let user specify percentages (must sum to 100%).

### Step 3: Create Portfolio File

Use `write_file` to create `~/.dexter/portfolios/{name}.md`:

```markdown
---
name: {Portfolio Name}
currency: {CURRENCY}
benchmark: {BENCHMARK}
created: {TODAY_DATE}
rebalance_strategy: {STRATEGY}
rebalance_threshold: {THRESHOLD}
tax_type: {TAX_TYPE}
goals: [{GOAL_NAME_IF_LINKED}]
---

# {Portfolio Name}

## Target Allocation

| Asset Class | Target % |
|-------------|----------|
{ALLOCATION_ROWS}

## Holdings

| Ticker | Shares | Cost Basis | Date | Sector | Asset Class | Account Lot |
|--------|--------|------------|------|--------|-------------|-------------|

## Transactions

| Date | Type | Ticker | Shares | Price | Fees | Lot | Notes |
|------|------|--------|--------|-------|------|-----|-------|

## Dividends

| Date | Ticker | Amount | Shares | Reinvested |
|------|--------|--------|--------|------------|

## Notes

```

### Step 4: Create or Update Config

If `~/.dexter/portfolios/config.md` does not exist, create it:

```markdown
---
default_portfolio: {name}
risk_free_rate: 4.5
tax_rate_short_term: 37
tax_rate_long_term: 15
tax_rate_qualified_dividend: 15
reporting_currency: USD
---

# Portfolio Configuration

## Watchlist

| Ticker | Target Price | Notes |
|--------|-------------|-------|

## Sector Limits

| Sector | Max % |
|--------|-------|
| Technology | 35 |
| Healthcare | 15 |
| Financial | 15 |
| Consumer | 15 |
| Energy | 10 |
| Other | 10 |
```

If config already exists, do NOT overwrite it. Only update `default_portfolio` if this is the first portfolio.

### Step 5: Confirm

```
Created portfolio: {Name}
  Location: ~/.dexter/portfolios/{name}.md
  Type: {tax_type} | Currency: {currency} | Benchmark: {benchmark}
  Strategy: {rebalance_strategy} (threshold: {threshold}%)
  Allocation: {template_name}

  Next: Add positions with "/portfolio add <ticker> <shares> <price>"
```

---

## Workflow A: Portfolio Overview

### Checklist
```
Portfolio Overview Progress:
- [ ] Step 1: Discover all portfolio files
- [ ] Step 2: Read each portfolio file
- [ ] Step 3: Fetch current prices for all holdings
- [ ] Step 4: Calculate summary for each portfolio
- [ ] Step 5: Present consolidated overview
```

### Step 1: Discover Portfolio Files

Use `read_file` to check if `~/.dexter/portfolios/` directory exists.
List all `.md` files (excluding `config.md`).
If no portfolios exist, suggest: "No portfolios found. Create one with `/portfolio init`"

### Step 2: Read Each Portfolio

Use `read_file` for each portfolio `.md` file.
Parse YAML frontmatter for: name, currency, benchmark, tax_type.
Parse the Holdings table for all positions.

### Step 3: Fetch Current Prices

For each unique ticker across all portfolios:
- **Stocks/ETFs**: Use `financial_search` with query `"[TICKER] price snapshot"`
- **Crypto** (BTC, ETH, SOL, etc.): Use `crypto_search` with query `"[TOKEN] current price"`

Extract: current_price, day_change_percent

**Important**: Batch lookups — do NOT call the tool separately for each ticker if possible.

### Step 4: Calculate Per-Portfolio Summary

For each portfolio:
- **Total Market Value**: SUM(shares × current_price) for all holdings
- **Total Cost Basis**: SUM(shares × cost_basis) for all holdings
- **Total P&L**: Total Market Value - Total Cost Basis
- **Total Return %**: (Total P&L / Total Cost Basis) × 100
- **Day Change**: SUM(position_value × day_change_percent / 100)
- **Number of Positions**: count of unique tickers
- **Largest Position**: ticker with highest market value and its % of total

### Step 4.5: Goal Progress Summary (Optional)

If `~/.dexter/portfolios/goals/` directory exists and contains goal files:

1. Read each goal file
2. For each goal, calculate:
   - **Current value**: SUM(market value of linked portfolios)
   - **Progress %**: current_value / target_amount × 100
   - **Status**: On Track / At Risk / Behind (from most recent Progress History entry, or calculate via Workflow M logic)
3. Include a Goal Progress section in the output

### Step 5: Output Format

```
Portfolio Summary (as of {DATE})

{PORTFOLIO_NAME} ({TAX_TYPE})
  Market Value: $XXX,XXX    Cost: $XXX,XXX
  P&L: +$XX,XXX (+XX.X%)   Today: +$X,XXX (+X.XX%)
  Positions: N              Largest: AAPL (XX.X%)

{PORTFOLIO_NAME_2} ...

────────────────────────────────────────
Combined Total: $XXX,XXX    Total P&L: +$XX,XXX (+XX.X%)

{If goals exist:}
═══ Goal Progress ═══
  Goal            Target         Current     Progress   Status      Target Date
  retirement      $2,000,000     $485,000    24.3%      On Track    2045-06-01
  education       $200,000       $45,000     22.5%      At Risk     2035-09-01
```

If only one portfolio exists, also show the full holdings breakdown:

```
Holdings Detail
  Ticker   Shares   Avg Cost    Current    Value        P&L          Weight
  AAPL     80       $163.41     $192.30    $15,384      +$2,311 (+17.7%)   22.1%
  MSFT     40       $380.00     $415.20    $16,608      +$1,408 (+9.3%)    23.9%
  VTI      100      $220.30     $248.50    $24,850      +$2,820 (+12.8%)   35.7%
  ...
```

---

## Workflow B: Add Position

### Checklist
```
Add Position Progress:
- [ ] Step 1: Parse input (ticker, shares, price, optional: date, portfolio)
- [ ] Step 2: Validate ticker and determine asset class
- [ ] Step 3: Read target portfolio file
- [ ] Step 4: Generate lot ID and update Holdings table
- [ ] Step 5: Add transaction record
- [ ] Step 6: Confirm addition with current market data
```

### Step 1: Parse Input

Extract from user command or natural language:
- `ticker` (required): Stock/ETF/Crypto symbol (uppercase)
- `shares` (required): Number of shares/units (decimals OK)
- `price` (required): Purchase price per share
- `date` (optional): Purchase date YYYY-MM-DD, default to today
- `portfolio` (optional): Target portfolio name, default from config.md `default_portfolio`
- `fees` (optional): Transaction fees, default 0

**Examples:**
- `/portfolio add AAPL 50 185.50` → ticker=AAPL, shares=50, price=185.50
- `/portfolio add BTC 0.5 42000 2024-01-20` → includes date
- "애플 50주 185달러에 샀어" → ticker=AAPL, shares=50, price=185

### Step 2: Validate Ticker and Determine Asset Class

Use `financial_search` with query `"[TICKER] company facts"` to validate the ticker exists.
For crypto tokens, use `crypto_search` with query `"[TOKEN] token information"`.

Determine sector and asset class using [asset-class-taxonomy.md](asset-class-taxonomy.md).

If the ticker cannot be validated, warn the user but allow them to proceed.

### Step 3: Read Target Portfolio

Read `~/.dexter/portfolios/config.md` to find `default_portfolio`.
Read the target portfolio file with `read_file`.
If the portfolio file does not exist, tell the user: "Portfolio not found. Create one with `/portfolio init`"

### Step 4: Update Holdings Table

Find the highest existing lot number in the Holdings table (e.g., lot-007 → next is lot-008).
If no lots exist, start at lot-001.

Add a new row to the Holdings table:
```
| {TICKER} | {SHARES} | {PRICE} | {DATE} | {SECTOR} | {ASSET_CLASS} | {LOT_ID} |
```

Use `edit_file` to insert the new row at the end of the Holdings table (before the empty line after the table).

### Step 5: Add Transaction Record

Add a new row to the Transactions table:
```
| {DATE} | BUY | {TICKER} | {SHARES} | {PRICE} | {FEES} | {LOT_ID} | {NOTES} |
```

Use `edit_file` to insert the transaction row.

### Step 6: Confirm with Market Data

Fetch current price: `financial_search` query `"[TICKER] price snapshot"` (or `crypto_search` for crypto).

Output:
```
Added: {SHARES} shares of {TICKER} @ ${PRICE} ({LOT_ID})
  Current Price: ${CURRENT}  |  Unrealized: {+/-}${DIFF} ({+/-}X.X%)
  Portfolio: {PORTFOLIO_NAME}  |  Asset Class: {ASSET_CLASS}  |  Sector: {SECTOR}
```

---

## Workflow C: Record Sale

### Checklist
```
Record Sale Progress:
- [ ] Step 1: Parse input (ticker, shares, price, optional: lot method)
- [ ] Step 2: Read portfolio and find matching lots
- [ ] Step 3: Determine which lots to sell (FIFO default)
- [ ] Step 4: Calculate realized gain/loss and holding period
- [ ] Step 5: Update Holdings and Transactions tables
- [ ] Step 6: Present tax impact summary
```

### Step 1: Parse Input

Extract:
- `ticker` (required): Symbol to sell
- `shares` (required): Number of shares to sell
- `price` (required): Sale price per share
- `date` (optional): Sale date, default to today
- `lot_method` (optional): FIFO (default), LIFO, HIFO, or specific lot ID
- `portfolio` (optional): Portfolio name, default from config
- `fees` (optional): Transaction fees, default 0

### Step 2: Read Portfolio and Find Lots

Read the portfolio file and find all Holdings rows matching the ticker.
Sort lots by date for FIFO processing.

Verify total available shares >= requested sell shares.
If not enough shares, report: "Only {N} shares of {TICKER} available (requested {M})."

### Step 3: Lot Selection

Apply the selected method to determine which lots to sell:

**FIFO (default)**: Sell oldest lots first (by purchase date).
**LIFO**: Sell newest lots first.
**HIFO** (Highest In, First Out): Sell highest cost basis first (minimizes gain / maximizes loss).
**Specific lot**: Sell from the user-specified lot ID.

If selling partially consumes a lot, split it: reduce shares in the existing lot row, don't delete it.

### Step 4: Calculate Tax Impact

For each lot being sold, calculate:
- **Holding Period**: (sale_date - purchase_date) in days
- **Classification**: Short-term if < 366 days, Long-term if >= 366 days
- **Realized Gain/Loss**: (sale_price - cost_basis) × shares_sold
- **Tax Estimate**: gain × applicable_tax_rate (from config.md: `tax_rate_short_term` or `tax_rate_long_term`)

Read `~/.dexter/portfolios/config.md` for tax rates.
If `tax_type` is `tax-deferred` or `tax-free`, skip tax estimate and note: "No immediate tax impact (tax-advantaged account)."

### Step 5: Update Files

Using `edit_file`:

1. **Holdings table**: Remove fully sold lots, reduce shares for partially sold lots.
2. **Transactions table**: Add SELL transaction row(s):
```
| {DATE} | SELL | {TICKER} | {SHARES} | {PRICE} | {FEES} | {LOT_ID} | {NOTES} |
```

### Step 6: Output Format

```
SELL: {SHARES} shares of {TICKER} @ ${PRICE}

  Lot        Shares   Cost Basis   Gain/Loss      Holding     Type
  lot-001    30       $150.25      +$1,342.50     345 days    Short-term
  lot-002    20       $185.50      +$190.00       180 days    Short-term

  Total Realized Gain: +$1,532.50
  Estimated Tax: $567.03 (short-term @ 37%)
  Net Proceeds: ${TOTAL_PROCEEDS}

  Remaining {TICKER} position: {REMAINING_SHARES} shares (avg cost: ${AVG})
```

---

## Workflow D: Performance Analysis

### Checklist
```
Performance Analysis Progress:
- [ ] Step 1: Read portfolio and fetch current prices
- [ ] Step 2: Calculate position-level metrics
- [ ] Step 3: Calculate portfolio-level return metrics
- [ ] Step 4: Calculate risk-adjusted metrics
- [ ] Step 5: Generate performance attribution
- [ ] Step 6: Present comprehensive report
```

### Step 1: Read Portfolio and Fetch Current Prices

Read the portfolio file with `read_file`.
Parse Holdings table for all positions.
Read `~/.dexter/portfolios/config.md` for `risk_free_rate` and `benchmark`.

Fetch current prices for all holdings:
- **Stocks/ETFs**: `financial_search` query `"[TICKER] price snapshot"`
- **Crypto**: `crypto_search` query `"[TOKEN] current price"`

Also fetch key ratios for major holdings:
- `financial_search` query `"[TICKER] key ratios"` — extract: beta, dividend_yield

Fetch benchmark data:
- `financial_search` query `"[BENCHMARK] price performance returns YTD 1-year"`
- `financial_search` query `"[BENCHMARK] key ratios"` — extract: YTD return, 1-year return

If the portfolio has no holdings, respond: "Your portfolio has no holdings yet. Add positions first with `/portfolio add <ticker> <shares> <price>`."

### Step 2: Position-Level Metrics

For each holding (aggregate lots by ticker for display):

- **Total Shares**: SUM(shares) across all lots of the same ticker
- **Average Cost**: SUM(shares × cost_basis) / total_shares
- **Market Value**: total_shares × current_price
- **Weight**: position_market_value / total_portfolio_value × 100
- **Unrealized P&L ($)**: market_value - (total_shares × average_cost)
- **Unrealized P&L (%)**: (current_price - average_cost) / average_cost × 100
- **Contribution to Return**: weight × position_return / 100

Sort by contribution (descending) to identify top contributors and detractors.

### Step 3: Portfolio-Level Return Metrics

Calculate these portfolio-level metrics:

**Simple Total Return:**
- total_cost = SUM(shares × cost_basis) for all holdings
- total_value = SUM(shares × current_price) for all holdings
- total_return = (total_value - total_cost) / total_cost × 100

**Time-Weighted Return (TWR):**
Using the Transactions table, identify all cash flow events (BUY, SELL, TRANSFER_IN, TRANSFER_OUT).
For each sub-period between consecutive cash flows:
- period_return = (end_value - start_value - net_cash_flow) / start_value
- Note: net_cash_flow = buys (positive inflow to portfolio) - sells (negative outflow)

Chain-link all sub-period returns:
- TWR = [PRODUCT(1 + period_return_i) - 1] × 100

**Annualized TWR:**
- days_held = (today - portfolio_created_date)
- annualized_twr = [(1 + TWR/100) ^ (365/days_held) - 1] × 100

**Simplification for MVP**: If transaction history is too sparse to compute accurate sub-period returns, fall back to a simple annualized return using the total return and holding period.

**Money-Weighted Return (MWR / IRR):**
Using all cash flows from Transactions (BUY = negative cash flow, SELL = positive cash flow) and the current portfolio value as the terminal cash flow:

Solve for r in: SUM(CF_i / (1+r)^(t_i/365)) + current_value / (1+r)^(T/365) = 0

Use iterative approximation:
1. Start with initial_guess = simple_annualized_return
2. Apply Newton-Raphson or bisection for 10 iterations
3. Report result with note on approximation

**When TWR ≈ MWR**: Cash flow timing had minimal impact.
**When TWR > MWR**: Investor added money at poor times (bought high).
**When TWR < MWR**: Investor timed additions well (bought low).

### Step 4: Risk-Adjusted Metrics

Read `risk_free_rate` from config.md (default: 4.5%).
Read `benchmark` from portfolio frontmatter (default: SPY).

Fetch benchmark return data via `financial_search`:
- Query: `"[BENCHMARK] price performance returns YTD 1-year"`

**Estimate portfolio beta** using position-level betas:
- For each stock/ETF: use beta from `financial_search` key ratios
- If beta unavailable for a holding: use 1.0 for stocks, 0.0 for bonds, 0.3 for gold, 1.5 for crypto
- Portfolio beta = SUM(weight_i × beta_i)

**Estimate portfolio volatility** from position betas:
- benchmark_vol = estimate from benchmark data (typical: SPY ~15%, AGG ~5%)
- portfolio_vol ≈ portfolio_beta × benchmark_vol
- This is an approximation; note this in the output

Calculate risk-adjusted metrics:

| Metric | Formula |
|--------|---------|
| **Alpha** | portfolio_annualized_return - [risk_free_rate + portfolio_beta × (benchmark_annualized_return - risk_free_rate)] |
| **Sharpe Ratio** | (portfolio_annualized_return - risk_free_rate) / portfolio_vol |
| **Sortino Ratio** | (portfolio_annualized_return - risk_free_rate) / downside_deviation |
| **Treynor Ratio** | (portfolio_annualized_return - risk_free_rate) / portfolio_beta |

For **Sortino Ratio**, estimate downside deviation:
- downside_deviation ≈ portfolio_vol × 0.7 (approximation: assumes ~70% of volatility is downside for typical equity portfolios)
- Note this approximation in output

**Max Drawdown** (estimated):
- If detailed price history is unavailable, estimate from beta:
  - max_dd ≈ portfolio_beta × benchmark_max_dd
  - Typical SPY max drawdown in recent years: -25% to -35% (use -30% as reference)
- If transaction history allows reconstruction of portfolio value over time, compute actual max drawdown

**Calmar Ratio**: annualized_return / |max_drawdown|

### Step 5: Performance Attribution

Group holdings by asset class and calculate attribution:

For each asset class:
- **Weight**: SUM(market_value in class) / total_value
- **Return**: weighted average return of holdings in class
- **Contribution**: weight × return (how much this class contributed to total return)

Also identify:
- **Top 3 Contributors**: Holdings with highest positive contribution
- **Top 3 Detractors**: Holdings with lowest (or most negative) contribution

Compare actual weights vs Target Allocation:
- **Selection Effect**: (actual_weight - target_weight) × (class_return - portfolio_return)
  - Positive = overweighting outperformers or underweighting underperformers

### Step 6: Output Format

```
Performance Report: {PORTFOLIO_NAME}
Period: {CREATED_DATE} to {TODAY} ({DAYS} days)

═══ Return Metrics ═══
  Total Return:       +XX.X%      Benchmark ({BENCHMARK}): +XX.X%
  TWR (annualized):   +XX.X%      MWR (IRR):               +XX.X%
  Excess Return:      +X.X%       (vs benchmark)

═══ Risk-Adjusted Metrics ═══
  Alpha:              +X.X%       Beta:              X.XX
  Sharpe Ratio:       X.XX        Sortino Ratio:     X.XX
  Treynor Ratio:      X.XX        Calmar Ratio:      X.XX
  Max Drawdown (est): -XX.X%      Portfolio Vol (est): XX.X%

═══ Top Contributors ═══                ═══ Top Detractors ═══
  {TICKER}: +X.X% contrib                {TICKER}: -X.X% contrib
  {TICKER}: +X.X% contrib                {TICKER}: -X.X% contrib
  {TICKER}: +X.X% contrib                {TICKER}: -X.X% contrib

═══ Asset Class Attribution ═══
  Class              Weight   Return    Contribution   vs Target
  US Equity          XX.X%    +XX.X%    +XX.X%         +X.X% over
  Intl Equity        XX.X%    +XX.X%    +X.X%          -X.X% under
  Fixed Income       XX.X%    +X.X%     +X.X%          OK
  Alternatives       X.X%     +XX.X%    +X.X%          OK
  Cash               X.X%     +X.X%     +X.X%          OK

{If portfolio is linked to a goal:}
═══ Goal Trajectory ═══
  Goal: {GOAL_NAME}  |  Target: ${TARGET}  |  Deadline: {TARGET_DATE}
  Required Annual Return:  {X.X}%
  Actual Annual Return:    {X.X}%  ({ABOVE/BELOW} target by {X.X}%)
  Projected Value at Deadline: ${XXX,XXX} (base case)
  Status: {On Track / At Risk / Behind}

═══ Holdings Detail ═══
  Ticker   Shares   Avg Cost    Current    Value        P&L              Weight
  AAPL     80       $163.41     $192.30    $15,384      +$2,311 (+17.7%) 22.1%
  MSFT     40       $380.00     $415.20    $16,608      +$1,408 (+9.3%)  23.9%
  VTI      100      $220.30     $248.50    $24,850      +$2,820 (+12.8%) 35.7%
  ...

Note: Volatility and Sortino estimates use beta-based approximation.
      For precise metrics, longer price history is required.

Past performance does not guarantee future results. This is not investment advice.
```

---

## Workflow J: Benchmark Comparison

### Checklist
```
Benchmark Comparison Progress:
- [ ] Step 1: Read portfolio and determine benchmark
- [ ] Step 2: Fetch benchmark performance data
- [ ] Step 3: Calculate relative metrics
- [ ] Step 4: Present comparison report
```

### Step 1: Read Portfolio and Determine Benchmark

Read the portfolio file. Extract benchmark from YAML frontmatter.
If `custom_benchmark_weights` is set, use that. Otherwise use `benchmark` field (default: SPY).

Read config.md for `risk_free_rate`.

Calculate current portfolio metrics (reuse calculations from Workflow D Steps 1-4 if recently computed, otherwise recalculate).

### Step 2: Fetch Benchmark Performance Data

See [benchmark-definitions.md](benchmark-definitions.md) for the full list of supported benchmarks and how to fetch data.

**For single-ticker benchmark** (e.g., SPY):
- `financial_search` query: `"[BENCHMARK] price performance returns YTD 1-year 3-year"`
- `financial_search` query: `"[BENCHMARK] key ratios"` — extract: dividend_yield, beta (should be ~1.0)

**For blended benchmark** (e.g., SPY:60,AGG:40):
- Fetch each component separately via `financial_search`
- Calculate blended return: SUM(component_return × weight / 100)
- Calculate blended volatility: approximate as SUM(weight_i × vol_i) (simplified; ignores correlation benefit)

Extract from benchmark data:
- YTD return, 1-year return
- Day change %
- Volatility (annualized)
- Dividend yield

### Step 3: Calculate Relative Metrics

| Metric | Formula |
|--------|---------|
| **Excess Return** | portfolio_total_return - benchmark_total_return |
| **Annualized Excess** | portfolio_annualized - benchmark_annualized |
| **Tracking Error** | Estimate: \|portfolio_vol - benchmark_vol\| + 2% (approximation without daily returns) |
| **Information Ratio** | annualized_excess / tracking_error |

**Up/Down Capture** (estimated from beta):
- Up Capture ≈ portfolio_beta × 100 + alpha_contribution
  - If alpha > 0: up_capture ≈ (portfolio_beta + alpha/benchmark_return) × 100
  - Simplification: up_capture ≈ portfolio_beta × 105 if alpha > 0, else portfolio_beta × 95
- Down Capture ≈ portfolio_beta × 100 - alpha_contribution
  - Simplification: down_capture ≈ portfolio_beta × 95 if alpha > 0, else portfolio_beta × 105
- Note these are rough estimates in the output

**Active Positioning** (comparing portfolio sector weights to benchmark):
For each asset class or sector:
- active_weight = portfolio_weight - benchmark_typical_weight
- Report significant over/under weights (|active_weight| > 3%)

Typical SPY sector weights for reference:
| Sector | Typical SPY Weight |
|--------|-------------------|
| Technology | 30% |
| Healthcare | 13% |
| Financial | 13% |
| Consumer Discretionary | 10% |
| Communication | 9% |
| Industrial | 8% |
| Consumer Staples | 6% |
| Energy | 4% |
| Utilities | 3% |
| Real Estate | 2% |
| Materials | 2% |

### Step 4: Output Format

```
Benchmark Comparison: {PORTFOLIO_NAME} vs {BENCHMARK}
Period: {CREATED_DATE} to {TODAY}

                      Portfolio     Benchmark     Difference
Total Return          +XX.X%        +XX.X%        {+/-}X.X%
Annualized            +XX.X%        +XX.X%        {+/-}X.X%
Volatility (est)      XX.X%         XX.X%         {+/-}X.X%
Sharpe Ratio          X.XX          X.XX          {+/-}X.XX
Max Drawdown (est)    -XX.X%        -XX.X%        {+/-}X.X%
Dividend Yield        X.XX%         X.XX%         {+/-}X.XX%
Beta                  X.XX          1.00          —

═══ Capture Ratios (estimated) ═══
  Up Capture:    ~XXX.X%   ({interpretation})
  Down Capture:  ~XX.X%    ({interpretation})

═══ Active Positioning ═══
  Overweight:  {Sector} (+X.X%), {Sector} (+X.X%)
  Underweight: {Sector} (-X.X%), {Sector} (-X.X%)

═══ Interpretation ═══
{2-3 sentences summarizing whether the portfolio is outperforming/underperforming,
 whether risk-adjusted returns justify any additional risk taken,
 and whether active positioning has helped or hurt.}

Note: Capture ratios and volatility are estimated from beta.
Past performance does not guarantee future results. This is not investment advice.
```

---

## Workflow K: Allocation Analysis

### Checklist
```
Allocation Analysis Progress:
- [ ] Step 1: Read portfolio and fetch current prices
- [ ] Step 2: Compute allocation by multiple dimensions
- [ ] Step 3: Compare to target allocation
- [ ] Step 4: Generate visual allocation breakdown
- [ ] Step 5: Identify concentration issues and recommendations
```

### Step 1: Read Portfolio and Fetch Current Prices

Read portfolio file with `read_file`.
Parse Holdings table and Target Allocation table.
Fetch current prices for all holdings (same as Workflow A Step 3).

Calculate market value for each position: shares × current_price.
Calculate total portfolio value: SUM(all position market values).

If the portfolio has no holdings, respond: "Your portfolio has no holdings yet. Add positions first with `/portfolio add <ticker> <shares> <price>`."

### Step 2: Compute Multi-Dimensional Allocation

Calculate weight breakdowns by **five dimensions**:

**Dimension 1: Asset Class**
Group holdings by the Asset Class column:
- US Equity, International Equity, Fixed Income, Alternatives, Cash, Crypto
- Weight = SUM(market_value in class) / total_value × 100

**Dimension 2: Sector**
Group holdings by the Sector column:
- Technology, Healthcare, Financial, Consumer, Energy, Industrial, Materials, Utilities, Real Estate, Broad Market, Commodities, Fixed Income, Crypto
- Weight = SUM(market_value in sector) / total_value × 100

**Dimension 3: Geography**
Map holdings to geography using [asset-class-taxonomy.md](asset-class-taxonomy.md):
- US: All US Equity holdings + US-listed individual stocks
- Developed International: EFA, VEA, IEFA + European/Japanese ADRs
- Emerging Markets: VWO, IEMG, EEM + EM ADRs
- Global: ACWI, VT, VXUS (split as ~45% Developed, ~25% EM, ~30% US overlap)
- Other: Crypto, Commodities (non-geographic)

For international ETFs like VXUS, use approximate geographic breakdown:
- Europe: ~40%, Asia-Pacific: ~30%, Emerging: ~25%, Other: ~5%

**Dimension 4: Investment Vehicle**
- Individual Stock: Single company equities (AAPL, MSFT, etc.)
- ETF: Exchange-traded funds (VTI, SPY, BND, etc.)
- Crypto: Direct crypto holdings (BTC, ETH, etc.)
- Other: Anything not classified above

**Dimension 5: Market Cap** (for equity holdings)
Use the sub-type from [asset-class-taxonomy.md](asset-class-taxonomy.md):
- Large Cap: SPY, VOO, individual large-cap stocks (market cap > $10B)
- Mid Cap: VO, IJH, mid-cap stocks ($2B-$10B)
- Small Cap: IWM, VB, small-cap stocks (< $2B)
- Total Market: VTI, ITOT (mix of all caps)
- N/A: Bonds, commodities, crypto

For individual stocks, use `financial_search` `"[TICKER] company facts"` to check market_cap:
- > $10B → Large Cap
- $2B-$10B → Mid Cap
- < $2B → Small Cap
- If data unavailable, default to Large Cap

### Step 3: Compare to Target Allocation

Read Target Allocation table from the portfolio.
For each asset class:
- **Current Weight**: from Step 2 Dimension 1
- **Target Weight**: from Target Allocation table
- **Drift**: current - target (absolute %)
- **Drift Ratio**: drift / target × 100 (relative %)
- **Status**: OK (|drift| ≤ threshold), OVER (drift > threshold), UNDER (drift < -threshold)

Read `rebalance_threshold` from YAML frontmatter (default: 5%).

### Step 4: Generate Visual Allocation Breakdown

Present ASCII bar charts for each dimension. Use filled block characters (█) for the bars.

**Bar chart generation rules:**
- Max bar width: 30 characters
- Scale: largest weight maps to 30 chars, others proportional
- Show percentage and absolute dollar value

```
═══ Asset Class Allocation ═══

  Asset Class          Current    Target    Drift     Status
  US Equity            ████████████████████████  52.3%  (50%)   +2.3%  OK
  Intl Equity          ██████████               18.1%  (20%)   -1.9%  OK
  Fixed Income         ███████████              19.8%  (20%)   -0.2%  OK
  Alternatives         ███                       5.8%  (5%)    +0.8%  OK
  Cash                 ██                        4.0%  (5%)    -1.0%  OK

═══ Sector Breakdown ═══

  Sector               Weight    Value
  Technology           █████████████████             32.1%   $XX,XXX
  Broad Market         ██████████████                28.5%   $XX,XXX
  Fixed Income         ███████████                   19.8%   $XX,XXX
  Commodities          ███                            5.5%   $X,XXX
  Crypto               ██                             4.1%   $X,XXX
  Healthcare           ██                             3.8%   $X,XXX
  Financial            █                              2.5%   $X,XXX
  Other                █                              3.7%   $X,XXX

═══ Geography ═══

  Region               Weight
  United States        ████████████████████████████  72.3%
  Developed Intl       ████████                      18.1%
  Emerging Markets     ██                             5.5%
  Non-Geographic       ██                             4.1%

═══ Vehicle Type ═══

  Type                 Weight    Count
  ETF                  ██████████████████████████    75.2%   5 positions
  Individual Stock     ██████████                    20.7%   3 positions
  Crypto               ██                             4.1%   1 position

═══ Market Cap (Equity Only) ═══

  Size                 Weight
  Large Cap            ██████████████████████████    62.5%
  Total Market         █████████████                 30.2%
  Mid Cap              ██                             4.8%
  Small Cap            █                              2.5%
```

### Step 5: Identify Concentration Issues and Recommendations

Check for concentration risks and report:

**Single Position Concentration:**
- Flag any position > 10% of portfolio: "⚠ {TICKER} is {XX.X}% of portfolio — consider trimming for diversification"
- Warning at > 5% for individual stocks (not broad ETFs): "Note: {TICKER} is {XX.X}% — monitor closely"

**Sector Concentration:**
Read sector limits from config.md `Sector Limits` table.
- Flag any sector exceeding its limit: "⚠ {SECTOR} at {XX.X}% exceeds {LIMIT}% limit"
- Warning at 80% of limit: "Note: {SECTOR} at {XX.X}% approaching {LIMIT}% limit"

**Asset Class Drift:**
From Step 3, flag any asset class where |drift| > rebalance_threshold:
- "⚠ {ASSET_CLASS} has drifted {+/-}X.X% from target — consider rebalancing"

**Geography Concentration:**
- Flag if US exposure > 80%: "Note: {XX.X}% US concentration — consider international diversification"
- Flag if any single non-US country > 15%: "Note: {COUNTRY} is {XX.X}% — significant single-country exposure"

**Vehicle Diversification:**
- Flag if individual stocks > 40% of portfolio: "Note: {XX.X}% in individual stocks — consider ETFs for broader diversification"

**Herfindahl-Hirschman Index (HHI):**
- HHI = SUM(weight_i² / 10000) for all positions (where weight is in %)
- HHI < 0.10: "Well Diversified"
- HHI 0.10-0.25: "Moderately Concentrated"
- HHI > 0.25: "Highly Concentrated"

Output:
```
═══ Concentration Analysis ═══

  Diversification Score (HHI): 0.08 — Well Diversified

  Warnings:
  ⚠ AAPL is 12.3% of portfolio — consider trimming for diversification
  ⚠ Technology sector at 32.1% approaching 35% limit

  Recommendations:
  • Consider adding international exposure (currently 18.1% vs 20% target)
  • Portfolio is 72.3% US — adding VXUS or EFA would improve geographic diversification
  • Individual stock concentration is 20.7% — within acceptable range

Past performance does not guarantee future results. This is not investment advice.
```

---

## Workflow E: Rebalancing

### Checklist
```
Rebalancing Progress:
- [ ] Step 1: Read portfolio, targets, and current prices
- [ ] Step 2: Calculate current vs target allocation
- [ ] Step 3: Detect drift and determine if rebalancing is needed
- [ ] Step 4: Generate rebalancing trades
- [ ] Step 5: Assess tax impact of proposed trades
- [ ] Step 6: Present recommendations with alternatives
```

### Step 1: Read Portfolio, Targets, and Current Prices

**Goal-based routing**: If the user includes `--goal [name]` or mentions "goal-based rebalancing", route to **Workflow N: Goal-Based Rebalancing** instead.

Read the portfolio file with `read_file`.
Parse: Holdings table, Target Allocation table, YAML frontmatter (rebalance_strategy, rebalance_threshold, tax_type).
Read `~/.dexter/portfolios/config.md` for tax rates (`tax_rate_short_term`, `tax_rate_long_term`).

Fetch current prices for all holdings:
- **Stocks/ETFs**: `financial_search` query `"[TICKER] price snapshot"`
- **Crypto**: `crypto_search` query `"[TOKEN] current price"`

Calculate total portfolio value: SUM(shares × current_price) for all holdings.

If the portfolio has no holdings, respond: "Your portfolio has no holdings yet. Add positions first with `/portfolio add <ticker> <shares> <price>`."

### Step 2: Calculate Current vs Target Allocation

For each asset class in the Target Allocation table:

```
current_value = SUM(market_value of holdings in this asset class)
current_weight = current_value / total_portfolio_value × 100
target_weight = from Target Allocation table
drift = current_weight - target_weight
drift_ratio = drift / target_weight × 100  (relative %)
```

Build the allocation comparison table with all asset classes.

### Step 3: Detect Drift and Determine Rebalancing Need

Apply the strategy from YAML frontmatter. See [rebalancing-strategies.md](rebalancing-strategies.md) for full details.

**Threshold Strategy** (`rebalance_strategy: threshold`):
- Check if ANY asset class has |drift| > `rebalance_threshold`
- If yes → Rebalancing recommended
- If no → "Portfolio is within tolerance. No rebalancing needed."

**Calendar Strategy** (`rebalance_strategy: calendar`):
- Find the most recent rebalancing event in the Transactions table (look for pairs of SELL+BUY on the same date)
- If no prior rebalance found, use the portfolio `created` date
- Check if the required period has elapsed:
  - quarterly: 90 days
  - semi-annual: 180 days
  - annual: 365 days
- If elapsed → Rebalancing is due
- If not → "Next scheduled rebalance: {date}. Current drift: {max_drift}%"

**Band Strategy** (`rebalance_strategy: band`):
- For each asset class, check drift against inner band (`rebalance_band_inner`) and outer band (`rebalance_band_outer`)
- |drift| ≤ inner → OK
- inner < |drift| ≤ outer → ADVISORY (optional rebalance)
- |drift| > outer → MANDATORY (must rebalance)

### Step 4: Generate Rebalancing Trades

For each asset class needing adjustment:

**Calculate target values:**
```
target_value = target_weight / 100 × total_portfolio_value
adjustment_needed = target_value - current_value
```

**For OVERWEIGHT classes (adjustment_needed < 0, need to SELL):**

Select specific lots to sell using tax-optimized priority (see [rebalancing-strategies.md](rebalancing-strategies.md)):
1. Lots with unrealized losses first (harvest tax benefit)
2. Long-term gain lots next (lower tax rate, 15%)
3. Short-term gain lots last (higher tax rate, 37%)

Within each tier, prefer lots with smallest gains.
Convert dollar amount to shares: shares_to_sell = |adjustment_needed| / current_price.
Round to nearest whole share (except crypto).

**For UNDERWEIGHT classes (adjustment_needed > 0, need to BUY):**

Select what to buy:
1. If portfolio already holds positions in this class → add to existing largest position
2. If no existing position → suggest default ETF:
   - US Equity → VTI
   - International Equity → VXUS
   - Fixed Income → BND
   - Alternatives → GLD
   - Cash → SGOV

Convert dollar amount to shares: shares_to_buy = adjustment_needed / current_price.
Round to nearest whole share.

**Minimum trade filter:** Skip trades < $100 or < 1 share. Note as "Below minimum threshold."

### Step 5: Assess Tax Impact

For each proposed SELL trade, calculate:

- **Lot identification**: Which lot(s) will be sold (from Step 4 priority order)
- **Holding period**: (today - lot_purchase_date) in days
- **Classification**: Short-term (< 366 days) or Long-term (≥ 366 days)
- **Realized gain/loss**: (current_price - lot_cost_basis) × shares_to_sell
- **Tax estimate**: realized_gain × applicable_rate (from config.md)

Sum all trades:
- **Total realized gains**: SUM(positive gains)
- **Total realized losses**: SUM(negative gains) — these offset gains
- **Net taxable gain**: total_gains + total_losses (losses reduce gains)
- **Estimated tax**: net_taxable_gain × applicable_rate (use blended rate if mix of ST/LT)

**For tax-deferred/tax-free accounts**: Skip tax calculation entirely. Note: "No tax impact — tax-advantaged account."

**Wash sale check**: For any lot sold at a loss, warn if the rebalancing plan also buys a "substantially identical" security. See [rebalancing-strategies.md](rebalancing-strategies.md) for wash sale rules.

### Step 6: Output Format

```
Rebalancing Analysis: {PORTFOLIO_NAME}
Strategy: {STRATEGY} ({DETAILS})  |  Total Value: ${TOTAL}

═══ Current Allocation vs Target ═══

  Asset Class          Current    Target    Drift     Status
  US Equity            55.2%      50.0%     +5.2%     ⚠ OVER
  Intl Equity          16.8%      20.0%     -3.2%     ⚠ UNDER
  Fixed Income         18.5%      20.0%     -1.5%     OK
  Alternatives         5.5%       5.0%      +0.5%     OK
  Cash                 4.0%       5.0%      -1.0%     OK

═══ Recommended Trades ═══

  Action   Ticker   Shares   Est. Value    Lot         Tax Impact
  SELL     AAPL     15       $2,884        lot-002     +$675 ST gain → $250 tax
  BUY      VXUS     45       $2,500        (new)       N/A
  BUY      BND      5        $384          (add)       N/A

═══ Tax Summary ═══

  Realized Gains:  $675 (short-term)
  Realized Losses: $0
  Net Taxable:     $675
  Estimated Tax:   $250 (ST @ 37%)

═══ Post-Rebalance Allocation ═══

  Asset Class          Before     After      Target
  US Equity            55.2%      50.1%      50.0%
  Intl Equity          16.8%      20.0%      20.0%
  Fixed Income         18.5%      19.9%      20.0%
  Alternatives         5.5%       5.5%       5.0%
  Cash                 4.0%       4.5%       5.0%

═══ Alternative: Cash Flow Rebalancing ═══

  Deposit ${AMOUNT} and allocate:
    VXUS: $2,500 (45 shares)
    BND:  $384 (5 shares)
    SGOV: $316 (remainder to cash)
  → No sells needed, no tax events
  → Reduces max drift from 5.2% to 2.1%

Note: Review trades before executing. Prices may change.
Past performance does not guarantee future results. This is not investment advice.
```

**Cash flow rebalancing alternative:**
Always present this option if the portfolio has overweight classes:
```
deposit_needed = SUM(|adjustment_needed| for all underweight classes)
```
Show how depositing that amount would reduce drift without any sells.

---

## Workflow F: Risk Analysis

### Checklist
```
Risk Analysis Progress:
- [ ] Step 1: Read portfolio and fetch current data
- [ ] Step 2: Calculate portfolio beta and volatility
- [ ] Step 3: Calculate Value at Risk (VaR)
- [ ] Step 4: Analyze concentration risk
- [ ] Step 5: Run stress test scenarios
- [ ] Step 6: Compute overall risk score
- [ ] Step 7: Present risk dashboard
```

### Step 1: Read Portfolio and Fetch Current Data

Read the portfolio file with `read_file`.
Parse Holdings table for all positions.
Read config.md for `risk_free_rate`.

Fetch current prices and key ratios for all holdings:
- `financial_search` query `"[TICKER] price snapshot"` — current price
- `financial_search` query `"[TICKER] key ratios"` — extract: beta, dividend_yield
- For crypto: `crypto_search` query `"[TOKEN] current price and market data"`

Calculate position weights: position_value / total_portfolio_value.

If the portfolio has no holdings, respond: "Your portfolio has no holdings yet. Add positions first with `/portfolio add <ticker> <shares> <price>`."

### Step 2: Calculate Portfolio Beta and Volatility

**Portfolio Beta:**
```
β_portfolio = Σ (w_i × β_i)
```

For each holding:
- Use beta from `financial_search` key ratios if available
- If unavailable, use defaults from [risk-metrics-guide.md](risk-metrics-guide.md):
  - US stocks: 1.0, International stocks: 0.9, Bonds: 0.0, Gold: 0.0, REITs: 0.8, Crypto: 1.5-2.0

**Portfolio Volatility:**
Use the full correlation-based calculation from [risk-metrics-guide.md](risk-metrics-guide.md):

1. Group holdings by asset class
2. Calculate class-level weights and volatilities
3. Apply the correlation matrix:
```
σ²_p = Σ_i Σ_j (w_i × w_j × σ_i × σ_j × ρ_ij)
σ_p = √(σ²_p)
```

Correlations between asset classes:
- US Equity ↔ Intl Equity: 0.75
- Equities ↔ Fixed Income: -0.20
- Equities ↔ Gold: 0.05
- Equities ↔ Crypto: 0.30
- Fixed Income ↔ Gold: 0.30

Show the calculation step by step for transparency.

### Step 3: Calculate Value at Risk (VaR)

Using portfolio volatility from Step 2:

| Metric | Formula | Z-score |
|--------|---------|---------|
| Daily VaR (95%) | total_value × σ_p / √252 × 1.645 | 1.645 |
| Daily VaR (99%) | total_value × σ_p / √252 × 2.326 | 2.326 |
| Weekly VaR (95%) | Daily VaR (95%) × √5 | — |
| Monthly VaR (95%) | Daily VaR (95%) × √21 | — |

**Conditional VaR (Expected Shortfall):**
```
CVaR (95%) ≈ VaR (95%) × 1.22
```
This estimates the average loss in the worst 5% of scenarios.

Present all values as both dollar amounts and percentages of portfolio value.

### Step 4: Analyze Concentration Risk

**Position Concentration:**
For each holding, calculate weight. Flag:
- Individual stock > 10%: CRITICAL — "⚠ {TICKER} is {XX.X}% — significant single-stock risk"
- Individual stock > 5%: WARNING — "Note: {TICKER} is {XX.X}% — monitor concentration"
- Top 5 holdings combined: report percentage

**Herfindahl-Hirschman Index:**
```
HHI = Σ (w_i²)  where w_i is decimal weight
Effective positions = 1 / HHI
```
Interpret per [risk-metrics-guide.md](risk-metrics-guide.md): < 0.10 = Well Diversified, 0.10-0.25 = Moderate, > 0.25 = Concentrated.

**Sector Concentration:**
Group by sector. Read Sector Limits from config.md.
- Flag sectors exceeding limit
- Flag sectors at 80%+ of limit

**Geography Concentration:**
Map holdings to geography (US, Developed Intl, Emerging, Non-Geographic).
- Flag if > 80% in single country/region

**Correlation Risk:**
Identify pairs of individual stocks in the same sector:
- If combined weight > 10%: "⚠ {TICKER1} + {TICKER2}: correlated pair ({SECTOR}), combined {XX.X}%"
- Suggest replacing one with a sector ETF for diversification

### Step 5: Run Stress Test Scenarios

Apply the stress scenarios from [risk-metrics-guide.md](risk-metrics-guide.md):

For each scenario, calculate portfolio impact:
```
scenario_impact = Σ (w_i × scenario_return_for_asset_class_i)
scenario_dollar_impact = total_value × scenario_impact / 100
```

| Scenario | US Eq | Intl Eq | Bonds | Gold | Crypto | Description |
|----------|-------|---------|-------|------|--------|-------------|
| Market Crash | -20% | -22% | +5% | +10% | -35% | Sudden market drop |
| Rate Hike Cycle | -15% | -12% | -10% | -5% | -25% | Tightening policy |
| Recession | -30% | -25% | +10% | +15% | -50% | Economic downturn |
| Inflation Spike | -10% | -8% | -15% | +20% | -10% | Stagflation |
| Recovery Rally | +25% | +20% | -5% | -10% | +50% | Post-bottom rally |

For holdings that don't fit neatly into a class (e.g., specific sector stocks), use the US Equity return as default, adjusted by beta:
```
individual_stock_impact = scenario_us_equity × stock_beta
```

### Step 6: Compute Overall Risk Score

Score each factor from 1-10:

| Factor | Value | Score Logic |
|--------|-------|------------|
| Portfolio Beta | β_p | β < 0.5 → 2, 0.5-0.8 → 4, 0.8-1.2 → 6, 1.2-1.5 → 8, >1.5 → 10 |
| HHI | HHI | < 0.05 → 2, 0.05-0.10 → 4, 0.10-0.25 → 6, 0.25-0.50 → 8, >0.50 → 10 |
| Crypto Weight | w_crypto | 0% → 1, <3% → 3, 3-10% → 5, 10-20% → 7, >20% → 10 |
| Max Single Stock | max_w | <3% → 2, 3-5% → 4, 5-10% → 6, 10-20% → 8, >20% → 10 |
| Daily VaR / Value | var_pct | <1% → 2, 1-1.5% → 4, 1.5-2.5% → 6, 2.5-4% → 8, >4% → 10 |

Overall risk score = ROUND(average of all factor scores)

| Score | Label | Description |
|-------|-------|-------------|
| 1-2 | Very Conservative | Capital preservation focus |
| 3-4 | Conservative | Low risk, moderate returns |
| 5-6 | Moderate | Balanced risk/return |
| 7-8 | Aggressive | Growth focus, higher volatility |
| 9-10 | Very Aggressive | High risk, speculative elements |

### Step 7: Output Format

```
Risk Dashboard: {PORTFOLIO_NAME}
Total Value: ${TOTAL}  |  Risk Score: {SCORE}/10 ({LABEL})

═══ Portfolio Risk Metrics ═══

  Beta:                {X.XX}      ({interpretation})
  Volatility (est):    {XX.X}% annualized
  Sharpe Ratio:        {X.XX}

═══ Value at Risk ═══

  Horizon        95% VaR          99% VaR          CVaR (95%)
  Daily          -${X,XXX} (-X.X%)  -${X,XXX} (-X.X%)  -${X,XXX} (-X.X%)
  Weekly         -${X,XXX} (-X.X%)  —                   —
  Monthly        -${XX,XXX} (-X.X%) —                   —

  Interpretation: On 95% of days, loss should not exceed ${X,XXX}.
  In the worst 5% of days, average loss is estimated at ${X,XXX}.

═══ Concentration Analysis ═══

  Diversification (HHI):  {X.XX} — {Interpretation} ({N} effective positions)

  Position Concentration:
    Top 1:  {TICKER} — {XX.X}%    {⚠ if > 10%}
    Top 3:  {combined}%
    Top 5:  {combined}%

  Sector Exposure:
    {SECTOR}: {XX.X}%  {⚠ if over limit}
    {SECTOR}: {XX.X}%
    ...

  Geography:
    US: {XX.X}%  |  Intl Developed: {XX.X}%  |  EM: {XX.X}%  |  Other: {XX.X}%

  Correlation Flags:
    {⚠ flags or "No significant correlation concerns"}

═══ Stress Tests ═══

  Scenario            Impact        Dollar Impact    Key Drivers
  Market Crash        {-XX.X}%      -${XX,XXX}       {top 2 contributors}
  Rate Hike Cycle     {-XX.X}%      -${XX,XXX}       {top 2 contributors}
  Recession           {-XX.X}%      -${XX,XXX}       {top 2 contributors}
  Inflation Spike     {-XX.X}%      -${XX,XXX}       {top 2 contributors}
  Recovery Rally      {+XX.X}%      +${XX,XXX}       {top 2 contributors}

═══ Risk Factor Breakdown ═══

  Factor              Value         Score
  Portfolio Beta      {X.XX}        {N}/10
  Concentration (HHI) {X.XX}       {N}/10
  Crypto Exposure     {X.X}%        {N}/10
  Max Single Stock    {X.X}%        {N}/10
  Daily VaR / Value   {X.X}%        {N}/10
  ─────────────────────────────────
  Overall Risk Score               {N}/10 ({LABEL})

═══ Recommendations ═══

  {2-4 actionable recommendations based on the analysis, e.g.:}
  • Portfolio beta is {X.XX} — {recommendation}
  • {TICKER} at {XX.X}% is above 10% threshold — consider trimming
  • {SECTOR} exposure is {XX.X}% — approaching {LIMIT}% limit
  • Adding {SUGGESTION} would improve diversification

Note: VaR and volatility are estimated using parametric methods with
approximate correlations. Actual risk may differ, especially in crisis periods.
Past performance does not guarantee future results. This is not investment advice.
```

---

## Workflow G: Tax Analysis

### Checklist
```
Tax Analysis Progress:
- [ ] Step 1: Read portfolio, config, and fetch current prices
- [ ] Step 2: Classify all lots by holding period and gain/loss
- [ ] Step 3: Summarize realized gains/losses YTD
- [ ] Step 4: Identify tax-loss harvesting opportunities
- [ ] Step 5: Check wash sale constraints
- [ ] Step 6: Identify lots approaching long-term status
- [ ] Step 7: Estimate year-end tax liability
- [ ] Step 8: Present tax optimization report
```

### Step 1: Read Portfolio, Config, and Fetch Current Prices

Read the portfolio file with `read_file`.
Parse: Holdings table (all lots), Transactions table, Dividends table, YAML frontmatter (`tax_type`).
Read `~/.dexter/portfolios/config.md` for tax rates:
- `tax_rate_short_term` (default: 37%)
- `tax_rate_long_term` (default: 15%)
- `tax_rate_qualified_dividend` (default: 15%)

**Check tax_type first:**
- If `tax-deferred` or `tax-free`: Respond with abbreviated analysis:
  "This is a {tax_type} account. No capital gains tax applies. Holdings can be sold and rebalanced freely without tax consequences."
  Then show only the unrealized P&L summary (skip Steps 3-7) and exit.
- If `taxable`: Proceed with full analysis.

Fetch current prices for all holdings:
- **Stocks/ETFs**: `financial_search` query `"[TICKER] price snapshot"`
- **Crypto**: `crypto_search` query `"[TOKEN] current price"`

If no holdings, respond: "Your portfolio has no holdings yet. Add positions first with `/portfolio add <ticker> <shares> <price>`."

### Step 2: Classify All Lots

For each lot in the Holdings table, calculate:

- **Current value**: shares × current_price
- **Cost basis total**: shares × cost_basis
- **Unrealized gain/loss ($)**: current_value - cost_basis_total
- **Unrealized gain/loss (%)**: (current_price - cost_basis) / cost_basis × 100
- **Holding period (days)**: today - purchase_date
- **Classification**: Short-term (< 366 days) or Long-term (≥ 366 days)
- **Days to long-term**: MAX(0, 366 - holding_period) — only relevant if currently short-term

Group results into four categories:

| Category | Condition |
|----------|-----------|
| Short-term gains | holding < 366 days AND unrealized > 0 |
| Short-term losses | holding < 366 days AND unrealized < 0 |
| Long-term gains | holding ≥ 366 days AND unrealized > 0 |
| Long-term losses | holding ≥ 366 days AND unrealized < 0 |

### Step 3: Summarize Realized Gains/Losses YTD

Scan the Transactions table for all SELL transactions in the current calendar year.

For each SELL transaction:
- Look up the corresponding lot's cost_basis from the original BUY
- Calculate realized gain/loss: (sell_price - cost_basis) × shares
- Classify as short-term or long-term based on holding period at time of sale

Sum up:
- **Total realized ST gains YTD**
- **Total realized ST losses YTD**
- **Total realized LT gains YTD**
- **Total realized LT losses YTD**
- **Net realized gain/loss YTD**: sum of all above

If no sells this year: "No realized gains or losses year-to-date."

### Step 4: Identify Tax-Loss Harvesting (TLH) Opportunities

See [tax-lot-rules.md](tax-lot-rules.md) for full TLH rules and replacement security mapping.

Scan all lots for unrealized losses. For each loss lot:

```
unrealized_loss = (current_price - cost_basis) × shares     (negative number)
potential_tax_savings = |unrealized_loss| × applicable_tax_rate
  - Short-term loss: use tax_rate_short_term (37%)
  - Long-term loss: use tax_rate_long_term (15%)
```

**Filter criteria** (skip if below threshold):
- |unrealized_loss| < $100 → Skip (trivial)
- potential_tax_savings < $25 → Skip (not worth the effort)

**For each qualifying TLH candidate, suggest a replacement security:**
Use the replacement mapping from [tax-lot-rules.md](tax-lot-rules.md):
- Individual stock → Sector ETF (e.g., AAPL → XLK)
- ETF → Different-index ETF (e.g., VTI → VOO)
- Must NOT be "substantially identical" to avoid wash sale

**Rank TLH candidates** by potential_tax_savings descending.

### Step 5: Check Wash Sale Constraints

For each TLH candidate identified in Step 4:

**Check backward (30 days before today):**
- Scan Transactions table for BUY of same ticker within last 30 days
- If found: "⚠ Wash sale risk: {TICKER} was purchased {N} days ago on {DATE}. Wait until {SAFE_DATE} to harvest."

**Check forward (30 days after potential sale):**
- If the rebalancing plan or any pending action would buy the same ticker within 30 days → warn
- Recommend replacement security to avoid wash sale

**Check for existing lots of same ticker:**
- If selling one lot of a ticker at a loss while still holding another lot of the same ticker, this is fine (not a wash sale by itself)
- But if you plan to BUY more of the same ticker within 30 days → wash sale

Mark each TLH candidate as:
- SAFE: No wash sale conflict
- CAUTION: Recent purchase within 30 days — must wait
- BLOCKED: Would trigger wash sale due to planned rebalancing buy

### Step 6: Identify Lots Approaching Long-Term Status

Find all short-term lots where days_to_long_term ≤ 90:

```
For each short-term lot:
  days_remaining = 366 - (today - purchase_date)
  if 0 < days_remaining ≤ 90:
    long_term_date = purchase_date + 366 days
    tax_savings_if_wait = unrealized_gain × (tax_rate_short_term - tax_rate_long_term) / 100
```

These are lots where waiting a few more days/weeks would convert the gain from short-term (37%) to long-term (15%), saving 22 percentage points on the tax rate.

**Flag if the lot has significant gains:**
- "⚠ {TICKER} lot-{ID}: +${GAIN} gain becomes long-term in {N} days ({DATE}). Waiting saves ~${SAVINGS} in taxes."

### Step 7: Estimate Year-End Tax Liability

Calculate the full picture:

```
Realized ST gains YTD:                 +$X,XXX
Realized ST losses YTD:                -$X,XXX
Net short-term:                        ±$X,XXX   (taxed at ST rate)

Realized LT gains YTD:                 +$X,XXX
Realized LT losses YTD:                -$X,XXX
Net long-term:                         ±$X,XXX   (taxed at LT rate)

Dividend income (qualified):           +$X,XXX   (taxed at qualified rate)
Dividend income (non-qualified):       +$X,XXX   (taxed at ST rate)

───────────────────────────────────
If net ST < 0 and net LT > 0:
  ST losses offset LT gains first (at LT rate — less favorable)
If net LT < 0 and net ST > 0:
  LT losses offset ST gains first (at ST rate — more favorable)

After netting:
  Remaining net loss up to $3,000 offsets ordinary income
  Excess loss carries forward to next year

Estimated total tax = (net_ST_gains × ST_rate) + (net_LT_gains × LT_rate)
                    + (qualified_dividends × qualified_rate)
                    + (non_qualified_dividends × ST_rate)
```

**If TLH opportunities from Step 4 were executed, show the "after harvesting" scenario:**
```
Tax liability WITHOUT harvesting:     $X,XXX
Tax liability WITH harvesting:        $X,XXX
Tax savings from TLH:                 $X,XXX
```

### Step 8: Output Format

```
Tax Analysis: {PORTFOLIO_NAME} ({TAX_TYPE} Account)
Tax Year: {YEAR}  |  Tax Rates: ST {ST_RATE}% / LT {LT_RATE}%

═══ Unrealized Gains & Losses ═══

  Category          Gains         Losses        Net
  Short-term        +$X,XXX       -$XXX         ±$X,XXX
  Long-term         +$XX,XXX      -$X,XXX       ±$X,XXX
  ────────────────────────────────────────────
  Total             +$XX,XXX      -$X,XXX       ±$XX,XXX

═══ Lot Detail ═══

  Lot       Ticker   Shares   Cost     Current   Gain/Loss        Days   Type     Status
  lot-001   AAPL     50       $150.25  $192.30   +$2,102 (+28.0%) 345d   ST       Gain
  lot-002   AAPL     30       $185.50  $192.30   +$204 (+3.7%)    180d   ST       Gain
  lot-003   MSFT     40       $380.00  $415.20   +$1,408 (+9.3%)  420d   LT       Gain
  lot-005   VXUS     80       $55.20   $52.80    -$192 (-4.3%)    390d   LT       ★ TLH
  lot-007   GLD      20       $195.00  $188.50   -$130 (-3.3%)    270d   ST       ★ TLH

═══ Realized Gains/Losses YTD ═══

  {Summary from Step 3, or "No realized gains or losses year-to-date."}

═══ Tax-Loss Harvesting Opportunities ═══

  Lot       Ticker   Loss       Type   Tax Savings   Replacement    Wash Sale
  lot-005   VXUS     -$192      LT     $29           IXUS           ✓ Safe
  lot-007   GLD      -$130      ST     $48           IAU            ✓ Safe

  Total Potential Tax Savings: $77

  {If wash sale conflicts exist:}
  ⚠ lot-XXX: {TICKER} purchased {N} days ago — wait until {DATE} to harvest safely

═══ Lots Approaching Long-Term Status ═══

  Lot       Ticker   Gain       Days Left   LT Date      Tax Savings if Wait
  lot-001   AAPL     +$2,102    21 days     {DATE}       ~$462
  lot-002   AAPL     +$204      186 days    {DATE}       ~$45

  Recommendation: Consider waiting 21 days to sell lot-001 —
  saves ~$462 by converting from 37% to 15% tax rate.

═══ Estimated Tax Liability ═══

  Without Harvesting                    With Harvesting
  ST gains tax:      $X,XXX            ST gains tax:      $X,XXX
  LT gains tax:      $X,XXX            LT gains tax:      $X,XXX
  Dividend tax:      $XXX              Dividend tax:       $XXX
  ──────────────────                   ──────────────────
  Total:             $X,XXX            Total:             $X,XXX
                                       Savings:           $XXX

═══ Recommendations ═══

  • {Ranked list of actionable recommendations, e.g.:}
  • Harvest VXUS loss ($192) and replace with IXUS — saves $29 in taxes
  • Wait 21 days to sell AAPL lot-001 — converts to long-term, saves ~$462
  • Consider year-end review in December for additional TLH opportunities
  • {If near year-end:} Review year-end tax planning checklist

This analysis is for informational purposes only and does not constitute tax advice.
Consult a qualified tax professional for personalized guidance.
```

---

## Workflow H: Dividend Analysis

### Checklist
```
Dividend Analysis Progress:
- [ ] Step 1: Read portfolio and dividend history
- [ ] Step 2: Fetch current dividend data for all holdings
- [ ] Step 3: Calculate portfolio income metrics
- [ ] Step 4: Analyze dividend history and growth
- [ ] Step 5: Project future income
- [ ] Step 6: Assess dividend tax impact
- [ ] Step 7: Present dividend dashboard
```

### Step 1: Read Portfolio and Dividend History

Read the portfolio file with `read_file`.
Parse: Holdings table, Dividends table, YAML frontmatter.
Read config.md for `tax_rate_qualified_dividend`.

If no holdings, respond: "Your portfolio has no holdings yet. Add positions first with `/portfolio add <ticker> <shares> <price>`."

### Step 2: Fetch Current Dividend Data

For each equity holding, fetch dividend information:
- `financial_search` query: `"[TICKER] key ratios"` — extract: dividend_yield, payout_ratio
- For holdings where dividend_yield is not available (crypto, some growth stocks): set to 0%

**Estimate annual dividend per share:**
```
annual_div_per_share = current_price × dividend_yield / 100
```

For ETFs and funds, if payout_ratio is not applicable, note "N/A" and use the yield directly.

### Step 3: Calculate Portfolio Income Metrics

**Per-position metrics:**

For each dividend-paying holding (aggregate lots by ticker):

| Metric | Formula |
|--------|---------|
| Total shares | SUM(shares) across all lots of same ticker |
| Market value | total_shares × current_price |
| Annual dividend income ($) | total_shares × annual_div_per_share |
| Yield (current) | dividend_yield (from financial_search) |
| Yield on cost | annual_div_per_share / weighted_avg_cost_basis × 100 |
| Portfolio income weight | position_annual_income / total_annual_income × 100 |

**Portfolio-level metrics:**

| Metric | Formula |
|--------|---------|
| Portfolio yield (weighted) | SUM(position_weight × position_yield) |
| Total annual income estimate | SUM(annual_income for all positions) |
| Monthly income estimate | total_annual_income / 12 |
| Quarterly income estimate | total_annual_income / 4 |
| Portfolio yield on cost | total_annual_income / total_cost_basis × 100 |
| Income growth potential | Based on payout ratios — low payout = room to grow |

### Step 4: Analyze Dividend History

Parse the Dividends table for historical payments:

**Group by quarter/year:**
```
For each quarter in the Dividends table:
  quarterly_income = SUM(Amount) for dividends in that quarter
```

**Calculate trends:**
- Total dividends received (all time)
- Total dividends received YTD
- Quarter-over-quarter trend (growing, stable, declining)
- Year-over-year growth rate (if > 1 year of data)

**Identify DRIP activity:**
- Any reinvested dividends (Reinvested = yes) — note total shares acquired via DRIP

### Step 5: Project Future Income

**12-month forward projection:**

For each holding:
```
projected_annual_income = total_shares × annual_div_per_share
```

Account for known factors:
- Holdings with payout_ratio < 40%: "Room for dividend growth"
- Holdings with payout_ratio > 80%: "High payout — limited growth potential, monitor for sustainability"
- Holdings with payout_ratio > 100%: "⚠ Payout exceeds earnings — dividend may be at risk"

**Monthly income projection:**
Estimate which months dividends are typically paid:
- Most US stocks: quarterly (Mar/Jun/Sep/Dec or Jan/Apr/Jul/Oct)
- Bond ETFs: monthly
- REITs: monthly or quarterly
- Present as approximate monthly stream

**Income growth scenarios:**
| Scenario | Assumption | Projected Annual Income |
|----------|------------|----------------------|
| No growth | Current yields maintained | ${CURRENT} |
| Moderate growth (+5%) | Dividend increases at 5%/yr | ${MODERATE} |
| Strong growth (+10%) | Dividend increases at 10%/yr | ${STRONG} |

### Step 6: Assess Dividend Tax Impact

Read tax rates from config.md.

For each position, estimate tax treatment:
- **Most US stock dividends**: Qualified (15% rate) if held > 60 days
- **Bond ETF distributions**: Ordinary income (37% rate) — interest income, not dividends
- **REIT dividends**: Mostly non-qualified (37% rate, but 20% QBI deduction may apply ≈ 29.6%)
- **International ETF dividends**: Mix — some qualified, foreign tax credit may apply
- **Crypto**: No dividends (staking rewards are ordinary income if applicable)

Identify holdings using [tax-lot-rules.md](tax-lot-rules.md):
- Flag positions held < 90 days where dividends may be non-qualified
- Flag REIT holdings with ordinary income treatment
- Flag international holdings with potential foreign tax credit

**Calculate after-tax income:**
```
For each position:
  if qualified: after_tax_income = annual_income × (1 - qualified_rate/100)
  if non-qualified: after_tax_income = annual_income × (1 - ST_rate/100)
  if bond interest: after_tax_income = annual_income × (1 - ST_rate/100)

Total after-tax annual income = SUM(after_tax_income)
Effective dividend tax rate = 1 - (total_after_tax / total_pre_tax)
```

### Step 7: Output Format

```
Dividend Analysis: {PORTFOLIO_NAME}
Portfolio Value: ${TOTAL}  |  Portfolio Yield: {X.XX}%  |  Yield on Cost: {X.XX}%

═══ Income Summary ═══

  Annual Income Estimate:     ${X,XXX}
  Monthly Income Estimate:    ~${XXX}
  Quarterly Income Estimate:  ~${X,XXX}

  After-Tax Annual Income:    ~${X,XXX} (effective rate: {XX.X}%)

═══ Holdings by Dividend Income ═══

  Ticker   Shares   Yield    Annual $    Yield on Cost   Payout Ratio   Tax Type
  BND      150      3.2%     $348        3.4%            N/A            Ordinary
  VXUS     80       2.8%     $124        2.9%            N/A            Mixed*
  VTI      100      1.4%     $308        1.5%            35%            Qualified
  AAPL     80       0.5%     $76         0.6%            15%            Qualified
  MSFT     40       0.8%     $133        0.8%            28%            Qualified
  GLD      20       0.0%     $0          0.0%            N/A            —
  BTC      0.5      0.0%     $0          0.0%            N/A            —
  ─────────────────────────────────────────────────────────────
  Total                      ${X,XXX}

  * Mixed: Foreign tax credit may be available for international ETFs

═══ Income History ═══

  {If Dividends table has data:}
  Quarter      Income      Change
  Q1 2026      ${XXX}      —
  Q4 2025      ${XXX}      +X.X%
  Q3 2025      ${XXX}      +X.X%
  Q2 2025      ${XXX}      (first quarter)

  Total Received (All Time): ${X,XXX}
  Total Received YTD:        ${XXX}

  {If no dividend history:}
  No dividend history recorded yet.
  Dividends will appear here as they are received and recorded.

═══ Payout Sustainability ═══

  Sustainable (payout < 60%):
    AAPL (15%), MSFT (28%), VTI (35%)

  Monitor (payout 60-80%):
    {tickers if any}

  At Risk (payout > 80%):
    {tickers if any, or "None — all payouts appear sustainable"}

═══ Income Projection (12 Months) ═══

  Scenario           Annual Income    Monthly
  Current yields     ${X,XXX}         ~${XXX}
  +5% growth         ${X,XXX}         ~${XXX}
  +10% growth        ${X,XXX}         ~${XXX}

═══ Tax Efficiency ═══

  Income Type        Pre-Tax      Tax Rate    After-Tax
  Qualified divs     ${XXX}       {LT_RATE}%  ${XXX}
  Ordinary/Interest  ${XXX}       {ST_RATE}%  ${XXX}
  ────────────────────────────────────────
  Total              ${X,XXX}     {EFF}%      ${X,XXX}

═══ Recommendations ═══

  • {Ranked actionable suggestions, e.g.:}
  • Portfolio yield of {X.XX}% is {above/below} S&P 500 average (~1.3%)
  • Consider adding {SCHD/VIG} for dividend growth exposure
  • BND distributions are taxed as ordinary income — consider holding in tax-deferred account
  • {If REIT holdings:} REIT dividends are taxed at ordinary rates — consider IRA placement
  • {If high-yield risk:} Monitor {TICKER} — payout ratio of {XX}% may not be sustainable

Past performance does not guarantee future results. This is not investment advice.
Dividend projections are estimates based on current yields and may change.
```

---

## Workflow L: Goal Initialization

### Checklist
```
Goal Initialization Progress:
- [ ] Step 1: Gather goal information from user
- [ ] Step 2: Calculate required return and horizon
- [ ] Step 3: Select allocation template
- [ ] Step 4: Create goal file
- [ ] Step 5: Link portfolios
- [ ] Step 6: Update config
- [ ] Step 7: Confirm creation
```

### Step 1: Gather Goal Information

Ask the user for:
- **Goal name** (required): lowercase identifier (e.g., "retirement", "education", "house")
- **Goal type** (required): retirement / education / home / emergency / travel / general
- **Target amount** (required): Dollar amount (e.g., $2,000,000)
- **Target date** (required): YYYY-MM-DD (e.g., 2045-06-01)
- **Monthly contribution** (optional, default: 0): Planned monthly savings toward this goal
- **Risk tolerance** (optional): conservative / moderate / aggressive — if not specified, use Goal Type Defaults from [goal-templates.md](goal-templates.md)
- **Linked portfolios** (optional): Which portfolio(s) fund this goal — default to `default_portfolio` from config.md

### Step 2: Calculate Required Return and Horizon

**Derive horizon:**
```
years_remaining = (target_date - today) / 365
if years_remaining < 3  → horizon = short
if 3 ≤ years_remaining ≤ 10 → horizon = medium
if years_remaining > 10 → horizon = long
```

**Calculate current portfolio value** for linked portfolios:
- Read each linked portfolio file
- Fetch current prices for all holdings
- current_value = SUM(market values across all linked portfolios)

**Calculate required annual return:**

If monthly_contribution = 0:
```
r = (target_amount / current_value) ^ (1 / years_remaining) - 1
```

If monthly_contribution > 0 (use bisection method):
```
Find r such that:
FV = current_value × (1+r)^n + monthly_contribution × 12 × ((1+r)^n - 1) / r = target_amount
where n = years_remaining

Bisection: search r in [0, 0.50] for 20 iterations
```

**Warning**: If required return > 15%, warn the user:
"⚠ Required annual return of {r}% is very aggressive. Consider increasing contributions, extending the timeline, or reducing the target."

### Step 3: Select Allocation Template

Using the derived `horizon` and user's `risk_tolerance`, look up the template from [goal-templates.md](goal-templates.md):

1. Read the Template Selection Matrix
2. Select the matching template (e.g., moderate-long)
3. If risk_tolerance not specified, use Goal Type Defaults table

Present the selected template to the user:
```
Selected template: {template_name}
  Based on: {horizon} horizon ({years_remaining} years) × {risk_tolerance} risk

  Asset Class          Target %
  US Equity            XX%
  International Equity XX%
  Fixed Income         XX%
  ...

  Expected annual return: X–X%
  Required annual return: X.X%
```

If required return exceeds the template's expected return range, suggest:
- A more aggressive template, OR
- Increasing monthly contributions, OR
- Extending the target date

### Step 4: Create Goal File

Use `write_file` to create `~/.dexter/portfolios/goals/{name}.md`:

```markdown
---
name: {name}
type: {type}
target_amount: {amount}
target_date: {date}
annual_return_target: {calculated_r}
monthly_contribution: {contribution}
risk_tolerance: {tolerance}
horizon: {horizon}
linked_portfolios: [{portfolio_names}]
allocation_template: {template_name}
currency: USD
created: {TODAY_DATE}
---

# Goal: {Name}

## Target Allocation

| Asset Class | Target % |
|-------------|----------|
{ALLOCATION_ROWS from selected template}

## Progress History

| Date | Portfolio Value | Cumulative Contributions | On Track |
|------|----------------|-------------------------|----------|
| {TODAY_DATE} | ${current_value} | $0 | {status} |

## Milestones

| Target % | Amount | Date Reached | Notes |
|----------|--------|-------------|-------|
| 25% | ${target × 0.25} | | |
| 50% | ${target × 0.50} | | |
| 75% | ${target × 0.75} | | |
| 100% | ${target} | | |

## Notes

```

If `~/.dexter/portfolios/goals/` directory does not exist, create it first.

### Step 5: Link Portfolios

For each linked portfolio:
1. Read the portfolio file
2. If the YAML frontmatter has a `goals` field, append the new goal name
3. If no `goals` field exists, add `goals: [{name}]`
4. Use `edit_file` to update the portfolio file

### Step 6: Update Config

Read `~/.dexter/portfolios/config.md`.
If config does not have a `## Goals` section, add one:

```markdown
## Goals

| Goal | Type | Target | Target Date | Status |
|------|------|--------|-------------|--------|
| {name} | {type} | ${target} | {date} | Active |
```

If it already has a `## Goals` section, add a new row.

### Step 7: Confirm

```
Created goal: {name}
  Type: {type} | Target: ${target_amount} | Deadline: {target_date}
  Horizon: {horizon} ({years_remaining} years)
  Risk: {risk_tolerance} | Template: {template_name}
  Required Return: {r}% | Expected Return: {expected_range}%
  Monthly Contribution: ${contribution}
  Linked Portfolios: {portfolio_names}
  Location: ~/.dexter/portfolios/goals/{name}.md

  Next: Track progress with "/portfolio goal {name}"
        View all goals with "/portfolio goals"
```

---

## Workflow M: Goal Progress Tracking

### Checklist
```
Goal Progress Tracking:
- [ ] Step 1: Read goal file(s)
- [ ] Step 2: Fetch portfolio values and current prices
- [ ] Step 3: Calculate progress metrics
- [ ] Step 4: Project future value (3 scenarios)
- [ ] Step 5: Determine status
- [ ] Step 6: Present dashboard and update Progress History
```

### Step 1: Read Goal File(s)

**Single goal**: If user specifies a goal name (`/portfolio goal retirement`), read `~/.dexter/portfolios/goals/{name}.md`.

**All goals**: If user says `/portfolio goals` or "show all my goals", list all `.md` files in `~/.dexter/portfolios/goals/` and read each one.

If goal file not found: "Goal '{name}' not found. Create one with `/portfolio goal new`."
If goals directory is empty: "No goals set up yet. Create one with `/portfolio goal new`."

### Step 2: Fetch Portfolio Values and Current Prices

For each goal's `linked_portfolios`:
1. Read each portfolio file
2. Fetch current prices for all holdings (stocks via `financial_search`, crypto via `crypto_search`)
3. Calculate total market value across all linked portfolios

Also extract:
- Total cost basis across linked portfolios
- Total contributions from goal's Progress History table

### Step 3: Calculate Progress Metrics

```
current_value = SUM(market values of linked portfolios)
progress_pct = current_value / target_amount × 100
remaining = target_amount - current_value
years_remaining = (target_date - today) / 365
monthly_contribution = from goal YAML
cumulative_contributions = SUM(monthly_contribution × months since created) + initial_value
investment_return = current_value - cumulative_contributions
```

### Step 4: Project Future Value (3 Scenarios)

Using the future value formula with annuity:
```
FV = PV × (1+r)^n + PMT × ((1+r)^n - 1) / r
where:
  PV = current_value
  PMT = monthly_contribution × 12 (annualized)
  n = years_remaining
  r = annual return rate
```

Calculate three scenarios:

| Scenario | Annual Return | Description |
|----------|--------------|-------------|
| Optimistic | annual_return_target + 2% | Above-target performance |
| Base | annual_return_target | Expected performance |
| Pessimistic | annual_return_target - 3% (min 1%) | Below-target performance |

### Step 5: Determine Status

```
if base_FV >= target_amount → "On Track" ✅
if pessimistic_FV < target_amount AND base_FV >= target_amount → "At Risk" ⚠️
if base_FV < target_amount → "Behind" ❌
```

### Step 6: Output and Update

**Single Goal Dashboard:**
```
Goal Progress: {NAME}
Type: {type} | Created: {created}

═══ Progress ═══
  Target:        ${target_amount}         Deadline: {target_date}
  Current Value: ${current_value}         Progress: {progress_pct}%
  Remaining:     ${remaining}             Time Left: {years} years {months} months

  ░░░░░░░░░░░░░░░░████████░░░░░░░░░░  {progress_pct}%

  Contributions:     ${cumulative_contributions}
  Investment Return: ${investment_return} ({return_pct}%)

═══ Projection ═══
  Scenario        Return    Projected FV       vs Target
  Optimistic      {r+2}%    ${optimistic_FV}   {+/-}${diff}
  Base            {r}%      ${base_FV}         {+/-}${diff}
  Pessimistic     {r-3}%    ${pessimistic_FV}  {+/-}${diff}

  Status: {On Track ✅ / At Risk ⚠️ / Behind ❌}
  {If At Risk or Behind: specific recommendation}

═══ Milestones ═══
  25%: ${amount}  {✅ reached on DATE / ⬜ not yet}
  50%: ${amount}  {✅ reached on DATE / ⬜ not yet}
  75%: ${amount}  {⬜ not yet}
  100%: ${amount} {⬜ not yet}

Past performance does not guarantee future results. This is not investment advice.
```

**All Goals Overview:**
```
My Financial Goals

  Goal            Type         Target         Current     Progress   Status      Deadline
  retirement      retirement   $2,000,000     $485,000    24.3%      On Track    2045-06-01
  education       education    $200,000       $45,000     22.5%      At Risk     2035-09-01
  emergency       emergency    $50,000        $48,500     97.0%      On Track    2027-01-01

  Combined Target: $2,250,000    Combined Current: $578,500 (25.7%)
```

**Update Progress History**: After display, append a new row to the goal file's Progress History table:
```
| {TODAY_DATE} | ${current_value} | ${cumulative_contributions} | {status} |
```
Use `edit_file` to add the row. Only add one entry per day (check if today's date already exists).

**Update Milestones**: If progress has crossed a milestone threshold, fill in the Date Reached column.

---

## Workflow N: Goal-Based Rebalancing

### Checklist
```
Goal-Based Rebalancing Progress:
- [ ] Step 1: Read goal and portfolio files
- [ ] Step 2: Apply glide path rules
- [ ] Step 3: Compare current allocation to adjusted target
- [ ] Step 4: Generate rebalancing trades
- [ ] Step 5: Assess tax impact
- [ ] Step 6: Present recommendation
```

### Step 1: Read Goal and Portfolio Files

Parse the goal name from `--goal [name]` or user intent.
Read `~/.dexter/portfolios/goals/{name}.md`.
Read all linked portfolio files.
Fetch current prices for all holdings.

### Step 2: Apply Glide Path Rules

Read glide path rules from [goal-templates.md](goal-templates.md).

1. Calculate `years_remaining = (target_date - today) / 365`
2. Determine the adjusted template based on glide path:

| Years Remaining | Action |
|-----------------|--------|
| > 10 | Keep current template |
| 7–10 | Shift one risk level down |
| 3–7 | Shift to medium-term at same or lower risk |
| 1–3 | Shift to conservative-short |
| < 1 | Capital preservation mode |

3. If template changed, note the transition

### Step 3: Compare Current Allocation to Adjusted Target

For each asset class in the adjusted template:
```
current_value = SUM(holdings in this class across all linked portfolios)
current_weight = current_value / total_value × 100
target_weight = from adjusted template
drift = current_weight - target_weight
```

### Step 4: Generate Rebalancing Trades

Same logic as Workflow E Step 4, but using the goal's adjusted template targets instead of the portfolio's own target allocation.

For OVERWEIGHT classes → generate SELL trades (tax-optimized lot selection)
For UNDERWEIGHT classes → generate BUY trades (suggest default ETFs)

### Step 5: Assess Tax Impact

Same as Workflow E Step 5 — calculate realized gains/losses and tax estimates for proposed sells.

### Step 6: Output Format

```
Goal-Based Rebalancing: {GOAL_NAME}
Goal: ${target_amount} by {target_date} ({years_remaining} years remaining)
Total Portfolio Value: ${total_value}

═══ Glide Path Assessment ═══
  Current Template:  {current_template}
  Adjusted Template: {adjusted_template}  {(no change) or (→ shifted from X)}
  Reason: {years_remaining} years remaining — {rule description}

═══ Current vs Adjusted Target Allocation ═══

  Asset Class          Current    Target    Drift     Status
  US Equity            XX.X%      XX%       {+/-}X%   {OK/OVER/UNDER}
  International Equity XX.X%      XX%       {+/-}X%   {OK/OVER/UNDER}
  Fixed Income         XX.X%      XX%       {+/-}X%   {OK/OVER/UNDER}
  ...

═══ Recommended Trades ═══

  Action   Ticker   Shares   Est. Value    Lot         Tax Impact
  SELL     {TICKER} {N}      ${VALUE}      {LOT}       {tax info}
  BUY      {TICKER} {N}      ${VALUE}      (new/add)   N/A
  ...

═══ Tax Summary ═══

  Realized Gains:  ${amount}
  Realized Losses: ${amount}
  Net Taxable:     ${amount}
  Estimated Tax:   ${amount}

═══ Post-Rebalance Allocation ═══

  Asset Class          Before     After      Target
  ...

Note: Glide path transitions are recommendations. Review before executing.
Past performance does not guarantee future results. This is not investment advice.
```

---

## Workflow O: Goal Planning

### Checklist
```
Goal Planning Progress:
- [ ] Step 1: Read goal file and current status
- [ ] Step 2: Calculate required monthly contribution
- [ ] Step 3: Generate year-by-year projection
- [ ] Step 4: Provide adjustment recommendations
- [ ] Step 5: Present planning report
```

### Step 1: Read Goal and Current Status

Read `~/.dexter/portfolios/goals/{name}.md`.
Read linked portfolio files and fetch current prices.
Calculate current_value, years_remaining, progress_pct.

### Step 2: Calculate Required Monthly Contribution

If the user's current trajectory is off-track, calculate what monthly contribution would be needed:

```
PMT_monthly = [(target_amount - current_value × (1+r)^n) × r / ((1+r)^n - 1)] / 12
where:
  r = annual_return_target (from goal YAML)
  n = years_remaining
```

Also calculate for alternative scenarios:
- **Current pace**: What target amount is achievable with current contributions + expected return
- **Increased contributions**: Various contribution levels to hit the target
- **Extended timeline**: How much longer would be needed at current pace

### Step 3: Generate Year-by-Year Projection

Create a projection table showing each year from now to the target date:

```
Year    Start Value   Contributions   Return    End Value    Progress    Template
2026    $485,000      $24,000         $40,800   $549,800     27.5%       aggressive-long
2027    $549,800      $24,000         $45,900   $619,700     31.0%       aggressive-long
...
2038    ...           ...             ...       ...          ...         moderate-medium  ← glide path shift
...
2044    ...           ...             ...       ...          ...         conservative-short
2045    ...           ...             ...       $2,050,000   102.5%      conservative-short ✅
```

Include glide path transitions in the projection (mark years where template shifts).

### Step 4: Provide Adjustment Recommendations

Based on the analysis, provide actionable recommendations:

If **On Track**:
- "Your goal is on track. Continue current strategy."
- Show when each milestone will be reached

If **At Risk**:
- Option A: Increase monthly contribution by $X
- Option B: Extend target date by Y months
- Option C: Accept higher risk (if not already aggressive)

If **Behind**:
- Combination of above options
- Revised realistic target with current trajectory

### Step 5: Output Format

```
Goal Planning Report: {GOAL_NAME}
Type: {type} | Target: ${target_amount} | Deadline: {target_date}
Current Value: ${current_value} | Progress: {progress_pct}%

═══ Contribution Analysis ═══
  Current monthly contribution:    ${current}
  Required monthly contribution:   ${required}   ({shortfall_or_surplus})
  {If shortfall: "Increase by ${diff}/month to stay on track"}

═══ Scenario Analysis ═══
  Scenario                    Monthly     Projected FV    Hit Target?
  Current pace                ${current}  ${FV}           {Yes/No}
  Required to hit target      ${required} ${target}       Yes
  Moderate increase (+25%)    ${mod}      ${FV}           {Yes/No}

═══ Year-by-Year Projection ═══
  Year   Start       Contrib    Return     End         Progress  Template
  {rows as described above}

═══ Glide Path Preview ═══
  Year    Template Change
  {YEAR}  {current} → {new} (reason)
  {YEAR}  {current} → {new} (reason)
  ...

═══ Recommendations ═══
  {Ranked actionable suggestions}

Past performance does not guarantee future results. This is not investment advice.
Projections are based on assumed returns and may not reflect actual results.
```

---

## Error Handling

- **Portfolio file not found**: Suggest `/portfolio init`
- **`~/.dexter/portfolios/` does not exist**: Create the directory automatically before writing
- **`financial_search` fails for a ticker**: Use last known price from Holdings table, note "price data unavailable — using cost basis as fallback"
- **Holdings table is empty**: Report $0 portfolio, suggest `/portfolio add`
- **Invalid ticker**: Warn but allow user to proceed (some tickers may not be in the data source)
- **Duplicate lot ID**: Auto-increment to next available
- **Sell more than available**: Report available shares and ask to confirm
- **Config file missing**: Create with defaults on first portfolio operation
- **Goal file not found**: "Goal '{name}' not found. See all goals with `/portfolio goals` or create one with `/portfolio goal new`."
- **Goals directory does not exist**: Create `~/.dexter/portfolios/goals/` automatically when first goal is created
- **Duplicate goal name**: "A goal named '{name}' already exists. Choose a different name or view it with `/portfolio goal {name}`."
- **Linked portfolio not found**: "Portfolio '{name}' not found. Create it first with `/portfolio init {name}`."
- **Target date in the past**: "Target date {date} has already passed. Please set a future date."
- **Target already achieved**: If current_value >= target_amount, congratulate and suggest: "🎉 Goal '{name}' has been achieved! Current value ${current} exceeds target ${target}. Consider setting a new goal or preserving gains."

## Important Notes

- Always use `edit_file` (not `write_file`) when modifying existing portfolio files to avoid data loss
- Preserve exact markdown table formatting with `|` column separators and alignment
- When doing calculations, show your work step-by-step for transparency
- All monetary values should use commas for thousands separators in output
- Dates must always be YYYY-MM-DD format
- Tax analysis disclaimer: "This analysis is for informational purposes only and does not constitute tax advice. Consult a qualified tax professional."
- Investment disclaimer: "Past performance does not guarantee future results. This is not investment advice."
- When editing goal files, always use `edit_file` to preserve existing Progress History data
- Glide path transitions are suggestions only — always present to user for confirmation before executing trades
- Progress History is append-only — never overwrite or delete historical entries
- Goal projections assume constant returns and contributions — real results will vary
- Goal-based features do not constitute financial planning advice — recommend consulting a qualified financial advisor
