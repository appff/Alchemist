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
import { getSetting, setSetting } from '@/utils/config';
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

// Generic retry helper with exponential backoff and 429 rate-limit awareness
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

      // For 429 rate-limit errors, parse the reset time and wait accordingly
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
        const resetMatch = message.match(/reset after (\d+)s/);
        const resetSeconds = resetMatch ? parseInt(resetMatch[1], 10) : 0;
        if (resetSeconds > 0) {
          logger.info(`[${provider} API] Rate limited — waiting ${resetSeconds}s for quota reset`);
          await new Promise((r) => setTimeout(r, resetSeconds * 1000));
          continue;
        }
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
  if (!apiKey || apiKey === 'your-api-key') {
    throw new Error(`[LLM] ${envVar} is not set. Please set a valid API key in .env or use OAuth login.`);
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
  if (creds.expiresAt < Date.now() + 60_000) {
    logger.warn(`[OAuth] ${provider} token expires at ${new Date(creds.expiresAt).toISOString()} — will attempt refresh on next retry`);
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

// --- Antigravity request sanitization (matching opencode-antigravity-auth) ---

// JSON Schema keywords not supported by the Antigravity/Gemini backend
const UNSUPPORTED_SCHEMA_KEYS = new Set([
  'additionalProperties', '$schema', '$id', '$comment', '$ref', '$defs',
  'definitions', 'const', 'contentMediaType', 'contentEncoding',
  'if', 'then', 'else', 'not', 'patternProperties',
  'unevaluatedProperties', 'unevaluatedItems', 'dependentRequired',
  'dependentSchemas', 'propertyNames', 'minContains', 'maxContains',
  'minLength', 'maxLength', 'exclusiveMinimum', 'exclusiveMaximum',
  'pattern', 'minItems', 'maxItems', 'format', 'default', 'examples',
  'title',
]);

/**
 * Recursively sanitize a JSON Schema for Gemini/Antigravity compatibility.
 * Uppercases type values, removes unsupported keywords, flattens unions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeGeminiSchema);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};

  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_SCHEMA_KEYS.has(key)) continue;

    if (key === 'type' && typeof value === 'string') {
      result.type = value.toUpperCase();
    } else if (key === 'type' && Array.isArray(value)) {
      // Flatten type arrays — pick first non-null type
      const nonNull = value.filter((t: string) => t !== 'null');
      result.type = ((nonNull[0] as string) || 'STRING').toUpperCase();
    } else if (key === 'anyOf' || key === 'oneOf') {
      // Flatten unions — pick first non-null option
      if (Array.isArray(value)) {
        // Check if all options are const/single-enum → merge into enum
        const constVals = value
          .map((v: { const?: unknown; enum?: unknown[] }) => v?.const ?? (Array.isArray(v?.enum) && v.enum.length === 1 ? v.enum[0] : undefined))
          .filter((v: unknown) => v !== undefined);
        if (constVals.length === value.length && constVals.length > 0) {
          result.enum = constVals;
        } else {
          const nonNull = value.filter((v: { type?: string }) => v?.type !== 'null');
          if (nonNull.length > 0) {
            Object.assign(result, sanitizeGeminiSchema(nonNull[0]));
          }
        }
      }
    } else if (key === 'allOf') {
      // Merge allOf into single schema
      if (Array.isArray(value)) {
        for (const item of value) {
          Object.assign(result, sanitizeGeminiSchema(item));
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeGeminiSchema(value);
    } else {
      result[key] = value;
    }
  }

  // Fix required to only reference existing properties
  if (Array.isArray(result.required) && result.properties && typeof result.properties === 'object') {
    result.required = result.required.filter((r: string) => r in result.properties);
    if (result.required.length === 0) delete result.required;
  }

  // For arrays without items, add default
  if (result.type === 'ARRAY' && !result.items) {
    result.items = { type: 'STRING' };
  }

  return result;
}

// Valid part keys for Gemini content filtering
const VALID_PART_KEYS = new Set([
  'text', 'functionCall', 'functionResponse', 'inlineData',
  'fileData', 'executableCode', 'codeExecutionResult', 'thought',
]);

/**
 * Sanitize the inner request payload for Antigravity compatibility.
 * Cleans tool schemas, filters content parts, validates system instructions.
 */
function sanitizeAntigravityPayload(payload: Record<string, unknown>): void {
  // Sanitize tool schemas
  if (Array.isArray(payload.tools)) {
    payload.tools = (payload.tools as Record<string, unknown>[]).map((tool) => {
      const funcDecls = tool.functionDeclarations;
      if (Array.isArray(funcDecls)) {
        tool.functionDeclarations = funcDecls.map((decl: Record<string, unknown>) => {
          if (decl.parameters) {
            decl.parameters = sanitizeGeminiSchema(decl.parameters);
            const params = decl.parameters as Record<string, unknown>;
            if (!params.type) params.type = 'OBJECT';
          }
          // Sanitize tool name
          if (typeof decl.name === 'string') {
            decl.name = decl.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
          }
          return decl;
        });
      }
      return tool;
    });
    // Remove empty tools array
    if ((payload.tools as unknown[]).length === 0) delete payload.tools;
  }

  // Sanitize content parts
  if (Array.isArray(payload.contents)) {
    payload.contents = (payload.contents as Record<string, unknown>[])
      .map((content) => {
        if (Array.isArray(content.parts)) {
          content.parts = (content.parts as Record<string, unknown>[]).filter((part) =>
            Object.keys(part).some((k) => VALID_PART_KEYS.has(k)),
          );
        }
        return content;
      })
      .filter((content) => Array.isArray(content.parts) && (content.parts as unknown[]).length > 0);
  }

  // Sanitize systemInstruction
  if (payload.systemInstruction && typeof payload.systemInstruction === 'object') {
    const si = payload.systemInstruction as Record<string, unknown>;
    if (Array.isArray(si.parts)) {
      si.parts = (si.parts as Record<string, unknown>[]).filter((part) =>
        Object.keys(part).some((k) => VALID_PART_KEYS.has(k)),
      );
      if ((si.parts as unknown[]).length === 0) delete payload.systemInstruction;
    }
  }

  // Remove safetySettings if they have unsupported format
  if (Array.isArray(payload.safetySettings)) {
    payload.safetySettings = (payload.safetySettings as Record<string, unknown>[]).filter(
      (s) => s.category && s.threshold,
    );
    if ((payload.safetySettings as unknown[]).length === 0) delete payload.safetySettings;
  }
}

// --- Antigravity endpoint configuration (matching opencode-antigravity-auth) ---
// Gemini 3.x models are available on sandbox endpoints; 2.5 on production.
const ANTIGRAVITY_ENDPOINTS = {
  daily: 'https://daily-cloudcode-pa.sandbox.googleapis.com',
  autopush: 'https://autopush-cloudcode-pa.sandbox.googleapis.com',
  prod: 'https://cloudcode-pa.googleapis.com',
};

// Request fallback order: sandbox first (has Gemini 3), then production
const ANTIGRAVITY_FALLBACKS = [
  ANTIGRAVITY_ENDPOINTS.daily,
  ANTIGRAVITY_ENDPOINTS.autopush,
  ANTIGRAVITY_ENDPOINTS.prod,
];

// Project discovery: production first (more reliable), then sandboxes
const LOAD_ENDPOINTS = [
  ANTIGRAVITY_ENDPOINTS.prod,
  ANTIGRAVITY_ENDPOINTS.daily,
];

/**
 * Transform model name for Antigravity style.
 * - Strip `-preview` and `-preview-customtools` suffixes
 * - Gemini 3 Pro models get `-low` tier suffix if no tier present
 */
function toAntigravityModelName(model: string): string {
  let name = model
    .replace(/-preview-customtools$/i, '')
    .replace(/-preview$/i, '');

  // Gemini 3.1 Pro models default to -high tier
  const isGemini31Pro = /^gemini-3\.1-pro$/i.test(name);
  const hasTier = /-(low|medium|high)$/i.test(name);
  if (isGemini31Pro && !hasTier) {
    name = `${name}-high`;
  }

  return name;
}

// Cache the managed project ID from loadCodeAssist or settings
let _managedProjectId: string | null = null;
async function getManagedProjectId(accessToken: string): Promise<string> {
  if (_managedProjectId) return _managedProjectId;

  // 1. Check saved project in settings
  const savedProject = getSetting('gcpProjectId', null) as string | null;
  if (savedProject) {
    _managedProjectId = savedProject;
    logger.info(`[Antigravity] Using saved project: ${_managedProjectId}`);
    return _managedProjectId;
  }

  // 2. Try loadCodeAssist to get managed project
  for (const endpoint of LOAD_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'google-api-nodejs-client/9.15.1',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        cloudaicompanionProject?: string | { id?: string };
        allowedTiers?: Array<{ id: string; userDefinedCloudaicompanionProject?: boolean }>;
      };

      const proj = data.cloudaicompanionProject;
      const projectId = typeof proj === 'string' ? proj : proj?.id;
      if (projectId) {
        _managedProjectId = projectId;
        setSetting('gcpProjectId', projectId);
        logger.info(`[Antigravity] Managed project: ${_managedProjectId}`);
        return _managedProjectId;
      }
    } catch { /* try next */ }
  }

  // 3. Try cloudresourcemanager as last resort
  try {
    const projRes = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (projRes.ok) {
      const projData = (await projRes.json()) as { projects?: Array<{ projectId: string; lifecycleState: string }> };
      const active = projData.projects?.find((p) => p.lifecycleState === 'ACTIVE');
      if (active) {
        _managedProjectId = active.projectId;
        setSetting('gcpProjectId', active.projectId);
        logger.info(`[Antigravity] GCP project from cloudresourcemanager: ${_managedProjectId}`);
        return _managedProjectId;
      }
    }
  } catch { /* fall through */ }

  logger.warn('[Antigravity] No project found. Set gcpProjectId in settings.');
  return '';
}

