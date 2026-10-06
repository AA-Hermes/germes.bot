# TypeScript

## Rules

- Keep strict TypeScript enabled.
- Prefer explicit domain interfaces for external payloads.
- Avoid `any` unless integration boundaries make it unavoidable.
- Narrow `unknown` before use.
- Keep transport DTOs separate from internal domain concepts when their shapes diverge.
- Prefer small modules with explicit dependencies.
- Do not introduce decorators or framework-specific abstractions without a concrete need.

## Imports

The project uses ESM and NodeNext module resolution.

Internal TypeScript imports must use the emitted `.js` extension where required by NodeNext.

## Errors

Use typed/domain errors where transport behavior depends on error type.

Do not leak credentials, access tokens, refresh tokens, application tokens, or secrets in error messages or logs.
