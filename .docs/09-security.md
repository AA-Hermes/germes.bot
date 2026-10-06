# Security

## Secrets

Never commit or log:
- Bitrix24 client secret;
- access tokens;
- refresh tokens;
- application tokens;
- database credentials.

## Incoming callbacks

Treat all external callbacks as untrusted input.

Validate:
- payload shape;
- portal identity;
- application token.

Use constant-time comparison for secrets where practical.

## Logging

Structured logs may contain:
- event type;
- portal domain;
- message IDs;
- bot IDs;
- HTTP status;
- REST error code.

Structured logs must not contain credentials or token values.

## Dependencies

Do not add dependencies unless necessary.

Review security-sensitive dependency changes separately from unrelated refactors.
