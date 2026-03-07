# PRD: E2E Test Consolidation

## Introduction

E2E tests are slow because nearly every test file makes its own faucet request. The faucet is the bottleneck — it takes 2–5 seconds per call, and with 50+ network test files running in parallel they all hit the faucet simultaneously. The fix: consolidate tests into fewer, larger files so that ~5–6 tests share a single `beforeAll` that funds one master wallet from the faucet, then distributes 5–10 XRP to each sub-wallet needed by that file's tests.

## Goals

- Create a shared funding helper so all test files use a consistent pattern
- Consolidate network test files per command group: aim for ~5–6 tests per file, one faucet call per file
- Each faucet-funded master distributes 5–10 XRP to sub-wallets via fast internal payments
- Validation test files (no network) remain unchanged
- Total faucet calls across the suite drops from ~50+ to ~15–20
- All existing tests continue to pass after consolidation

## User Stories

### US-001: Create shared test funding helper

**Description:** As a test author, I want a shared utility to fund wallets efficiently so I don't have to call the faucet multiple times per test file.

**Acceptance Criteria:**
- [ ] Create `tests/e2e/helpers/fund.ts` with:
  - `fundMaster(client: Client): Promise<Wallet>` — calls `client.fundWallet()` once; returns faucet-funded wallet (~1000 XRP)
  - `initTicketPool(client: Client, master: Wallet, count: number): Promise<void>` — submits `TicketCreate` with `TicketCount: count`; extracts `TicketSequence` values from `meta.AffectedNodes` where `LedgerEntryType === "Ticket"`; stores in a module-level array; resets the pool index to 0
  - `nextTicket(): number` — synchronous; returns next ticket sequence from the pool; throws if pool is exhausted
  - `generateWallets(count: number): Wallet[]` — creates `count` fresh wallets via `Wallet.generate()` without funding
  - `createFunded(client: Client, master: Wallet, count: number, amountXrp?: number): Promise<Wallet[]>` — generates wallets; submits one Payment per wallet concurrently using `Sequence: 0, TicketSequence: nextTicket()` (no sequence conflicts); returns funded wallets
- [ ] Export `XRPL_WS` constant (testnet WebSocket URL) from the helper
- [ ] Document the canonical `beforeAll` pattern in a comment at top of `fund.ts`:
  ```typescript
  // beforeAll: fundMaster → initTicketPool(N) where N = total wallets needed across all tests
  // each it(): const [w1, w2] = await createFunded(client, master, 2, 10)
  // Payments use Sequence:0 + TicketSequence so all fund concurrently without conflicts
  ```
- [ ] RULE: each individual `it()` block calls `createFunded` to get its own fresh wallets — wallets are NEVER shared across test cases
- [ ] Typecheck passes

### US-002: Consolidate payment + trust + offer tests

**Description:** As a developer, I want payment, trust, and offer tests consolidated so each group uses one faucet call.

**Acceptance Criteria:**
- [ ] **payment**: Merge `payment.core.test.ts`, `payment.iou.test.ts`, `payment.mpt.test.ts`, `payment.paths.test.ts` into:
  - `payment.network.test.ts` — XRP payments, --json, --dry-run, --no-wait (≤6 tests, 1 faucet call)
  - `payment.tokens.test.ts` — IOU payment, MPT payment, path payment (≤6 tests, 1 faucet call)
  - Delete the 4 original files
- [ ] **trust**: Merge `trust.core.test.ts` and `trust.issuer.test.ts` into:
  - `trust.network.test.ts` — all 13 tests, 1 faucet call, master funds issuer + holder + extra wallets with 10 XRP each
  - Delete the 2 original files
- [ ] **offer**: Merge `offer.core.test.ts` and `offer.flags.test.ts` into:
  - `offer.network.test.ts` — all 16 tests, 1 faucet call
  - Delete the 2 original files
