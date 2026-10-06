import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { EventQueue } from '../src/queue/event-queue.js';
import { QueuedEventProcessor } from '../src/modules/bitrix24/services/queued-event-processor.service.js';

function createLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as FastifyBaseLogger;
}

describe('QueuedEventProcessor', () => {
  it('processes claimed events and marks them completed', async () => {
    const queue: EventQueue = {
      enqueue: vi.fn(),
      claim: vi.fn(async () => [
        {
          id: 42,
          channel: 'bitrix24',
          externalId: '670324',
          conversationId: '1',
          userId: '1',
          text: 'Привет',
          attempts: 1,
        },
      ]),
      complete: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
    };

    const workflowService = {
      handleMessage: vi.fn(async () => ({
        text: 'OPENAI',
        provider: 'openai',
        model: 'gpt-6-luna',
      })),
    };

    const botService = {
      sendMessage: vi.fn(async () => ({ result: true })),
    };

    const logger = createLogger();
    const processor = new QueuedEventProcessor(
      queue,
      workflowService as never,
      botService as never,
      logger,
    );

    await processor.processAvailable();

    expect(queue.claim).toHaveBeenCalledWith(5);
    expect(workflowService.handleMessage).toHaveBeenCalledWith({
      channel: 'bitrix24',
      conversationId: '1',
      userId: '1',
      text: 'Привет',
    });
    expect(botService.sendMessage).toHaveBeenCalledWith('1', 'OPENAI');
    expect(queue.complete).toHaveBeenCalledWith(42);
    expect(queue.retry).not.toHaveBeenCalled();
  });

  it('returns failed work to the queue for retry', async () => {
    const queue: EventQueue = {
      enqueue: vi.fn(),
      claim: vi.fn(async () => [
        {
          id: 43,
          channel: 'bitrix24',
          externalId: '670325',
          conversationId: '1',
          userId: '1',
          text: 'Привет',
          attempts: 2,
        },
      ]),
      complete: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
    };

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

    const logger = createLogger();
    const processor = new QueuedEventProcessor(
      queue,
      workflowService as never,
      botService as never,
      logger,
    );

    await processor.processAvailable();

    expect(queue.complete).not.toHaveBeenCalled();
    expect(queue.retry).toHaveBeenCalledWith(43, 2, 'Error');
  });
});
