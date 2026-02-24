# Alchemist 사용자 매뉴얼

AI 기반 금융 분석 에이전트 — 설치부터 고급 활용까지

---

# Part 1: 설치 및 설정

---

## 1.1 시스템 요구사항

| 항목 | 요구사항 |
|------|----------|
| 런타임 | [Bun](https://bun.sh/) v1.0 이상 |
| OS | macOS, Linux, Windows (WSL 권장) |
| Node.js | v18 이상 (일부 의존성용) |
| 브라우저 | Chromium (설치 시 자동 다운로드) |
| 네트워크 | 인터넷 연결 필수 (API 호출) |

## 1.2 설치

### Step 1: 저장소 클론

```bash
git clone https://github.com/your-repo/alchemist.git
cd alchemist
```

### Step 2: 의존성 설치

```bash
bun install
```

> `postinstall` 스크립트가 자동으로 Playwright Chromium 브라우저를 설치합니다.

### Step 3: 환경 변수 설정

```bash
cp env.example .env
```

`.env` 파일을 열어 필요한 API 키를 입력합니다 (1.3절 참조).

### Step 4: 실행

```bash
bun start
```

개발 모드 (파일 변경 시 자동 재시작):

```bash
bun dev
```

## 1.3 환경 변수 설정

`.env` 파일에 설정하는 모든 환경 변수 목록입니다. **최소 하나의 LLM API 키**가 있어야 Alchemist가 작동합니다.

### LLM 프로바이더 API 키

| 환경 변수 | 프로바이더 | 필수 여부 | 발급처 |
|-----------|-----------|----------|--------|
| `OPENAI_API_KEY` | OpenAI (기본) | 권장 | [platform.openai.com](https://platform.openai.com/) |
| `ANTHROPIC_API_KEY` | Anthropic | 선택 | [console.anthropic.com](https://console.anthropic.com/) |
| `GOOGLE_API_KEY` | Google | 선택 | [aistudio.google.com](https://aistudio.google.com/) |
| `XAI_API_KEY` | xAI (Grok) | 선택 | [console.x.ai](https://console.x.ai/) |
| `OPENROUTER_API_KEY` | OpenRouter | 선택 | [openrouter.ai](https://openrouter.ai/) |
| `MOONSHOT_API_KEY` | Moonshot (Kimi) | 선택 | [platform.moonshot.ai](https://platform.moonshot.ai/) |
| `DEEPSEEK_API_KEY` | DeepSeek | 선택 | [platform.deepseek.com](https://platform.deepseek.com/) |

> **OAuth 인증**: Anthropic, Google, OpenAI는 `/auth` 명령어를 통한 OAuth 인증도 지원합니다 (1.5절 참조). OAuth를 사용하면 `.env`에 키를 넣지 않아도 됩니다.

### 로컬 LLM (Ollama)

| 환경 변수 | 설명 | 기본값 |
|-----------|------|--------|
| `OLLAMA_BASE_URL` | Ollama 서버 주소 | `http://127.0.0.1:11434` |

Ollama 사용 시 API 키가 필요 없습니다. [ollama.com](https://ollama.com/)에서 설치 후, 원하는 모델을 `ollama pull`로 다운로드하세요.

### 금융 데이터 API

| 환경 변수 | 용도 | 필수 여부 | 발급처 |
|-----------|------|----------|--------|
| `FINANCIAL_DATASETS_API_KEY` | 주식 시세, 재무제표, 내부자 거래 등 | 권장 | [financialdatasets.ai](https://financialdatasets.ai/) |

> 이 키가 없으면 `financial_search`, `financial_metrics`, `read_filings` 도구가 비활성화됩니다.

### 웹 검색 API (하나 이상 권장)

| 환경 변수 | 프로바이더 | 우선순위 | 발급처 |
|-----------|-----------|---------|--------|
| `EXASEARCH_API_KEY` | Exa | 1 (최우선) | [exa.ai](https://exa.ai/) |
| `PERPLEXITY_API_KEY` | Perplexity | 2 | [perplexity.ai](https://www.perplexity.ai/) |
| `TAVILY_API_KEY` | Tavily | 3 | [tavily.com](https://tavily.com/) |

> 세 키 중 **하나만 있으면** `web_search` 도구가 활성화됩니다.

### 암호화폐 API (선택)

| 환경 변수 | 용도 | 필수 여부 | 발급처 |
|-----------|------|----------|--------|
| `COINGECKO_API_KEY` | CoinGecko 레이트 리밋 확대 (10→500/분) | 선택 | [coingecko.com](https://www.coingecko.com/) |
| `ETHERSCAN_API_KEY` | 온체인 보유자 데이터 | 선택 | [etherscan.io](https://etherscan.io/) |

> DeFiLlama는 API 키가 필요 없습니다. CoinGecko도 키 없이 사용 가능하지만, 레이트 리밋이 낮습니다.

### 관측성 (Observability)

| 환경 변수 | 용도 | 기본값 |
|-----------|------|--------|
| `LANGSMITH_API_KEY` | LangSmith 트레이싱 | — |
| `LANGSMITH_ENDPOINT` | LangSmith API 엔드포인트 | `https://api.smith.langchain.com` |
| `LANGSMITH_PROJECT` | LangSmith 프로젝트 이름 | `dexter` |
| `LANGSMITH_TRACING` | 트레이싱 활성화 여부 | `true` |

### 최소 설정 예시

금융 리서치를 바로 시작하려면 다음 3개 키만 설정하세요:

```bash
# .env 최소 설정
OPENAI_API_KEY=sk-...                    # LLM (필수)
FINANCIAL_DATASETS_API_KEY=fd-...        # 금융 데이터 (권장)
TAVILY_API_KEY=tvly-...                  # 웹 검색 (권장)
```

## 1.4 첫 실행

```bash
bun start
```

Alchemist가 시작되면 터미널에 대화형 인터페이스가 표시됩니다:

```
┌─ Alchemist ──────────────────────────────────────────────┐
│                                                        │
│  Model: gpt-5.2 (OpenAI)                              │
│                                                        │
│  > _                                                   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- 상단에 현재 사용 중인 모델과 프로바이더가 표시됩니다
- 하단 입력창에 질문을 입력하고 Enter를 누르면 에이전트가 응답합니다
- 에이전트가 도구를 호출하면 실시간으로 진행 상황이 표시됩니다

**첫 테스트:**

```
애플 현재 주가 알려줘
```

정상적으로 응답이 오면 설정이 완료된 것입니다.

## 1.5 인증 (Authentication)

Alchemist는 두 가지 인증 방식을 지원합니다:

1. **API 키** — `.env` 파일에 직접 입력 (모든 프로바이더)
2. **OAuth / Device Auth** — `/auth` 명령어로 브라우저 인증 (Anthropic, Google, OpenAI)

### `/auth` 명령어

입력창에 `/auth`를 입력하면 프로바이더 선택 화면이 나타납니다:

```
Select a provider to authenticate:
  > OpenAI
    Anthropic
    Google
    xAI
    Moonshot
    DeepSeek
    OpenRouter
    Ollama
```

### OAuth 프로바이더 (Anthropic, Google)

1. 프로바이더를 선택합니다
2. 브라우저가 자동으로 열리고 로그인/권한 부여 페이지가 표시됩니다
3. **Anthropic**: 권한 부여 후 표시되는 인증 코드를 Alchemist에 붙여넣습니다
4. **Google**: 권한 부여 후 자동으로 콜백이 처리됩니다 (로컬 서버 사용)
5. 인증 완료 메시지가 표시됩니다

```
Authenticated with Anthropic successfully.
```

### Device Auth 프로바이더 (OpenAI)

1. OpenAI를 선택합니다
2. 브라우저가 열리고 인증 코드가 표시됩니다
3. 브라우저에서 코드를 입력하고 권한을 부여합니다
4. Alchemist가 자동으로 폴링하여 인증을 완료합니다

```
Go to https://auth.openai.com/device and enter code: ABCD-1234
```

### API 키 프로바이더 (xAI, Moonshot, DeepSeek, OpenRouter)

1. 프로바이더를 선택합니다
2. API 키 입력 프롬프트가 나타납니다
3. 키를 붙여넣으면 `.env` 파일에 자동 저장됩니다

```
Enter your API key for xAI:
> grok-...
API key saved for xAI.
```

### `/auth logout` — 인증 정보 삭제

```
/auth logout
```

저장된 OAuth 자격 증명을 삭제합니다.

### 자격 증명 저장 위치

| 유형 | 저장 위치 |
|------|----------|
| API 키 | `.env` 파일 (프로젝트 루트) |
| OAuth 토큰 | `~/.dexter/credentials.json` |
| WhatsApp 세션 | `~/.dexter/credentials/whatsapp/default/` |

## 1.6 모델 선택

### `/model` 명령어

입력창에 `/model`을 입력하면 프로바이더 → 모델 선택 플로우가 시작됩니다.

**Step 1: 프로바이더 선택**

```
Select a provider:
  > OpenAI
    Anthropic
    Google
    xAI
    Moonshot
    DeepSeek
    OpenRouter
    Ollama
```

**Step 2: 모델 선택**

```
Select a model:
  > GPT 5.2
    GPT 4.1
```

### 전체 프로바이더/모델 목록

| 프로바이더 | 모델 ID | 표시 이름 | Fast Model | 인증 방식 |
|-----------|---------|----------|-----------|----------|
| **OpenAI** | `gpt-5.2` | GPT 5.2 | `gpt-4.1` | OAuth (Device) / API Key |
| | `gpt-4.1` | GPT 4.1 | | |
| **Anthropic** | `claude-sonnet-4-6` | Sonnet 4.6 | `claude-haiku-4-5` | OAuth / API Key |
| | `claude-opus-4-6` | Opus 4.6 | | |
| **Google** | `gemini-3-flash-preview` | Gemini 3 Flash | `gemini-3-flash-preview` | OAuth / API Key |
| | `gemini-3-pro-preview` | Gemini 3 Pro | | |
| **xAI** | `grok-4-0709` | Grok 4 | `grok-4-1-fast-reasoning` | API Key |
| | `grok-4-1-fast-reasoning` | Grok 4.1 Fast Reasoning | | |
| **Moonshot** | `kimi-k2-5` | Kimi K2.5 | `kimi-k2-5` | API Key |
| **DeepSeek** | `deepseek-chat` | DeepSeek V3 | `deepseek-chat` | API Key |
| | `deepseek-reasoner` | DeepSeek R1 | | |
| **OpenRouter** | (사용자 입력) | — | `openrouter:openai/gpt-4o-mini` | API Key |
| **Ollama** | (로컬 모델) | — | — | 불필요 |

### Fast Model

각 프로바이더에는 요약, 도구 결과 처리 등 경량 작업에 사용되는 Fast Model이 지정되어 있습니다. 이는 자동으로 선택되며 별도 설정이 필요 없습니다.

### OpenRouter — 커스텀 모델

OpenRouter를 선택하면 모델 목록 대신 **직접 모델명을 입력**하는 프롬프트가 나타납니다:

```
Enter OpenRouter model name (e.g., openai/gpt-4o):
> meta-llama/llama-3.1-70b-instruct
```

[OpenRouter 모델 목록](https://openrouter.ai/models)에서 사용 가능한 모델을 확인하세요.

### Ollama — 로컬 모델

1. [Ollama](https://ollama.com/)를 설치합니다
2. 원하는 모델을 다운로드합니다:
   ```bash
   ollama pull llama3.1
   ollama pull qwen2.5
   ```
3. Alchemist에서 `/model` → Ollama 선택 → 로컬에 설치된 모델 목록이 표시됩니다

> Ollama는 API 키가 필요 없으며, `OLLAMA_BASE_URL` 환경 변수로 서버 주소를 지정할 수 있습니다 (기본값: `http://127.0.0.1:11434`).

### 설정 영속성

모델 선택은 `~/.dexter/settings.json`에 자동 저장됩니다. 다음 실행 시에도 마지막 선택이 유지됩니다.

```json
{
  "provider": "anthropic",
  "modelId": "claude-sonnet-4-6"
}
```

## 1.7 디렉토리 구조

### `~/.dexter/` — 사용자 데이터 디렉토리

```
~/.dexter/
├── settings.json              # 모델/프로바이더 설정
├── credentials.json           # OAuth 인증 토큰
├── gateway.json               # WhatsApp 게이트웨이 설정
├── credentials/
│   └── whatsapp/
│       └── default/           # WhatsApp 세션 데이터
├── portfolios/
│   ├── config.md              # 포트폴리오 전역 설정 (세율 등)
│   ├── main.md                # 기본 포트폴리오
│   └── ...                    # 추가 포트폴리오
└── skills/
    └── (사용자 커스텀 스킬)/
        └── SKILL.md
```

### 프로젝트 루트

```
alchemist/
├── .env                       # 환경 변수 (API 키)
├── env.example                # 환경 변수 템플릿
├── package.json               # 의존성 및 스크립트
├── src/
│   ├── index.tsx              # 엔트리 포인트
│   ├── cli.ts                 # CLI 인터페이스
│   ├── providers.ts           # 프로바이더 레지스트리
│   ├── skills/                # 내장 스킬
│   │   ├── dcf-valuation/
│   │   ├── crypto-analysis/
│   │   └── portfolio/
│   ├── tools/                 # 에이전트 도구
│   ├── auth/                  # OAuth 인증 모듈
│   └── gateway/               # WhatsApp 게이트웨이
└── .dexter/
    └── skills/                # 프로젝트별 커스텀 스킬
```

---

# Part 2: 핵심 기능

---

## 2.1 슬래시 커맨드

Alchemist는 슬래시(`/`)로 시작하는 커맨드를 지원합니다. 입력창에 `/`를 입력하면 사용 가능한 커맨드 목록이 자동완성 팝업으로 표시됩니다.

### 기본 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/model` | LLM 프로바이더 및 모델 전환 |
| `/auth` | 프로바이더 인증 설정 |
| `/auth logout` | 저장된 인증 정보 삭제 |
| `/exit` | Alchemist 종료 |

### 스킬 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/dcf-valuation` | DCF 적정가치 분석 실행 |
| `/crypto-analysis` | 암호화폐 종합 분석 실행 |
| `/portfolio` | 포트폴리오 관리 (조회, 추가, 매도, 분석 등) |
| `/portfolio goal new` | 투자 목표 생성 |
| `/portfolio goal [이름]` | 특정 목표 진행 추적 |
| `/portfolio goals` | 모든 목표 현황 조회 |
| `/portfolio rebalance --goal [이름]` | 목표 기반 리밸런싱 |
| `/portfolio goal plan [이름]` | 목표 달성 계획 분석 |

### 자동완성 사용법

1. 입력창에 `/`를 입력하면 팝업 메뉴가 나타납니다
2. **방향키(↑↓)** 로 항목 탐색
3. **Tab** 또는 **Enter**로 선택 및 확정
4. **Esc**로 팝업 닫기
5. 글자를 계속 입력하면 목록이 실시간 필터링됩니다

```
┌─────────────────────────────────────────┐
│  /                                      │
├─────────────────────────────────────────┤
│  /model          Switch LLM provider    │
│  /auth           Authenticate           │
│  /dcf-valuation  DCF valuation analysis │
│  /crypto-analysis  Crypto analysis      │
│  /portfolio      Portfolio management   │
│  /exit           Exit Alchemist            │
└─────────────────────────────────────────┘
```

슬래시 커맨드 뒤에 인자를 추가할 수도 있습니다:

```
/dcf-valuation AAPL
/crypto-analysis ETH
/portfolio add AAPL 50 185.50
```

> **참고**: 파일 경로를 입력할 때도 자동완성이 작동합니다. 현재 작업 디렉토리 기준으로 파일과 폴더를 제안합니다.

---

## 2.2 에이전트 도구 (Tools)

Alchemist의 AI 에이전트는 다양한 전문 도구를 자동으로 선택하여 사용합니다. 사용자가 질문하면 에이전트가 적합한 도구를 판단하고 호출합니다. 도구는 크게 4가지 카테고리로 분류됩니다.

### 2.2.1 금융 데이터 도구

#### `financial_search` — 금융 데이터 통합 검색

자연어 질의를 받아 적절한 금융 데이터 소스로 자동 라우팅하는 지능형 메타 도구입니다. 회사 이름을 티커 심볼로 자동 변환하고("애플" → AAPL), 날짜 표현을 자동 해석합니다("최근 5년" → 5년 전부터 현재까지).

**조회 가능한 데이터:**

| 데이터 유형 | 예시 |
|-------------|------|
| 주가 | 현재가 스냅샷, 과거 가격 추이 |
| 기업 정보 | 섹터, 산업, 시가총액, 직원 수, 상장일, 거래소 |
| 재무제표 | 손익계산서, 대차대조표, 현금흐름표 |
| 재무 지표 | P/E, EPS, 배당수익률, 시가총액, EV |
| 애널리스트 추정 | 실적 추정치, 목표 주가 |
| 내부자 거래 | 임원 매수/매도 내역 |
| 매출 세그먼트 | 사업부별·지역별 매출 분해 |
| 기업 뉴스 | 최근 뉴스 및 공시 |

**사용 예시:**

```
"애플 현재 주가 알려줘"
"테슬라의 최근 5년 매출 추이"
"NVDA와 AMD의 P/E 비율 비교"
"마이크로소프트의 최근 내부자 거래 내역"
"아마존의 사업부별 매출 비중"
"삼성전자 애널리스트 목표주가"
```

> **팁**: 비교 분석도 한 번의 질문으로 가능합니다. "AAPL vs MSFT 매출 비교"와 같이 전체 질문을 그대로 입력하세요.

---

#### `financial_metrics` — 재무제표 및 핵심 지표 조회

재무제표(손익계산서, 대차대조표, 현금흐름표)와 핵심 재무 비율에 특화된 도구입니다.

**조회 가능한 항목:**

| 카테고리 | 세부 항목 |
|----------|-----------|
| 손익계산서 | 매출, 매출총이익, 영업이익, 순이익, EPS |
| 대차대조표 | 자산, 부채, 자본, 현금 |
| 현금흐름표 | 영업활동, 투자활동, 재무활동 현금흐름, FCF |
| 핵심 비율 | P/E, EV/EBITDA, ROE, ROA, 마진율, 배당수익률 |

**`financial_search`와의 차이점:**

- `financial_search`: 주가, 뉴스, 애널리스트 추정, 내부자 거래 등 **폭넓은** 금융 데이터
- `financial_metrics`: 재무제표와 재무 비율에 **특화**된 심층 분석

**사용 예시:**

```
"애플의 최근 3년 손익계산서"
"테슬라와 리비안의 ROE 비교"
"마이크로소프트의 분기별 FCF 추이"
```

---

#### `read_filings` — SEC 공시 원문 열람

SEC(미국 증권거래위원회) 공시 문서의 원문 텍스트를 읽는 도구입니다.

**지원하는 공시 유형:**

| 공시 유형 | 내용 |
|-----------|------|
| 10-K | 연간보고서 — 사업 개요, 리스크 요인, MD&A, 재무제표 |
| 10-Q | 분기보고서 — 분기 실적, MD&A, 시장리스크 |
| 8-K | 수시공시 — 중요 사건, 인수합병, 실적 발표 |

**사용 예시:**

```
"애플 10-K에서 리스크 요인 부분 읽어줘"
"테슬라의 최근 분기보고서 MD&A 섹션"
"엔비디아의 최근 8-K 공시 내용"
```

---

### 2.2.2 암호화폐 도구

#### `crypto_search` — 암호화폐 및 DeFi 통합 검색

암호화폐와 DeFi 프로토콜에 관한 모든 데이터를 자연어로 조회하는 지능형 메타 도구입니다. 내부적으로 CoinGecko, DeFiLlama, Etherscan 등 다양한 API를 자동 라우팅합니다.

**조회 가능한 데이터:**

| 카테고리 | 세부 항목 |
|----------|-----------|
| 가격 데이터 | 현재가, 과거 가격 추이, OHLCV |
| 토큰 정보 | 유통량, 총공급량, 최대공급량, FDV, 카테고리 |
| 기술 분석 | SMA(20, 50), RSI(14), MACD, 볼린저 밴드, 지지/저항선 |
| 파생상품 | 선물, 무기한 계약, 미결제약정, 펀딩비율 |
| DeFi 프로토콜 | TVL(총예치금), 프로토콜 수수료/수익, DeFi 수익률(APY) |
| 온체인 데이터 | 보유자 분포, 고래 분석 (ETHERSCAN_API_KEY 필요) |
| 시장 센티먼트 | Fear & Greed 지수, 소셜 지표 |
| 상관관계 분석 | 크립토 간 또는 크립토-주식 상관관계 |

**사용 예시:**

```
"비트코인 현재 가격과 24시간 변동률"
"이더리움의 기술적 분석 — RSI, MACD, 볼린저 밴드"
"유니스왑 프로토콜의 TVL과 수수료 수익"
"솔라나 vs 아발란체 비교 분석"
"Fear & Greed 지수 현재 수준"
"DeFi 수익률 상위 프로토콜"
```

---

### 2.2.3 웹 도구

#### `web_search` — 웹 검색

일반적인 주제에 대해 최신 정보를 검색합니다.

**검색 프로바이더 우선순위:**

| 우선순위 | 프로바이더 | 환경변수 |
|----------|-----------|----------|
| 1 | Exa | `EXASEARCH_API_KEY` |
| 2 | Perplexity | `PERPLEXITY_API_KEY` |
| 3 | Tavily | `TAVILY_API_KEY` |

#### `web_fetch` — 웹 페이지 읽기

특정 URL의 웹 페이지 내용을 가져와 읽기 쉬운 마크다운 형태로 변환합니다. Mozilla Readability로 콘텐츠를 추출하며, 결과가 15분간 캐시됩니다.

#### `browser` — 인터랙티브 브라우저

Playwright 기반의 실제 브라우저를 제어하여 웹 페이지와 상호작용합니다. JavaScript 렌더링이 필요한 동적 페이지에 사용합니다.

**언제 어떤 도구를 사용하나요?**

| 상황 | 추천 도구 |
|------|-----------|
| 정적 웹 페이지 읽기 | `web_fetch` (빠르고 단순) |
| 일반 검색 | `web_search` |
| JavaScript 렌더링이 필요한 페이지 | `browser` |
| 링크 클릭, 폼 입력 등 상호작용 | `browser` |

---

### 2.2.4 파일 시스템 도구

Alchemist는 로컬 파일 시스템에서 파일을 읽고, 쓰고, 수정할 수 있습니다. 주로 포트폴리오 관리 기능에서 사용됩니다.

| 도구 | 설명 | 주요 용도 |
|------|------|----------|
| `read_file` | 파일 읽기 | 포트폴리오 보유 내역 조회 |
| `write_file` | 파일 생성/덮어쓰기 | 새 포트폴리오 파일 생성 |
| `edit_file` | 파일 부분 수정 | 매수/매도 시 테이블 업데이트 |

> 기존 포트폴리오 파일을 수정할 때는 데이터 손실을 방지하기 위해 항상 `edit_file`(부분 수정)이 사용됩니다.

---

## 2.3 스킬 시스템

### 2.3.1 스킬이란?

스킬(Skill)은 Alchemist 에이전트에게 **복잡한 분석 워크플로우를 단계별로 안내하는 상세 지침서**입니다.

#### SKILL.md 파일 구조

```yaml
---
name: dcf-valuation
description: Performs discounted cash flow (DCF) valuation analysis...
---

# DCF Valuation Skill

## Workflow Checklist
- [ ] Step 1: Gather financial data
- [ ] Step 2: Calculate FCF growth rate
...
```

- **`name`** (필수): 슬래시 커맨드로 사용됨 (예: `/dcf-valuation`)
- **`description`** (필수): 에이전트가 자연어 질문에서 적절한 스킬을 선택하는 데 사용

#### 스킬 탐색 디렉토리

| 우선순위 | 위치 | 용도 |
|---------|------|------|
| 1 (낮음) | `src/skills/` (내장) | Alchemist에 기본 포함된 스킬 |
| 2 (중간) | `~/.dexter/skills/` | 사용자 커스텀 스킬 (모든 프로젝트에 적용) |
| 3 (높음) | `.dexter/skills/` | 프로젝트별 스킬 |

> 같은 이름의 스킬이 여러 위치에 있으면 **높은 우선순위의 스킬이 우선** 적용됩니다.

#### 스킬 호출 방법

1. **슬래시 커맨드**: `/dcf-valuation AAPL`
2. **자연어**: "애플의 적정가치를 DCF로 분석해줘"

---

### 2.3.2 DCF Valuation 스킬

**DCF(Discounted Cash Flow)** 분석을 통해 기업의 내재가치를 추정합니다.

**8단계 분석 과정:**

1. 재무 데이터 수집
2. FCF 성장률 계산
3. 할인율(WACC) 추정
4. 미래 현금흐름 예측
5. 현재가치 계산
6. 민감도 분석 (WACC ±1% × 터미널 성장률 3×3 매트릭스)
7. 검증 (EV 비교, 터미널 밸류 비율)
8. 결과 보고서 출력

**호출:**

```
/dcf-valuation AAPL
```

또는: "애플의 적정가치는 얼마야?"

---

### 2.3.3 Crypto Analysis 스킬

암호화폐 토큰에 대한 **종합 분석** (9단계): 토크노믹스, 기술적 분석, DeFi 프로토콜 지표, 온체인 데이터, 시장 센티먼트 통합 분석.

**호출:**

```
/crypto-analysis ETH
```

또는: "이더리움 분석해줘"

---

## 2.4 자연어 질의 예시

Alchemist는 한국어 자연어를 이해하고 적절한 도구와 스킬을 자동으로 선택합니다.

### 주식 리서치

```
"애플의 현재 주가와 최근 실적을 알려줘"
"엔비디아의 최근 5년 매출 성장률 추이"
"테슬라의 P/E, EV/EBITDA, ROE를 동종업계와 비교해줘"
"마이크로소프트 10-K 리스크 요인 섹션 읽어줘"
"아마존의 사업부별 매출 비중이 어떻게 되나?"
```

### 기업 밸류에이션

```
"애플의 적정가치를 DCF로 분석해줘"
"테슬라가 현재 고평가인지 저평가인지 분석"
"메타의 내재가치는 얼마로 추정돼?"
```

### 암호화폐 리서치

```
"비트코인 현재 가격이랑 Fear & Greed 지수 알려줘"
"이더리움의 기술적 분석 — RSI, MACD 포함해서"
"솔라나 vs 아발란체 종합 비교"
"유니스왑의 TVL과 프로토콜 수익"
```

### 시장 동향 및 비교 분석

```
"오늘 미국 주식 시장 주요 뉴스"
"FAANG 주식들의 YTD 수익률 비교"
"반도체 섹터 주요 기업들 실적 비교"
"비트코인과 금의 상관관계 분석"
```

### 포트폴리오 관리

```
"내 포트폴리오 보여줘"
"애플 50주 185달러에 매수했어"
"포트폴리오 성과 분석해줘"
"리밸런싱이 필요한 상태인지 확인해줘"
"세금 최적화 분석해줘"
```

### 목표 기반 투자

```
"은퇴 목표 만들어줘. 200만 달러 2045년까지"
"내 은퇴 목표 진행 상황 보여줘"
"목표 기반으로 리밸런싱 해줘"
"목표 달성 계획 분석해줘"
"내 모든 목표 보여줘"
```

> **팁**: 질문은 구어체로 자유롭게 해도 됩니다. "삼성전자 요즘 어때?", "비트코인 살까 말까?" 같은 자연스러운 표현도 이해합니다.

---

# Part 3: 포트폴리오 관리

Alchemist의 포트폴리오 관리 시스템은 개인 투자자를 위한 전문급 포트폴리오 추적·분석 도구입니다. 마크다운 파일 기반으로 보유 자산, 거래 내역, 배당금을 체계적으로 기록하고, 성과 분석부터 세금 최적화까지 펀드 매니저 수준의 분석을 제공합니다.

---

## 3.1 포트폴리오 시스템 개요

### 시스템이란?

Alchemist 포트폴리오 시스템은 투자 포트폴리오를 **마크다운 파일**로 관리합니다. 별도의 데이터베이스나 외부 서비스 없이, 로컬 파일 시스템에 모든 데이터가 저장됩니다.

### 파일 구조

```
~/.dexter/portfolios/
├── config.md          # 전역 설정 (세율, 기본 포트폴리오, 섹터 한도 등)
├── main.md            # 기본 포트폴리오
├── retirement.md      # IRA/401k 포트폴리오 (예시)
└── crypto.md          # 암호화폐 포트폴리오 (예시)
```

**config.md** 주요 설정:

| 설정 항목 | 기본값 | 설명 |
|-----------|--------|------|
| `default_portfolio` | main | 기본 포트폴리오 이름 |
| `risk_free_rate` | 4.5 | 무위험 수익률 (%) |
| `tax_rate_short_term` | 37 | 단기 양도소득세율 (%) |
| `tax_rate_long_term` | 15 | 장기 양도소득세율 (%) |
| `tax_rate_qualified_dividend` | 15 | 적격 배당 세율 (%) |
| `reporting_currency` | USD | 보고 통화 |

### 핵심 개념

**Lot (로트):** 동일 종목을 여러 번에 걸쳐 매수하면 각 매수 건이 별도의 "로트"로 기록됩니다. 매도 시 어떤 로트를 먼저 파는지에 따라 세금이 달라집니다.

**세금 추적:** 각 로트의 보유 기간(단기 vs 장기), 미실현 손익, 세금 영향을 자동으로 계산합니다.

**목표 자산 배분:** 포트폴리오 생성 시 설정하는 자산 클래스별 목표 비중입니다.

**벤치마크:** 포트폴리오 성과를 비교할 기준 지수입니다 (기본: SPY).

---

## 3.2 포트폴리오 생성하기

### `/portfolio init` 명령어

```
/portfolio init
```

또는: "새 포트폴리오 만들어줘"

### 프리셋 자산 배분 템플릿

**Aggressive Growth (공격적 성장형, 80/20)**

| 자산 클래스 | 목표 비중 |
|-------------|----------|
| US Equity | 50% |
| International Equity | 30% |
| Fixed Income | 15% |
| Alternatives | 5% |

**Balanced (균형형, 60/40)**

| 자산 클래스 | 목표 비중 |
|-------------|----------|
| US Equity | 35% |
| International Equity | 25% |
| Fixed Income | 30% |
| Alternatives | 5% |
| Cash | 5% |

**Conservative (보수형, 40/60)**

| 자산 클래스 | 목표 비중 |
|-------------|----------|
| US Equity | 20% |
| International Equity | 20% |
| Fixed Income | 45% |
| Alternatives | 5% |
| Cash | 10% |

**All-Weather (올웨더)**

| 자산 클래스 | 목표 비중 |
|-------------|----------|
| US Equity | 30% |
| International Equity | 15% |
| Fixed Income | 40% |
| Alternatives | 15% |

### 생성 예시

```
사용자: 새 포트폴리오 만들어줘. 이름은 "장기투자"로 하고, 균형형으로 설정해줘.
```

```
Created portfolio: 장기투자
  Location: ~/.dexter/portfolios/장기투자.md
  Type: taxable | Currency: USD | Benchmark: SPY
  Strategy: threshold (threshold: 5%)
  Allocation: Balanced (60/40)
```

> **목표 연결**: 포트폴리오 생성 시 "은퇴 목표를 위한 포트폴리오"처럼 목표를 언급하면, 해당 포트폴리오가 자동으로 목표에 연결됩니다. 나중에 `/portfolio goal new`에서도 연결할 수 있습니다.

---

## 3.3 포지션 관리

### 3.3.1 매수 기록

```
/portfolio add <티커> <수량> <매수가> [날짜]
```

**예시:**

```
/portfolio add AAPL 50 185.50
/portfolio add BTC 0.5 42000 2025-06-15
/portfolio add VTI 100 220.30 --portfolio 장기투자
```

**한국어 자연어:**

```
테슬라 20주 250달러에 샀어
애플 50주 185달러에 샀어
```

매수를 기록하면 자산 클래스(US Equity, Fixed Income 등)와 섹터(Technology, Healthcare 등)가 자동 분류되고, 고유한 로트 ID(lot-001, lot-002...)가 부여됩니다.

### 3.3.2 매도 기록

```
/portfolio sell <티커> <수량> <매도가> [--method FIFO|LIFO|HIFO|lot-ID]
```

**로트 선택 방식:**

| 방식 | 설명 | 적합한 상황 |
|------|------|------------|
| **FIFO** (기본) | 가장 오래된 로트부터 매도 | 일반적인 매도 |
| **LIFO** | 가장 최근 로트부터 매도 | 최근 매수가가 높아 손실 실현 시 |
| **HIFO** | 매수가가 가장 높은 로트부터 매도 | 양도소득세 최소화 |
| **Specific** | 지정한 로트만 매도 | 세금 최적화 직접 제어 |

매도 시 보유 기간에 따라 세금이 자동 계산됩니다:
- **365일 이하**: 단기 양도소득 (37%)
- **366일 이상**: 장기 양도소득 (15%)

---

## 3.4 Use Case: 신규 투자자 시나리오

### $50,000 투자 시작 시나리오

**1단계: 포트폴리오 생성**

```
/portfolio init
```
→ 이름 "main", 균형형(Balanced), 과세 계좌 설정

**2단계: 6개 종목에 분산 투자**

```
/portfolio add VTI 65 223.50       # US Equity - $14,528
/portfolio add AAPL 30 188.00      # US Equity (Tech) - $5,640
/portfolio add VXUS 200 53.50      # International - $10,700
/portfolio add BND 170 72.80       # Fixed Income - $12,376
/portfolio add GLD 12 195.00       # Alternatives - $2,340
/portfolio add BTC 0.025 64000     # Crypto - $1,600
```

**3단계: 포트폴리오 조회**

```
/portfolio
```

```
Portfolio Summary
  Market Value: $48,157    Cost: $47,184
  P&L: +$973 (+2.1%)      Positions: 6

  Ticker   Shares   Avg Cost    Current    Value        P&L           Weight
  VTI      65       $223.50     $225.10    $14,632      +$104         30.4%
  VXUS     200      $53.50      $54.20     $10,840      +$140         22.5%
  BND      170      $72.80      $73.10     $12,427      +$51          25.8%
  AAPL     30       $188.00     $192.30    $5,769       +$129         12.0%
  GLD      12       $195.00     $197.50    $2,370       +$30          4.9%
  BTC      0.025    $64,000     $67,200    $1,680       +$80          3.5%
```

---

## 3.5 성과 분석 (`/portfolio performance`)

```
/portfolio performance
```

### 계산되는 지표

| 지표 | 설명 |
|------|------|
| **Total Return** | 투자 원금 대비 현재 가치 변화율 |
| **TWR** (시간 가중 수익률) | 현금 유출입 영향을 제거한 순수 투자 성과 |
| **MWR/IRR** (금액 가중 수익률) | 투자 시점의 영향을 반영한 실제 투자자 수익률 |
| **Alpha** | 시장 대비 초과 수익률 (양수 = 시장 대비 초과 성과) |
| **Beta** | 시장 대비 변동성 (1.0 = 시장과 동일) |
| **Sharpe Ratio** | 위험 1단위당 초과 수익 (> 1.0 양호) |
| **Sortino Ratio** | 하방 위험 1단위당 초과 수익 (> 2.0 양호) |

### 목표 연동 분석

포트폴리오가 투자 목표에 연결되어 있으면, 성과 분석에 **Goal Trajectory** 섹션이 추가됩니다:

- **필요 수익률 vs 실제 수익률**: 목표 달성에 필요한 연간 수익률과 실제 달성 수익률 비교
- **예상 도달 금액**: 현재 추세 유지 시 목표일에 예상되는 포트폴리오 가치
- **상태**: On Track (순조로움) / At Risk (주의) / Behind (뒤처짐)

---

## 3.6 자산 배분 분석 (`/portfolio allocation`)

```
/portfolio allocation
```

**5가지 분석 차원:**
1. 자산 클래스별 (US Equity, Fixed Income 등)
2. 섹터별 (Technology, Healthcare 등)
3. 지역별 (미국, 선진국, 신흥국)
4. 투자 수단별 (개별 주식, ETF, 암호화폐)
5. 시가총액별 (대형주, 중형주, 소형주)

ASCII 바 차트 시각화, HHI 분산 점수, 집중 경고를 포함합니다.

---

## 3.7 벤치마크 비교 (`/portfolio compare`)

```
/portfolio compare
```

**내장 벤치마크:** SPY, VTI, QQQ, ACWI, 60/40, 80/20, All-Weather, Three-Fund

**비교 지표:** Excess Return, Tracking Error, Information Ratio, Up/Down Capture

---

## 3.8 리밸런싱 (`/portfolio rebalance`)

```
/portfolio rebalance
```

### 3가지 전략

| 전략 | 설명 | 적합한 투자자 |
|------|------|-------------|
| **Threshold** (기본) | 드리프트가 ±5% 초과 시 리밸런싱 | 적극적 관리 |
| **Calendar** | 분기/반기/연간 정기 리밸런싱 | 장기 패시브 |
| **Band** | 내부(3%)/외부(8%) 밴드 기반 | 정밀 제어 |

**세금 효율적 매매 순서:**
1. 미실현 손실 로트 우선 (손실 실현 → 세금 혜택)
2. 장기 이익 로트 다음 (15% 세율)
3. 단기 이익 로트 마지막 (37% 세율)

**캐시 플로우 리밸런싱:** 매도 없이 새로운 자금을 저비중 자산에 투자하여 드리프트를 줄이는 대안도 함께 제시됩니다.

### 목표 기반 리밸런싱

`/portfolio rebalance --goal [이름]` 명령어를 사용하면 투자 목표의 **글라이드 패스(Glide Path)**에 따라 리밸런싱합니다:

| 목표일까지 남은 기간 | 전환 규칙 |
|---------------------|-----------|
| 10년 초과 | 현재 템플릿 유지 |
| 7–10년 | 위험도 한 단계 하향 |
| 3–7년 | 중기 템플릿으로 전환 |
| 1–3년 | 보수적 단기 템플릿으로 전환 |
| 1년 미만 | 자본 보존 모드 (현금 60%, 채권 35%, 주식 5%) |

글라이드 패스 전환은 자동 제안되며, 실행 전 항상 사용자 확인을 거칩니다.

---

## 3.9 리스크 분석 (`/portfolio risk`)

```
/portfolio risk
```

### 주요 분석 항목

- **포트폴리오 베타**: 시장 대비 민감도
- **VaR (Value at Risk)**: 일일/주간/월간 최대 예상 손실
- **스트레스 테스트**: Market Crash, Rate Hike, Recession, Inflation Spike, Recovery Rally 5가지 시나리오
- **리스크 점수** (1~10): 5가지 요소 종합 평가

| 점수 | 등급 |
|------|------|
| 1~2 | Very Conservative |
| 3~4 | Conservative |
| 5~6 | Moderate |
| 7~8 | Aggressive |
| 9~10 | Very Aggressive |

---

## 3.10 세금 분석 (`/portfolio tax`)

```
/portfolio tax
```

### 주요 기능

- **Tax-Loss Harvesting**: 손실 중인 종목 매도 → 다른 이익과 상쇄 → 세금 절감
- **교체 종목 가이드**: VTI → VOO, VXUS → IXUS 등 Wash Sale을 피하는 대체 종목 추천
- **Wash Sale 감지**: 매도일 전후 30일 내 동일 종목 재매수 자동 경고
- **로트 분류**: 단기/장기 이익·손실 4가지 범주 자동 분류
- **연말 세금 계획**: 10~12월 특별 체크리스트

---

## 3.11 배당 분석 (`/portfolio dividend`)

```
/portfolio dividend
```

### 주요 분석 항목

- **예상 연간 배당금**: 종목별·월별 배당 수입 예측
- **배당 수익률**: Current Yield, Yield on Cost
- **배당 지속 가능성**: Payout Ratio 기반 안전성 평가
- **세금 효율**: 적격/비적격 배당 세금 처리
- **배당 성장 시나리오**: +5%, +10% 성장 시 수입 예측

---

## 3.12 커맨드 요약 테이블

| 명령어 | 설명 |
|--------|------|
| `/portfolio` | 포트폴리오 전체 요약 보기 |
| `/portfolio init` | 새 포트폴리오 생성 |
| `/portfolio add <티커> <수량> <매수가>` | 매수 기록 추가 |
| `/portfolio sell <티커> <수량> <매도가>` | 매도 기록 |
| `/portfolio performance` | 성과 분석 (TWR, 알파, 샤프 등) |
| `/portfolio allocation` | 자산 배분 분석 (5차원) |
| `/portfolio compare` | 벤치마크 대비 비교 |
| `/portfolio rebalance` | 리밸런싱 분석 및 매매 권고 |
| `/portfolio risk` | 리스크 분석 (VaR, 스트레스 테스트) |
| `/portfolio tax` | 세금 분석 (TLH, Wash Sale) |
| `/portfolio dividend` | 배당 수익 분석 및 예측 |
| `/portfolio goal new` | 투자 목표 생성 |
| `/portfolio goal [이름]` | 목표 진행 추적 |
| `/portfolio goals` | 전체 목표 현황 |
| `/portfolio rebalance --goal [이름]` | 목표 기반 리밸런싱 |
| `/portfolio goal plan [이름]` | 목표 달성 계획 분석 |

**자연어로도 사용 가능합니다:**

| 자연어 (한국어) | 실행되는 명령 |
|----------------|-------------|
| "내 포트폴리오 보여줘" | `/portfolio` |
| "애플 50주 185달러에 샀어" | `/portfolio add AAPL 50 185` |
| "테슬라 10주 팔았어" | `/portfolio sell TSLA 10` |
| "포트폴리오 성과 분석해줘" | `/portfolio performance` |
| "리밸런싱 해야 하나?" | `/portfolio rebalance` |
| "세금 분석해줘" | `/portfolio tax` |
| "배당 수익 알려줘" | `/portfolio dividend` |
| "벤치마크랑 비교해줘" | `/portfolio compare` |
| "자산 배분 분석해줘" | `/portfolio allocation` |
| "포트폴리오 위험 분석해줘" | `/portfolio risk` |
| "은퇴 목표 만들어줘" | `/portfolio goal new` |
| "내 은퇴 목표 진행 상황 보여줘" | `/portfolio goal retirement` |
| "내 모든 목표 보여줘" | `/portfolio goals` |
| "목표 기반으로 리밸런싱 해줘" | `/portfolio rebalance --goal` |
| "목표 달성 계획 분석해줘" | `/portfolio goal plan` |

---

## 3.13 목표 기반 투자 개요

### 목표 기반 투자란?

목표 기반 투자(Goal-Based Investing)는 구체적인 재무 목표(은퇴, 교육, 주택 구매 등)를 설정하고, 해당 목표를 달성하기 위해 포트폴리오를 관리하는 투자 전략입니다.

### 핵심 개념

**글라이드 패스(Glide Path)**: 목표일이 가까워질수록 자동으로 보수적인 자산 배분으로 전환하는 메커니즘입니다. 은퇴가 20년 남았을 때는 공격적으로, 5년 남았을 때는 중립적으로, 1년 남았을 때는 보수적으로 운용합니다.

**상태 분류**:

| 상태 | 의미 | 조건 |
|------|------|------|
| On Track ✅ | 순조로움 | 기본 시나리오 예상치 ≥ 목표 금액 |
| At Risk ⚠️ | 주의 필요 | 비관 시나리오 < 목표 ≤ 기본 시나리오 |
| Behind ❌ | 뒤처짐 | 기본 시나리오 예상치 < 목표 금액 |

---

## 3.14 목표 생성 (`/portfolio goal new`)

```
/portfolio goal new
```

또는: "은퇴 목표 만들어줘. 200만 달러 2045년까지"

### 입력 항목

| 항목 | 필수 | 설명 | 예시 |
|------|------|------|------|
| 목표 이름 | ✅ | 소문자 식별자 | retirement, education |
| 목표 유형 | ✅ | retirement/education/home/emergency/travel/general | retirement |
| 목표 금액 | ✅ | 달성 목표 금액 | $2,000,000 |
| 목표일 | ✅ | 달성 기한 | 2045-06-01 |
| 월 적립액 | 선택 | 매월 추가 투자 금액 | $2,000 |
| 위험 성향 | 선택 | conservative/moderate/aggressive | aggressive |
| 연결 포트폴리오 | 선택 | 이 목표에 연결할 포트폴리오 | main |

### 목표 유형별 기본 설정

| 유형 | 기본 위험 성향 | 설명 |
|------|--------------|------|
| retirement (은퇴) | aggressive | 긴 투자 기간, 회복 여유 |
| education (교육) | moderate | 중간 기간, 적절한 리스크 |
| home (주택) | moderate | 5–10년 중기 목표 |
| emergency (비상금) | conservative | 자본 보존 우선 |
| travel (여행) | moderate | 단기 목표 |
| general (일반) | moderate | 기간에 따라 자동 조정 |

### 생성 예시

```
사용자: 은퇴 목표 만들어줘. 200만 달러, 2045년까지, 매달 2천 달러 적립.

Created goal: retirement
  Type: retirement | Target: $2,000,000 | Deadline: 2045-06-01
  Horizon: long (19 years)
  Risk: aggressive | Template: aggressive-long
  Required Return: 8.5% | Expected Return: 10–12%
  Monthly Contribution: $2,000
  Linked Portfolios: main
  Location: ~/.dexter/portfolios/goals/retirement.md
```

---

## 3.15 목표 진행 추적

### 단일 목표 조회

```
/portfolio goal retirement
```

또는: "내 은퇴 목표 진행 상황 보여줘"

현재 가치, 진행률, 3가지 시나리오 예측(낙관/기본/비관), 마일스톤 달성 현황을 보여줍니다.

### 전체 목표 조회

```
/portfolio goals
```

또는: "내 모든 목표 보여줘"

모든 목표의 현황을 한 눈에 보여주는 대시보드를 표시합니다.

---

## 3.16 목표 기반 리밸런싱

```
/portfolio rebalance --goal retirement
```

또는: "목표 기반으로 리밸런싱 해줘"

투자 목표의 글라이드 패스에 따라 자산 배분을 자동 조정합니다.

### 글라이드 패스 전환 규칙

| 남은 기간 | 전환 | 예시 |
|-----------|------|------|
| 10년 초과 | 유지 | aggressive-long 유지 |
| 7–10년 | 위험도 ↓ | aggressive-long → moderate-long |
| 3–7년 | 중기 전환 | moderate-long → moderate-medium |
| 1–3년 | 보수적 전환 | → conservative-short |
| 1년 미만 | 자본 보존 | 현금 60%, 채권 35%, 주식 5% |

전환 시 기존 리밸런싱과 동일하게 세금 효율적 매매 순서를 적용합니다.

---

## 3.17 목표 달성 계획 (`/portfolio goal plan`)

```
/portfolio goal plan retirement
```

또는: "목표 달성 계획 분석해줘"

### 분석 내용

- **필요 적립액 계산**: 목표 달성을 위한 필요 월 적립액
- **시나리오 분석**: 현재 페이스, 적립 증액, 기간 연장 시 결과 비교
- **연도별 예측**: 목표일까지의 연도별 가치 변화 예측 (글라이드 패스 전환 포함)
- **조정 권고**: 상태(On Track/At Risk/Behind)에 따른 구체적 행동 제안

---

## 3.18 목표 파일 위치

목표 파일은 포트폴리오와 함께 관리됩니다:

```
~/.dexter/portfolios/
├── config.md
├── main.md
├── retirement-ira.md
└── goals/
    ├── retirement.md
    ├── education.md
    └── emergency.md
```

각 목표 파일에는 YAML 메타데이터, 목표 자산 배분, 진행 이력, 마일스톤이 기록됩니다.

---

# Part 4: 고급 활용

---

## 4.1 WhatsApp 게이트웨이

### 4.1.1 개요

Alchemist의 WhatsApp 게이트웨이는 스마트폰의 WhatsApp을 통해 Alchemist 에이전트에 접근할 수 있게 해주는 기능입니다. 터미널 앞에 앉아있지 않아도, 이동 중에 WhatsApp 메시지로 금융 질문을 보내면 Alchemist가 분석 결과를 답장으로 보내줍니다.

**아키텍처:**

```
스마트폰 (WhatsApp)
    ↕ WhatsApp Web 프로토콜
게이트웨이 서버 (로컬 컴퓨터)
    ↕ 메시지 라우팅
Alchemist 에이전트 (도구 호출 + LLM 응답)
    ↕
응답을 WhatsApp으로 전송
```

### 4.1.2 설정 방법

**Step 1: WhatsApp 로그인**

```bash
bun gateway:login
```

터미널에 QR 코드가 표시됩니다.

**Step 2: QR 코드 스캔**

1. 스마트폰에서 WhatsApp → **설정** → **연결된 기기** → **기기 연결**
2. 터미널에 표시된 QR 코드를 스캔
3. "WhatsApp linked successfully." 메시지가 나타나면 성공

인증 정보는 `~/.dexter/credentials/whatsapp/default/`에 저장됩니다.

**Step 3: 게이트웨이 서버 시작**

```bash
bun gateway
```

### 4.1.3 사용 방법

게이트웨이가 실행 중이면 WhatsApp에서 **자기 자신에게 메시지**(셀프 챗)를 보내는 방식으로 Alchemist와 대화합니다.

**CLI와의 차이점:**

| 기능 | CLI | WhatsApp |
|------|-----|----------|
| 실시간 스트리밍 | 토큰 단위 스트리밍 | 완성된 응답 일괄 전송 |
| 슬래시 명령어 | 지원 | 자연어로 대체 |
| 파일 읽기/쓰기 | 전체 지원 | 제한적 |

### 4.1.4 보안 설정

설정 파일: `~/.dexter/gateway.json`

**`dmPolicy` — DM 정책:**

| 정책 | 설명 |
|------|------|
| `pairing` | 기본값. 페어링된 기기만 허용 (가장 안전) |
| `allowlist` | `allowFrom` 목록의 번호만 허용 |
| `open` | 모든 DM에 응답 (테스트용) |
| `disabled` | DM 응답 비활성화 |

**권장 설정 (개인 사용):**

```json
{
  "channels": {
    "whatsapp": {
      "accounts": {
        "default": {
          "dmPolicy": "allowlist",
          "allowFrom": ["+82본인번호"],
          "groupPolicy": "disabled"
        }
      }
    }
  }
}
```

---

## 4.2 커스텀 스킬 만들기

### 4.2.1 스킬 구조

```markdown
---
name: my-skill
description: >
  이 스킬이 언제 사용되어야 하는지 설명합니다.
---

# 스킬 이름

## 워크플로우 체크리스트
- [ ] Step 1: 데이터 수집
- [ ] Step 2: 분석 수행
- [ ] Step 3: 결과 제시

## Step 1: 데이터 수집
구체적인 도구 호출 지시...
```

### 4.2.2 나만의 스킬 작성하기 — 예시: earnings-preview

**Step 1: 디렉토리 생성**

```bash
mkdir -p ~/.dexter/skills/earnings-preview
```

**Step 2: SKILL.md 작성**

`~/.dexter/skills/earnings-preview/SKILL.md`:

```markdown
---
name: earnings-preview
description: >
  다가오는 실적 발표를 미리 분석합니다. "실적 미리보기",
  "earnings preview" 등을 언급할 때 트리거됩니다.
---

# 실적 미리보기 스킬

## 워크플로우 체크리스트
- [ ] Step 1: 기본 정보 및 실적 일정 확인
- [ ] Step 2: 컨센서스 추정치 수집
- [ ] Step 3: 최근 실적 트렌드 분석
- [ ] Step 4: 주요 관전 포인트 정리
- [ ] Step 5: 결과 보고서 작성
```

**Step 3:** Alchemist를 재시작하면 자동으로 스킬이 발견됩니다.

### 4.2.3 스킬 작성 팁

- **체크리스트 패턴**: 에이전트가 진행 상황을 체계적으로 추적
- **도구 쿼리 정확히 지정**: `financial_search` 쿼리 형식을 명시
- **출력 형식 템플릿**: 결과를 구조화된 형태로 제공
- **에러 처리**: 데이터 불가 시 대응 방법 포함

---

## 4.3 고급 활용 시나리오

### 4.3.1 종합 종목 리서치

단계적으로 심층 분석을 수행합니다:

```
질문 1: "NVDA 기본 분석 — 주가, 밸류에이션, 핵심 재무지표"
질문 2: "최근 4분기 실적 추이와 데이터센터 매출 분석"
질문 3: "NVDA DCF 밸류에이션 해줘"
질문 4: "최근 내부자 거래와 기관 동향"
질문 5: "최신 10-K 리스크 팩터 요약"
질문 6: "종합 투자 의견 정리"
```

### 4.3.2 섹터 비교 분석

```
NVDA, AMD, INTC 세 회사를 비교 분석해줘.
매출 성장률, 이익률, 밸류에이션, AI 전략 중심으로.
```

### 4.3.3 투자 논문 (Investment Thesis) 작성

```
TSLA에 대한 불 케이스와 베어 케이스를 만들어줘.
각각 핵심 논거 3가지와 목표 주가를 포함해서.
```

### 4.3.4 매크로 경제 리서치

```
연준이 다음 FOMC에서 금리를 인하할 가능성과
그 영향을 분석해줘. 주식, 채권, 암호화폐 각각.
```

### 4.3.5 포트폴리오 + 리서치 결합

```
내 포트폴리오에 AAPL이 있는데, 지금 추가 매수할지
아니면 줄여야 할지 분석해줘.
```

### 4.3.6 암호화폐 DeFi 리서치

```
Aave 프로토콜 분석해줘.
TVL, 수익, 수익률, 리스크 중심으로.
```

---

## 4.4 평가 시스템 (Evals)

에이전트의 응답 정확도를 체계적으로 측정하는 도구입니다.

**실행 방법:**

```bash
bun run src/evals/run.ts              # 전체 데이터셋
bun run src/evals/run.ts --sample 10  # 샘플 10개
```

**LangSmith 연동:**

```bash
# .env에 설정
LANGSMITH_API_KEY=ls-your-api-key
LANGSMITH_TRACING=true
```

---

## 4.5 문제 해결 (Troubleshooting)

### API 키 관련 문제

"No tools available" 메시지가 나오면:
1. `.env` 파일에 필요한 API 키가 설정되어 있는지 확인
2. 필수: LLM 프로바이더 키 (최소 1개)
3. 권장: `FINANCIAL_DATASETS_API_KEY`, 웹 검색 키 (1개)

### 모델 응답 없음

1. 인터넷 연결 상태 확인
2. API 키 유효성 확인 (만료, 잔액 부족)
3. 모델 프로바이더 서비스 상태 확인

### 금융 데이터 불가

1. `FINANCIAL_DATASETS_API_KEY` 확인
2. 무료 플랜 일일 호출 제한 (250회/일)
3. 티커 심볼 정확성 확인

### 포트폴리오 파일 문제

1. 마크다운 테이블 형식 확인 (파이프 `|` 구분자)
2. YAML 프론트매터 `---` 구분자 확인
3. 파일 위치: `~/.dexter/portfolios/`

### WhatsApp 연결 끊김

1. 게이트웨이 로그 확인
2. WhatsApp에서 연결된 기기 목록 확인
3. 필요시 재로그인: `bun gateway:login`

### 전체 초기화

```bash
rm -rf ~/.dexter       # 주의: 모든 Alchemist 데이터 삭제
bun start              # 다시 시작
```

선택적 초기화:

```bash
rm -rf ~/.dexter/credentials/whatsapp  # WhatsApp만
rm -rf ~/.dexter/portfolios             # 포트폴리오만
rm ~/.dexter/gateway.json               # 게이트웨이만
```

---

## 4.6 팁과 모범 사례

### 질문 작성 팁

| 비효율적 | 효율적 |
|----------|--------|
| "애플 분석해줘" | "AAPL의 P/E, 매출 성장률, FCF를 분석해줘" |
| "주식 추천해줘" | "반도체 섹터에서 P/E 20x 이하, 매출 성장률 15%+ 종목 찾아줘" |
| "시장 어때?" | "S&P 500의 YTD 성과와 섹터별 수익률 비교해줘" |

### 슬래시 명령어 vs 자연어

| 상황 | 추천 방식 |
|------|-----------|
| 포트폴리오 조작 | 슬래시 명령어 (`/portfolio add ...`) |
| 정형화된 분석 | 자연어 + 키워드 ("NVDA DCF 밸류에이션") |
| 탐색적 리서치 | 자연어 ("AI 반도체 시장 전망이 어때?") |

### 다회차 대화 전략

```
1단계 (개요): "MSFT 기본 분석해줘"
2단계 (심화): "클라우드 사업부 매출 추이를 더 자세히"
3단계 (비교): "AWS, GCP와 비교하면 어때?"
4단계 (밸류에이션): "이 데이터로 DCF 해줘"
5단계 (결론): "종합 의견 정리해줘"
```

### 모델 선택 가이드

| 용도 | 권장 모델 |
|------|-----------|
| 빠른 데이터 조회 | GPT 4.1, Gemini 3 Flash |
| 종합 분석/리서치 | GPT 5.2 (기본), Claude Opus 4.6 |
| 비용 효율적 사용 | DeepSeek V3, Ollama (로컬) |

---

> **면책 조항:** Alchemist가 제공하는 모든 분석, 데이터, 의견은 정보 제공 목적이며, 투자 조언이 아닙니다. 모든 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다. 과거 성과는 미래 수익을 보장하지 않습니다.
