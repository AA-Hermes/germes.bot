import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { EventQueue, QueuedEvent, QueuedEventInput } from '../src/queue/event-queue.js';
import { QueuedEventProcessor } from '../src/modules/bitrix24/services/queued-event-processor.service.js';

describe('queue recovery after the webhook worker is skipped', () => {
  it('keeps a pending event until recovery and records the outbound message ID', async () => {
    const row = {
      id: 101,
      status: 'pending',
      deliveryStatus: 'pending',
      outboundMessageId: null as number | null,
      attempts: 0,
    };
    const event: QueuedEventInput = {
      channel: 'bitrix24',
      externalId: 'recovery-test-101',
      conversationId: 'private-dialog',
      userId: '42',
      text: 'Recovery verification',
    };
    let queued = false;
    const queue: EventQueue = {
      enqueue: vi.fn(async () => {
        if (queued) return false;
        queued = true;
        return true;
      }),
      claim: vi.fn(async (): Promise<QueuedEvent[]> => {
        if (!queued || row.status !== 'pending') return [];
        row.status = 'processing';
        row.attempts += 1;
        return [{ ...event, id: row.id, attempts: row.attempts }];
      }),
      beginDelivery: vi.fn(async (id: number) => {
        if (id !== row.id || row.status !== 'processing' || row.deliveryStatus !== 'pending') return false;
        row.deliveryStatus = 'sending';
        return true;
      }),
      markDelivered: vi.fn(async (id: number, messageId: number) => {
        if (id !== row.id || row.deliveryStatus !== 'sending') throw new Error('Invalid delivery');
        row.status = 'completed';
        row.deliveryStatus = 'sent';
        row.outboundMessageId = messageId;
      }),
      retry: vi.fn(),
      failDelivery: vi.fn(),
    };
    const workflow = {
      handleMessage: vi.fn(async () => ({ text: 'Recovered reply', provider: 'openai' })),
    };
    const bot = {
      prepareMessage: vi.fn(async () => ({ preparedCall: {}, params: {} })),
      sendPreparedMessage: vi.fn(async () => ({ id: 99001 })),
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;
    const processor = new QueuedEventProcessor(queue, workflow as never, bot as never, logger);

    // Webhook acknowledgement: enqueue only, deliberately do not invoke waitUntil processing.
    expect(await queue.enqueue(event)).toBe(true);
    expect(await queue.enqueue(event)).toBe(false);
    expect(row.status).toBe('pending');
    expect(row.deliveryStatus).toBe('pending');
    expect(row.attempts).toBe(0);
    expect(workflow.handleMessage).not.toHaveBeenCalled();
    expect(bot.sendPreparedMessage).not.toHaveBeenCalled();

    // A later queue-recovery invocation processes the previously pending row.
    expect(await processor.processAvailable(10)).toBe(1);
    expect(row.status).toBe('completed');
    expect(row.deliveryStatus).toBe('sent');
    expect(row.outboundMessageId).toBe(99001);
    expect(row.attempts).toBe(1);
    expect(workflow.handleMessage).toHaveBeenCalledTimes(1);
    expect(bot.sendPreparedMessage).toHaveBeenCalledTimes(1);
    expect(await processor.processAvailable(10)).toBe(0);
    expect(bot.sendPreparedMessage).toHaveBeenCalledTimes(1);
  });
  it('does not resend when a recovered event fails after outbound delivery begins', async () => {
    const event: QueuedEvent = {
      id: 102,
      channel: 'bitrix24',
      externalId: 'recovery-test-102',
      conversationId: 'private-dialog',
      userId: '42',
      text: 'Recovery verification',
      attempts: 1,
    };
    let status: 'pending' | 'processing' | 'failed' = 'pending';
    let deliveryStatus: 'pending' | 'sending' | 'unknown' = 'pending';
    const queue: EventQueue = {
      enqueue: vi.fn(async () => true),
      claim: vi.fn(async () => {
        if (status !== 'pending') return [];
        status = 'processing';
        return [event];
      }),
      beginDelivery: vi.fn(async () => {
        deliveryStatus = 'sending';
        return true;
      }),
      markDelivered: vi.fn(),
      failDelivery: vi.fn(async () => {
        status = 'failed';
        deliveryStatus = 'unknown';
      }),
      retry: vi.fn(),
    };
    const workflow = {
      handleMessage: vi.fn(async () => ({ text: 'Recovered reply', provider: 'openai' })),
    };
    const bot = {
      prepareMessage: vi.fn(async () => ({ preparedCall: {}, params: {} })),
      sendPreparedMessage: vi.fn(async () => {
        throw new Error('Bitrix24 response lost after send');
      }),
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;
    const processor = new QueuedEventProcessor(queue, workflow as never, bot as never, logger);

    expect(await processor.processAvailable(10)).toBe(1);
    expect(status).toBe('failed');
    expect(deliveryStatus).toBe('unknown');
    expect(queue.failDelivery).toHaveBeenCalledWith(102, 'Error');
    expect(queue.retry).not.toHaveBeenCalled();
    expect(await processor.processAvailable(10)).toBe(0);
    expect(bot.sendPreparedMessage).toHaveBeenCalledTimes(1);
  });

});
