# Development

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Required checks

Before completing a code task run:

```bash
npm run lint
npm test
npm run build
```

## Local storage

If `DATABASE_URL` is not configured, the application uses `FileIntegrationStorage`.

This is intended only for local development.

## Production storage

When `DATABASE_URL` is configured, the application uses `PostgresIntegrationStorage`.

## Environment variables

Do not commit secrets.

Use `.env.example` to document required variables without real values.

## Change discipline

Prefer small, focused changes.

Do not refactor unrelated code as part of feature work.
