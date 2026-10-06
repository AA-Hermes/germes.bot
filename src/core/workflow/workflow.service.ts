import type { FastifyBaseLogger } from 'fastify';
import { LLMProviderError } from '../llm/llm-provider-error.js';
import type { LLMProvider } from '../llm/llm-provider.js';

export interface WorkflowMessage {
  channel: string;
  conversationId: string;
  userId?: string;
  text: string;
}

export interface WorkflowResult {
  text: string;
  provider: string;
  model?: string;
}

function getUserFacingErrorMessage(error: unknown): string {
  if (!(error instanceof LLMProviderError)) {
    return 'Не удалось обработать сообщение. Попробуйте ещё раз.';
  }

  switch (error.kind) {
    case 'quota_exhausted':
      return 'Не удалось обработать сообщение: исчерпан баланс AI-сервиса. Обратитесь к администратору.';
    case 'authentication_failed':
      return 'Не удалось обработать сообщение: ошибка авторизации AI-сервиса. Обратитесь к администратору.';
    case 'rate_limited':
      return 'AI-сервис временно достиг лимита запросов. Попробуйте ещё раз немного позже.';
    case 'timeout':
      return 'AI-сервис не успел ответить вовремя. Попробуйте ещё раз.';
    default:
      return 'Не удалось обработать сообщение. Попробуйте ещё раз.';
  }
}

export class WorkflowService {
  constructor(
    private readonly llmProvider: LLMProvider,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async handleMessage(message: WorkflowMessage): Promise<WorkflowResult> {
    const startedAt = performance.now();

    try {
      const result = await this.llmProvider.generateReply({
        message: message.text,
        conversationId: message.conversationId,
        userId: message.userId,
      });

      this.logger.info({
        event: 'WORKFLOW_MESSAGE_COMPLETED',
        channel: message.channel,
        conversationId: message.conversationId,
        provider: result.provider,
        model: result.model,
        latencyMs: Math.round(performance.now() - startedAt),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      return {
        text: result.text,
        provider: result.provider,
        model: result.model,
      };
    } catch (error) {
      this.logger.error({
        event: 'WORKFLOW_MESSAGE_ERROR',
        channel: message.channel,
        conversationId: message.conversationId,
        latencyMs: Math.round(performance.now() - startedAt),
        err: error,
      });

      return {
        text: getUserFacingErrorMessage(error),
        provider: 'fallback',
      };
    }
  }
}
