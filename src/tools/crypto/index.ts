// CoinGecko-powered tools
export { getCryptoPrice } from './crypto-price.js';
export { getCryptoHistoricalPrices } from './crypto-historical.js';
export { getCryptoTokenInfo } from './crypto-token-info.js';
export { getCryptoMarketOverview } from './crypto-market-overview.js';
export { getCryptoTechnical } from './crypto-technical.js';
export { getCryptoDerivatives } from './crypto-derivatives.js';

// DeFiLlama-powered tools
export { getCryptoProtocolTvl } from './crypto-protocol-tvl.js';
export { getCryptoProtocolRevenue } from './crypto-protocol-revenue.js';
export { getCryptoYields } from './crypto-yields.js';

// Cross-asset & monitoring tools
export { getCryptoCorrelation } from './crypto-correlation.js';
export { getCryptoMonitor } from './crypto-monitor.js';
export { getCryptoAlerts } from './crypto-alerts.js';

// On-chain data (Etherscan)
export { getCryptoOnchain } from './crypto-onchain.js';

// Sentiment & Fear/Greed
export { getCryptoSentiment } from './crypto-sentiment.js';

// Agentic router
export { createCryptoSearch } from './crypto-search.js';

// API clients (for direct use if needed)
export { callCoinGecko, resolveCoinId } from './coingecko-api.js';
export { callDeFiLlama } from './defillama-api.js';
export { callEtherscan } from './etherscan-api.js';
