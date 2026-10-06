---
title: Project
---

# Project

## Purpose

Germes Bot is a standalone backend integration service for Hermes.

Its first channel is Bitrix24 Chatbots 2.0. The project must remain independent from Bitrix24 so additional channels and AI workflows can be added later without restructuring the core application.

## Current scope

The current production flow is:

```text
Bitrix24
  -> OAuth local application
  -> Germes Bot
  -> Bitrix24 Chatbots 2.0 REST API
```

The current bot is **Hermes AI**.

Implemented:
- Fastify backend;
- Vercel deployment;
- Bitrix24 local application OAuth;
- OAuth token refresh;
- persistent integration state in Postgres;
- bot registration;
- incoming message webhook;
- echo reply;
- structured logging;
- tests and CI.

Not implemented yet:
- LLM provider integration;
- WorkflowService;
- conversation memory;
- additional channels such as Telegram.

## Stack

- Node.js 22
- TypeScript
- Fastify
- native `fetch`
- Zod
- Vitest
- Neon Postgres
- Vercel
- Docker

## Repository documentation

Source documentation lives in `/.docs/*.md`.

The Starlight documentation application lives in `/.docs/starlight/`.

Generated public documentation is written to `/docs/` and must not be edited manually.
