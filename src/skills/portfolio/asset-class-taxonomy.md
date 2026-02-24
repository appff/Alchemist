# Asset Class Taxonomy

Use this reference to automatically classify holdings into asset classes when adding new positions.

## Classification Rules

### 1. US Equity

**Individual US Stocks**: Any stock listed on NYSE/NASDAQ with a US-based company.
- Examples: AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, META, JPM, JNJ, V

**US Market ETFs**:
| Ticker | Name | Sub-type |
|--------|------|----------|
| SPY | S&P 500 | Large Cap |
| VOO | Vanguard S&P 500 | Large Cap |
| IVV | iShares S&P 500 | Large Cap |
| VTI | Vanguard Total Market | Total Market |
| ITOT | iShares Total Market | Total Market |
| SCHB | Schwab Broad Market | Total Market |
| QQQ | Invesco NASDAQ-100 | Growth/Tech |
| QQQM | Invesco NASDAQ-100 (mini) | Growth/Tech |
| IWM | iShares Russell 2000 | Small Cap |
| VB | Vanguard Small-Cap | Small Cap |
| VO | Vanguard Mid-Cap | Mid Cap |
| IJH | iShares S&P MidCap 400 | Mid Cap |
| VUG | Vanguard Growth | Growth |
| VTV | Vanguard Value | Value |
| SCHD | Schwab US Dividend | Dividend |
| VIG | Vanguard Dividend Appreciation | Dividend |
| XLK | Technology Select SPDR | Sector - Tech |
| XLF | Financial Select SPDR | Sector - Financial |
| XLV | Health Care Select SPDR | Sector - Healthcare |
| XLE | Energy Select SPDR | Sector - Energy |
| XLY | Consumer Discretionary SPDR | Sector - Consumer |
| XLP | Consumer Staples SPDR | Sector - Consumer |
| XLI | Industrial Select SPDR | Sector - Industrial |
| XLU | Utilities Select SPDR | Sector - Utilities |
| XLRE | Real Estate Select SPDR | Sector - Real Estate |

### 2. International Equity

**International/Global ETFs**:
| Ticker | Name | Region |
|--------|------|--------|
| VXUS | Vanguard Total International | Global ex-US |
| IXUS | iShares Total International | Global ex-US |
| EFA | iShares MSCI EAFE | Developed ex-US |
| VEA | Vanguard FTSE Developed | Developed ex-US |
| IEFA | iShares Core MSCI EAFE | Developed ex-US |
| VWO | Vanguard Emerging Markets | Emerging Markets |
| IEMG | iShares Core MSCI EM | Emerging Markets |
| EEM | iShares MSCI EM | Emerging Markets |
| ACWI | iShares MSCI ACWI | Global All-Country |
| VT | Vanguard Total World | Global All-Country |
| MCHI | iShares MSCI China | China |
| EWJ | iShares MSCI Japan | Japan |
| EWG | iShares MSCI Germany | Germany |
| EWY | iShares MSCI South Korea | South Korea |
| FXI | iShares China Large-Cap | China |

**Non-US individual stocks** (listed on foreign exchanges or ADRs):
- Examples: TSM, BABA, NVO, ASML, SAP, TM, SONY

### 3. Fixed Income

**Bond ETFs**:
| Ticker | Name | Sub-type |
|--------|------|----------|
| BND | Vanguard Total Bond | Total Bond |
| AGG | iShares Core US Aggregate | Total Bond |
| SCHZ | Schwab US Aggregate Bond | Total Bond |
| TLT | iShares 20+ Year Treasury | Long-term Treasury |
| IEF | iShares 7-10 Year Treasury | Intermediate Treasury |
| SHY | iShares 1-3 Year Treasury | Short-term Treasury |
| TIPS | iShares TIPS Bond | Inflation Protected |
| VTIP | Vanguard Short-Term TIPS | Inflation Protected |
| LQD | iShares Investment Grade Corp | Corporate |
| VCIT | Vanguard Intermediate Corp | Corporate |
| HYG | iShares High Yield Corp | High Yield |
| JNK | SPDR High Yield Bond | High Yield |
| MUB | iShares National Muni Bond | Municipal |
| VGSH | Vanguard Short-Term Treasury | Short-term Treasury |
| BNDX | Vanguard Total International Bond | International Bond |
| EMB | iShares J.P. Morgan USD EM Bond | EM Bond |

