# PRD: Fix Vault E2E Test Conventions

## Introduction

The vault E2E test files violate project test conventions: all tests use plain `it()` instead of `it.concurrent`, and wallets/vaults are shared at file scope across test cases. Additionally, `tests/e2e/helpers/devnet.ts` (needed for devnet faucet + ticket funding) does not exist, so the clawback test cannot compile. This PRD fixes all vault network tests and writes the missing clawback test (US-006 completion).

**Prerequisites:** `ralph/vault` branch must be merged into `main` before this branch is created. All vault commands (`vault create/set/deposit/withdraw/delete/clawback`) exist in `src/commands/vault.ts`.

## Goals

- Create `tests/e2e/helpers/devnet.ts` — mirrors `fund.ts` for devnet
- All vault network test files use `it.concurrent` with fresh wallets per test
- Consolidate 5 network test files into 3 (create+set, deposit+withdraw, delete standalone)
- Write `vault.clawback.network.test.ts` correctly
- All files satisfy budget: `TICKET_COUNT × 0.2 + N_wallets × amountXrp ≤ 99`
- Typecheck passes

## XRPL Devnet Facts

- Devnet WS: `wss://s.devnet.rippletest.net:51233`
- Devnet faucet: `https://faucet.devnet.rippletest.net/accounts` (POST, same API as testnet)
- Faucet gives **100 XRP** — same as testnet
- Base reserve: **1 XRP**, owner reserve: **0.2 XRP** per object
- Budget formula: `TICKET_COUNT × 0.2 + N_wallets × amountXrp ≤ 99`
- Tickets work exactly the same as testnet (`Sequence: 0 + TicketSequence`)
- VaultCreate fee is elevated: **0.2 XRP (200000 drops)** — set `Fee: "200000"` explicitly

## User Stories

### US-001: Create devnet funding helper

**Description:** As a developer, I need a `devnet.ts` helper that mirrors `fund.ts` so vault tests can use ticket-based concurrent wallet funding on devnet.

**Acceptance Criteria:**
- [ ] Create `tests/e2e/helpers/devnet.ts`
- [ ] Export `DEVNET_WS = "wss://s.devnet.rippletest.net:51233"`
- [ ] Export `fundMasterDevnet(client): Promise<Wallet>` — calls devnet faucet (`https://faucet.devnet.rippletest.net/accounts`), returns funded wallet (same implementation as `fundMaster` in `fund.ts` but using devnet URL)
- [ ] Export `initTicketPoolDevnet`, `createFundedDevnet`, `fundAddressDevnet` — identical logic to `fund.ts` counterparts but operate on devnet (these can call through to the same internal helpers since ticket logic is network-agnostic; just need separate exports for clarity)
- [ ] `devnet.ts` imports from `xrpl` only (no relative imports that break)
- [ ] Typecheck passes

### US-002: Fix and consolidate vault create + set tests

**Description:** As a developer, I want the create and set test files merged into one concurrent-safe file so tests run faster with no wallet sharing.

**Acceptance Criteria:**
- [ ] Delete `vault.create.network.test.ts` and `vault.set.network.test.ts`
- [ ] Create `vault.create-set.network.test.ts` with all 13 tests (7 create + 6 set)
- [ ] `beforeAll`: `fundMasterDevnet` + `initTicketPoolDevnet(client, master, 15)` (15 ≥ 13 wallets)
- [ ] Every test uses `it.concurrent`
- [ ] Each `it.concurrent` calls `createFundedDevnet(client, master, 1, 3)` for its own fresh wallet — no shared wallets at file scope except `master`
- [ ] Each test creates its own vault inline (using `runCLI` with `--dry-run` or live submission as appropriate)
- [ ] Budget: `15 × 0.2 + 13 × 3 = 3 + 39 = 42 ≤ 99` ✓
- [ ] All original test assertions preserved (no test logic removed)
- [ ] Typecheck passes

### US-003: Fix and consolidate vault deposit + withdraw tests

**Description:** As a developer, I want deposit and withdraw tests merged into one concurrent-safe file where each test is fully self-contained (creates its own wallet + vault + does deposit then optionally withdraw).

**Acceptance Criteria:**
- [ ] Delete `vault.deposit.network.test.ts` and `vault.withdraw.network.test.ts`
- [ ] Create `vault.deposit-withdraw.network.test.ts` with all 11 tests (5 deposit + 6 withdraw)
- [ ] `beforeAll`: `fundMasterDevnet` + `initTicketPoolDevnet(client, master, 13)` (13 ≥ 11 wallets + buffer)
- [ ] Every test uses `it.concurrent`
- [ ] Each `it.concurrent` calls `createFundedDevnet(client, master, 1, 5)` for its own wallet (5 XRP: 1 base + 2 vault share reserve + 2 for deposit amounts and fees)
- [ ] Each test creates its own XRP vault via xrpl.js directly in the test body (not via CLI — setup only), then uses the CLI for the operation under test
- [ ] Withdraw tests: each test does its own deposit first (via xrpl.js `VaultDeposit` tx) then calls the CLI to withdraw — fully self-contained
- [ ] Budget: `13 × 0.2 + 11 × 5 = 2.6 + 55 = 57.6 ≤ 99` ✓
- [ ] All original test assertions preserved
- [ ] Typecheck passes

