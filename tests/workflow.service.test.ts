import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type {
  LLMGenerateInput,
  LLMProvider,
} from '../src/core/llm/llm-provider.js';
import { WorkflowService } from '../src/core/workflow/workflow.service.js';

function createLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as FastifyBaseLogger;
}

describe('WorkflowService', () => {
  it('delegates message generation to LLMProvider', async () => {
    const provider: LLMProvider = {
      generateReply: vi.fn(async (input: LLMGenerateInput) => ({
        text: `AI: ${input.message}`,
        provider: 'test',
        model: 'test-model',
        inputTokens: 4,
        outputTokens: 2,
      })),
    };

    const logger = createLogger();
    const service = new WorkflowService(provider, logger);

    await expect(
      service.handleMessage({
        channel: 'bitrix24',
        conversationId: 'chat5',
        userId: '1',
        text: 'Привет',
      }),
    ).resolves.toEqual({
      text: 'AI: Привет',
      provider: 'test',
      model: 'test-model',
    });

    expect(provider.generateReply).toHaveBeenCalledWith({
      message: 'Привет',
      conversationId: 'chat5',
      userId: '1',
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'WORKFLOW_MESSAGE_COMPLETED',
        channel: 'bitrix24',
        provider: 'test',
        model: 'test-model',
        inputTokens: 4,
        outputTokens: 2,
      }),
    );
  });

  it('returns a fallback reply when provider fails', async () => {
    const provider: LLMProvider = {
      generateReply: vi.fn(async () => {
        throw new Error('provider unavailable');
      }),
    };

    const logger = createLogger();
    const service = new WorkflowService(provider, logger);

    await expect(
      service.handleMessage({
        channel: 'bitrix24',
        conversationId: 'chat5',
        text: 'Привет',
      }),
    ).resolves.toEqual({
      text: 'Не удалось обработать сообщение. Попробуйте ещё раз.',
      provider: 'fallback',
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'WORKFLOW_MESSAGE_ERROR',
        channel: 'bitrix24',
        conversationId: 'chat5',
      }),
    );
  });
});
