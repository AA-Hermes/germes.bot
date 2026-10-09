---
title: Architecture
---

# Architecture

## Principles

Bitrix24 is an adapter/channel, not the application core.

Keep HTTP, business logic, transport, and persistence separated.

Current production message flow:

```text
Bitrix24 webhook
  -> BotController
    -> EventService
    -> PostgresEventQueue
  -> HTTP 200
  -> QueuedEventProcessor
    -> WorkflowService
      -> LLMProvider
    -> BotService
      -> Bitrix24RestClient
        -> Bitrix24OAuthService
      -> IntegrationStorage
```

A scheduled queue worker also invokes `QueuedEventProcessor` to recover retries and stale leases that are not picked up by the immediate webhook-triggered background task.

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

Incoming production messages are persisted separately through `EventQueue`. `PostgresEventQueue` provides durable enqueueing, duplicate protection, retry state, and worker leases.

Current implementations:
- `PostgresIntegrationStorage` for production;
- `FileIntegrationStorage` for local development.

### Workflow core

`WorkflowService` is channel-independent and owns message processing orchestration.

`LLMProvider` is the provider contract. Bitrix24 code must depend on `WorkflowService`, not on a concrete model vendor.

`EchoLLMProvider` preserves the existing `Получил: ...` behavior when no external provider is configured. `OpenAIProvider` implements the same contract through the OpenAI Responses API.

Provider failures return a safe fallback reply and are logged with latency metadata.

### Tool layer

The channel-independent tool layer lives under `src/core/tools/`. It is the only application-core boundary for exposing controlled business capabilities to LLM/workflow orchestration.

```text
Workflow / LLM orchestration
  -> ToolRegistry
    -> ToolExecutor
      -> Tool
        -> application/integration service
          -> external transport
```

Responsibilities:
- `Tool` declares a stable name, description, input schema, risk (`read` or `write`), input parser, and execution function;
- `ToolContext` carries channel-independent request context such as channel, conversation ID, and user ID;
- `ToolRegistry` is the allowlist. It stores private snapshots of enforcement metadata and returns copies so callers cannot mutate a tool from `write` to `read`;
- `ToolExecutor` validates/parses input before execution, enforces the current risk policy, and emits metadata-only execution logs;
- `ToolError` exposes only normalized error kind, tool name, and safe message. Raw upstream exceptions, response bodies, credentials, tool inputs, and tool outputs must not cross this boundary or be logged.

Write tools are intentionally blocked until an explicit authorization/confirmation policy is implemented. Do not bypass this by calling a write tool's `execute()` directly from Workflow, an LLM provider, or a channel adapter.

Integration-specific tools belong in their integration module and should delegate to application services rather than exposing arbitrary transport calls. In particular, do not expose a generic `bitrix_rest_call(method, params)` tool to the model. Bitrix24 CRM tools should be explicit allowlisted operations such as search/get actions.

The current PR establishes the tool infrastructure only. Native LLM tool-call orchestration and concrete Bitrix24 CRM tools are separate steps; `WorkflowService` still calls `LLMProvider` directly today.

Future conversation history should be introduced behind a dedicated `ConversationStorage` abstraction:

```text
Channel Adapter
  -> WorkflowService
    -> LLMProvider
    -> ConversationStorage
```

Do not place provider-specific or prompt-specific behavior inside Bitrix24 controllers or services.
