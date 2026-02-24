/**
 * Simple chat ID-based access control for Telegram.
 * If allowedChatIds is empty, all chats are allowed.
 */
export function checkTelegramAccess(
  chatId: number,
  allowedChatIds: number[],
): boolean {
  if (allowedChatIds.length === 0) return true;
  return allowedChatIds.includes(chatId);
}
