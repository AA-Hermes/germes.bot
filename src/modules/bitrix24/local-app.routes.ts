import type { FastifyInstance } from 'fastify';
import { config } from '../../config/index.js';
import { FileIntegrationStorage } from '../../storage/file-integration-storage.js';
import { LocalAppController } from './controllers/local-app.controller.js';

export async function bitrix24LocalAppRoutes(app: FastifyInstance): Promise<void> {
  const storage = new FileIntegrationStorage(config.storageFile);
  const controller = new LocalAppController(storage);

  app.get('/install', controller.installInfo);
  app.post('/install', controller.install);

  app.get('/handler', controller.handler);
  app.post('/handler', controller.handler);
}
