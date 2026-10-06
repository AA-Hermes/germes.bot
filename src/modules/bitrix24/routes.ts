import type { FastifyInstance } from 'fastify';
import { waitUntil } from '@vercel/functions';
import { config } from '../../config/index.js';
import { createLLMProvider } from '../../core/llm/index.js';
import { WorkflowService } from '../../core/workflow/workflow.service.js';
import { PostgresEventQueue } from '../../queue/postgres-event-queue.js';
import { getIntegrationStorage } from '../../storage/index.js';
import { BotController } from './controllers/bot.controller.js';
import { BotService } from './services/bot.service.js';
import { EventService } from './services/event.service.js';
import { Bitrix24OAuthService } from './services/oauth.service.js';
import { QueuedEventProcessor } from './services/queued-event-processor.service.js';
import { Bitrix24RestClient } from './services/rest-client.service.js';

export async function bitrix24Routes(app: FastifyInstance): Promise<void> {
  const storage = getIntegrationStorage();
  const oauth = new Bitrix24OAuthService(
    storage,
    config.bitrix24.clientId,
    config.bitrix24.clientSecret,
    app.log,
  );
  const client = new Bitrix24RestClient(storage, oauth, app.log);
  const botService = new BotService(
    client,
    storage,
    app.log,
    `${config.appUrl}/api/bitrix24/webhook`,
  );
  const workflowService = new WorkflowService(createLLMProvider(), app.log);

  const eventQueue = config.databaseUrl
    ? new PostgresEventQueue(config.databaseUrl)
    : null;
  const queuedEventProcessor = eventQueue
    ? new QueuedEventProcessor(eventQueue, workflowService, botService, app.log)
    : null;

  const scheduleBackground = eventQueue
    ? (task: Promise<void>) => {
        if (process.env.VERCEL) {
          waitUntil(task);
          return;
        }

        void task;
      }
    : null;

  const controller = new BotController(
    botService,
    new EventService(),
    storage,
    workflowService,
    eventQueue,
    queuedEventProcessor,
    scheduleBackground,
  );

  app.post('/bot/register', controller.register);
  app.get('/bot/status', controller.status);
  app.post('/bot/test', controller.test);
  app.post(
    '/webhook',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    controller.webhook,
  );
}
