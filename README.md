# Germes Bot

Standalone Hermes integration service. Bitrix24 is the first channel adapter; future channels and AI workflows must not depend on Bitrix24-specific application structure.

## MVP
- Node.js 22 + TypeScript + Fastify
- Bitrix24 Chatbots 2.0 (imbot.v2)
- inbound webhook authorization for one owned Bitrix24 Cloud portal
- Hermes AI registration
- incoming message webhook
- echo reply: `Получил: {message}`
- file-backed runtime integration state
- structured logging
- health endpoint
- Docker
- CI

## Architecture

```text
HTTP
  -> BotController
    -> BotService / EventService
      -> Bitrix24RestClient
      -> IntegrationStorage
```

Bitrix24 is an adapter, not the application core.

## Authorization

For one Hermes-owned Bitrix24 Cloud portal, use an inbound webhook with the `imbot` scope. OAuth is deferred until multi-portal installation is required.

## Configuration

Copy:

```bash
cp .env.example .env
```

Configure:

- `APP_URL`
- `BITRIX24_WEBHOOK_URL`
- `BITRIX24_BOT_TOKEN`
- `BITRIX24_APPLICATION_TOKEN`

The registered bot callback is:

```text
{APP_URL}/api/bitrix24/webhook
```

## Development

```bash
npm install
npm run dev
```

## API

```text
GET  /health
POST /api/bitrix24/bot/register
GET  /api/bitrix24/bot/status
POST /api/bitrix24/bot/test
POST /api/bitrix24/webhook
```

## Docker

```bash
docker build -t germes-bot .
docker run --rm -p 3000:3000 --env-file .env germes-bot
```

## End-to-end

1. Start the service on a public HTTPS URL.
2. `GET /health` returns `{"status":"ok"}`.
3. Call `POST /api/bitrix24/bot/register`.
4. Find **Hermes AI** in Bitrix24 Messenger.
5. Send `Привет`.
6. Bitrix24 calls `POST /api/bitrix24/webhook`.
7. Hermes AI replies `Получил: Привет`.

## MVP limitations
- one Bitrix24 portal
- local file storage
- duplicate-event protection is in memory
- no OAuth installation lifecycle yet
- no LLM/WorkflowService yet
