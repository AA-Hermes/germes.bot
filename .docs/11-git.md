# Git

## Workflow

One feature or fix per branch.

Do not commit directly to `main`.

Create a Pull Request for every change.

## Commits

Keep commits focused and understandable.

Do not mix unrelated refactors into feature commits.

## Pull Requests

A PR should describe:
- what changed;
- why it changed;
- important implementation decisions;
- how it was tested;
- deployment or migration requirements.

Before merge verify:

```bash
npm run lint
npm test
npm run build
```
