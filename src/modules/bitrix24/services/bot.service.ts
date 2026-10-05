import type { FastifyBaseLogger } from 'fastify';
import type { IntegrationStorage } from '../../../storage/integration-storage.js';
import type {
  BotListResult,
  BotRegisterResult,
  BotRegistration,
  SendMessageResult,
} from '../types/bot.js';
import { Bitrix24RestClient } from './rest-client.service.js';

const BOT_CODE = 'hermes_ai';
const BOT_NAME = 'Hermes AI';

export class BotService {
  constructor(
    private readonly client: Bitrix24RestClient,
    private readonly storage: IntegrationStorage,
    private readonly logger: FastifyBaseLogger,
    private readonly botToken: string | null,
    private readonly webhookUrl: string,
  ) {}

  private requireBotToken(): string {
    if (!this.botToken) throw new Error('BITRIX24_BOT_TOKEN is not configured');
    return this.botToken;
  }

  async register(): Promise<BotRegistration> {
    const result = await this.client.call<BotRegisterResult>('imbot.v2.Bot.register', {
      fields: {
        code: BOT_CODE,
        botToken: this.requireBotToken(),
        type: 'bot',
        eventMode: 'webhook',
        webhookUrl: this.webhookUrl,
        properties: {
          name: BOT_NAME,
          workPosition: 'AI Business Assistant',
        },
      },
    });

    await this.storage.setBotId(result.bot.id);
    this.logger.info({ event: 'BOT_REGISTER', botId: result.bot.id });
    return { registered: true, botId: result.bot.id, name: BOT_NAME };
  }

  async isRegistered(): Promise<boolean> {
    if (!this.botToken) return false;

    const result = await this.client.call<BotListResult>('imbot.v2.Bot.list', {
      botToken: this.botToken,
      filter: { type: 'bot' },
      limit: 100,
    });

    const bot = result.bots.find((item) => item.code === BOT_CODE);
    if (!bot) {
      await this.storage.setBotId(null);
      return false;
    }

    await this.storage.setBotId(bot.id);
    return true;
  }

  getBotId(): Promise<number | null> {
    return this.storage.getBotId();
  }

  async sendMessage(dialogId: string | number, message: string): Promise<SendMessageResult> {
    const botId = await this.storage.getBotId();
    if (!botId) throw new Error('Hermes AI bot is not registered');

    const result = await this.client.call<SendMessageResult>('imbot.v2.Chat.Message.send', {
      botId,
      botToken: this.requireBotToken(),
      dialogId: String(dialogId),
      fields: { message },
    });

    this.logger.info({
      event: 'BOT_MESSAGE_SENT',
      botId,
      dialogId: String(dialogId),
      messageId: result.id,
    });

    return result;
  }

  async unregister(): Promise<void> {
    const botId = await this.storage.getBotId();
    if (!botId) return;

    await this.client.call('imbot.v2.Bot.unregister', {
      botId,
      botToken: this.requireBotToken(),
    });

    await this.storage.setBotId(null);
  }
}
