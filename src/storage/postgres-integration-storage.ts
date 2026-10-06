import { neon } from '@neondatabase/serverless';
import type {
  AuthTokens,
  Bitrix24Installation,
  IntegrationStorage,
} from './integration-storage.js';

interface StateRow {
  bot_id: number | null;
  tokens: AuthTokens | null;
  installation: Bitrix24Installation | null;
}

const STATE_KEY = 'bitrix24';

export class PostgresIntegrationStorage implements IntegrationStorage {
  private readonly sql: ReturnType<typeof neon>;
  private initialized = false;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) return;

    await this.sql`
      CREATE TABLE IF NOT EXISTS integration_state (
        integration_key text PRIMARY KEY,
        bot_id bigint,
        tokens jsonb,
        installation jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await this.sql`
      INSERT INTO integration_state (integration_key)
      VALUES (${STATE_KEY})
      ON CONFLICT (integration_key) DO NOTHING
    `;

    this.initialized = true;
  }

  private async getState(): Promise<StateRow> {
    await this.ensureSchema();

    const result = await this.sql`
      SELECT bot_id, tokens, installation
      FROM integration_state
      WHERE integration_key = ${STATE_KEY}
      LIMIT 1
    `;

    const rows = result as unknown as StateRow[];
    const row = rows[0];

    return {
      bot_id: row?.bot_id == null ? null : Number(row.bot_id),
      tokens: row?.tokens ?? null,
      installation: row?.installation ?? null,
    };
  }

  async getBotId(): Promise<number | null> {
    return (await this.getState()).bot_id;
  }

  async setBotId(id: number | null): Promise<void> {
    await this.ensureSchema();

    await this.sql`
      INSERT INTO integration_state (integration_key, bot_id, updated_at)
      VALUES (${STATE_KEY}, ${id}, now())
      ON CONFLICT (integration_key)
      DO UPDATE SET bot_id = EXCLUDED.bot_id, updated_at = now()
    `;
  }

  async getTokens(): Promise<AuthTokens | null> {
    return (await this.getState()).tokens;
  }

  async saveTokens(tokens: AuthTokens | null): Promise<void> {
    await this.ensureSchema();
    const value = tokens ? JSON.stringify(tokens) : null;

    await this.sql`
      INSERT INTO integration_state (integration_key, tokens, updated_at)
      VALUES (${STATE_KEY}, ${value}::jsonb, now())
      ON CONFLICT (integration_key)
      DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = now()
    `;
  }

  async getBitrix24Installation(): Promise<Bitrix24Installation | null> {
    return (await this.getState()).installation;
  }

  async saveBitrix24Installation(
    installation: Bitrix24Installation | null,
  ): Promise<void> {
    await this.ensureSchema();
    const value = installation ? JSON.stringify(installation) : null;

    await this.sql`
      INSERT INTO integration_state (integration_key, installation, updated_at)
      VALUES (${STATE_KEY}, ${value}::jsonb, now())
      ON CONFLICT (integration_key)
      DO UPDATE SET installation = EXCLUDED.installation, updated_at = now()
    `;
  }
}
