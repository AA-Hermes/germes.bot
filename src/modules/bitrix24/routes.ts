import type { FastifyInstance } from 'fastify';
import { config } from '../../config/index.js';
import { getIntegrationStorage } from '../../storage/index.js';
import { BotController } from './controllers/bot.controller.js';
import { BotService } from './services/bot.service.js';
import { EventService } from './services/event.service.js';
import { Bitrix24OAuthService } from './services/oauth.service.js';
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
  const controller = new BotController(botService, new EventService(), storage);

  app.post('/bot/register', controller.register);
  app.get('/bot/status', controller.status);
  app.post('/bot/test', controller.test);
  app.post(
    '/webhook',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    controller.webhook,
  );
}