### 4. Alternatives

**Commodities**:
| Ticker | Name | Sub-type |
|--------|------|----------|
| GLD | SPDR Gold Trust | Gold |
| IAU | iShares Gold Trust | Gold |
| SLV | iShares Silver Trust | Silver |
| USO | United States Oil Fund | Oil |
| DBC | Invesco DB Commodity | Broad Commodity |
| PDBC | Invesco Optimum Yield Diversified | Broad Commodity |
| GLDM | SPDR Gold MiniShares | Gold |

**REITs**:
| Ticker | Name | Sub-type |
|--------|------|----------|
| VNQ | Vanguard Real Estate | US REITs |
| SCHH | Schwab US REIT | US REITs |
| IYR | iShares US Real Estate | US REITs |
| VNQI | Vanguard Global ex-US Real Estate | International REITs |
| O | Realty Income | Individual REIT |
| AMT | American Tower | Individual REIT |
| PLD | Prologis | Individual REIT |

### 5. Cash / Cash Equivalents

| Ticker | Name | Sub-type |
|--------|------|----------|
| SGOV | iShares 0-3 Month Treasury | Ultra Short Treasury |
| BIL | SPDR 1-3 Month T-Bill | T-Bill |
| SHV | iShares Short Treasury | Short Treasury |
| USFR | WisdomTree Floating Rate | Floating Rate |
| MINT | PIMCO Enhanced Short Maturity | Ultra Short Bond |

Cash holdings can also be recorded with ticker `CASH` and price `1.00`.

### 6. Crypto

Common cryptocurrency tickers:
| Ticker | Name |
|--------|------|
| BTC | Bitcoin |
| ETH | Ethereum |
| SOL | Solana |
| ADA | Cardano |
| DOT | Polkadot |
| AVAX | Avalanche |
| MATIC | Polygon |
| LINK | Chainlink |
| UNI | Uniswap |
| AAVE | Aave |
| XRP | Ripple |
| DOGE | Dogecoin |
| ATOM | Cosmos |
| ARB | Arbitrum |
| OP | Optimism |

**Crypto ETFs** (classified as Alternatives, not Crypto):
| Ticker | Name |
|--------|------|
| IBIT | iShares Bitcoin Trust |
| FBTC | Fidelity Wise Origin Bitcoin |
| GBTC | Grayscale Bitcoin Trust |
| ETHE | Grayscale Ethereum Trust |

## Auto-Classification Logic

When a new ticker is added and not found in the tables above:

1. Use `financial_search` with query `"[TICKER] company facts"` to get sector and country.
2. If the company is US-based → **US Equity**, use the returned sector.
3. If the company is non-US → **International Equity**, use the returned sector.
4. If `financial_search` fails, try `crypto_search` with `"[TICKER] token information"`.
5. If crypto search succeeds → **Crypto**.
6. If both fail → Ask the user to specify the asset class manually.

## Sector Classification

Map the sector returned by `financial_search` to display categories:

| API Sector | Display Sector |
|------------|---------------|
| Information Technology | Technology |
| Communication Services | Technology |
| Consumer Discretionary | Consumer |
| Consumer Staples | Consumer |
| Health Care | Healthcare |
| Financials | Financial |
| Industrials | Industrial |
| Energy | Energy |
| Materials | Materials |
| Utilities | Utilities |
| Real Estate | Real Estate |
| (ETFs/Funds) | Broad Market |
| (Crypto) | Crypto |
| (Commodities) | Commodities |
| (Bonds) | Fixed Income |
