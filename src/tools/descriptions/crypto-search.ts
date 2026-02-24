/**
 * Rich description for the crypto_search tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const CRYPTO_SEARCH_DESCRIPTION = `
Intelligent meta-tool for cryptocurrency and DeFi data. Takes a natural language query and routes to appropriate crypto data sources including prices, token info, protocol metrics, DeFi yields, technical indicators, derivatives, on-chain data, sentiment, correlation, and monitoring.

## When to Use

- Cryptocurrency prices (current and historical)
- Token information (supply, market cap, FDV, categories, links)
- Technical analysis (SMA, RSI, MACD, Bollinger Bands, support/resistance)
- Derivatives data (futures, perpetuals, open interest, funding rates)
- On-chain holder data and whale analysis (requires token contract address + ETHERSCAN_API_KEY)
- Market sentiment and Fear & Greed Index
- Social metrics (Twitter followers, Reddit subscribers, Telegram members)
- Cross-asset correlation analysis (crypto-to-crypto or crypto-to-stock)
- Real-time monitoring and price alerts for multiple coins
- Market-wide alerts and scanning (top movers, Fear & Greed, volume spikes)
- DeFi protocol TVL (Total Value Locked)
- Protocol fees and revenue
- DeFi yields and APY
- Market overview (top tokens, trending, dominance)
- Crypto market comparisons and tokenomics analysis

## When NOT to Use

- Traditional stock/equity data (use financial_search)
- SEC filings or financial statements (use financial_search or read_filings)
- General web searches (use web_search)
- Questions that don't require external crypto data

## Usage Notes

- Call ONCE with full natural language query - the tool handles complexity internally
- Handles token symbol → CoinGecko ID resolution (BTC → bitcoin, ETH → ethereum)
- Handles protocol name → DeFiLlama slug resolution (Uniswap → uniswap)
- For comparisons (e.g., "compare ETH vs SOL"), pass the full query as-is
- On-chain queries require an ERC20 contract address and ETHERSCAN_API_KEY
- Fear & Greed Index is free and requires no API key
- Returns structured JSON data with source URLs for verification
`.trim();
