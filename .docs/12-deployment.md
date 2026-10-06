# Deployment

## Platform

Production is deployed on Vercel.

Framework preset:

```text
Fastify
```

Runtime:

```text
Node.js 22.x
```

## Production environment

Expected variables include:
- `APP_URL`;
- `BITRIX24_CLIENT_ID`;
- `BITRIX24_CLIENT_SECRET`;
- `DATABASE_URL`.

## Documentation publication

Documentation source lives in `/.docs/*.md`.

The Starlight application lives in `/.docs/starlight/`.

The generated static documentation output is written to:

```text
/docs/
```

and is intended to be served publicly under:

```text
/docs/*
```

Do not edit generated files in `/docs/` manually.
