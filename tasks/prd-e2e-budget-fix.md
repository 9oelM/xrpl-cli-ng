# PRD: Fix E2E Test Wallet Funding Amounts

## Introduction

E2E tests are failing with `tecUNFUNDED_PAYMENT` because wallet funding amounts were written assuming a 1000 XRP faucet. The actual testnet faucet gives **100 XRP**. Combined with the correct reserve values (base: 1 XRP, owner: 0.2 XRP per object), many test files exceed the available budget and the master wallet runs dry after the first test.

This PRD fixes all E2E network test files to use amounts that fit within the 100 XRP faucet budget.

## XRPL Testnet Facts (Ground Truth)

- **Faucet amount: 100 XRP** exactly
- **Base reserve: 1 XRP** per account
- **Owner reserve: 0.2 XRP** per ledger object (ticket, offer, trust line, escrow, channel, NFT offer, etc.)
- Master available after faucet = `100 - 1 - (TICKET_COUNT × 0.2)` XRP
- Net cost per funded wallet = `amountXrp - 0.2` XRP (ticket reserve freed on use)
- **Budget constraint**: `TICKET_COUNT × 0.2 + N_wallets × amountXrp ≤ 99`

## Safe Per-Wallet Amounts

- **General tests** (payments, trust lines, offers, credentials, etc.): **3 XRP** (1 base + 2 for ops)
- **Tests that lock XRP** (escrow, payment channels): **20 XRP** for the locking account; other wallets still 3 XRP
- **Mnemonic/keystore wallets**: same as above — 3 XRP is enough

## Goals

- All E2E network test files pass their wallet funding step without `tecUNFUNDED_PAYMENT`
- All files satisfy the budget constraint `TICKET_COUNT × 0.2 + N_wallets × amountXrp ≤ 99`
- `fund.ts` default changed to a safe value

## User Stories

### US-001: Fix fund.ts default and high-amount test files

**Description:** As a developer, I want the shared funding helper and the test files that hardcode 25–30 XRP per wallet to be fixed so tests don't run out of funds.

**Acceptance Criteria:**
- [ ] `tests/e2e/helpers/fund.ts`: change default `amountXrp = 10` → `amountXrp = 3`
- [ ] `tests/e2e/payment/payment.network.test.ts`:
  - Change all `createFunded(client, master, 2, 25)` → `createFunded(client, master, 2, 3)`
  - Change mnemonic test `createFunded(client, master, 1, 15)` → `createFunded(client, master, 1, 3)`
  - Change mnemonic test `fundAddress(client, master, mnemonicWallet.address, 20)` → `fundAddress(client, master, mnemonicWallet.address, 3)`
  - Verify budget: `TICKET_COUNT × 0.2 + N_wallets × 3 ≤ 99`
- [ ] `tests/e2e/payment/payment.tokens.test.ts`:
  - Change all `createFunded(client, master, 2, 25)` → `createFunded(client, master, 2, 3)`
  - Verify budget passes
- [ ] `tests/e2e/trust/trust.network.test.ts`:
  - Change all `createFunded(..., 25)` → `createFunded(..., 3)`
  - Change all `fundAddress(..., 20)` → `fundAddress(..., 3)`
  - Verify budget: `30 × 0.2 + N_wallets × 3 ≤ 99`
- [ ] `tests/e2e/offer/offer.network.test.ts`:
  - Change `createFunded(client, master, 2, 30)` in `setupMakerIssuer` → `createFunded(client, master, 2, 3)`
  - Change `createFunded(client, master, 1, 25)` → `createFunded(client, master, 1, 3)`
  - Change `fundAddress(client, master, mnemonicWallet.address, 25)` → `fundAddress(client, master, mnemonicWallet.address, 3)`
  - Offers for 10 XRP: a wallet with 3 XRP (2 available) can place an offer for any amount — XRPL does not require the maker to hold the full TakerGets at offer creation time; leave offer amounts as-is
  - Verify budget: `TICKET_COUNT × 0.2 + N_wallets × 3 ≤ 99`; reduce TICKET_COUNT if needed
