# eas-preflight

Catches Expo/React Native app bundle size regressions on every pull request, before they ship.

Adds a GitHub Action that measures your JS bundle size on every PR, compares it against the base
branch, and posts a comment when the size changes meaningfully. Optionally fails the check if the
increase crosses a threshold you configure.

```
### App size check

+892341 bytes (+12.4%)

Base: 7189230 bytes
Head: 8081571 bytes

❌ Exceeds the configured 10% threshold
```

## Why

Dependency and config drift already have good tooling (`expo-doctor`, EAS's own build checks).
App size doesn't: it's easy for a PR to quietly pull in a large asset, font, or library and have
nobody notice until users complain about install size. eas-preflight turns that into a visible,
reviewable diff on every PR, the same way a test coverage bot would.

v1 measures JS bundle size only (via `expo export --platform ios|android`), as a proxy for what
actually ships in the binary. It deliberately does not check dependency compatibility or
config/env drift, both judged out of scope for v1 (see [CLAUDE.md](./CLAUDE.md)).

## Usage

```yaml
# .github/workflows/eas-preflight.yml
name: EAS Preflight

on:
  pull_request:

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # needed so the base branch is available to diff against

      - uses: CodeEnthusiast09/eas-preflight@main
        with:
          max-increase-percent: '10'
```

### Inputs

| Input                   | Required | Default                              | Description                                                                                    |
| ------------------------ | -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `github-token`           | No       | `${{ github.token }}`                 | Token used to post the PR comment.                                                              |
| `base-ref`                | No       | `${{ github.event.pull_request.base.ref }}` | Git ref to compare bundle size against.                                                   |
| `working-directory`       | No       | `.`                                    | Directory containing the Expo project (supports monorepos, e.g. `apps/mobile`).                |
| `max-increase-percent`    | No       | unset                                  | Fail the check if bundle size increases by more than this percent. Unset means comment-only.   |
| `ignore-patterns`         | No       | unset                                  | Comma or newline separated glob patterns (relative to the exported bundle, e.g. `assets/**`) to exclude from the size comparison. |

## Requirements

- The workflow must check out with `fetch-depth: 0` (or otherwise have the base branch's history
  available), since eas-preflight diffs against the base ref via a git worktree.
- `node_modules` must already be installed before this action runs (it reuses the existing
  install rather than running its own).

## Local development

```bash
pnpm install
pnpm dev      # run the CLI locally with tsx
pnpm build    # compile to dist/
pnpm lint
pnpm format
```

## License

MIT
