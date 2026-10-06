# Database

## Storage abstraction

Business and integration services must depend on `IntegrationStorage`, not directly on Postgres.

## Production

Production uses Neon Postgres through `DATABASE_URL`.

Current table:

```text
integration_state
```

It stores:
- integration key;
- bot ID;
- OAuth token state;
- Bitrix24 installation metadata;
- update timestamp.

## Local development

Without `DATABASE_URL`, the application falls back to file storage.

Never rely on file storage in Vercel production.

## Changes

Database changes must:
- preserve the `IntegrationStorage` contract when possible;
- be backward compatible with existing production state;
- avoid destructive migrations unless explicitly approved;
- document schema or persistence behavior changes.
