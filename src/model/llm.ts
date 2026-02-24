import { AIMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StructuredToolInterface } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';
import { z } from 'zod';
import { DEFAULT_SYSTEM_PROMPT } from '@/agent/prompts';
import type { TokenUsage } from '@/agent/types';
import { logger } from '@/utils';
import { resolveProvider, getProviderById } from '@/providers';
import {
  hasValidCredentials,
  loadCredentials,
  refreshAnthropicToken,
  refreshGoogleToken,
  refreshOpenAIToken,
} from '@/auth';

export const DEFAULT_PROVIDER = 'openai';
export const DEFAULT_MODEL = 'gpt-5.2';

/**
 * Gets the fast model variant for the given provider.
 * Falls back to the provided model if no fast variant is configured (e.g., Ollama).
 */
export function getFastModel(modelProvider: string, fallbackModel: string): string {
  return getProviderById(modelProvider)?.fastModel ?? fallbackModel;
}

// Generic retry helper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, provider: string, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`[${provider} API] error (attempt ${attempt + 1}/${maxAttempts}): ${message}`);

      // Auto-refresh OAuth tokens on 401 errors
      if (message.includes('401') || message.includes('Unauthorized')) {
        await tryRefreshOAuthToken(provider);
      }

      if (attempt === maxAttempts - 1) {
        throw new Error(`[${provider} API] ${message}`);
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

async function tryRefreshOAuthToken(providerName: string): Promise<void> {
  try {
    if (providerName === 'Anthropic' || providerName === 'anthropic') {
      const creds = loadCredentials('anthropic');
      if (creds?.refreshToken) {
        logger.info('[OAuth] Refreshing Anthropic token...');
        await refreshAnthropicToken(creds.refreshToken);
      }
    } else if (providerName === 'Google' || providerName === 'google') {
      const creds = loadCredentials('google');
      if (creds?.refreshToken) {
        logger.info('[OAuth] Refreshing Google token...');
        await refreshGoogleToken(creds.refreshToken);
      }
    } else if (providerName === 'OpenAI' || providerName === 'openai') {
      const creds = loadCredentials('openai');
      if (creds?.refreshToken) {
        logger.info('[OAuth] Refreshing OpenAI token...');
        await refreshOpenAIToken(creds.refreshToken);
      }
    }
  } catch (refreshErr) {
    logger.error(`[OAuth] Token refresh failed: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`);
  }
}

// Model provider configuration
interface ModelOpts {
  streaming: boolean;
}

type ModelFactory = (name: string, opts: ModelOpts) => BaseChatModel;

function getApiKey(envVar: string): string {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new Error(`[LLM] ${envVar} not found in environment variables`);
  }
  return apiKey;
}

/**
 * Returns a valid OAuth access token for the given provider,
 * auto-refreshing if the token has expired. Returns null if
 * no OAuth credentials are available.
 */
function getOAuthToken(provider: 'anthropic' | 'google' | 'openai'): string | null {
  if (!hasValidCredentials(provider)) return null;
  const creds = loadCredentials(provider);
  if (!creds) return null;

  // If token is expired (with 60s buffer), refresh synchronously is not possible.
  // Instead, we return the current token and let the SDK handle 401s,
  // or we can eagerly refresh if we detect expiry. For simplicity, the
  // refresh is done lazily — callers that hit 401 should trigger a refresh.
  // However, we CAN do a sync check and log a warning.
  if (creds.expiresAt < Date.now() - 60_000) {
    logger.warn(`[OAuth] ${provider} token expired — will attempt refresh on next retry`);
  }
  return creds.accessToken;
}

/**
 * Decode a JWT and extract the ChatGPT account ID from the OpenAI OAuth token.
 * The claim lives at `["https://api.openai.com/auth"]["chatgpt_account_id"]`.
 */
function extractChatGPTAccountId(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
    );
    const authClaim = payload?.['https://api.openai.com/auth'];
    return authClaim?.chatgpt_account_id ?? null;
  } catch {
    return null;
  }
}

const CODEX_BASE_URL = 'https://chatgpt.com/backend-api';

/**
 * Extract path + search from a URL string.
 * Matching guard22/opencode-multi-auth-codex approach.
 */
function extractPathAndSearch(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    const trimmed = String(url || '').trim();
    if (trimmed.startsWith('/')) return trimmed;
    const firstSlash = trimmed.indexOf('/');
    if (firstSlash >= 0) return trimmed.slice(firstSlash);
    return trimmed;
  }
}

