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
OPENAI_REASONING_EFFORT
```

Default model:

```text
gpt-6-luna
```

Default response settings:

```text
OPENAI_MAX_OUTPUT_TOKENS = 1200
OPENAI_REASONING_EFFORT = optional
```

`OPENAI_MAX_OUTPUT_TOKENS` must be at least 16.

`OPENAI_REASONING_EFFORT` is only sent when configured. Supported configured values are `none`, `low`, `medium`, `high`, `xhigh`, and `max`. For the default `gpt-6-luna`, the provider factory applies `low` automatically; switching to another model does not inherit that reasoning parameter unless explicitly configured.

The model is configuration, not application architecture. Do not hard-code model behavior into Bitrix24 adapters or WorkflowService.

## Prompting

Provider-level instructions currently define Hermes AI as a concise business assistant and ask it to reply in the user's language.

When prompt behavior becomes business-specific or versioned, move it behind a dedicated prompt/configuration abstraction rather than expanding channel code.

## Errors

Provider errors are propagated to `WorkflowService`.

Responses with `status: incomplete` are treated as failures even if they contain partial text.

Successful refusal content is treated as valid user-facing output, not as a provider failure.

When the raw REST payload contains multiple `output_text` parts, the provider concatenates them in response order.

`WorkflowService`:
- logs the provider failure;
- records latency;
- returns a safe fallback reply;
- maps typed provider failures to safe user-facing explanations for quota exhaustion, authentication failures, rate limits, and timeouts.

Never log API keys, Authorization headers, or raw provider error messages. OpenAI error responses are converted to a typed safe local error containing only provider metadata, HTTP status, and a sanitized error code. Non-JSON error bodies are never propagated into local error messages. User-facing replies must describe the failure category without exposing raw provider response bodies or credentials.

Billing and quota codes such as `credit_balance_exhausted`, `insufficient_quota`, `organization_spend_limit_exceeded`, `project_spend_limit_exceeded`, and `organization_usage_limit_exceeded` are classified as `quota_exhausted`, not as temporary rate limits.

## Token usage

When the provider returns usage metadata, map:
- input tokens -> `inputTokens`;
- output tokens -> `outputTokens`.

Workflow logging may record token counts, provider, model, and latency, but never prompt secrets or credentials.

## Conversation history

The current provider sends only the current user message.

Persistent history is the next separate concern and should be implemented behind `ConversationStorage`.