let _googleOAuthFetchInstalled = false;
function installGoogleOAuthFetch() {
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

    try {
    // Read fresh credentials on each request to avoid stale tokens
    const creds = loadCredentials('google');
    if (!creds) {
      return origFetch.call(globalThis, input, init);
    }

    // Extract model name and action from the URL
    const match = url.match(/\/models\/([^:?]+):(\w+)/);
    if (!match) {
      return origFetch.call(globalThis, input, init);
    }
    const [, rawModelName, action] = match;
    const isStreaming = action === 'streamGenerateContent';

    // Transform model name for Antigravity
    const effectiveModel = toAntigravityModelName(rawModelName);

    // Wrap request body in Antigravity format
    let body = init?.body;
    if (typeof body === 'string') {
      try {
        const originalPayload = JSON.parse(body);
        if ('model' in originalPayload) delete originalPayload.model;

        sanitizeAntigravityPayload(originalPayload);

        // Clean up generationConfig
        if (originalPayload.generationConfig && typeof originalPayload.generationConfig === 'object') {
          const gc = originalPayload.generationConfig as Record<string, unknown>;
          if (Array.isArray(gc.stopSequences) && gc.stopSequences.length === 0) delete gc.stopSequences;
          if (Object.keys(gc).length === 0) delete originalPayload.generationConfig;
        }

        const projectId = await getManagedProjectId(creds.accessToken);
        const wrappedBody = {
          project: projectId,
          model: effectiveModel,
          requestType: 'agent',
          userAgent: 'antigravity',
          requestId: `agent-${crypto.randomUUID()}`,
          request: originalPayload,
        };
        body = JSON.stringify(wrappedBody);
        logger.info(`[Antigravity] model=${rawModelName}→${effectiveModel} project=${projectId}`);
        logger.debug(`[Antigravity] body: ${body.slice(0, 2000)}`);
      } catch { /* keep original body if parse fails */ }
    }

    // Antigravity-style headers
    const headers = new Headers(init?.headers);
    headers.delete('x-goog-api-key');
    headers.delete('x-goog-user-project');
    headers.set('Authorization', `Bearer ${creds.accessToken}`);
    headers.set('Content-Type', 'application/json');
    headers.set('User-Agent', 'antigravity/1.18.3 darwin/arm64');
    headers.set('X-Goog-Api-Client', 'google-cloud-sdk vscode_cloudshelleditor/0.1');

    // Try endpoints in fallback order
    let lastResponse: Response | null = null;
    for (const endpoint of ANTIGRAVITY_FALLBACKS) {
      const targetUrl = `${endpoint}/v1internal:${action}${isStreaming ? '?alt=sse' : ''}`;
      logger.info(`[Antigravity] → ${action} model=${effectiveModel} endpoint=${endpoint}`);

      const response = await origFetch.call(globalThis, targetUrl, {
        ...init,
        headers,
        body,
      });

      logger.info(`[Antigravity] ← ${response.status} ${response.statusText}`);
      lastResponse = response;

      // On 404, 403, or 5xx, try next endpoint
      if (response.status === 404 || response.status === 403 || response.status >= 500) {
        const errBody = await response.text().catch(() => '');
        logger.warn(`[Antigravity] ${endpoint} returned ${response.status}, trying next... ${errBody.slice(0, 200)}`);
        continue;
      }

      if (!response.ok) {
        const errBody = await response.clone().text().catch(() => '(unreadable)');
        logger.error(`[Antigravity] error ${response.status}: ${errBody.slice(0, 500)}`);
        return response;
      }

      // Success — unwrap response
      if (!isStreaming) {
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

      // Streaming: unwrap SSE data lines
      if (response.body) {
        logger.info(`[Antigravity] streaming started from ${endpoint}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); return; }
            let text = decoder.decode(value, { stream: true });
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
    }

    // All endpoints failed — return last response
    return lastResponse ?? new Response('All Antigravity endpoints failed', { status: 502 });
    } catch (err) {
      logger.error(`[Antigravity Fetch] unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      return origFetch.call(globalThis, input, init);
    }
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
      // Read fresh token on each request to handle token refreshes
      const oauthFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const freshToken = getOAuthToken('anthropic') ?? oauthToken;
        const headers = new Headers(init?.headers);
        headers.delete('x-api-key');
        headers.set('authorization', `Bearer ${freshToken}`);
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
      installGoogleOAuthFetch();
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