/**
 * Rewrite URL path: /responses → /codex/responses, /chat/completions → /codex/chat/completions.
 * Matching guard22/opencode-multi-auth-codex approach.
 */
function toCodexBackendUrl(originalUrl: string): string {
  let mapped = extractPathAndSearch(originalUrl);
  if (mapped.includes('/responses')) {
    mapped = mapped.replace('/responses', '/codex/responses');
  } else if (mapped.includes('/chat/completions')) {
    mapped = mapped.replace('/chat/completions', '/codex/chat/completions');
  }
  return new URL(mapped, CODEX_BASE_URL).toString();
}

/**
 * Parse SSE stream text and extract the final response from response.done or response.completed.
 * Matching guard22/opencode-multi-auth-codex approach.
 */
function parseSseStream(sseText: string): unknown | null {
  const lines = sseText.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    try {
      const data = JSON.parse(line.substring(6)) as { type?: string; response?: unknown };
      if (data?.type === 'response.done' || data?.type === 'response.completed') {
        return data.response;
      }
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * Filter a single SSE line: keep only valid SSE protocol lines and data events
 * that are NOT ChatGPT backend error/metadata events.
 */
function isCleanSseLine(trimmed: string): boolean {
  if (trimmed === '') return true; // SSE delimiters
  if (trimmed.startsWith('event:')) return true;
  if (trimmed.startsWith('id:')) return true;
  if (trimmed.startsWith('retry:')) return true;
  if (trimmed.startsWith('data:')) {
    // Filter out data lines containing ChatGPT backend error events
    const jsonStr = trimmed.substring(trimmed.indexOf(':') + 1).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      // Drop error events from the ChatGPT backend
      if (parsed?.type === 'error' || parsed?.error) return false;
    } catch {
      // Non-JSON data line — might be "[DONE]" which is valid, or garbage
      if (jsonStr === '[DONE]') return true;
      return false; // Drop unparseable data lines (trace metadata etc.)
    }
    return true;
  }
  // Drop everything else (Context: trace=..., raw error text, etc.)
  return false;
}

/**
 * Create a custom fetch for ChatGPT backend API routing.
 * Matches guard22/opencode-multi-auth-codex and numman-ali/opencode-openai-codex-auth.
 */
function createChatGPTFetch(token: string, accountId: string) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    // Rewrite URL path to codex backend endpoint
    const targetUrl = toCodexBackendUrl(rawUrl);

    // Parse request body — handle both JSON strings and non-string types (FormData, Blob, etc.)
    let payload: Record<string, unknown> = {};
    if (init?.body) {
      if (typeof init.body === 'string') {
        try { payload = JSON.parse(init.body); } catch { payload = {}; }
      } else if (init.body instanceof ArrayBuffer || ArrayBuffer.isView(init.body)) {
        try { payload = JSON.parse(new TextDecoder().decode(init.body as ArrayBuffer)); } catch { payload = {}; }
      }
      // FormData / Blob / ReadableStream — can't reliably parse, use empty payload
      // The ChatGPT backend requires JSON, so this is a best-effort approach.
    }

    // If parsing failed and payload is empty (no model/input), skip this request
    // This prevents sending empty payloads that the ChatGPT backend would reject
    if (!payload.model && !payload.input) {
      // Passthrough to original endpoint (will likely fail, but avoids confusing 403s)
      return globalThis.fetch(input, init);
    }

    const isStreaming = payload?.stream === true;

    // Transform payload: ChatGPT backend always requires stream: true and store: false
    payload.store = false;
    payload.stream = true;

    // ChatGPT /codex/responses requires a top-level `instructions` field.
    // LangChain puts the system prompt in `input` as role:"developer" or role:"system".
    // Extract it and move to `instructions`.
    if (!payload.instructions && Array.isArray(payload.input)) {
      const inputArr = payload.input as Array<Record<string, unknown>>;
      const sysIdx = inputArr.findIndex(
        (m) => m.role === 'developer' || m.role === 'system',
      );
      if (sysIdx !== -1) {
        const sysMsg = inputArr[sysIdx];
        payload.instructions = typeof sysMsg.content === 'string'
          ? sysMsg.content
          : JSON.stringify(sysMsg.content);
        // Remove from input array
        inputArr.splice(sysIdx, 1);
        payload.input = inputArr;
      }
    }

    // Build headers matching guard22/opencode-multi-auth-codex exactly
    const headers = new Headers(init?.headers || {});
    headers.delete('x-api-key');                      // Remove SDK's API key header
    headers.set('Content-Type', 'application/json');   // Force JSON (prevent multipart)
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('chatgpt-account-id', accountId);
    headers.set('OpenAI-Beta', 'responses=experimental');
    headers.set('originator', 'codex_cli_rs');
    headers.set('accept', 'text/event-stream');

    const body = JSON.stringify(payload);

    const res = await globalThis.fetch(targetUrl, {
      method: init?.method ?? 'POST',
      headers,
      body,
      signal: init?.signal,
    });

    if (!res.ok) {
      // Return a clean error response with proper JSON format for the SDK
      const errText = await res.text().catch(() => '');
      const cleanError = JSON.stringify({
        error: {
          message: `ChatGPT backend error (${res.status})`,
          type: 'api_error',
          code: String(res.status),
        },
      });
      return new Response(cleanError, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
      });
    }

    // Always filter SSE — ChatGPT backend always returns SSE since we force stream: true
    if (res.body) {
      if (isStreaming) {
        // Streaming: filter and pass through SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); return; }
            const text = decoder.decode(value, { stream: true });
            const filtered = text.split('\n')
              .filter((line) => isCleanSseLine(line.trim()))
              .join('\n');
            if (filtered) {
              controller.enqueue(encoder.encode(filtered));
            }
          },
        });
        const responseHeaders = new Headers(res.headers);
        if (!responseHeaders.has('content-type')) {
          responseHeaders.set('content-type', 'text/event-stream; charset=utf-8');
        }
        return new Response(stream, {
          status: res.status,
          statusText: res.statusText,
          headers: responseHeaders,
        });
      }

      // Non-streaming: read all SSE and extract final response as JSON
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      const finalResponse = parseSseStream(fullText);
      if (finalResponse) {
        return new Response(JSON.stringify(finalResponse), {
          status: res.status,
          statusText: res.statusText,
          headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
        });
      }

      // Fallback: return raw text with JSON content-type to avoid SDK parsing issues
      return new Response(fullText, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers({ 'content-type': 'text/plain; charset=utf-8' }),
      });
    }

    return res;
  };
}

