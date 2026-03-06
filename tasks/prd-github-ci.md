# PRD: GitHub Actions CI

## Introduction

The repository has no CI configured. Every push and every PR can silently break typechecks or tests. This PRD adds two GitHub Actions workflows — one for typechecking and one for running E2E tests — so failures are caught automatically before code is merged.

## Goals

- Typecheck runs on every push to any branch and on every PR (fast feedback, no Node testnet traffic)
- Full E2E test suite runs on every push to any branch and on every PR
- Node installation is consistent so `tsx` and `tsc` are on PATH when tests spawn child processes
- Both workflows are independently readable and independently re-runnable
- E2E tests correctly find `node`/`tsx` regardless of how Node is installed on the runner

## User Stories

### US-001: Typecheck workflow

**Description:** As a developer, I want a CI workflow that runs `npm run typecheck` on every push and PR so TypeScript errors are caught immediately without running expensive network tests.

**Acceptance Criteria:**
- [ ] Create `.github/workflows/typecheck.yml`
- [ ] Triggers on `push` (all branches) and `pull_request` (all branches)
- [ ] Uses `actions/checkout@v4`
- [ ] Sets up Node 22 via `actions/setup-node@v4` with `node-version: '22'` and `cache: 'npm'`
- [ ] Runs `npm ci` to install dependencies
- [ ] Runs `npm run typecheck` as the check step
- [ ] Job named `typecheck`, workflow named `Typecheck`
- [ ] Workflow file is valid YAML and passes `actionlint` (or equivalent check)

### US-002: E2E test workflow

**Description:** As a developer, I want a CI workflow that runs the full test suite on every push and PR so regressions in command behaviour are caught before merge.

**Acceptance Criteria:**
- [ ] Create `.github/workflows/test.yml`
- [ ] Triggers on `push` (all branches) and `pull_request` (all branches)
- [ ] Uses `actions/checkout@v4`
- [ ] Sets up Node 22 via `actions/setup-node@v4` with `node-version: '22'` and `cache: 'npm'`
- [ ] Runs `npm ci` to install dependencies
- [ ] The `PATH` environment variable passed to the test runner includes the directory where `setup-node` installs the `node` binary, so that `spawnSync` calls inside tests can find `node` and `tsx`
  - Use `$(dirname $(which node))` evaluated at run time, or rely on `setup-node` adding Node to PATH before vitest runs (vitest inherits the runner's PATH, which `setup-node` has already augmented — so `process.env.PATH` inside vitest includes the correct Node bin directory)
- [ ] Runs `npm test` (i.e., `vitest run`)
- [ ] `testTimeout` and `hookTimeout` for faucet-heavy tests are long enough (current vitest config uses 30 000 ms; E2E faucet retries can take up to ~5 minutes total — set `test:e2e` timeout in workflow to at least 15 minutes via `timeout-minutes: 15` on the job)
- [ ] Job named `test`, workflow named `Test`
- [ ] Workflow file is valid YAML

### US-003: Fix hardcoded fnm PATH in test files

**Description:** As a developer, I want E2E test files to resolve the Node binary directory at runtime rather than using the hardcoded devcontainer path `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin`, so tests pass both locally (fnm) and in CI (setup-node).

**Acceptance Criteria:**
- [ ] Create (or update) `tests/helpers/cli.ts` (or equivalent shared helper) that exports a `runCLI` function with `PATH` set to `path.dirname(process.execPath) + path.delimiter + (process.env.PATH ?? "")` — this resolves to the directory of whichever `node` binary is currently running, which works for both fnm and `setup-node` environments
- [ ] Replace every hardcoded `E2E_PATH` / `fnm/node-versions/v22.22.0/installation/bin` string across all test files with the runtime-resolved path from the shared helper (or inline the same `process.execPath` pattern)
- [ ] After the change, `npm test` still passes locally
- [ ] Typecheck passes
- [ ] Tests pass

## Functional Requirements

- FR-1: Both workflows trigger on `on: [push, pull_request]` with no branch filter (all branches)
- FR-2: `actions/setup-node@v4` with `node-version: '22'` and `cache: 'npm'` is used in both workflows
- FR-3: E2E test job sets `timeout-minutes: 15` to allow for faucet retry backoff
- FR-4: The `PATH` inside spawned CLI child processes includes the directory of the currently-running `node` binary (`path.dirname(process.execPath)`)
- FR-5: No hardcoded `/home/vscode/.fnm/...` path strings remain in test files after US-003

## Non-Goals

- Matrix builds across multiple Node versions (Node 22 only for now)
- Separate staging/production deployment workflows
- Code coverage reporting or artifact upload
- Caching the built `dist/` across workflow runs
- Self-hosted runners

## Technical Considerations

- `process.execPath` is the absolute path to the current `node` binary (e.g., `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin/node` locally, `/opt/hostedtoolcache/node/22.x.x/x64/bin/node` in CI). `path.dirname(process.execPath)` gives the bin directory in all environments.
- `spawnSync` in tests inherits `process.env` but many tests override `PATH` explicitly with the hardcoded fnm path — those overrides must be updated to use `process.execPath`.
- `npm ci` is preferred over `npm install` in CI for deterministic, locked installs.
- Vitest's default `testTimeout` (30 000 ms) is fine for individual tests; the job-level `timeout-minutes: 15` guards against the entire suite hanging.

## Success Metrics

- Green CI badge on every passing commit
- Typecheck and test jobs complete independently (one failure doesn't block the other)
- No test failures due to `node: command not found` in CI

## Open Questions

- Should the E2E workflow run on `push` to all branches or only `main` + PR? (Current spec: all branches — change to main-only if faucet load becomes a concern.)
- Should failed faucet retries be surfaced as skipped tests rather than suite failures? (Out of scope for this PRD — addressed by the retry logic already in `fundFromFaucet`.)