- [ ] `tests/e2e/escrow/escrow.network.test.ts`:
  - Change `createFunded(client, master, 2, 30)` → `createFunded(client, master, 2, 20)` — escrow tests lock XRP so 20 XRP per wallet is needed (1 base + escrow amounts + fees)
  - Verify budget: `5 × 0.2 + 2 × 20 = 41 ≤ 99` ✓
- [ ] Typecheck passes

### US-002: Audit and fix remaining network test files

**Description:** As a developer, I want all remaining network test files audited so no file silently exceeds the 100 XRP budget when run in isolation.

**Acceptance Criteria:**
- [ ] For each file below, verify `TICKET_COUNT × 0.2 + N_wallets × FUND_AMOUNT ≤ 99`. Fix TICKET_COUNT or FUND_AMOUNT if over budget:
  - `tests/e2e/account/account.keys.test.ts` (FUND_AMOUNT=2)
  - `tests/e2e/account/account.set.network.test.ts` (FUND_AMOUNT=2, TICKET_COUNT=15)
  - `tests/e2e/account/account.query.test.ts`
  - `tests/e2e/channel/channel.network.test.ts` (FUND_AMOUNT=2) — channel sender needs enough to fund the channel; if any test funds a channel with >1 XRP, increase that wallet's amount to `channel_amount + 2`
  - `tests/e2e/check/check.network.test.ts` (FUND_AMOUNT=2)
  - `tests/e2e/clawback/clawback.network.test.ts` (FUND_AMOUNT=5)
  - `tests/e2e/credential/credential.network.test.ts` (FUND_AMOUNT=2)
  - `tests/e2e/deposit-preauth/deposit-preauth.network.test.ts` (FUND_AMOUNT=2, TICKET_COUNT=30)
  - `tests/e2e/multisig/multisig.network.test.ts` (FUND_AMOUNT=3)
  - `tests/e2e/nft/nft.core.test.ts` (FUND_AMOUNT=3)
  - `tests/e2e/nft/nft.offers.test.ts` (FUND_AMOUNT=2)
  - `tests/e2e/oracle/oracle.network.test.ts` (FUND_AMOUNT=4, TICKET_COUNT=20)
  - `tests/e2e/ticket/ticket.network.test.ts` (FUND_AMOUNT=5)
- [ ] For any file over budget: reduce FUND_AMOUNT or TICKET_COUNT to satisfy the constraint
- [ ] For any file with TICKET_COUNT higher than the actual number of wallets funded: reduce TICKET_COUNT to match (excess tickets waste 0.2 XRP each and reduce budget headroom)
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `fund.ts` default `amountXrp` = 3 (covers 1 XRP base reserve + 2 XRP for fees and operations)
- FR-2: Budget formula `TICKET_COUNT × 0.2 + N_wallets × amountXrp ≤ 99` must hold for every network test file
- FR-3: Escrow and channel tests that lock XRP may use higher amounts (20 XRP) for the locking wallet only — all other wallets use 3 XRP
- FR-4: Do NOT change test assertions or test logic — only change funding amounts and ticket counts
- FR-5: Do NOT change `--taker-gets`/`--taker-pays` values in offer tests — XRPL allows placing offers for amounts greater than current balance
- FR-6: After all changes, run `npm run typecheck` and verify it passes

## Non-Goals

- No changes to validation test files (`*.validation.test.ts`)
- No changes to test logic, assertions, or what is being tested
- No changes to `channel.sign.test.ts` (no faucet calls)
- No splitting or merging of test files

## Technical Considerations

- When calculating N_wallets, count every `createFunded` call across all `it()` blocks (multiply count argument by number of calls), plus every `fundAddress` call
- TICKET_COUNT must be ≥ N_wallets (one ticket per wallet funding)
- The escrow test file shares wallets at file scope across tests (sequential dependency) — this is acceptable for escrow; just fix the XRP amount

## Success Metrics

- `npm test` runs payment, trust, offer, and escrow tests to completion without `tecUNFUNDED_PAYMENT`
- All tests that were passing before continue to pass
- Typecheck passes
