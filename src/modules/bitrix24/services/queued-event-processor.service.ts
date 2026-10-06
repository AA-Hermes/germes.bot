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

      let deliveryStarted = false;

      try {
        const workflow = await this.workflowService.handleMessage({
          channel: event.channel,
          conversationId: event.conversationId,
          userId: event.userId,
          text: event.text,
        });

        const preparedMessage = await this.botService.prepareMessage(
          event.conversationId,
          workflow.text,
        );

        deliveryStarted = await this.queue.beginDelivery(event.id);

        if (!deliveryStarted) {
          this.logger.warn({
            event: 'QUEUED_EVENT_DELIVERY_SKIPPED',
            queueId: event.id,
            externalId: event.externalId,
          });
          processed += 1;
          continue;
        }

        const sent = await this.botService.sendPreparedMessage(preparedMessage);
        await this.queue.markDelivered(event.id, sent.id);

        this.logger.info({
          event: 'QUEUED_EVENT_COMPLETED',
          queueId: event.id,
          externalId: event.externalId,
          attempts: event.attempts,
          outboundMessageId: sent.id,
        });
      } catch (error) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';

        if (deliveryStarted) {
          await this.queue.failDelivery(event.id, errorName);

          this.logger.error({
            event: 'QUEUED_EVENT_DELIVERY_UNCERTAIN',
            queueId: event.id,
            externalId: event.externalId,
            attempts: event.attempts,
            err: error,
          });
        } else {
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

      processed += 1;
    }

    return processed;
  }
}
