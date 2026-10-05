import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import qs from 'qs';
import { config } from './config/index.js';
import { bitrix24LocalAppRoutes } from './modules/bitrix24/local-app.routes.js';
import { bitrix24Routes } from './modules/bitrix24/routes.js';

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

try {
  await app.listen({
    port: Number(process.env.PORT ?? config.port),
    host: '0.0.0.0',
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
