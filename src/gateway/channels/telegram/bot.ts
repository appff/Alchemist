import { Bot } from 'grammy';
import type { TelegramInboundMessage } from './types.js';
import { discoverSkills } from '../../../skills/index.js';

export async function createTelegramBot(
  token: string,
  onMessage: (msg: TelegramInboundMessage) => Promise<void>,
  allowedChatIds: number[],
): Promise<Bot> {
  const bot = new Bot(token);

  // Register skill-based commands with Telegram
  const skills = discoverSkills();
  const commands = skills.map(s => ({
    command: s.name,
    description: s.description.slice(0, 256),
  }));
  // Add help command
  commands.unshift({ command: 'start', description: 'Start the bot' });

  bot.command('start', async (ctx) => {
    const skillList = skills.map(s => `/${s.name} - ${s.description.slice(0, 60)}`).join('\n');
    await ctx.reply(
      `Welcome to Alchemist! 🧪\n\nI'm your AI financial research assistant.\n\nAvailable commands:\n${skillList}\n\nOr just send me any question!`,
    );
  });

  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;

    // Access control
    if (allowedChatIds.length > 0 && !allowedChatIds.includes(chatId)) {
      console.log(`[telegram] Rejected message from chat ${chatId} (not in allowedChatIds)`);
      return;
    }

    const msg: TelegramInboundMessage = {
      accountId: 'default',
      messageId: ctx.message.message_id,
      chatId,
      chatType: (['private', 'group', 'supergroup'].includes(ctx.chat.type)
        ? ctx.chat.type
        : 'private') as TelegramInboundMessage['chatType'],
      from: ctx.from?.username ?? ctx.from?.first_name ?? 'unknown',
      senderId: ctx.from?.id ?? 0,
      body: ctx.message.text,
      timestamp: ctx.message.date * 1000,
    };

    await onMessage(msg);
  });

  // Set commands in Telegram menu
  try {
    await bot.api.setMyCommands(commands);
  } catch {
    // Non-fatal: commands menu just won't be set
  }

  return bot;
}
