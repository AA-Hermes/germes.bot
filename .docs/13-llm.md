---
title: LLM
---

# LLM

## Architecture

LLM access is isolated behind the `LLMProvider` contract.

Current providers:
- `EchoLLMProvider` — local/default fallback that preserves the old `Получил: ...` behavior;
- `OpenAIProvider` — production provider using the OpenAI Responses API.

Bitrix24 and other channel adapters must not depend on a concrete provider.

## Provider selection

Provider selection is configuration-driven:

```text
OPENAI_API_KEY set   -> OpenAIProvider
OPENAI_API_KEY empty -> EchoLLMProvider
```

## OpenAI

The OpenAI integration uses:

```text
POST https://api.openai.com/v1/responses
```

Configuration:

```text
OPENAI_API_KEY
OPENAI_MODEL
OPENAI_TIMEOUT_MS
OPENAI_MAX_OUTPUT_TOKENS
```

Default model:

```text
gpt-6-luna
```

The model is configuration, not application architecture. Do not hard-code model behavior into Bitrix24 adapters or WorkflowService.

## Prompting

Provider-level instructions currently define Hermes AI as a concise business assistant and ask it to reply in the user's language.

When prompt behavior becomes business-specific or versioned, move it behind a dedicated prompt/configuration abstraction rather than expanding channel code.

## Errors

Provider errors are propagated to `WorkflowService`.

`WorkflowService`:
- logs the provider failure;
- records latency;
- returns a safe fallback reply.

Never log API keys or Authorization headers.

## Token usage

When the provider returns usage metadata, map:
- input tokens -> `inputTokens`;
- output tokens -> `outputTokens`.

Workflow logging may record token counts, provider, model, and latency, but never prompt secrets or credentials.

## Conversation history

The current provider sends only the current user message.

Persistent history is the next separate concern and should be implemented behind `ConversationStorage`.
