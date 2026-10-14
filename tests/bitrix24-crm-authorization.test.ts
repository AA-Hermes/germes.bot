import { describe, expect, it } from 'vitest';
import { canUseBitrix24CrmTools } from '../src/modules/bitrix24/services/crm-workflow.factory.js';

describe('Bitrix24 CRM tool authorization', () => {
  const allowed = new Set(['42']);
  const base = { message: 'Find deals', channel: 'bitrix24', conversationId: '42', userId: '42' };

  it('permits allowlisted users in explicitly private chats', () => {
    expect(canUseBitrix24CrmTools({ ...base, chatType: 'private' }, allowed)).toBe(true);
  });

  it('rejects group chats even for allowlisted users', () => {
    expect(canUseBitrix24CrmTools({ ...base, chatType: 'chat' }, allowed)).toBe(false);
  });

  it('fails closed when chat type is absent, including legacy queue events', () => {
    expect(canUseBitrix24CrmTools(base, allowed)).toBe(false);
  });

  it('rejects unapproved users and other channels', () => {
    expect(canUseBitrix24CrmTools({ ...base, chatType: 'private', userId: '43' }, allowed)).toBe(false);
    expect(canUseBitrix24CrmTools({ ...base, chatType: 'private', channel: 'telegram' }, allowed)).toBe(false);
  });
});
