# Bitrix24

## Integration type

Germes Bot uses a Bitrix24 local server application with OAuth.

Current production portal integration is expected to be installed through:

```text
/b24/install
/b24/handler
```

## Chatbot API

The project uses Bitrix24 Chatbots 2.0 methods under `imbot.v2`.

Current bot:
- name: Hermes AI;
- code: `hermes_ai`;
- type: bot;
- event mode: webhook.

## OAuth

Do not use the legacy inbound webhook model for this integration.

OAuth credentials come from:
- `BITRIX24_CLIENT_ID`;
- `BITRIX24_CLIENT_SECRET`.

Runtime installation data includes:
- access token;
- refresh token;
- expiry;
- portal domain;
- member ID;
- client endpoint;
- server endpoint;
- application token.

On `expired_token`, refresh the token pair and retry the original REST request once.

The new refresh token must replace the previous refresh token.

## Incoming webhook security

Validate:
- `application_token`;
- portal domain;
- payload shape.

Ignore self-authored bot messages.

Protect against duplicate message processing.
