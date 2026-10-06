import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  BITRIX24_CLIENT_ID: z.string().optional().or(z.literal('')),
  BITRIX24_CLIENT_SECRET: z.string().optional().or(z.literal('')),
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  INTEGRATION_STORAGE_FILE: z.string().default('.data/integration.json'),
  OPENAI_API_KEY: z.string().optional().or(z.literal('')),
  OPENAI_MODEL: z.string().default('gpt-6-luna'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(16).default(1_200),
  OPENAI_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).optional().or(z.literal('')),
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
  openai: {
    apiKey: env.OPENAI_API_KEY || null,
    model: env.OPENAI_MODEL,
    timeoutMs: env.OPENAI_TIMEOUT_MS,
    maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS,
    reasoningEffort: env.OPENAI_REASONING_EFFORT || null,
  },
};

export function isBitrixOAuthConfigured(): boolean {
  return Boolean(config.bitrix24.clientId && config.bitrix24.clientSecret);
}
