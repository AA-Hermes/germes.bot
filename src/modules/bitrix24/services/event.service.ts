import type { ParsedBitrixEvent } from '../types/events.js';

function numberValue(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid numeric field in Bitrix24 event');
  return parsed;
}

function stringValue(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid string field in Bitrix24 event');
  return value;
}

export class EventService {
  parse(payload: any): ParsedBitrixEvent {
    if (!payload || payload.event !== 'ONIMBOTV2MESSAGEADD') return null;

    const data = payload.data;
    if (!data?.bot || !data?.message || !data?.chat) {
      throw new Error('Malformed ONIMBOTV2MESSAGEADD payload');
    }

    return {
      event: 'ONIMBOTV2MESSAGEADD',
      botId: numberValue(data.bot.id),
      messageId: numberValue(data.message.id),
      text: stringValue(data.message.text),
      authorId: numberValue(data.message.authorId),
      chatId: numberValue(data.chat.id),
      dialogId: stringValue(data.chat.dialogId),
      chatType: stringValue(data.chat.type),
      applicationToken:
        typeof payload.auth?.application_token === 'string' ? payload.auth.application_token : null,
      domain: typeof payload.auth?.domain === 'string' ? payload.auth.domain : null,
    };
  }
}