- [ ] Each consolidated file uses `fundMaster` + `createFunded` from `tests/e2e/helpers/fund.ts`
- [ ] All tests pass
- [ ] Typecheck passes

### US-003: Consolidate channel + escrow tests

**Description:** As a developer, I want channel and escrow tests consolidated so each group uses one faucet call.

**Acceptance Criteria:**
- [ ] **channel**: Merge `channel.create.test.ts`, `channel.fund.test.ts`, `channel.list.test.ts`, `channel.claim.test.ts` into:
  - `channel.network.test.ts` — up to 6 tests, 1 faucet call (sender + receiver funded with 20 XRP each for channel operations)
  - `channel.claim.test.ts` can remain separate if >6 tests, but must use `fundMaster` pattern
  - `channel.sign.test.ts` has no faucet calls — leave unchanged
  - Delete merged original files
- [ ] **escrow**: Merge `escrow.create.test.ts`, `escrow.finish.test.ts`, `escrow.cancel.test.ts`, `escrow.list.test.ts` into:
  - `escrow.network.test.ts` — all tests, 1 faucet call, master funds participants with 20 XRP each (escrows lock funds)
  - Delete the 4 original files
- [ ] Each consolidated file uses `fundMaster` + `createFunded` from `tests/e2e/helpers/fund.ts`
- [ ] All tests pass
- [ ] Typecheck passes

### US-004: Consolidate check + clawback + multisig tests

**Description:** As a developer, I want check, clawback, and multisig tests consolidated so each group uses one faucet call.

**Acceptance Criteria:**
- [ ] **check**: Merge `check.create.test.ts`, `check.cash.test.ts`, `check.cancel.test.ts`, `check.list.test.ts` into:
  - `check.network.test.ts` — all 20 tests, 1 faucet call
  - Delete the 4 original files
- [ ] **clawback**: Merge `clawback.iou.test.ts` and `clawback.mpt.test.ts` into:
  - `clawback.network.test.ts` — all 7 tests, 1 faucet call
  - Delete the 2 original files
- [ ] **multisig**: Merge `multisig.set.test.ts`, `multisig.delete.test.ts`, `multisig.list.test.ts` into:
  - `multisig.network.test.ts` — all 14 tests, 1 faucet call, master funds signer wallets with 10 XRP each
  - Delete the 3 original files
- [ ] Each consolidated file uses `fundMaster` + `createFunded` from `tests/e2e/helpers/fund.ts`
- [ ] All tests pass
- [ ] Typecheck passes

### US-005: Consolidate credential + oracle + ticket + deposit-preauth tests

**Description:** As a developer, I want credential, oracle, ticket, and deposit-preauth tests consolidated so each group uses one faucet call.

**Acceptance Criteria:**
- [ ] **credential**: Merge `credential.create.test.ts`, `credential.accept.test.ts`, `credential.delete.test.ts`, `credential.list.test.ts` into:
  - `credential.network.test.ts` — all 20 tests, 1 faucet call, master funds issuer + subject wallets
  - Delete the 4 original files
- [ ] **oracle**: Merge `oracle.set.test.ts`, `oracle.get.test.ts`, `oracle.delete.test.ts` into:
  - `oracle.network.test.ts` — all 18 tests, 1 faucet call
  - Delete the 3 original files
- [ ] **ticket**: Merge `ticket.create.test.ts` and `ticket.list.test.ts` into:
  - `ticket.network.test.ts` — all 10 tests, 1 faucet call
  - Delete the 2 original files
- [ ] **deposit-preauth**: Merge `deposit-preauth.set.test.ts` and `deposit-preauth.list.test.ts` into:
  - `deposit-preauth.network.test.ts` — all 14 tests, 1 faucet call
  - Delete the 2 original files
- [ ] Each consolidated file uses `fundMaster` + `createFunded` from `tests/e2e/helpers/fund.ts`
- [ ] All tests pass
- [ ] Typecheck passes

### US-006: Consolidate nft + account tests

