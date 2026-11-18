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

If the live status check receives `ACCESS_DENIED` with the exact upstream description
`REST is available only on commercial plans.`, it returns HTTP 503 and a safe
`error.code = BITRIX24_REST_PLAN_REQUIRED` with instructions to check the portal's
plan and REST access. `registered` is `null` (not verified), not `false`; the
stored bot ID is preserved. This does not prove that a subscription expired:
other permission and authentication errors retain their existing behavior.

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
