# Germes Bot

Standalone backend integration service for Hermes.

## Stack
- Node.js 22+
- TypeScript strict mode
- Fastify
- native fetch
- Vitest
- Docker

## Architecture
Bitrix24 is an adapter/channel, not the application core.

HTTP -> Controller -> BotService / EventService -> Bitrix24RestClient

Runtime integration state must be accessed through IntegrationStorage so file storage can later be replaced by PostgreSQL, Redis, or SQLite.

## Rules
- Keep HTTP, business logic, REST transport, and persistence separate.
- Never commit or log secrets.
- Do not call Bitrix24 REST directly from controllers.
- Prefer small explicit abstractions over framework-heavy patterns.
- Do not add frontend code unless explicitly requested.
- Do not add LLM integrations yet; preserve a path for a future WorkflowService.

## Before completing a task
Run:
npm run lint
npm test
npm run build

## Git
One feature = one branch.
Never commit directly to main.
Create a Pull Request.
