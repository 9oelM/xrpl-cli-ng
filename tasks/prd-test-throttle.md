# PRD: Test Concurrency Throttling & Fallback XRPL Node

## Introduction

Running E2E tests with high concurrency hammers a single XRPL testnet WebSocket node, causing `TimeoutError` on `tx` lookups when many tests submit transactions simultaneously. This PRD adds two mitigations: (1) cap file and test-case concurrency in vitest, and (2) automatically retry using a fallback XRPL node URL when timeout errors occur.

## Goals

- Limit vitest to 3 concurrent test files and 3 concurrent test cases at any time (max 9 simultaneous test cases)
- Automatically fall back to `wss://testnet.xrpl-labs.com/` when the primary node returns a timeout error
- No changes to test logic — purely config and helper changes

## User Stories

### US-001: Cap vitest file and test-case concurrency

**Description:** As a developer, I want vitest to run at most 3 files and 3 test cases concurrently so that the testnet node is not overwhelmed.

**Acceptance Criteria:**
- [ ] `vitest.config.ts` sets `poolOptions.forks.maxForks: 3` to cap concurrent test files at 3
- [ ] `vitest.config.ts` sets `test.maxConcurrency: 3` to cap concurrent `it.concurrent` cases per file at 3
- [ ] At any point in time, at most 9 test cases run simultaneously (3 files × 3 cases)
- [ ] Typecheck passes

### US-002: Fallback XRPL node on timeout errors

**Description:** As a developer, I want the test helper to automatically retry on a fallback XRPL node when the primary node times out, so that transient congestion errors don't fail tests.

**Acceptance Criteria:**
- [ ] `tests/e2e/helpers/fund.ts` exports a second constant `XRPL_WS_FALLBACK = "wss://testnet.xrpl-labs.com/"`
- [ ] `createFunded`, `fundMaster`, and `initTicketPool` in `fund.ts` catch `TimeoutError` (message contains `"Timeout"`) and retry the failed operation once using `XRPL_WS_FALLBACK` with a new `Client` instance
- [ ] If the fallback also fails, rethrow the original error
- [ ] The fallback faucet URL `https://testnet.xrpl-labs.com/accounts` is used as `FAUCET_URL_FALLBACK` and tried if the primary faucet call fails with a network/timeout error
- [ ] No test files need to be changed — the retry logic lives entirely in `fund.ts`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `vitest.config.ts` — add `poolOptions: { forks: { maxForks: 3 } }` and `maxConcurrency: 3` inside the `test` config block
- FR-2: `fund.ts` — add `XRPL_WS_FALLBACK = "wss://testnet.xrpl-labs.com/"` and `FAUCET_URL_FALLBACK = "https://testnet.xrpl-labs.com/accounts"`
- FR-3: Wrap `submitAndWait` / faucet calls in `fund.ts` with a try/catch that checks for `TimeoutError` and retries on the fallback node
- FR-4: Fallback retry must create a fresh `Client` connected to `XRPL_WS_FALLBACK`, not reuse the existing client

## Non-Goals

- No changes to individual test files
- No retry logic for non-timeout errors (e.g. `tecNO_PERMISSION`, `temBAD_FEE`)
- No round-robin or load balancing across nodes — just primary → fallback

## Technical Considerations

- Vitest `poolOptions.forks.maxForks` controls how many worker processes (files) run simultaneously
- `maxConcurrency` controls how many `it.concurrent` tests run simultaneously within a single file
- `TimeoutError` from xrpl.js has message containing `"Timeout for request"` — match on this string
- Fallback client must be connected before use and disconnected after the retry attempt

## Success Metrics

- `TimeoutError` failures in `deposit-preauth.network.test.ts` (and similar) no longer occur when running the full test suite
- Full test suite completes without manual retries
