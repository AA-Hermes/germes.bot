import { neon } from '@neondatabase/serverless';
import type { EventQueue, QueuedEvent, QueuedEventInput } from './event-queue.js';

interface QueueRow {
  id: number | string;
  channel: string;
  external_id: string;
  conversation_id: string;
  user_id: string | null;
  text: string;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

export class PostgresEventQueue implements EventQueue {
  private readonly sql: ReturnType<typeof neon>;
  private initialized = false;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) return;

    await this.sql`
      CREATE TABLE IF NOT EXISTS incoming_event_queue (
        id bigserial PRIMARY KEY,
        channel text NOT NULL,
        external_id text NOT NULL,
        conversation_id text NOT NULL,
        user_id text,
        text text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0,
        available_at timestamptz NOT NULL DEFAULT now(),
        locked_at timestamptz,
        last_error text,
        delivery_status text NOT NULL DEFAULT 'pending',
        outbound_message_id bigint,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (channel, external_id)
      )
    `;

    await this.sql`
      ALTER TABLE incoming_event_queue
      ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending'
    `;

    await this.sql`
      ALTER TABLE incoming_event_queue
      ADD COLUMN IF NOT EXISTS outbound_message_id bigint
    `;

    await this.sql`
      CREATE INDEX IF NOT EXISTS incoming_event_queue_pending_idx
      ON incoming_event_queue (status, delivery_status, available_at, created_at)
    `;

    this.initialized = true;
  }

  async enqueue(event: QueuedEventInput): Promise<boolean> {
    await this.ensureSchema();

    const result = await this.sql`
      INSERT INTO incoming_event_queue (
        channel,
        external_id,
        conversation_id,
        user_id,
        text
      )
      VALUES (
        ${event.channel},
        ${event.externalId},
        ${event.conversationId},
        ${event.userId ?? null},
        ${event.text}
      )
      ON CONFLICT (channel, external_id) DO NOTHING
      RETURNING id
    `;

    const rows = result as unknown as Array<{ id: number | string }>;
    return rows.length > 0;
  }

  async claim(limit: number): Promise<QueuedEvent[]> {
    await this.ensureSchema();

    await this.finalizeStaleRows();

    const result = await this.sql`
      WITH candidates AS (
        SELECT id
        FROM incoming_event_queue
        WHERE attempts < ${MAX_ATTEMPTS}
          AND delivery_status = 'pending'
          AND (
            (status = 'pending' AND available_at <= now())
            OR
            (status = 'processing' AND locked_at < now() - interval '5 minutes')
          )
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE incoming_event_queue AS queue
      SET
        status = 'processing',
        attempts = queue.attempts + 1,
        locked_at = now(),
        updated_at = now()
      FROM candidates
      WHERE queue.id = candidates.id
      RETURNING
        queue.id,
        queue.channel,
        queue.external_id,
        queue.conversation_id,
        queue.user_id,
        queue.text,
        queue.attempts
    `;

    return (result as unknown as QueueRow[]).map((row) => ({
      id: Number(row.id),
      channel: row.channel,
      externalId: row.external_id,
      conversationId: row.conversation_id,
      userId: row.user_id ?? undefined,
      text: row.text,
      attempts: row.attempts,
    }));
  }

  async beginDelivery(id: number): Promise<boolean> {
    await this.ensureSchema();

    const result = await this.sql`
      UPDATE incoming_event_queue
      SET
        delivery_status = 'sending',
        updated_at = now()
      WHERE id = ${id}
        AND status = 'processing'
        AND delivery_status = 'pending'
      RETURNING id
    `;

    const rows = result as unknown as Array<{ id: number | string }>;
    return rows.length > 0;
  }

  async markDelivered(id: number, outboundMessageId: number): Promise<void> {
    await this.ensureSchema();

    await this.sql`
      UPDATE incoming_event_queue
      SET
        status = 'completed',
        delivery_status = 'sent',
        outbound_message_id = ${outboundMessageId},
        locked_at = NULL,
        last_error = NULL,
        updated_at = now()
      WHERE id = ${id}
        AND delivery_status = 'sending'
    `;
  }

  async failDelivery(id: number, errorName: string): Promise<void> {
    await this.ensureSchema();

    await this.sql`
      UPDATE incoming_event_queue
      SET
        status = 'failed',
        delivery_status = 'unknown',
        locked_at = NULL,
        last_error = ${errorName},
        updated_at = now()
      WHERE id = ${id}
        AND delivery_status = 'sending'
    `;
  }

  async retry(id: number, attempts: number, errorName: string): Promise<void> {
    await this.ensureSchema();

    const exhausted = attempts >= MAX_ATTEMPTS;
    const retryDelayMs = Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 15 * 60_000);
    const availableAt = new Date(Date.now() + retryDelayMs).toISOString();

    await this.sql`
      UPDATE incoming_event_queue
      SET
        status = ${exhausted ? 'failed' : 'pending'},
        available_at = ${availableAt},
        locked_at = NULL,
        last_error = ${errorName},
        updated_at = now()
      WHERE id = ${id}
        AND delivery_status = 'pending'
    `;
  }

  private async finalizeStaleRows(): Promise<void> {
    await this.sql`
      UPDATE incoming_event_queue
      SET
        status = 'failed',
        locked_at = NULL,
        last_error = 'AttemptLimitReached',
        updated_at = now()
      WHERE status = 'processing'
        AND delivery_status = 'pending'
        AND attempts >= ${MAX_ATTEMPTS}
        AND locked_at < now() - interval '5 minutes'
    `;

    await this.sql`
      UPDATE incoming_event_queue
      SET
        status = 'failed',
        delivery_status = 'unknown',
        locked_at = NULL,
        last_error = 'OutboundDeliveryUncertain',
        updated_at = now()
      WHERE status = 'processing'
        AND delivery_status = 'sending'
        AND locked_at < now() - interval '5 minutes'
    `;
  }
}
