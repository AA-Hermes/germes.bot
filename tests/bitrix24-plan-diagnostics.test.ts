import Fastify from 'fastify';
import type { FastifyBaseLogger } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotController } from '../src/modules/bitrix24/controllers/bot.controller.js';
import { Bitrix24RestClient, Bitrix24RestError, Bitrix24RestPlanRequiredError } from '../src/modules/bitrix24/services/rest-client.service.js';
import { QueuedEventProcessor } from '../src/modules/bitrix24/services/queued-event-processor.service.js';

vi.mock('../src/config/index.js', () => ({ isBitrixOAuthConfigured: () => true }));

afterEach(() => vi.unstubAllGlobals());

describe('Bitrix24 REST plan diagnostics', () => {
  it.each([
    ['ACCESS_DENIED', 'REST is available only on commercial plans.', true],
    ['ACCESS_DENIED', 'Insufficient permissions', false],
    ['INVALID_CREDENTIALS', 'REST is available only on commercial plans.', false],
  ])('classifies %s / %s without confusing permissions or token expiry', async (code, message, expected) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: code, error_description: message,
    }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const logger = { error: vi.fn() };
    const client = new Bitrix24RestClient({} as never, {} as never, logger as unknown as FastifyBaseLogger);
    const error = await client.callPrepared({
      clientEndpoint: 'https://example.bitrix24.com/rest/', accessToken: 'test-secret',
    }, 'imbot.v2.Bot.list', {}).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Bitrix24RestError);
    expect(error instanceof Bitrix24RestPlanRequiredError).toBe(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (expected) {
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ reason: 'BITRIX24_REST_PLAN_REQUIRED' }));
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain('test-secret');
    }
  });

  it('returns a safe actionable status without claiming the bot is unregistered or clearing its ID', async () => {
    const storage = {
      getBitrix24Installation: vi.fn().mockResolvedValue({ domain: 'example.bitrix24.com' }),
      getTokens: vi.fn().mockResolvedValue({ accessToken: 'test-secret' }),
      setBotId: vi.fn(),
    };
    const bot = { isRegistered: vi.fn().mockRejectedValue(new Bitrix24RestPlanRequiredError(401)) };
    const controller = new BotController(bot as never, {} as never, storage as never, {} as never);
    const app = Fastify();
    app.get('/status', controller.status);
    try {
      const response = await app.inject({ method: 'GET', url: '/status' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        configured: true, installed: true, registered: null, botId: null,
        error: { code: 'BITRIX24_REST_PLAN_REQUIRED', message: expect.stringContaining('Проверьте тариф') },
      });
      expect(response.body).not.toContain('test-secret');
      expect(response.body).not.toContain('stack');
      expect(storage.setBotId).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('persists the safe diagnostic and keeps uncertain delivery from automatic retry', async () => {
    const queue = {
      claim: vi.fn().mockResolvedValue([{ id: 3, attempts: 1, channel: 'bitrix24', conversationId: '1', userId: '1', text: 'test' }]),
      beginDelivery: vi.fn().mockResolvedValue(true),
      failDelivery: vi.fn(), retry: vi.fn(), markDelivered: vi.fn(),
    };
    const workflow = { handleMessage: vi.fn().mockResolvedValue({ text: 'reply' }) };
    const bot = {
      prepareMessage: vi.fn().mockResolvedValue({}),
      sendPreparedMessage: vi.fn().mockRejectedValue(new Bitrix24RestPlanRequiredError(401)),
    };
    const processor = new QueuedEventProcessor(queue as never, workflow as never, bot as never, { error: vi.fn() } as unknown as FastifyBaseLogger);
    await processor.processAvailable(1);
    expect(queue.failDelivery).toHaveBeenCalledWith(3, 'Bitrix24RestPlanRequiredError');
    expect(queue.retry).not.toHaveBeenCalled();
    expect(queue.markDelivered).not.toHaveBeenCalled();
  });
});
