export type TelegramInboundMessage = {
  accountId: string;
  messageId: number;
  chatId: number;
  chatType: 'private' | 'group' | 'supergroup';
  from: string;          // username or first_name
  senderId: number;
  body: string;
  timestamp: number;
};
