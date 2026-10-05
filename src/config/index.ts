import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  BITRIX24_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  BITRIX24_BOT_TOKEN: z.string().max(40).optional().or(z.literal('')),
  BITRIX24_APPLICATION_TOKEN: z.string().optional().or(z.literal('')),
  INTEGRATION_STORAGE_FILE: z.string().default('.data/integration.json'),
});

const env = schema.parse(process.env);

export const config = {
  port: env.PORT,
  appUrl: env.APP_URL.replace(/\/$/, ''),
  bitrix24: {
    webhookUrl: env.BITRIX24_WEBHOOK_URL || null,
    botToken: env.BITRIX24_BOT_TOKEN || null,
    applicationToken: env.BITRIX24_APPLICATION_TOKEN || null,
  },
  storageFile: env.INTEGRATION_STORAGE_FILE,
};

export function isBitrixConfigured(): boolean {
  return Boolean(config.bitrix24.webhookUrl && config.bitrix24.botToken);
}