**Description:** As a developer, I want nft and account tests consolidated so each group uses one faucet call per file.

**Acceptance Criteria:**
- [ ] **nft**: Merge `nft.mint.test.ts`, `nft.burn.test.ts`, `nft.modify.test.ts` into:
  - `nft.core.test.ts` — all mint/burn/modify tests, 1 faucet call
  - Merge `nft.offer.create.test.ts`, `nft.offer.cancel.test.ts`, `nft.offer.accept.test.ts`, `nft.offer.list.test.ts` into:
  - `nft.offers.test.ts` — all NFT offer tests, 1 faucet call
  - Delete the 7 original files
- [ ] **account**: Merge `account.set.fields.test.ts`, `account.set.flags.test.ts`, `account.set.clawback.test.ts` into:
  - `account.set.test.ts` — all account-set tests, 1 faucet call (replacing existing `set.test.ts` if redundant)
  - Merge `account.set-regular-key.test.ts` and `account.delete.test.ts` into:
  - `account.keys.test.ts` — regular key + delete tests, 1 faucet call
  - Review remaining account test files (`info.test.ts`, `balance.test.ts`, `transactions.test.ts`, `trust-lines.test.ts`, `offers.test.ts`, `channels.test.ts`, `nfts.test.ts`) — consolidate into 1–2 query test files if they share a faucet call
  - Delete merged original files
- [ ] Each consolidated file uses `fundMaster` + `createFunded` from `tests/e2e/helpers/fund.ts`
- [ ] All tests pass
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `tests/e2e/helpers/fund.ts` exports `fundMaster`, `initTicketPool`, `nextTicket`, `generateWallets`, `createFunded`, `XRPL_WS`
- FR-2: `fundMaster` calls `client.fundWallet()` once and returns the wallet
- FR-3: `initTicketPool` submits `TicketCreate` with `TicketCount: count`; parses `meta.AffectedNodes` to extract all `TicketSequence` values from `CreatedNode` entries where `LedgerEntryType === "Ticket"`; stores sorted array module-level
- FR-4: `createFunded` generates wallets, then submits all funding payments concurrently via `Promise.all`, each payment using `Sequence: 0, TicketSequence: nextTicket()`; `nextTicket()` is synchronous so it safely assigns unique tickets before any awaits
- FR-5: All consolidated test files import from `tests/e2e/helpers/fund.ts`; no test file calls `client.fundWallet()` more than once
- FR-6: Validation test files (`*.validation.test.ts`) are not modified
- FR-7: Each consolidated network test file has exactly one `beforeAll` that contains exactly one faucet call
- FR-8: **NEVER share wallets across test cases.** Each individual `it()` block creates its own fresh wallets via `createFunded`. Wallets are never declared at file scope and reused across multiple tests. This prevents state bleed between tests.

## Non-Goals

- No changes to validation test files
- No changes to test assertions or test logic — only file consolidation and funding pattern
- No changes to `wallet/` test files (they test wallet management commands, not XRPL transactions)
- No changes to `channel.sign.test.ts` (already has no faucet calls)

## Technical Considerations

- **10 XRP minimum**: Most operations (trust set, offer, payment, check, escrow) need far less than 10 XRP in fees; 10 XRP per sub-wallet is safe. Escrow operations lock funds — use 20 XRP for escrow participants
- **Wallet generation**: Use `Wallet.generate()` to create sub-wallets without calling the faucet; fund them via internal payment from master
- **Channel operations**: Payment channels require larger balances locked in the channel; use 20 XRP for channel sender wallets
- **beforeAll timeout**: Increase to 60000ms (60s) for files with many wallets to fund
- **Import path**: `import { fundMaster, createFunded, XRPL_WS } from '../helpers/fund.js'`

## Success Metrics

- Total faucet calls across the E2E suite drops from ~50 to ~15–20
- Full E2E suite runtime decreases noticeably
- No test regressions — all tests that were passing continue to pass
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
