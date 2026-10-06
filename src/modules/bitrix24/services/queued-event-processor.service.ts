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

  async processAvailable(limit = 5): Promise<number> {
    let processed = 0;

    while (processed < limit) {
      const [event] = await this.queue.claim(1);
      if (!event) break;

      try {
        const workflow = await this.workflowService.handleMessage({
          channel: event.channel,
          conversationId: event.conversationId,
          userId: event.userId,
          text: event.text,
        });

        await this.botService.sendMessage(event.conversationId, workflow.text);
        await this.queue.complete(event.id);
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

      processed += 1;
    }

    return processed;
  }
}
