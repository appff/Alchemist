import type { Bot } from 'grammy';

const MAX_MESSAGE_LENGTH = 4096;

export async function sendMessageTelegram(
  bot: Bot,
  chatId: number,
  text: string,
): Promise<void> {
  if (text.length <= MAX_MESSAGE_LENGTH) {
    try {
      await bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch {
      // Fallback: send without parse_mode if Markdown parsing fails
      await bot.api.sendMessage(chatId, text);
    }
    return;
  }

  // Split long messages
  const chunks = splitMessage(text, MAX_MESSAGE_LENGTH);
  for (const chunk of chunks) {
    try {
      await bot.api.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
    } catch {
      await bot.api.sendMessage(chatId, chunk);
    }
  }
}

export async function sendTypingTelegram(
  bot: Bot,
  chatId: number,
): Promise<void> {
  try {
    await bot.api.sendChatAction(chatId, 'typing');
  } catch {
    // Non-fatal: typing indicator is best-effort
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline
    let splitIdx = remaining.lastIndexOf('\n', maxLen);
    if (splitIdx < maxLen * 0.5) {
      // Try to split at a space
      splitIdx = remaining.lastIndexOf(' ', maxLen);
    }
    if (splitIdx < maxLen * 0.3) {
      splitIdx = maxLen;
    }
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return chunks;
}
