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

## Vercel lifecycle

Vercel production uses `waitUntil()` from `@vercel/functions` so the HTTP webhook response is not blocked by OpenAI latency while background processing remains attached to the Function lifecycle.

The Postgres row is persisted before the background task is scheduled. If a Function stops unexpectedly, the row remains recoverable instead of losing the incoming Bitrix24 message.

When `DATABASE_URL` is not configured, local development keeps the previous synchronous webhook behavior.


## Recovery trigger

Each accepted webhook schedules a background processor immediately. Pending or stale events are also eligible to be claimed by later webhook-triggered processors.

Vercel Cron calls `GET /api/queue/process` once per minute. The route requires `Authorization: Bearer <CRON_SECRET>` and processes up to 10 available items. This independently recovers delayed retries and stale leases even when no new Bitrix24 webhook arrives.
