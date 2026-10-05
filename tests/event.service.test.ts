import { describe, expect, it } from 'vitest';
import { EventService } from '../src/modules/bitrix24/services/event.service.js';

describe('EventService', () => {
  it('normalizes ONIMBOTV2MESSAGEADD', () => {
    const event = new EventService().parse({
      event: 'ONIMBOTV2MESSAGEADD',
      data: {
        bot: { id: '456' },
        message: { id: '790', authorId: '1', text: 'Привет' },
        chat: { id: '5', dialogId: 'chat5', type: 'chat' },
      },
      auth: { domain: 'example.bitrix24.com', application_token: 'secret' },
    });

    expect(event?.messageId).toBe(790);
    expect(event?.text).toBe('Привет');
    expect(event?.dialogId).toBe('chat5');
    expect(event?.applicationToken).toBe('secret');
  });

  it('ignores unrelated events', () => {
    expect(new EventService().parse({ event: 'OTHER' })).toBeNull();
  });
});
