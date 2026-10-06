# Germes Bot

Standalone Hermes integration service. Bitrix24 is the first channel adapter; future channels and AI workflows must not depend on Bitrix24-specific application structure.

## MVP
- Node.js 22 + TypeScript + Fastify
- Bitrix24 Chatbots 2.0 (`imbot.v2`)
- Bitrix24 local application OAuth
- Hermes AI bot registration
- incoming message webhook
- echo reply: `Получил: {message}`
- OAuth token refresh on `expired_token`
- structured logging
- health endpoint
- Docker
- CI

## Architecture

```text
HTTP
  -> Controller
    -> BotService / EventService
      -> Bitrix24RestClient
        -> Bitrix24OAuthService
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

Required application scope:

```text
imbot
```

Leave **Application completes the installation itself** disabled for the backend callback flow.

Bitrix24 sends `ONAPPINSTALL` to `/b24/install`. The service stores the OAuth access token, refresh token, expiry, portal metadata, and `application_token` through `IntegrationStorage`.

For OAuth calls:
- `access_token` is sent as the REST `auth` parameter;
- `botToken` is not used;
- when Bitrix24 returns `expired_token`, the service refreshes the token pair and retries the original call once;
- refreshed tokens replace the previous token pair in storage.


## Storage

Production uses persistent Postgres storage when `DATABASE_URL` is configured. The recommended Vercel setup is Neon Postgres from the Vercel Marketplace.

The storage implementation is selected automatically:

```text
DATABASE_URL set   -> PostgresIntegrationStorage
DATABASE_URL empty -> FileIntegrationStorage
```

`PostgresIntegrationStorage` creates the `integration_state` table automatically on first access and stores the Bitrix24 bot ID, OAuth token pair, and installation metadata. No manual SQL migration is required for the MVP.

`FileIntegrationStorage` remains available for local development only. Do not rely on it in Vercel production because the serverless filesystem is ephemeral.

## Configuration

Copy:

```bash
cp .env.example .env
```

Configure:

```text
APP_URL=https://germesbot.vercel.app
BITRIX24_CLIENT_ID=...
BITRIX24_CLIENT_SECRET=...
DATABASE_URL=postgresql://...
```

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

1. Deploy the service to a public HTTPS URL.
2. `GET /health` returns `{"status":"ok"}`.
3. Install the local Bitrix24 application.
4. The installation callback saves OAuth authorization data.
5. Call `POST /api/bitrix24/bot/register`.
6. Find **Hermes AI** in Bitrix24 Messenger.
7. Send `Привет`.
8. Bitrix24 calls `POST /api/bitrix24/webhook`.
9. Hermes AI replies `Получил: Привет`.

## MVP limitations

- one Bitrix24 portal;
- production storage is Postgres when `DATABASE_URL` is configured;
- file storage remains a local-development fallback;
- duplicate-event protection is in memory;
- no LLM / WorkflowService yet.
