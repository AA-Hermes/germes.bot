import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import qs from 'qs';
import { bitrix24LocalAppRoutes } from './modules/bitrix24/local-app.routes.js';
import { bitrix24Routes } from './modules/bitrix24/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 256 * 1024,
  });

  await app.register(formbody, {
    parser: (body) => qs.parse(body),
  });

  await app.register(rateLimit, { global: false });

  app.get('/', async () => ({
    service: 'Germes Bot',
    status: 'ok',
  }));

  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(bitrix24LocalAppRoutes, { prefix: '/b24' });
  await app.register(bitrix24Routes, { prefix: '/api/bitrix24' });

  await app.ready();
  return app;
}

const app = await buildApp();

export default app;
