import type { GatewayConfig, TelegramAccountConfig } from '../../config.js';
import { listTelegramAccountIds, resolveTelegramAccount } from '../../config.js';
import type { ChannelPlugin } from '../types.js';
import { createTelegramBot } from './bot.js';
import { sendMessageTelegram, sendTypingTelegram } from './outbound.js';
import type { TelegramInboundMessage } from './types.js';
import type { Bot } from 'grammy';

const activeBots = new Map<string, Bot>();

export function getActiveBot(accountId = 'default'): Bot | undefined {
  return activeBots.get(accountId);
}

export function createTelegramPlugin(params: {
  loadConfig: () => GatewayConfig;
  onMessage: (msg: TelegramInboundMessage) => Promise<void>;
}): ChannelPlugin<GatewayConfig, TelegramAccountConfig> {
  return {
    id: 'telegram',
    config: {
      listAccountIds: (cfg) => listTelegramAccountIds(cfg),
      resolveAccount: (cfg, accountId) => resolveTelegramAccount(cfg, accountId),
      isEnabled: (account, cfg) => account.enabled && cfg.channels.telegram.enabled !== false,
      isConfigured: (account) => Boolean(account.botToken),
    },
    gateway: {
      startAccount: async (ctx) => {
        const bot = await createTelegramBot(
          ctx.account.botToken,
          params.onMessage,
          ctx.account.allowedChatIds,
        );

        activeBots.set(ctx.accountId, bot);

        ctx.setStatus({ connected: true, lastError: null });

        // Start long polling (blocks until stopped)
        await bot.start({
          onStart: () => {
            console.log(`[telegram] Bot started for account ${ctx.accountId}`);
          },
        });
      },
      stopAccount: async (ctx) => {
        const bot = activeBots.get(ctx.accountId);
        if (bot) {
          await bot.stop();
          activeBots.delete(ctx.accountId);
        }
        ctx.setStatus({ connected: false });
      },
    },
    status: {
      defaultRuntime: {
        accountId: 'default',
        running: false,
        connected: false,
        lastError: null,
      },
    },
  };
}

export { sendMessageTelegram, sendTypingTelegram };
