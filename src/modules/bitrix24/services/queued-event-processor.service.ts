import type { FastifyBaseLogger } from 'fastify';
import type { WorkflowService } from '../../../core/workflow/workflow.service.js';
import type { EventQueue } from '../../../queue/event-queue.js';
import type { IntegrationStorage } from '../../../storage/integration-storage.js';
import type { BotService } from './bot.service.js';

export class QueuedEventProcessor {
  constructor(
    private readonly queue: EventQueue,
    private readonly workflowService: WorkflowService,
    private readonly botService: BotService,
    private readonly logger: FastifyBaseLogger,
    private readonly storage?: IntegrationStorage,
  ) {}

  async processAvailable(limit = 5): Promise<number> {
    let processed = 0;

    while (processed < limit) {
      const [event] = await this.queue.claim(1);
      if (!event) break;

      let deliveryStarted = false;

      try {
        if (this.storage) {
          const installation = await this.storage.getBitrix24Installation();
          if (!event.portalDomain || !installation || event.portalDomain !== installation.domain) {
            throw new Error('Queue event portal does not match current installation');
          }
        }
        const workflow = await this.workflowService.handleMessage({
          channel: event.channel,
          chatType: event.chatType,
          portalDomain: event.portalDomain,
          conversationId: event.conversationId,
          userId: event.userId,
          text: event.text,
        });

        const preparedMessage = await this.botService.prepareMessage(
          event.conversationId,
          workflow.text,
          event.portalDomain,
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
          provider: workflow.provider,
          model: workflow.model,
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
