# AI Agent Instructions

The repository documentation is located in [`./.docs/`](./.docs/).

## Always read

- [`./.docs/00-project.md`](./.docs/00-project.md)
- [`./.docs/01-architecture.md`](./.docs/01-architecture.md)
- [`./.docs/02-development.md`](./.docs/02-development.md)

## Read when relevant

- TypeScript changes → [`./.docs/03-typescript.md`](./.docs/03-typescript.md)
- Fastify / HTTP changes → [`./.docs/04-fastify.md`](./.docs/04-fastify.md)
- Bitrix24 changes → [`./.docs/05-bitrix24.md`](./.docs/05-bitrix24.md)
- Database / storage changes → [`./.docs/06-database.md`](./.docs/06-database.md)
- API changes → [`./.docs/07-api.md`](./.docs/07-api.md)
- Tests → [`./.docs/08-testing.md`](./.docs/08-testing.md)
- Security-sensitive changes → [`./.docs/09-security.md`](./.docs/09-security.md)
- Performance work → [`./.docs/10-performance.md`](./.docs/10-performance.md)
- Git / PR work → [`./.docs/11-git.md`](./.docs/11-git.md)
- Vercel / deployment / documentation publishing → [`./.docs/12-deployment.md`](./.docs/12-deployment.md)

## Documentation structure

- `./.docs/*.md` — documentation source files.
- `./.docs/starlight/` — Starlight application used to publish the documentation.
- `./docs/` — generated public documentation output served under `/docs/*`.

Do not edit generated files under `./docs/` manually. Change the source Markdown in `./.docs/` and rebuild the Starlight documentation instead.

## Project architecture rules

- Bitrix24 is an adapter/channel, not the application core.
- Keep HTTP, business logic, external REST transport, and persistence separated.
- Controllers must not call Bitrix24 REST directly.
- Access integration state only through `IntegrationStorage`.
- Keep future LLM and workflow logic channel-independent.
- Never commit or log secrets.

## General rules

- prefer minimal changes;
- preserve backward compatibility;
- follow existing project architecture;
- do not modernize unrelated code;
- do not add dependencies unless necessary;
- update documentation when behavior or architecture changes;
- if code and documentation conflict, explicitly report the conflict.

## Before completing a code task

Run:

```bash
npm run lint
npm test
npm run build
```

## Git workflow

- one feature or fix = one branch;
- never commit directly to `main`;
- create a Pull Request;
- keep commits focused and understandable.