// Global fetch interceptor for Google OAuth via Antigravity (Gemini Code Assist).
// The @google/generative-ai SDK sends requests to generativelanguage.googleapis.com
// with an x-goog-api-key header. Antigravity OAuth tokens don't work with that API.
// Instead, we redirect requests to the Cloud Code Assist API (cloudcode-pa.googleapis.com)
// wrapping the request body in the Antigravity format, matching opencode-antigravity-auth.
const ANTIGRAVITY_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
let _googleOAuthFetchInstalled = false;
function installGoogleOAuthFetch(token: string) {
  if (_googleOAuthFetchInstalled) return;
  const origFetch = globalThis.fetch;
  (globalThis as Record<string, unknown>).fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    if (!url.includes('generativelanguage.googleapis.com')) {
      return origFetch.call(globalThis, input, init);
    }

    // Extract model name and action from the URL
    // Format: .../v1beta/models/{model}:{action}
    const match = url.match(/\/models\/([^:?]+):(\w+)/);
    if (!match) {
      return origFetch.call(globalThis, input, init);
    }
    const [, modelName, action] = match;
    const isStreaming = action === 'streamGenerateContent';

    // Build Antigravity endpoint URL
    const antigravityUrl = `${ANTIGRAVITY_ENDPOINT}/v1internal:${action}${isStreaming ? '?alt=sse' : ''}`;

    // Wrap request body in Antigravity format
    let body = init?.body;
    if (typeof body === 'string') {
      try {
        const originalPayload = JSON.parse(body);
        const wrappedBody = {
          project: 'alchemist-cli',
          model: modelName,
          request: originalPayload,
        };
        body = JSON.stringify(wrappedBody);
      } catch { /* keep original body if parse fails */ }
    }

    // Set Antigravity headers
    const headers = new Headers(init?.headers);
    headers.delete('x-goog-api-key');
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');
    headers.set('User-Agent', 'google-api-nodejs-client/9.15.1');
    headers.set('X-Goog-Api-Client', 'google-cloud-sdk vscode_cloudshelleditor/0.1');

    const response = await origFetch.call(globalThis, antigravityUrl, {
      ...init,
      headers,
      body,
    });

    // Unwrap Antigravity response: extract the `response` field
    if (response.ok && !isStreaming) {
      try {
        const responseText = await response.text();
        const parsed = JSON.parse(responseText);
        if (parsed.response) {
          return new Response(JSON.stringify(parsed.response), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
        return new Response(responseText, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        return response;
      }
    }

    // For streaming responses, transform SSE data lines to unwrap .response
    if (response.ok && isStreaming && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async pull(controller) {
          const { done, value } = await reader.read();
          if (done) { controller.close(); return; }
          let text = decoder.decode(value, { stream: true });
          // Unwrap each SSE data line: "data: {response: {...}}" -> "data: {...}"
          text = text.replace(/^data: (.+)$/gm, (_match, json) => {
            try {
              const parsed = JSON.parse(json);
              if (parsed.response) return `data: ${JSON.stringify(parsed.response)}`;
            } catch { /* ignore */ }
            return _match;
          });
          controller.enqueue(encoder.encode(text));
        },
      });
      return new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  };
  _googleOAuthFetchInstalled = true;
}

// Factories keyed by provider id — prefix routing is handled by resolveProvider()
const MODEL_FACTORIES: Record<string, ModelFactory> = {
  anthropic: (name, opts) => {
    const oauthToken = getOAuthToken('anthropic');
    if (oauthToken) {
      // Use custom fetch to intercept requests and replace x-api-key with Bearer token,
      // matching the approach used by opencode-anthropic-auth plugin.
      // LangChain always forces apiKey into the SDK client, so we must override at fetch level.
      const oauthFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        headers.delete('x-api-key');
        headers.set('authorization', `Bearer ${oauthToken}`);
        headers.set('anthropic-beta', 'oauth-2025-04-20,interleaved-thinking-2025-05-14');
        headers.set('user-agent', 'claude-cli/2.1.2 (external, cli)');

        // Add ?beta=true to /v1/messages requests (required for OAuth)
        let requestInput = input;
        try {
          const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
          const url = new URL(urlStr);
          if (url.pathname === '/v1/messages' && !url.searchParams.has('beta')) {
            url.searchParams.set('beta', 'true');
            requestInput = typeof input === 'string' || input instanceof URL ? url : new Request(url, input as Request);
          }
        } catch { /* ignore URL parse errors */ }

        return globalThis.fetch(requestInput, { ...init, headers });
      };

      return new ChatAnthropic({
        model: name,
        ...opts,
        apiKey: 'oauth-placeholder', // Dummy key to pass LangChain validation; removed by custom fetch
        clientOptions: {
          fetch: oauthFetch,
          dangerouslyAllowBrowser: true,
        },
      });
    }
    return new ChatAnthropic({
      model: name,
      ...opts,
      apiKey: getApiKey('ANTHROPIC_API_KEY'),
    });
  },
  google: (name, opts) => {
    const oauthToken = getOAuthToken('google');
    if (oauthToken) {
      // The @google/generative-ai SDK always sends x-goog-api-key header.
      // For Antigravity OAuth, we need Authorization: Bearer instead.
      // Install a global fetch interceptor for googleapis.com requests.
      installGoogleOAuthFetch(oauthToken);
      return new ChatGoogleGenerativeAI({
        model: name,
        ...opts,
        apiKey: 'oauth-placeholder', // Needed to pass SDK validation; replaced by fetch interceptor
      });
    }
    return new ChatGoogleGenerativeAI({
      model: name,
      ...opts,
      apiKey: getApiKey('GOOGLE_API_KEY'),
    });
  },
  openai: (name, opts) => {
    const oauthToken = getOAuthToken('openai');
    if (oauthToken) {
      const accountId = extractChatGPTAccountId(oauthToken);
      if (accountId) {
        return new ChatOpenAI({
          model: name,
          ...opts,
          apiKey: 'chatgpt-oauth',
          useResponsesApi: true,
          configuration: {
            baseURL: CODEX_BASE_URL,
            fetch: createChatGPTFetch(oauthToken, accountId),
          },
        });
      }
    }
    // Fallback: standard OpenAI API with env key
    return new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: oauthToken ?? getApiKey('OPENAI_API_KEY'),
    });
  },
  xai: (name, opts) =>
    new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: getApiKey('XAI_API_KEY'),
      configuration: {
        baseURL: 'https://api.x.ai/v1',
      },
    }),
  openrouter: (name, opts) =>
    new ChatOpenAI({
      model: name.replace(/^openrouter:/, ''),
      ...opts,
      apiKey: getApiKey('OPENROUTER_API_KEY'),
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    }),
  moonshot: (name, opts) =>
    new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: getApiKey('MOONSHOT_API_KEY'),
      configuration: {
        baseURL: 'https://api.moonshot.cn/v1',
      },
    }),
  deepseek: (name, opts) =>
    new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: getApiKey('DEEPSEEK_API_KEY'),
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
    }),
  ollama: (name, opts) =>
    new ChatOllama({
      model: name.replace(/^ollama:/, ''),
      ...opts,
      ...(process.env.OLLAMA_BASE_URL ? { baseUrl: process.env.OLLAMA_BASE_URL } : {}),
    }),
};

