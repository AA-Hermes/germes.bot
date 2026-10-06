---
title: API
---

# API

## Health

```text
GET /health
```

## Bitrix24 application

```text
GET  /b24/install
POST /b24/install
GET  /b24/handler
POST /b24/handler
```

## Bitrix24 bot

```text
POST /api/bitrix24/bot/register
GET  /api/bitrix24/bot/status
POST /api/bitrix24/bot/test
POST /api/bitrix24/webhook
```

## Queue worker

```text
GET /api/queue/process
```

The endpoint is used by the scheduled recovery workflow to process pending retries and stale queue leases. It requires `Authorization: Bearer <CRON_SECRET>` and is not intended for public clients.

## Rules

- Keep endpoint behavior backward compatible unless a breaking change is explicitly requested.
- Return structured JSON for API endpoints unless an integration requires another format.
- Do not expose secrets or tokens.
- Keep integration-specific DTO parsing at the boundary.
- Update this document whenever public endpoint behavior changes.
