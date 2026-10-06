---
title: Architecture
---

# Architecture

## Principles

Bitrix24 is an adapter/channel, not the application core.

Keep HTTP, business logic, transport, and persistence separated.

Current message flow:

```text
Bitrix24 webhook
  -> BotController
    -> EventService
    -> WorkflowService
      -> LLMProvider
    -> BotService
      -> Bitrix24RestClient
        -> Bitrix24OAuthService
      -> IntegrationStorage
```

## Main modules

### HTTP layer

Fastify routes receive external requests and delegate work to controllers.

Controllers must not call Bitrix24 REST directly.

### Services

`BotService` contains chatbot operations.

`EventService` normalizes incoming Bitrix24 events.

`Bitrix24RestClient` owns REST transport behavior.

`Bitrix24OAuthService` owns access-token refresh behavior.

### Persistence

All integration runtime state must be accessed through `IntegrationStorage`.

Current implementations:
- `PostgresIntegrationStorage` for production;
- `FileIntegrationStorage` for local development.

### Workflow core

`WorkflowService` is channel-independent and owns message processing orchestration.

`LLMProvider` is the provider contract. Bitrix24 code must depend on `WorkflowService`, not on a concrete model vendor.

`EchoLLMProvider` preserves the existing `Получил: ...` behavior when no external provider is configured. `OpenAIProvider` implements the same contract through the OpenAI Responses API.

Provider failures return a safe fallback reply and are logged with latency metadata.

Future conversation history should be introduced behind a dedicated `ConversationStorage` abstraction:

```text
Channel Adapter
  -> WorkflowService
    -> LLMProvider
    -> ConversationStorage
```

Do not place provider-specific or prompt-specific behavior inside Bitrix24 controllers or services.
