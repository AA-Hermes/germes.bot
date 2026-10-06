import type { FastifyBaseLogger } from 'fastify';
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
        text: 'Не удалось обработать сообщение. Попробуйте ещё раз.',
        provider: 'fallback',
      };
    }
  }
}
