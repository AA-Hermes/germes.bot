---
title: Testing
---

# Testing

## Framework

Tests use Vitest.

## Required checks

```bash
npm run lint
npm test
npm run build
```

## What to test

Add or update tests when changing:
- OAuth refresh logic;
- REST retry behavior;
- webhook event normalization;
- duplicate/self-message handling;
- storage behavior;
- public API behavior;
- WorkflowService provider delegation;
- provider failure fallback behavior;
- OpenAI Responses API request/response mapping;
- provider usage metadata mapping.

Prefer deterministic unit tests for integration logic.

Mock external network calls.

Do not call real Bitrix24 or production databases from unit tests.