const DEFAULT_FACTORY: ModelFactory = (name, opts) => {
  // Use the openai factory if available (handles ChatGPT backend routing)
  const openaiFactory = MODEL_FACTORIES['openai'];
  if (openaiFactory) return openaiFactory(name, opts);

  const oauthToken = getOAuthToken('openai');
  return new ChatOpenAI({
    model: name,
    ...opts,
    apiKey: oauthToken ?? getApiKey('OPENAI_API_KEY'),
  });
};

export function getChatModel(
  modelName: string = DEFAULT_MODEL,
  streaming: boolean = false
): BaseChatModel {
  const opts: ModelOpts = { streaming };
  const provider = resolveProvider(modelName);
  const factory = MODEL_FACTORIES[provider.id] ?? DEFAULT_FACTORY;
  return factory(modelName, opts);
}

interface CallLlmOptions {
  model?: string;
  systemPrompt?: string;
  outputSchema?: z.ZodType<unknown>;
  tools?: StructuredToolInterface[];
  signal?: AbortSignal;
}

export interface LlmResult {
  response: AIMessage | string;
  usage?: TokenUsage;
}

function extractUsage(result: unknown): TokenUsage | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const msg = result as Record<string, unknown>;

  const usageMetadata = msg.usage_metadata;
  if (usageMetadata && typeof usageMetadata === 'object') {
    const u = usageMetadata as Record<string, unknown>;
    const input = typeof u.input_tokens === 'number' ? u.input_tokens : 0;
    const output = typeof u.output_tokens === 'number' ? u.output_tokens : 0;
    const total = typeof u.total_tokens === 'number' ? u.total_tokens : input + output;
    return { inputTokens: input, outputTokens: output, totalTokens: total };
  }

  const responseMetadata = msg.response_metadata;
  if (responseMetadata && typeof responseMetadata === 'object') {
    const rm = responseMetadata as Record<string, unknown>;
    if (rm.usage && typeof rm.usage === 'object') {
      const u = rm.usage as Record<string, unknown>;
      const input = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0;
      const output = typeof u.completion_tokens === 'number' ? u.completion_tokens : 0;
      const total = typeof u.total_tokens === 'number' ? u.total_tokens : input + output;
      return { inputTokens: input, outputTokens: output, totalTokens: total };
    }
  }

  return undefined;
}

