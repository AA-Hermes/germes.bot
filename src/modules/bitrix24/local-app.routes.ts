import type { FastifyInstance } from 'fastify';
import { getIntegrationStorage } from '../../storage/index.js';
import { LocalAppController } from './controllers/local-app.controller.js';

export async function bitrix24LocalAppRoutes(app: FastifyInstance): Promise<void> {
  const controller = new LocalAppController(getIntegrationStorage());

  app.get('/install', controller.installInfo);
  app.post('/install', controller.install);

  app.get('/handler', controller.handler);
  app.post('/handler', controller.handler);
}
