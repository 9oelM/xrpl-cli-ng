# PRD: Fix Failing Tests (DID registration + credential collision)

## Introduction

Two root causes account for all 29 currently failing CI tests:

1. **DID command not registered** — `ralph/did` implemented `src/commands/did.ts` but never added `didCommand` to `src/commands/index.ts` or `src/index.ts`, so `xrpl did` is an unknown command.
2. **Credential delete concurrent collision** — concurrent tests share the same hardcoded `CredentialType` hex string; after one test deletes its credential, another test's credential with the same type is still on-ledger, causing the post-delete assertion to find a stale entry and fail.

## Goals

- All 29 failing tests pass
- No existing passing tests regress
- Typecheck continues to pass

## User Stories

### US-001: Register DID command in CLI entry points

**Description:** As a developer, I want `xrpl did` to be a valid CLI command so that all DID tests can run.

**Acceptance Criteria:**
- [ ] `src/commands/index.ts` exports `didCommand` from `"./did.js"`
- [ ] `src/index.ts` calls `program.addCommand(didCommand)`
- [ ] Running `node dist/index.js did --help` (or equivalent via tsx) exits 0 and prints DID subcommand help
- [ ] All 28 previously-failing DID tests now pass (run `npx vitest run tests/e2e/did` to verify)
- [ ] Typecheck passes

### US-002: Fix credential delete test concurrent collision

**Description:** As a developer, I want each concurrent credential test to use a unique `CredentialType` so that post-delete assertions are not polluted by other in-flight tests.

**Acceptance Criteria:**
- [ ] Locate the credential E2E test file (`tests/e2e/credential/`) and identify every `it.concurrent` block that creates a credential
- [ ] Each `it.concurrent` block uses a distinct `CredentialType` value (e.g. append a short unique suffix per test such as `_01`, `_02`, etc., encoded as hex)
- [ ] The `credential delete > issuer deletes a credential they created` test verifies deletion by checking for its own specific `CredentialType`, not any credential
- [ ] The previously-failing credential delete test now passes (run `npx vitest run tests/e2e/credential` to verify)
- [ ] No other credential tests regress
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `didCommand` must appear in both `src/commands/index.ts` (export) and `src/index.ts` (addCommand), following the same pattern as every other command (e.g. `mptokenCommand`, `permissionedDomainCommand`)
- FR-2: In the credential test file, each concurrent test that creates a credential must use a `CredentialType` string that is unique within the file — use distinct ASCII strings converted to hex, one per test block
- FR-3: Do not change any credential test logic beyond the `CredentialType` values and any assertion that filters by `CredentialType`

## Non-Goals

- No changes to `src/commands/did.ts` implementation
- No changes to unrelated test files
- No refactoring of the credential command implementation

## Technical Considerations

- DID fix is a 2-line change; do not touch did.ts itself
- For unique credential types: pick short ASCII strings like `"KYC_01"`, `"KYC_02"`, etc., then hex-encode them (e.g. `Buffer.from("KYC_01").toString("hex").toUpperCase()`); confirm the exact format used by the existing tests and match it
- Run each test suite in isolation to confirm fixes before declaring done

## Success Metrics

- `npx vitest run tests/e2e/did` — 0 failures
- `npx vitest run tests/e2e/credential` — 0 failures
- `npx tsc --noEmit` — 0 errors