/**
 * Build messages with Anthropic cache_control on the system prompt.
 * Marks the system prompt as ephemeral so Anthropic caches the prefix,
 * reducing input token costs by ~90% on subsequent calls.
 */
function buildAnthropicMessages(systemPrompt: string, userPrompt: string) {
  return [
    new SystemMessage({
      content: [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
    }),
    new HumanMessage(userPrompt),
  ];
}

export async function callLlm(prompt: string, options: CallLlmOptions = {}): Promise<LlmResult> {
  const { model = DEFAULT_MODEL, systemPrompt, outputSchema, tools, signal } = options;
  const finalSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const llm = getChatModel(model, false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runnable: Runnable<any, any> = llm;

  if (outputSchema) {
    runnable = llm.withStructuredOutput(outputSchema, { strict: false });
  } else if (tools && tools.length > 0 && llm.bindTools) {
    runnable = llm.bindTools(tools);
  }

  const invokeOpts = signal ? { signal } : undefined;
  const provider = resolveProvider(model);
  let result;

  if (provider.id === 'anthropic') {
    // Anthropic: use explicit messages with cache_control for prompt caching (~90% savings)
    const messages = buildAnthropicMessages(finalSystemPrompt, prompt);
    result = await withRetry(() => runnable.invoke(messages, invokeOpts), provider.displayName);
  } else {
    // Other providers: use ChatPromptTemplate (OpenAI/Gemini have automatic caching)
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', finalSystemPrompt],
      ['user', '{prompt}'],
    ]);
    const chain = promptTemplate.pipe(runnable);
    result = await withRetry(() => chain.invoke({ prompt }, invokeOpts), provider.displayName);
  }
  const usage = extractUsage(result);

  // If no outputSchema and no tools, extract content from AIMessage
  // When tools are provided, return the full AIMessage to preserve tool_calls
  if (!outputSchema && !tools && result && typeof result === 'object' && 'content' in result) {
    return { response: (result as { content: string }).content, usage };
  }
  return { response: result as AIMessage, usage };
}
