# eas-preflight

Catches Expo/React Native app bundle size regressions on every pull request, before they ship.

Adds a GitHub Action that measures your JS bundle size on every PR, compares it against the base
branch, and posts a comment if the size changed meaningfully.

## Status

Early v1 build in progress. Core size measurement and comparison logic is not implemented yet
(see `src/bundle-size.ts` and `src/git-diff.ts`).

## Usage (once published)

```yaml
# .github/workflows/eas-preflight.yml
on: pull_request

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/eas-preflight@v1
```

## Local development

```bash
pnpm install
pnpm dev      # run the CLI locally with tsx
pnpm build    # compile to dist/
pnpm lint
pnpm format
```