### US-004: Fix vault delete test + write vault clawback test

**Description:** As a developer, I want the delete test fixed to use `it.concurrent` and the clawback test written correctly so US-006 is fully complete.

**Acceptance Criteria:**
- [ ] Fix `vault.delete.network.test.ts` in place:
  - `beforeAll`: `fundMasterDevnet` + `initTicketPoolDevnet(client, master, 7)` (7 ≥ 5 + buffer)
  - All 5 tests changed to `it.concurrent`
  - Each test creates its own wallet via `createFundedDevnet(client, master, 1, 3)` and its own vault
  - Budget: `7 × 0.2 + 5 × 3 = 1.4 + 15 = 16.4 ≤ 99` ✓
- [ ] Write `vault.clawback.network.test.ts`:
  - `beforeAll` sets up ONE shared `issuer` wallet (via `fundMasterDevnet`) + ONE shared IOU vault — this shared setup is allowed because the issuer/vault are not mutated per-test; only the per-test fresh `holder` is consumed
  - Issuer setup in `beforeAll`: enable `DefaultRipple`, enable `AllowTrustLineClawback`, create IOU vault (VaultCreate with `Fee: "200000"`)
  - Each `it.concurrent` creates its own fresh `holder` via `createFundedDevnet(client, master, 1, 3)`, sets up trust line and receives IOU from issuer, deposits into vault, then calls CLI clawback
  - 6 tests: full clawback (no --amount), partial clawback (--amount), --json, --dry-run, --no-wait, --account/--keystore/--password
  - Budget: `8 × 0.2 + 6 × 3 = 1.6 + 18 = 19.6 ≤ 99` ✓ (issuer funded separately via faucet, 6 holders via tickets)
  - Delete the previously uncommitted/broken `vault.clawback.network.test.ts` and replace with this correct version
  - Typecheck passes
- [ ] `scripts/ralph/prd.json`: mark US-006 as `passes: true`
- [ ] Commit all changes: `feat: [US-006] - vault clawback test and test convention fixes`

## Functional Requirements

- FR-1: `tests/e2e/helpers/devnet.ts` exports `DEVNET_WS`, `fundMasterDevnet`, `initTicketPoolDevnet`, `createFundedDevnet`, `fundAddressDevnet`
- FR-2: All vault network test files use `it.concurrent` exclusively (no plain `it()`)
- FR-3: No wallet shared across test cases except `master` (and `issuer` in clawback `beforeAll` — justified exception)
- FR-4: Each test creates its own vault inline — no shared `vaultId` across tests (except clawback where issuer/vault is shared by design)
- FR-5: Budget formula `TICKET_COUNT × 0.2 + N_wallets × amountXrp ≤ 99` holds for all files
- FR-6: File consolidation: 5 files → 3 (create-set, deposit-withdraw, delete)
- FR-7: VaultCreate in test setup must use `Fee: "200000"` explicitly

## Non-Goals

- No changes to `vault.create.validation.test.ts` (validation tests are correct as-is)
- No changes to vault command implementation in `src/commands/vault.ts`
- No new vault CLI features
- Do not remove any existing test assertions — only restructure for concurrency

## Technical Considerations

- This PRD's branch (`ralph/vault-test-fix`) is created from `main` **after** `ralph/vault` is merged into `main`
- The devnet faucet API is identical to testnet: `POST https://faucet.devnet.rippletest.net/accounts` with `{"destination": "<address>", "userAgent": "xrpl-cli-tests"}`
- For concurrent IOU operations in clawback tests: each holder must set up their own trust line and receive IOU from issuer before depositing. Since issuer's sequence number advances, use tickets for holder-funding payments from issuer. Alternatively, fund holders from `master` (XRP), then holders interact with issuer directly (trust line + IOU payment) — issuer sequence conflicts must be avoided by serializing issuer-side operations or using tickets on issuer too.
- Simplest clawback approach: fund holders from `master` via tickets (concurrent), then serialize issuer→holder IOU issuance in the `it.concurrent` body (acceptable since it's just 2–3 txs per test)

## Success Metrics

- `npm test -- tests/e2e/vault` completes without `tecUNFUNDED_PAYMENT`
- All vault tests run concurrently without state bleed
- Total vault test wall-clock time reduced vs sequential execution
