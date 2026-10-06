# Architecture

## Principles

Bitrix24 is an adapter/channel, not the application core.

Keep HTTP, business logic, transport, and persistence separated.

Current request flow:

```text
HTTP
  -> Controller
    -> BotService / EventService
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

### Future core

AI logic should be introduced behind a channel-independent workflow layer, for example:

```text
Channel Adapter
  -> WorkflowService
    -> LLMProvider
    -> ConversationStorage
```

Do not place LLM-specific behavior inside Bitrix24 controllers or services.
