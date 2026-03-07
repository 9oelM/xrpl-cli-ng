# PRD: Convert E2E Tests to it.concurrent

## Introduction

All independent E2E test cases currently use `it()` which runs serially within a file. Converting them to `it.concurrent()` allows Vitest to run all independent tests within a file in parallel, dramatically reducing per-file runtime. Any test cases that share mutable state (e.g. shared wallets, pre-created sequences) must first be made fully independent — each test case creates its own wallets and objects inline — before being converted.

## Goals

- Convert every independent `it()` in every E2E test file to `it.concurrent()`
- Eliminate all shared mutable state between test cases (shared wallets, pre-created sequences, shared sequences stored as file-level `let` vars)
- Ensure faucet budget stays within 99 XRP per `beforeAll`; split into multiple files if needed
- All tests must continue to pass after conversion

## Background: Key Patterns

### it.concurrent pattern
```typescript
it.concurrent("does X", async () => {
  const [wallet] = await createFunded(client, master, 1, 5)
  // test uses only wallet — no shared mutable state
})
```

### Budget formula (CRITICAL)
- Faucet gives ~100 XRP; base reserve = 1 XRP; available = ~99 XRP
- Owner reserve = 0.2 XRP per object (ticket, escrow, offer, etc.)
- Ticket cost: `TICKET_COUNT × 0.2` XRP
- Wallet cost: `N_wallets × amountXrp` XRP
- **Constraint**: `TICKET_COUNT × 0.2 + total_funded_XRP ≤ 99`
- When tests run concurrently, TICKET_COUNT must cover ALL tests simultaneously
- If budget exceeded: split tests into a second file with its own `beforeAll`/faucet call

### Shared mutable state to eliminate
Any file-level `let` variable assigned in `beforeAll` and consumed in specific `it()` blocks is shared mutable state. Exception: `client` and `master` are read-only after `beforeAll` and are safe to share with `it.concurrent`.

---

## User Stories

### US-001: Convert validation tests, wallet tests, and offline tests

**Description:** As a developer, I want all no-network and filesystem-isolated tests to run concurrently so that these fast test files finish even faster.

**Acceptance Criteria:**
- [ ] All `it(` calls in the following files changed to `it.concurrent(`:
  - `tests/e2e/*/**.validation.test.ts` (all validation files across all commands)
  - `tests/e2e/wallet/*.test.ts` (all wallet files — each test already creates its own `mkdtempSync` temp dir, so they are already isolated)
  - `tests/e2e/channel/channel.sign.test.ts` (offline crypto, no shared state)
- [ ] No `beforeAll` changes needed for these files — isolation is already present
- [ ] All converted tests still pass (`npm test -- --testPathPattern validation`)
- [ ] Typecheck passes
- [ ] Tests pass

### US-002: Convert simple network test files to it.concurrent

**Description:** As a developer, I want small network test files (≤15 tests, already using `createFunded` per test) converted to `it.concurrent` with recalculated ticket budgets.

**Target files:**
- `tests/e2e/payment/payment.network.test.ts` (12 tests)
- `tests/e2e/payment/payment.tokens.test.ts` (5 tests)
- `tests/e2e/clawback/clawback.network.test.ts` (7 tests)
- `tests/e2e/ticket/ticket.network.test.ts` (10 tests)
- `tests/e2e/multisig/multisig.network.test.ts` (12 tests)
- `tests/e2e/account/account.set.network.test.ts` (14 tests)
- `tests/e2e/account/account.keys.test.ts` (10 tests)
- `tests/e2e/account/account.query.test.ts` (24 tests — already 0 shared vars)

**Acceptance Criteria:**
- [ ] For each file: all `it(` → `it.concurrent(`
- [ ] For each file: recalculate `TICKET_COUNT` to equal the total number of wallets funded across ALL tests (since all run concurrently, all tickets are consumed simultaneously)
- [ ] For each file: verify budget: `TICKET_COUNT × 0.2 + sum(all wallet funding) ≤ 99 XRP`; if exceeded, split into two files each with its own `beforeAll`
- [ ] Each test creates its own wallets via `createFunded` inside the test body — no shared wallets
- [ ] All tests still pass
- [ ] Typecheck passes
- [ ] Tests pass

### US-003: Convert medium network test files to it.concurrent

**Description:** As a developer, I want medium-complexity network test files converted to `it.concurrent` with per-test wallet creation and correct budget.

**Target files:**
- `tests/e2e/oracle/oracle.network.test.ts` (18 tests)
- `tests/e2e/deposit-preauth/deposit-preauth.network.test.ts` (14 tests)
- `tests/e2e/nft/nft.core.test.ts` (18 tests)
- `tests/e2e/trust/trust.network.test.ts` (13 tests)
- `tests/e2e/offer/offer.network.test.ts` (16 tests)

**Acceptance Criteria:**
- [ ] For each file: all `it(` → `it.concurrent(`
- [ ] For each file: move any wallet creation that currently happens in `beforeAll` (beyond client+master) into each individual test body using `createFunded`
- [ ] Remove any file-level `let` variables that hold wallets or object IDs (beyond `client` and `master`)
- [ ] Recalculate `TICKET_COUNT` = total wallets across all concurrent tests; verify budget ≤ 99 XRP; split into second file if needed
- [ ] All tests still pass
- [ ] Typecheck passes
- [ ] Tests pass

### US-004: Convert large network test files to it.concurrent

**Description:** As a developer, I want large network test files converted to `it.concurrent` with per-test isolation and budget splits where required.

**Target files:**
- `tests/e2e/channel/channel.network.test.ts` (22 tests)
- `tests/e2e/credential/credential.network.test.ts` (20 tests)
- `tests/e2e/nft/nft.offers.test.ts` (22 tests)
- `tests/e2e/check/check.network.test.ts` (20 tests)

