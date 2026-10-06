---
title: Event Queue
---

# Event Queue

## Purpose

Incoming Bitrix24 webhook events must be acknowledged before waiting for OpenAI or outbound Bitrix24 REST calls.

Production flow:

```text
Bitrix24 webhook
  -> validate event
  -> persist normalized message in Postgres
  -> HTTP 200
  -> Vercel waitUntil()
    -> claim queued messages
    -> WorkflowService / LLMProvider
    -> send reply through Bitrix24
    -> mark queue item completed
```

## Storage

When `DATABASE_URL` is configured, `PostgresEventQueue` creates the `incoming_event_queue` table automatically.

The queue stores only normalized message data:
- channel;
- external message ID;
- conversation ID;
- user ID;
- message text;
- processing state and retry metadata.

Bitrix24 application tokens and raw webhook payloads are not copied into the queue.

The unique key `(channel, external_id)` provides persistent duplicate-event protection.

## Claiming and concurrency

Workers claim rows atomically with `FOR UPDATE SKIP LOCKED`. The processor claims one row at a time so each item receives a fresh processing lease immediately before its work starts.

A claimed row moves to `processing` and increments `attempts`. Processing leases older than five minutes can be reclaimed.

This prevents concurrent Vercel invocations from processing the same queued message at the same time.

## Retries

Failed outbound processing is returned to `pending` with exponential backoff.

Current policy:
- maximum attempts: 5;
- initial retry delay: 30 seconds;
- maximum retry delay: 15 minutes;
- exhausted items move to `failed`.

Only a safe error class name is stored in `last_error`; raw provider response bodies are not persisted.

Before sending a reply to Bitrix24, the queue atomically changes `delivery_status` from `pending` to `sending`. After Bitrix24 returns a message ID, the same row is marked `completed` / `sent` and stores that outbound message ID. If the process fails after delivery has started, the row is not automatically resent because Bitrix24 Chatbots 2.0 does not expose an idempotency key for `imbot.v2.Chat.Message.send`. The row is instead marked `failed` / `unknown` for manual inspection. This favors avoiding duplicate user-visible replies over automatic retry of an ambiguous send.

Stale rows that have already reached the maximum attempt count are finalized as `failed`. Stale rows left in `sending` are finalized as `failed` / `unknown` instead of being reclaimed for another send.

## Vercel lifecycle

Vercel production uses `waitUntil()` from `@vercel/functions` so the HTTP webhook response is not blocked by OpenAI latency while background processing remains attached to the Function lifecycle.

The Postgres row is persisted before the background task is scheduled. If a Function stops unexpectedly, the row remains recoverable instead of losing the incoming Bitrix24 message.

When `DATABASE_URL` is not configured, local development keeps the previous synchronous webhook behavior.


## Recovery trigger

Each accepted webhook schedules a background processor immediately. Pending or stale events are also eligible to be claimed by later webhook-triggered processors.

`.github/workflows/queue-worker.yml` calls `GET /api/queue/process` every five minutes. The route requires `Authorization: Bearer <CRON_SECRET>` and processes up to 10 available items. Configure the same `CRON_SECRET` value both in Vercel environment variables and in GitHub Actions repository secrets. This independently recovers delayed retries and stale leases even when no new Bitrix24 webhook arrives.
