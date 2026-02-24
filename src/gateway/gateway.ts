import { createChannelManager } from './channels/manager.js';
import {
  createTelegramPlugin,
  getActiveBot,
  sendMessageTelegram,
  sendTypingTelegram,
  type TelegramInboundMessage,
} from './channels/telegram/index.js';
import { resolveRoute } from './routing/resolve-route.js';
import { resolveSessionStorePath, upsertSessionMeta } from './sessions/store.js';
import { loadGatewayConfig, type GatewayConfig } from './config.js';
import { runAgentForMessage } from './agent-runner.js';
import { discoverSkills } from '../skills/index.js';
import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOG_PATH = join(homedir(), '.dexter', 'gateway-debug.log');
function debugLog(msg: string) {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
}

export type GatewayService = {
  stop: () => Promise<void>;
  snapshot: () => Record<string, { accountId: string; running: boolean; connected?: boolean }>;
};

function elide(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Transform Telegram slash commands to skill invocations.
 * E.g., "/portfolio performance" → "Use the portfolio skill: performance"
 */
function transformSlashCommand(body: string): string {
  const match = body.match(/^\/(\S+)\s*(.*)?$/);
  if (!match) return body;

  const [, commandName, args] = match;
  // Skip Telegram built-in commands
  if (commandName === 'start') return body;

  const skills = discoverSkills();
  const skill = skills.find(s => s.name === commandName);
  if (skill) {
    return args?.trim()
      ? `Use the ${commandName} skill: ${args.trim()}`
      : `Use the ${commandName} skill`;
  }

  // Not a known skill - pass through as-is
  return body;
}

async function handleInbound(cfg: GatewayConfig, inbound: TelegramInboundMessage): Promise<void> {
  const bodyPreview = elide(inbound.body.replace(/\n/g, ' '), 50);
  console.log(`[telegram] Inbound from ${inbound.from} (chat ${inbound.chatId}, ${inbound.chatType}): "${bodyPreview}"`);
  debugLog(`[gateway] handleInbound from=${inbound.from} chatId=${inbound.chatId} body="${inbound.body.slice(0, 30)}..."`);

  // Skip /start command (handled by bot directly)
  if (inbound.body.trim() === '/start') return;

  const route = resolveRoute({
    cfg,
    channel: 'telegram',
    accountId: inbound.accountId,
    peer: { kind: inbound.chatType === 'private' ? 'direct' : 'group', id: String(inbound.senderId) },
  });

  const storePath = resolveSessionStorePath(route.agentId);
  upsertSessionMeta({
    storePath,
    sessionKey: route.sessionKey,
    channel: 'telegram',
    to: String(inbound.chatId),
    accountId: route.accountId,
    agentId: route.agentId,
  });

  const bot = getActiveBot(inbound.accountId);
  if (!bot) {
    console.log(`[telegram] No active bot for account ${inbound.accountId}`);
    return;
  }

  // Start typing indicator loop
  const TYPING_INTERVAL_MS = 4000; // Telegram typing expires after ~5s
  let typingTimer: ReturnType<typeof setInterval> | undefined;

  const startTypingLoop = async () => {
    await sendTypingTelegram(bot, inbound.chatId);
    typingTimer = setInterval(() => {
      void sendTypingTelegram(bot, inbound.chatId);
    }, TYPING_INTERVAL_MS);
  };

  const stopTypingLoop = () => {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = undefined;
    }
  };

  try {
    await startTypingLoop();

    // Transform slash commands to skill invocations
    const query = transformSlashCommand(inbound.body);

    console.log(`[telegram] Processing message with agent...`);
    debugLog(`[gateway] running agent for session=${route.sessionKey} query="${query.slice(0, 50)}"`);
    const startedAt = Date.now();
    const answer = await runAgentForMessage({
      sessionKey: route.sessionKey,
      query,
      model: 'gpt-5.2',
      modelProvider: 'openai',
    });
    const durationMs = Date.now() - startedAt;
    debugLog(`[gateway] agent answer length=${answer.length}`);

    stopTypingLoop();

    if (answer.trim()) {
      debugLog(`[gateway] sending reply to chat ${inbound.chatId}`);
      await sendMessageTelegram(bot, inbound.chatId, `[Alchemist] ${answer}`);
      console.log(`[telegram] Sent reply (${answer.length} chars, ${durationMs}ms)`);
      debugLog(`[gateway] reply sent`);
    } else {
      console.log(`[telegram] Agent returned empty response (${durationMs}ms)`);
      debugLog(`[gateway] empty answer, not sending`);
    }
  } catch (err) {
    stopTypingLoop();
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[telegram] Error: ${msg}`);
    debugLog(`[gateway] ERROR: ${msg}`);

    // Try to notify the user
    try {
      await sendMessageTelegram(bot, inbound.chatId, `[Alchemist] Sorry, an error occurred. Please try again.`);
    } catch {
      // Best effort
    }
  }
}

export async function startGateway(params: { configPath?: string } = {}): Promise<GatewayService> {
  const cfg = loadGatewayConfig(params.configPath);
  const plugin = createTelegramPlugin({
    loadConfig: () => loadGatewayConfig(params.configPath),
    onMessage: async (inbound) => {
      const current = loadGatewayConfig(params.configPath);
      await handleInbound(current, inbound);
    },
  });
  const manager = createChannelManager({
    plugin,
    loadConfig: () => loadGatewayConfig(params.configPath),
  });
  await manager.startAll();

  return {
    stop: async () => {
      await manager.stopAll();
    },
    snapshot: () => manager.getSnapshot(),
  };
}
