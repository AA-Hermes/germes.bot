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

## Bitrix24 local application

Configure the local server application in Bitrix24 with:

```text
Initial installation path:
https://germesbot.vercel.app/b24/install

Your handler path:
https://germesbot.vercel.app/b24/handler
```

Leave **Application completes the installation itself** disabled for the backend callback flow.

Bitrix24 sends `ONAPPINSTALL` to `/b24/install`. The service stores the OAuth access token, refresh token, expiry, portal metadata, and application token through `IntegrationStorage`.

The application handler page is available at `/b24/handler`.

For the local application, configure `BITRIX24_CLIENT_ID` and `BITRIX24_CLIENT_SECRET` after Bitrix24 creates the application.

## Configuration

Copy:

```bash
cp .env.example .env
```

Configure:

- `APP_URL`
- `BITRIX24_CLIENT_ID`
- `BITRIX24_CLIENT_SECRET`

Legacy inbound-webhook variables remain temporarily in `.env.example` while the bot REST client is migrated fully to OAuth.

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
GET  /b24/install
POST /b24/install
GET  /b24/handler
POST /b24/handler
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
- OAuth installation callback is implemented; automatic token refresh is the next step
- no LLM/WorkflowService yet
