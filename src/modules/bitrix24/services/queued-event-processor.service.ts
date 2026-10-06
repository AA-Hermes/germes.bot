import type { FastifyBaseLogger } from 'fastify';
import type { WorkflowService } from '../../../core/workflow/workflow.service.js';
import type { EventQueue } from '../../../queue/event-queue.js';
import type { BotService } from './bot.service.js';

export class QueuedEventProcessor {
  constructor(
    private readonly queue: EventQueue,
    private readonly workflowService: WorkflowService,
    private readonly botService: BotService,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async processAvailable(limit = 5): Promise<void> {
    const events = await this.queue.claim(limit);

    for (const event of events) {
      try {
        const workflow = await this.workflowService.handleMessage({
          channel: event.channel,
          conversationId: event.conversationId,
          userId: event.userId,
          text: event.text,
        });

        await this.botService.sendMessage(event.conversationId, workflow.text);
        await this.queue.complete(event.id);

        this.logger.info({
          event: 'QUEUED_EVENT_COMPLETED',
          queueId: event.id,
          externalId: event.externalId,
          attempts: event.attempts,
        });
      } catch (error) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';

        await this.queue.retry(event.id, event.attempts, errorName);

        this.logger.error({
          event: 'QUEUED_EVENT_FAILED',
          queueId: event.id,
          externalId: event.externalId,
          attempts: event.attempts,
          err: error,
        });
      }
    }
  }
}
