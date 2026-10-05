import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/create-app.js';

const app = await createApp();
await app.ready();

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  app.server.emit('request', request, response);
}
