export interface BotMessageEvent {
  event: 'ONIMBOTV2MESSAGEADD';
  botId: number;
  messageId: number;
  text: string;
  authorId: number;
  chatId: number;
  dialogId: string;
  chatType: string;
  applicationToken: string | null;
  domain: string | null;
}

export type ParsedBitrixEvent = BotMessageEvent | null;
