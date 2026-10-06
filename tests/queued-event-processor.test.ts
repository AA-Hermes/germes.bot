import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { EventQueue } from '../src/queue/event-queue.js';
import { QueuedEventProcessor } from '../src/modules/bitrix24/services/queued-event-processor.service.js';

function createLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as FastifyBaseLogger;
}

function createQueue(event: {
  id: number;
  externalId: string;
  attempts: number;
}): EventQueue {
  return {
    enqueue: vi.fn(),
    claim: vi.fn(async () => [
      {
        id: event.id,
        channel: 'bitrix24',
        externalId: event.externalId,
        conversationId: '1',
        userId: '1',
        text: 'Привет',
        attempts: event.attempts,
      },
    ]),
    beginDelivery: vi.fn(async () => true),
    markDelivered: vi.fn(async () => undefined),
    failDelivery: vi.fn(async () => undefined),
    retry: vi.fn(async () => undefined),
  };
}

describe('QueuedEventProcessor', () => {
  it('marks a successfully sent message as delivered', async () => {
    const queue = createQueue({ id: 42, externalId: '670324', attempts: 1 });

    const workflowService = {
      handleMessage: vi.fn(async () => ({
        text: 'OPENAI',
        provider: 'openai',
        model: 'gpt-6-luna',
      })),
    };

    const botService = {
      sendMessage: vi.fn(async () => ({ id: 670326 })),
    };

    const processor = new QueuedEventProcessor(
      queue,
      workflowService as never,
      botService as never,
      createLogger(),
    );

    await processor.processAvailable(1);

    expect(queue.claim).toHaveBeenCalledWith(1);
    expect(queue.beginDelivery).toHaveBeenCalledWith(42);
    expect(botService.sendMessage).toHaveBeenCalledWith('1', 'OPENAI');
    expect(queue.markDelivered).toHaveBeenCalledWith(42, 670326);
    expect(queue.failDelivery).not.toHaveBeenCalled();
    expect(queue.retry).not.toHaveBeenCalled();
  });

  it('retries failures that happen before outbound delivery starts', async () => {
    const queue = createQueue({ id: 43, externalId: '670325', attempts: 2 });

    const workflowService = {
      handleMessage: vi.fn(async () => {
        throw new Error('Workflow unavailable');
      }),
    };

    const botService = {
      sendMessage: vi.fn(),
    };

    const processor = new QueuedEventProcessor(
      queue,
      workflowService as never,
      botService as never,
      createLogger(),
    );

    await processor.processAvailable(1);

    expect(queue.beginDelivery).not.toHaveBeenCalled();
    expect(botService.sendMessage).not.toHaveBeenCalled();
    expect(queue.retry).toHaveBeenCalledWith(43, 2, 'Error');
    expect(queue.failDelivery).not.toHaveBeenCalled();
  });

  it('does not automatically resend after an outbound delivery attempt fails', async () => {
    const queue = createQueue({ id: 44, externalId: '670326', attempts: 3 });

    const workflowService = {
      handleMessage: vi.fn(async () => ({
        text: 'OPENAI',
        provider: 'openai',
      })),
    };

    const botService = {
      sendMessage: vi.fn(async () => {
        throw new Error('Bitrix unavailable');
      }),
    };

    const processor = new QueuedEventProcessor(
      queue,
      workflowService as never,
      botService as never,
      createLogger(),
    );

    await processor.processAvailable(1);

    expect(queue.beginDelivery).toHaveBeenCalledWith(44);
    expect(queue.failDelivery).toHaveBeenCalledWith(44, 'Error');
    expect(queue.retry).not.toHaveBeenCalled();
    expect(queue.markDelivered).not.toHaveBeenCalled();
  });
});
