---
title: Performance
---

# Performance

## Priorities

This service is I/O-bound.

Optimize network and storage behavior before micro-optimizing application code.

## Guidelines

- Reuse initialized clients where safe.
- Avoid unnecessary REST calls to Bitrix24.
- Avoid repeated database reads inside one logical operation when state is already available.
- Keep external HTTP timeouts bounded.
- Keep webhook handlers short.
- Use asynchronous processing only when the workflow genuinely requires it.

Do not add caching without a measured need and a clear invalidation strategy.
