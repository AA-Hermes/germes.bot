import type { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';
import { createLLMProvider } from '../core/llm/index.js';
import { WorkflowService } from '../core/workflow/workflow.service.js';
import { PostgresEventQueue } from '../queue/postgres-event-queue.js';
import { getIntegrationStorage } from '../storage/index.js';
import { BotService } from './bitrix24/services/bot.service.js';
import { Bitrix24OAuthService } from './bitrix24/services/oauth.service.js';
import { QueuedEventProcessor } from './bitrix24/services/queued-event-processor.service.js';
import { allowsWorkerRequest } from './bitrix24/services/queue-worker-guard.js';
import { Bitrix24RestClient } from './bitrix24/services/rest-client.service.js';

export async function queueWorkerRoutes(app: FastifyInstance): Promise<void> {
  if (!config.databaseUrl) {
    app.get('/queue/process', async (_request, reply) =>
      reply.code(503).send({ error: 'Postgres event queue is not configured' }),
    );
    return;
  }

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
  const queue = new PostgresEventQueue(config.databaseUrl);
  const processor = new QueuedEventProcessor(queue, workflowService, botService, app.log);

  app.get('/queue/process', async (request, reply) => {
    if (!config.cronSecret) {
      request.log.error({ event: 'QUEUE_CRON_SECRET_MISSING' });
      return reply.code(503).send({ error: 'Queue worker authentication is not configured' });
    }

    if (!allowsWorkerRequest(request.headers.authorization, config.cronSecret)) {
      request.log.warn({ event: 'QUEUE_WORKER_UNAUTHORIZED' });
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const processed = await processor.processAvailable(10);
    return reply.send({ status: 'ok', processed });
  });
}
