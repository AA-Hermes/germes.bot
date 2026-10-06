import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { isBitrixOAuthConfigured } from '../../../config/index.js';
import type { IntegrationStorage } from '../../../storage/integration-storage.js';
import { BotService } from '../services/bot.service.js';
import { EventService } from '../services/event.service.js';

interface TestBody {
  dialogId: string | number;
  message?: string;
}

function safeSecretEqual(actual: string | null, expected: string | null): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class BotController {
  private readonly seenMessageIds = new Set<number>();

  constructor(
    private readonly botService: BotService,
    private readonly eventService: EventService,
    private readonly storage: IntegrationStorage,
  ) {}

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isBitrixOAuthConfigured()) {
      return reply.code(503).send({ error: 'Bitrix24 OAuth credentials are not configured' });
    }

    const installation = await this.storage.getBitrix24Installation();
    const tokens = await this.storage.getTokens();

    if (!installation || !tokens) {
      return reply.code(503).send({ error: 'Bitrix24 application is not installed' });
    }

    try {
      return await this.botService.register();
    } catch (error) {
      request.log.error({ event: 'BOT_REGISTER_ERROR', err: error });
      throw error;
    }
  };

  status = async () => {
    const oauthConfigured = isBitrixOAuthConfigured();
    const installation = await this.storage.getBitrix24Installation();
    const tokens = await this.storage.getTokens();
    const installed = Boolean(installation && tokens);

    let registered = false;

    if (oauthConfigured && installed) {
      registered = await this.botService.isRegistered();
    }

    return {
      configured: oauthConfigured,
      installed,
      domain: installation?.domain ?? null,
      registered,
      botId: registered ? await this.botService.getBotId() : null,
      name: 'Hermes AI',
    };
  };

  test = async (request: FastifyRequest<{ Body: TestBody }>, reply: FastifyReply) => {
    const { dialogId, message = 'Test message' } = request.body ?? {};

    if (dialogId === undefined || dialogId === null || dialogId === '') {
      return reply.code(400).send({ error: 'dialogId is required' });
    }

    return this.botService.sendMessage(dialogId, message);
  };

  webhook = async (request: FastifyRequest, reply: FastifyReply) => {
    let event;

    try {
      event = this.eventService.parse(request.body);
    } catch (error) {
      request.log.warn({ event: 'BOT_WEBHOOK_INVALID', err: error });
      return reply.code(400).send({ status: 'invalid' });
    }

    if (!event) return reply.send({ status: 'ignored' });

    const installation = await this.storage.getBitrix24Installation();

    if (
      !installation ||
      !safeSecretEqual(event.applicationToken, installation.applicationToken) ||
      event.domain !== installation.domain
    ) {
      request.log.warn({ event: 'BOT_WEBHOOK_UNAUTHORIZED', domain: event.domain });
      return reply.code(401).send({ status: 'unauthorized' });
    }

    const botId = await this.botService.getBotId();

    if (botId && event.authorId === botId) return reply.send({ status: 'ignored' });
    if (this.seenMessageIds.has(event.messageId)) return reply.send({ status: 'duplicate' });

    this.seenMessageIds.add(event.messageId);

    if (this.seenMessageIds.size > 1000) {
      const oldest = this.seenMessageIds.values().next().value as number | undefined;
      if (oldest !== undefined) this.seenMessageIds.delete(oldest);
    }

    request.log.info({
      event: 'BOT_MESSAGE_RECEIVED',
      messageId: event.messageId,
      authorId: event.authorId,
      dialogId: event.dialogId,
    });

    await this.botService.sendMessage(event.dialogId, `Получил: ${event.text}`);

    return reply.send({ status: 'ok' });
  };
}
