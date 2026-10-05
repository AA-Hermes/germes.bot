import type { ParsedBitrixEvent } from '../types/events.js';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

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
  parse(payload: unknown): ParsedBitrixEvent {
    if (!isRecord(payload) || payload.event !== 'ONIMBOTV2MESSAGEADD') return null;

    const data = payload.data;
    if (!isRecord(data) || !isRecord(data.bot) || !isRecord(data.message) || !isRecord(data.chat)) {
      throw new Error('Malformed ONIMBOTV2MESSAGEADD payload');
    }

    const auth = isRecord(payload.auth) ? payload.auth : {};

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
        typeof auth.application_token === 'string' ? auth.application_token : null,
      domain: typeof auth.domain === 'string' ? auth.domain : null,
    };
  }
}
