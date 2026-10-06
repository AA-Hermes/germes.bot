# Fastify

## Role

Fastify is the HTTP layer of Germes Bot.

## Rules

- Routes should be thin.
- Controllers handle HTTP semantics.
- Business logic belongs in services.
- External API calls belong in dedicated clients.
- Persistence must go through storage abstractions.
- Validate incoming payloads at the boundary.
- Apply route-specific rate limits where external callbacks can be abused.

## Vercel

The project is deployed with the Vercel Fastify preset.

Do not change the Vercel framework preset without a concrete reason.

The project uses an explicit Vercel function entrypoint under `/api/`.

When changing server startup behavior, verify both local Node execution and Vercel deployment behavior.
