# Alchemist

An autonomous AI agent for financial research, crypto analysis, and portfolio management.
Extended fork of [virattt/dexter](https://github.com/virattt/dexter).

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [LLM Providers](#llm-providers)
- [Skills & Tools](#skills--tools)
- [Slash Commands](#slash-commands)
- [WhatsApp Gateway](#whatsapp-gateway)
- [Evaluation & Debugging](#evaluation--debugging)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## Overview

Alchemist is an autonomous financial research agent that takes complex financial questions, plans research steps, executes them with real-time data, and self-validates the results before presenting a final answer. It operates through an iterative tool-calling loop, selecting from 15+ specialized tools across financial data, crypto/DeFi analytics, web search, and file management.

Built on top of [Dexter](https://github.com/virattt/dexter), Alchemist extends the original agent with:

- **Extensible Skill System** -- SKILL.md-based workflows that define multi-step research procedures for DCF valuation, crypto analysis, and portfolio management, invoked via slash commands.
- **8 LLM Providers** -- OpenAI, Anthropic, Google Gemini, xAI Grok, Moonshot, DeepSeek, OpenRouter, and Ollama (local), with OAuth and API key authentication.
- **Crypto and DeFi Analysis** -- CoinGecko, DeFiLlama, and Etherscan integration for token prices, protocol metrics, TVL, on-chain data, and technical indicators.
- **Portfolio Management** -- Fund-manager-grade tracking with tax-lot accounting, FIFO/LIFO/HIFO lot selection, rebalancing strategies, risk metrics (Sharpe, Sortino, VaR), and dividend analysis.
- **Enhanced Terminal UI** -- pi-tui based interface with streaming output, slash command autocomplete, box-drawing table rendering, and CJK character support.
- **WhatsApp Gateway** -- Chat with the agent via WhatsApp using the Baileys library, with access control and session persistence.

---

## Architecture

Alchemist follows an iterative agent loop. The agent receives a user query, plans its approach, selects and executes tools, validates intermediate results, and iterates until it has enough information to produce a final answer.

```
User Query
    |
    v
Agent Loop (max 10 iterations)
    |
    |---> Plan: decide which tool to call next
    |---> Execute: run the selected tool
    |---> Record: append result to scratchpad (JSONL)
    |---> Validate: check if more data is needed
    |---> Iterate or finalize
    |
    v
Final Answer (generated with full scratchpad context, no tools bound)
```

### Core Components

- **Agent Loop** (`src/agent/agent.ts`) -- Iterative tool-calling loop with configurable max iterations. Full tool results are preserved in context. A context threshold triggers clearing of the oldest results while keeping the most recent.

- **Tool Registry** (`src/tools/registry.ts`) -- Conditionally loads tools based on available API keys and model capabilities. Tools span four categories:

  | Category | Examples |
  |----------|----------|
  | Financial | `financial_search`, `financial_metrics`, `read_filings` |
  | Crypto | `crypto_search` (prices, TVL, on-chain, technicals, sentiment) |
  | Web | `web_search`, `web_fetch`, `browser` |
  | File System | `read_file`, `write_file`, `edit_file` |

- **Skill Engine** (`src/skills/registry.ts`) -- Discovers SKILL.md files from builtin, user, and project directories. Each skill defines a multi-step workflow with triggers and supporting documentation.

- **TUI** (`src/components/`) -- React-for-CLI interface built with pi-tui. Streams tool progress, handles approval prompts for write operations, and provides slash command routing with autocomplete.

- **Scratchpad** -- Tracks all tool calls and results as JSONL entries, providing full context for the final answer generation step.

### Event Streaming

The agent emits typed events in real time (`tool_start`, `tool_progress`, `tool_end`, `tool_error`, `thinking`, `answer_start`, `done`, `context_cleared`, `tool_approval`), enabling the TUI and gateway to provide live feedback during execution.

---

## Key Features

- **Intelligent Task Planning** -- The agent analyzes queries and plans multi-step research strategies before execution.
- **Autonomous Execution** -- 15+ specialized tools called iteratively, with the agent deciding when it has sufficient data.
- **Self-Validation** -- Results are checked for consistency; the agent can re-query or use alternative tools to verify findings.
- **Real-Time Financial Data** -- Income statements, balance sheets, cash flow statements, financial ratios, and SEC filings.
- **Crypto and DeFi Analysis** -- Token prices, market data, protocol TVL, on-chain metrics, technical indicators (RSI, MACD, Bollinger Bands), and sentiment data.
- **Portfolio Management** -- Tax-lot tracking with FIFO/LIFO/HIFO, rebalancing with drift detection, risk metrics (beta, Sharpe, Sortino, VaR), benchmark comparison, and dividend analysis.
- **Multi-LLM Support** -- 8 providers with hot-swap via `/model`, OAuth for OpenAI/Anthropic/Google, and prompt caching for cost reduction.
- **Extensible Skill System** -- Create custom SKILL.md workflows with YAML frontmatter and markdown steps, discovered automatically at runtime.
- **WhatsApp Integration** -- Message the agent via WhatsApp with access control, typing indicators, and session persistence.
- **Safety Features** -- Loop detection, configurable step limits, tool approval prompts for write operations, and abort signal support.

---

## Getting Started

### Prerequisites

- **Bun v1.0+** -- a fast JavaScript runtime

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Installation

```bash
git clone https://github.com/appff/Alchemist.git
cd Alchemist
bun install
```

### Environment Variables

Copy the example file and fill in the keys you need:

```bash
cp env.example .env
```

| Category | Variables | Required |
|----------|-----------|----------|
| **LLM API Keys** | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `MOONSHOT_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY` | At least one |
| **Google OAuth** | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | For Gemini Code Assist |
| **Ollama** | `OLLAMA_BASE_URL` | For local models |
| **Stock Market** | `FINANCIAL_DATASETS_API_KEY` | For equity analysis |
| **Web Search** | `EXASEARCH_API_KEY`, `PERPLEXITY_API_KEY`, `TAVILY_API_KEY` | At least one for search |
| **Crypto** | `COINGECKO_API_KEY`, `ETHERSCAN_API_KEY` | Optional (free tiers work) |
| **Observability** | `LANGSMITH_API_KEY`, `LANGSMITH_ENDPOINT`, `LANGSMITH_PROJECT` | Optional |

> See [`env.example`](env.example) for the full reference with comments.

---

## LLM Providers

Alchemist supports 8 providers out of the box. Switch models anytime with `/model` and authenticate with `/auth`.

| Provider | Models | Auth Method |
|----------|--------|-------------|
| **OpenAI** | GPT-5.2, GPT-4.1 | Device Auth |
| **Anthropic** | Claude Opus 4.6, Claude Sonnet 4.6 | OAuth |
| **Google** | Gemini 3 Flash, Gemini 3 Pro | OAuth (Gemini Code Assist) |
| **xAI** | Grok 4, Grok 4.1 Fast Reasoning | API Key |
| **Moonshot** | Kimi K2.5 | API Key |
| **DeepSeek** | DeepSeek V3, DeepSeek R1 | API Key |
| **OpenRouter** | 100+ models | API Key |
| **Ollama** | Local models (Llama, Mistral, etc.) | None (local) |

Each provider also has a **fast model** variant used automatically for lightweight tasks like summarization.

---

## Skills & Tools

### Skill System

Skills are markdown-based workflow definitions (`SKILL.md`) that guide the agent through multi-step analytical processes. Each skill specifies its name, description, trigger patterns, and a detailed step-by-step workflow with checklists.

Skills are auto-discovered from three locations (later sources override earlier ones):

| Priority | Location | Purpose |
|----------|----------|---------|
| 1 | `src/skills/` | Built-in skills shipped with Alchemist |
| 2 | `~/.dexter/skills/` | User-level custom skills |
| 3 | `.dexter/skills/` | Project-level custom skills |

Invoke any skill via its slash command (e.g., `/dcf-valuation AAPL`) or through natural language -- the agent matches trigger patterns from the skill description automatically.

---

### Built-in Skills

#### DCF Valuation (`/dcf-valuation <TICKER>`)

Estimates intrinsic value per share using discounted cash flow analysis with built-in sanity checks and sensitivity modeling.

```
/dcf-valuation AAPL
```

**Process:** Gather financials → Calculate FCF growth rate → Estimate WACC (sector-adjusted) → Project 5-year cash flows with growth decay → Terminal value via Gordon Growth Model → Sensitivity analysis (WACC ±1%, terminal growth 2.0–3.0%) → Validate against reported EV → Present valuation summary with caveats

**Output includes:** Current price vs. fair value, key inputs table, projected FCF with present values, 3×3 sensitivity matrix, and standard DCF limitations.

#### Crypto Analysis (`/crypto-analysis <TOKEN>`)

Comprehensive cryptocurrency token analysis covering technical indicators, tokenomics, protocol metrics, on-chain data, sentiment, and risk assessment.

```
/crypto-analysis ETH
```

**Data sources:** CoinGecko (prices, token info, sentiment), DeFiLlama (TVL, fees, yields), Etherscan (on-chain holder data)

**Process:** Token data & market overview → Technical analysis (RSI, MACD, SMA, Bollinger Bands) → Tokenomics evaluation (supply, inflation, FDV/MCap) → Protocol metrics for DeFi (TVL, revenue, capital efficiency) → On-chain analysis (holder concentration, whale tracking) → Sentiment (Fear & Greed, social metrics) → Competitive comparison → Risk assessment (market, tokenomics, protocol, regulatory, liquidity) → Investment thesis

**Output includes:** Token summary, technical snapshot, tokenomics table, protocol metrics, sentiment dashboard, competitive positioning, risk matrix rated Low/Medium/High, and key takeaways.

#### Portfolio Management (`/portfolio <command>`)

Fund-manager-grade portfolio tracking stored as markdown files in `~/.dexter/portfolios/`. Supports multiple portfolios, full transaction history, tax-lot tracking, and professional-grade analytics.

| Command | Description |
|---------|-------------|
| `/portfolio init` | Create a new portfolio with target allocation templates |
| `/portfolio add <ticker> <shares> <price>` | Add a position (stocks, ETFs, or crypto) |
| `/portfolio sell <ticker> <shares> <price>` | Record a sale with FIFO/LIFO/HIFO lot selection |
| `/portfolio` | Portfolio overview with current market values |
| `/portfolio performance` | Performance analysis (TWR, MWR/IRR, Sharpe, Sortino, Alpha) |
| `/portfolio rebalance` | Rebalancing recommendations with tax-optimized trade suggestions |
| `/portfolio risk` | Risk dashboard (VaR, stress tests, concentration analysis, risk score) |
| `/portfolio tax` | Tax lot analysis with harvesting opportunities and wash sale checks |
| `/portfolio dividend` | Dividend analysis with income projections and payout sustainability |
| `/portfolio compare` | Benchmark comparison with capture ratios and active positioning |
| `/portfolio allocation` | Multi-dimensional allocation analysis (asset class, sector, geography, vehicle, market cap) |

Natural language also works -- e.g., "bought 50 shares of AAPL at $185" or "how is my portfolio doing?"

---

### Agent Tools

The agent has access to the following tools, automatically selected based on context:

| Tool | Description |
|------|-------------|
| `financial_search` | Natural language financial data queries -- prices, company financials, metrics, analyst estimates, news, insider trading, and multi-company comparisons |
| `financial_metrics` | Financial statements and key ratios (P/E, EV/EBITDA, ROE, ROA, dividend yield, and more) |
| `read_filings` | SEC filing reader for 10-K, 10-Q, 8-K, and other EDGAR filings |
| `crypto_search` | Crypto & DeFi data -- prices, OHLCV, token info, TVL, yields, technicals, derivatives, on-chain metrics, sentiment, and correlation analysis |
| `web_search` | Web search with provider fallback chain (Exa → Perplexity → Tavily) |
| `web_fetch` | Fetch and parse web pages to markdown |
| `browser` | Playwright-based interactive web automation |
| `read_file` | Read local files |
| `write_file` | Create or overwrite files |
| `edit_file` | Partial file modifications |

> **Note:** `web_search` requires at least one API key configured: `EXASEARCH_API_KEY`, `PERPLEXITY_API_KEY`, or `TAVILY_API_KEY`. The agent uses whichever is available, with the fallback order shown above.

---

### Creating Custom Skills

You can extend Alchemist with your own skills:

1. Create a directory for your skill:
   ```bash
   mkdir -p ~/.dexter/skills/my-skill
   ```

2. Create a `SKILL.md` file with YAML frontmatter and a markdown workflow:
   ```markdown
   ---
   name: my-skill
   description: Describe what this skill does and when it should trigger.
   ---

   # My Custom Skill

   ## Step 1: Gather Data
   Call `financial_search` with query "..."

   ## Step 2: Analyze
   Process the data and calculate...

   ## Step 3: Present Results
   Format the output as...
   ```

3. The skill is auto-discovered on next start and available as `/my-skill`.

**Frontmatter fields:**
- `name` (required) -- Slash command name and unique identifier
- `description` (required) -- Used for natural language trigger matching; describe when the skill should activate

Skills in `.dexter/skills/` (project-level) override `~/.dexter/skills/` (user-level), which override built-in skills -- allowing you to customize or replace any default behavior.

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/model` | Switch LLM provider and model |
| `/auth` | Authenticate with a provider |
| `/auth logout` | Clear stored credentials |
| `/exit` | Exit Alchemist |
| `/dcf-valuation <ticker>` | Run DCF valuation analysis |
| `/crypto-analysis <token>` | Run crypto token analysis |
| `/portfolio [command]` | Portfolio management |

---

## WhatsApp Gateway

Alchemist can be accessed via WhatsApp as a chat gateway:

```bash
bun run gateway:login   # Link your WhatsApp account (scan QR code)
bun run gateway         # Start the gateway server
```

Once linked, send messages to the connected WhatsApp number to interact with Alchemist.

For detailed setup instructions, see the [WhatsApp Gateway README](src/gateway/channels/whatsapp/README.md).

---

## Evaluation & Debugging

**Eval suite** -- run the built-in evaluation tests:

```bash
bun run src/evals/run.ts            # All questions
bun run src/evals/run.ts --sample 10  # Random sample
```

**Scratchpad debug logs** -- Alchemist writes all tool calls and reasoning steps to `.dexter/scratchpad/` as JSONL files. Inspect these files to trace agent decisions and tool call sequences.

---

## Documentation

- [Korean User Manual (한국어 매뉴얼)](docs/manual-ko.md) -- comprehensive guide covering installation, features, skills, portfolio management, and advanced usage

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Keep PRs small and focused. One feature or fix per PR.

---

## Acknowledgments

- Built on [Dexter](https://github.com/virattt/dexter) by [@virattt](https://twitter.com/virattt)
- Extended with skills system, multi-LLM support, crypto analysis, and portfolio management

---

## License

This project is licensed under the MIT License.
