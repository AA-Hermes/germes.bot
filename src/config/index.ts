import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  BITRIX24_CLIENT_ID: z.string().optional().or(z.literal('')),
  BITRIX24_CLIENT_SECRET: z.string().optional().or(z.literal('')),
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  INTEGRATION_STORAGE_FILE: z.string().default('.data/integration.json'),
});

const env = schema.parse(process.env);

export const config = {
  port: env.PORT,
  appUrl: env.APP_URL.replace(/\/$/, ''),
  bitrix24: {
    clientId: env.BITRIX24_CLIENT_ID || null,
    clientSecret: env.BITRIX24_CLIENT_SECRET || null,
  },
  databaseUrl: env.DATABASE_URL || null,
  storageFile: env.INTEGRATION_STORAGE_FILE,
};

export function isBitrixOAuthConfigured(): boolean {
  return Boolean(config.bitrix24.clientId && config.bitrix24.clientSecret);
}
