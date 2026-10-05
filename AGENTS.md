# Project

B2B SaaS application.

## Stack

- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Tailwind

## Architecture

See:
- .docs/architecture.md
- .docs/database.md

## Development rules

- TypeScript strict mode
- Server Components by default
- Client Components only when required
- Zod for validation
- Prisma for database access
- No business logic inside React components

## Before completing a task

Run:

pnpm lint
pnpm test
pnpm build

All commands must pass.

## Git

One feature = one branch.

Never commit directly to main.

Create a Pull Request.
