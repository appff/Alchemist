---
name: crypto-analysis
description: Performs comprehensive cryptocurrency token analysis including tokenomics, protocol metrics, competitive positioning, and risk assessment. Triggers when user asks for crypto analysis, token research, "analyze ETH", tokenomics evaluation, or DeFi protocol comparison.
---

# Crypto Analysis Skill

## Workflow Checklist

Copy and track progress:
```
Crypto Analysis Progress:
- [ ] Step 1: Gather token data (price, market data, token info)
- [ ] Step 2: Technical analysis (RSI, MACD, SMA, Bollinger Bands)
- [ ] Step 3: Analyze tokenomics (supply, distribution, inflation)
- [ ] Step 4: Evaluate protocol metrics (TVL, revenue, yields)
- [ ] Step 5: On-chain analysis (holder distribution, whale concentration)
- [ ] Step 6: Sentiment analysis (Fear & Greed, social metrics)
- [ ] Step 7: Competitive comparison
- [ ] Step 8: Risk assessment
- [ ] Step 9: Present investment thesis with caveats
```

## Step 1: Gather Token Data

Call the `crypto_search` tool with these queries:

### 1.1 Current Price & Market Data
**Query:** `"[TOKEN] current price, market cap, and volume"`

**Extract:** price, market_cap, volume_24h, change percentages (24h, 7d, 30d)

### 1.2 Token Information
**Query:** `"[TOKEN] token information and tokenomics"`

**Extract:** circulating_supply, total_supply, max_supply, FDV, categories, genesis_date, description, links

### 1.3 Historical Prices
**Query:** `"[TOKEN] price history for the last 365 days"`

**Extract:** price trend, volatility, drawdown from ATH

## Step 2: Technical Analysis

Call `crypto_search` for technical indicators:

**Query:** `"[TOKEN] technical analysis indicators"`

**Extract:** SMA (20, 50), RSI (14), MACD, Bollinger Bands, signals

### 2.1 Trend Assessment
- Price vs SMA-20 and SMA-50 (above = bullish, below = bearish)
- Golden Cross (SMA-20 > SMA-50) or Death Cross?
- MACD signal line crossover direction

### 2.2 Momentum & Volatility
- RSI reading: <30 oversold, >70 overbought, 30-70 neutral
- Bollinger Band position: near upper = overextended, near lower = potential bounce
- Band width: narrow = low volatility (breakout coming?), wide = high volatility

## Step 3: Analyze Tokenomics

Using data from Step 1, evaluate:

### 2.1 Supply Metrics
- Circulating / Total / Max supply ratios
- Inflation rate = (Total - Circulating) / Circulating
- If max_supply exists: % already in circulation
- FDV / Market Cap ratio (>3x = significant dilution risk)

### 2.2 Valuation Context
- Market cap rank and category positioning
- FDV relative to comparable protocols
- Price vs ATH (% from ATH)

## Step 4: Evaluate Protocol Metrics (for DeFi tokens)

Call `crypto_search` for DeFi metrics:

### 3.1 Protocol TVL
**Query:** `"[PROTOCOL] TVL and chain breakdown"`

**Extract:** total TVL, chain distribution, TVL trend (1d, 7d changes)

### 3.2 Protocol Revenue
**Query:** `"[PROTOCOL] fees and revenue"`

**Extract:** fees_24h, revenue_24h, fee structure, revenue breakdown

### 3.3 Yields (if applicable)
**Query:** `"[PROTOCOL] DeFi yields"`

**Extract:** typical APY ranges, pool sizes, base vs reward APY

### Key Metrics to Calculate:
- **TVL / Market Cap ratio** (>1.0 = potentially undervalued for DeFi)
- **Annualized Revenue / Market Cap** (P/S equivalent)
- **Annualized Revenue / FDV**
- **Revenue per $ of TVL** (capital efficiency)

**Note:** Skip this step for non-DeFi tokens (e.g., BTC, meme coins). Mention that protocol metrics are not applicable.

## Step 5: On-chain Analysis

If an ERC-20 token contract address is known (check token info links):

**Query:** `"[TOKEN_ADDRESS] on-chain holder data"`

**Extract:** top holder concentration, whale count, holder distribution

### 5.1 Holder Distribution
- Top 10 holder concentration (>60% = high risk)
- Number of whales (>1% of supply)
- Exchange vs non-exchange holdings (if identifiable)

### 5.2 Activity Metrics
- Recent large transfer activity
- Holder count growth trend (if available)

**Note:** Requires ETHERSCAN_API_KEY. Skip if not available or for non-EVM tokens.

## Step 6: Sentiment Analysis

Call `crypto_search` for market sentiment:

**Query:** `"[TOKEN] market sentiment and social metrics"`

**Extract:** Fear & Greed Index, Twitter followers, Reddit subscribers, Telegram members

### 6.1 Market Sentiment
- Fear & Greed Index: 0-25 Extreme Fear, 25-50 Fear, 50-75 Greed, 75-100 Extreme Greed
- 7-day trend: improving or deteriorating?
- Historical context: what happened at similar sentiment levels?

### 6.2 Social Engagement
- Twitter follower count (relative to market cap rank)
- Reddit activity (subscribers, active accounts)
- Telegram community size
- Compare social metrics to category peers

## Step 7: Competitive Comparison

Identify 2-3 comparable tokens in the same category and compare:
- Market cap ranking within category
- TVL comparison (DeFi protocols)
- Revenue multiples comparison
- Supply dynamics comparison

Use `crypto_search` to fetch price/market data for comparables.

## Step 8: Risk Assessment

Evaluate using framework from [risk-framework.md](risk-framework.md):

1. **Market Risk**: Volatility, correlation to BTC, drawdown history
2. **Tokenomics Risk**: Inflation, vesting cliffs, FDV/MCap dilution
3. **Protocol Risk** (DeFi): Smart contract risk, governance centralization, chain dependency
4. **Regulatory Risk**: Category-specific regulatory exposure
5. **Liquidity Risk**: Volume relative to market cap, exchange coverage

## Step 9: Output Format

Present a structured summary including:
1. **Token Summary**: Name, category, current price, market cap, rank
2. **Technical Snapshot**: RSI, MACD signal, SMA trend, Bollinger position
3. **Tokenomics Table**: Supply metrics, inflation rate, FDV/MCap ratio
4. **Protocol Metrics Table** (if DeFi): TVL, revenue, yields, capital efficiency ratios
5. **On-chain Metrics** (if available): Top holder concentration, whale count
6. **Sentiment Dashboard**: Fear & Greed, social metrics, community size
7. **Competitive Positioning**: How it compares to category peers
8. **Risk Matrix**: 5 risk categories rated Low/Medium/High with rationale
9. **Key Takeaways**: 3-5 bullet points, balanced bullish/bearish factors
10. **Caveats**: Standard disclaimers — not financial advice, crypto volatility, smart contract risks, data from free APIs may have delays