**Acceptance Criteria:**
- [ ] For each file: all `it(` → `it.concurrent(`
- [ ] Move all wallet/object creation from `beforeAll` into individual test bodies
- [ ] Remove all shared sequence/ID variables (e.g. pre-created check IDs, channel IDs stored as `let`)
- [ ] Recalculate `TICKET_COUNT` and verify budget ≤ 99 XRP
- [ ] If budget exceeded: split into two files (e.g. `check.network.test.ts` + `check.network2.test.ts`), each with its own `beforeAll` and faucet call
- [ ] Add a comment above `TICKET_COUNT` showing the budget calculation: `// N tests × W wallets × A XRP + T tickets × 0.2 = X ≤ 99`
- [ ] All tests still pass
- [ ] Typecheck passes
- [ ] Tests pass

### US-005: Refactor and convert escrow.network.test.ts to it.concurrent

**Description:** As a developer, I want `escrow.network.test.ts` fully refactored from shared-wallet/pre-created-sequence pattern to per-test isolation, then converted to `it.concurrent`.

This file is the most complex — it pre-creates 9 escrows in `beforeAll` using shared `sender`/`receiver` wallets, storing sequence numbers as file-level `let` variables. Each test consumes one of these pre-created sequences, making tests deeply interdependent.

**Acceptance Criteria:**
- [ ] Remove all file-level `let` variables except `client` and `master`: delete `sender`, `receiver`, `finishTimeSeq1`, `finishCondSeq`, `finishJsonSeq`, `finishNoWaitSeq`, `finishAccountSeq`, `cancelBasicSeq`, `cancelJsonSeq`, `cancelNoWaitSeq`, `cancelAccountSeq`, `listEscrowSeq`
- [ ] Each `it.concurrent` test creates its own `sender` and `receiver` wallets via `createFunded` inside the test body
- [ ] Each `it.concurrent` test that needs an escrow creates it inline using the CLI (`xrpl escrow create`) and extracts the sequence from the JSON output
- [ ] For time-based finish tests (`FinishAfter` in the future): set `FinishAfter` = now + 15s inside the test body, wait inline with `await new Promise(r => setTimeout(r, 16000))` (each test waits independently — safe because they run in parallel)
- [ ] For condition-based finish tests: create the escrow with condition inline in the test body
- [ ] Recalculate `TICKET_COUNT` = total wallets across all concurrent tests; verify budget ≤ 99 XRP
- [ ] Budget calculation: 23 tests × 2 wallets avg, fund sender at 5 XRP + receiver at 2 XRP = 23 × (5+2) = 161 XRP → exceeds 99; split into `escrow.network.test.ts` (~10 tests) and `escrow.network2.test.ts` (~13 tests), each with its own `beforeAll`
- [ ] Add budget comment showing the calculation above each `TICKET_COUNT`
- [ ] Set per-test timeout to `{ timeout: 90_000 }` for tests that wait for FinishAfter
- [ ] All 23 escrow tests still pass
- [ ] Typecheck passes
- [ ] Tests pass

---

## Functional Requirements

- FR-1: Every `it(` in every E2E test file must become `it.concurrent(` — no plain `it(` left in any test file (except inside `describe` blocks that are themselves sequential for a reason, which must be commented)
- FR-2: No file-level mutable `let` variable (other than `client` and `master`) may be assigned in `beforeAll` and read in `it.concurrent` — this is a race condition waiting to happen
- FR-3: Each `it.concurrent` test must be fully self-contained: it creates all wallets, objects, and state it needs, and cleans up after itself if needed
- FR-4: `TICKET_COUNT` in each network test file must be recalculated to reflect all concurrent tests running simultaneously; add a budget comment: `// N tests × W wallets × A XRP + T × 0.2 = X ≤ 99 ✓`
- FR-5: When total budget exceeds 99 XRP, split into multiple files — each file gets its own `beforeAll` with a fresh faucet call
- FR-6: Wallet tests already use `mkdtempSync` per test — they just need `it.concurrent`; do not change their filesystem isolation pattern
- FR-7: Set `{ timeout: 90_000 }` on any `it.concurrent` that does network setup (wallet creation + XRPL tx) inside the test body; set `{ timeout: 30_000 }` for tests that only do CLI calls with pre-funded wallets

## Non-Goals

- Do not change the `beforeAll` faucet/ticket-pool pattern — only the per-test wallet creation pattern changes
- Do not convert `describe` blocks to `describe.concurrent` — only individual `it` calls
- Do not change validation test logic — only add `concurrent` to `it`
- Do not add new test cases — only convert existing ones

## Technical Considerations

- Vitest `it.concurrent` within a `describe` block: all concurrent `it` calls in the same describe run in parallel
- `client` and `master` are safe to share as read-only; `createFunded` is safe to call concurrently (uses tickets, JS single-threaded ticket pool)
- For tests that previously relied on a pre-created object's sequence/ID: replace with inline creation using `runCLI([..., "--json"])` and parse the output
- Time-based escrow tests waiting concurrently: each test independently waits for its own escrow's `FinishAfter` — they don't block each other
- `channel.sign.test.ts` is pure crypto (no network) — trivially safe for `it.concurrent`

## Success Metrics

- All E2E test files use `it.concurrent` for every test case
- No shared mutable state between concurrent tests
- All tests pass
- Per-file runtime measurably reduced (concurrent tests in a file complete in the time of the slowest single test, not sum of all tests)

## Open Questions

- Are there any `it()` calls that are intentionally sequential within a file (e.g. test B depends on side effect of test A)? If found, they must be made independent before converting — do not skip this step.
