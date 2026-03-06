# PRD: Offer Command (DEX)

## Introduction

Add `xrpl offer create` and `xrpl offer cancel` commands that interact with the XRPL decentralized exchange (DEX). Users can place currency-exchange offers (OfferCreate) and remove them (OfferCancel). E2E tests must verify real on-chain state — not just `tesSUCCESS` — by querying `account_offers` and `book_offers` after each transaction.

## Goals

- Implement `offer create` with all standard flags and fields
- Implement `offer cancel` by offer sequence number
- E2E tests verify on-chain state: offer appears in `account_offers` and `book_offers` after create; offer is absent after cancel
- Follow existing CLI patterns (`trust set`, `payment`)
- All options covered by at least one test

## User Stories

### US-001: Core `offer create` and `offer cancel` commands

**Description:** As a CLI user, I want to create and cancel DEX offers on XRPL testnet so that I can exchange currencies without writing scripts.

**Acceptance Criteria:**
- [ ] `xrpl offer create --taker-pays <amount> --taker-gets <amount> --seed <seed>` submits an OfferCreate transaction and prints the offer sequence number on success
- [ ] Amount format supports XRP (e.g. `1.5`) and IOU (e.g. `10/USD/rIssuer...`)
- [ ] `xrpl offer cancel --sequence <seq> --seed <seed>` submits an OfferCancel and exits 0
- [ ] `--json` flag outputs `{ hash, result, offerSequence }` for create; `{ hash, result }` for cancel
- [ ] `--dry-run` outputs serialized tx JSON without submitting
- [ ] `--no-wait` flag submits without waiting for validation
- [ ] Commands registered in `src/commands/index.ts` and `src/index.ts`
- [ ] Typecheck passes
- [ ] Tests pass

### US-002: OfferCreate flags and optional fields

**Description:** As a CLI user, I want to use all OfferCreate flags so that I have full control over offer behavior (passive, sell, immediate-or-cancel, fill-or-kill, expiration, replace).

**Acceptance Criteria:**
- [ ] `--sell` sets `tfSell` flag (offer is a sell offer)
- [ ] `--passive` sets `tfPassive` flag (offer does not consume matching offers)
- [ ] `--immediate-or-cancel` sets `tfImmediateOrCancel` flag (fill what's available, cancel remainder)
- [ ] `--fill-or-kill` sets `tfFillOrKill` flag (fill completely or cancel)
- [ ] `--expiration <iso-or-unix>` sets `Expiration` field (accepts ISO 8601 string or XRPL epoch integer)
- [ ] `--replace <sequence>` sets `OfferSequence` field (cancels existing offer and creates new one atomically)
- [ ] Mutually exclusive: `--immediate-or-cancel` and `--fill-or-kill` cannot be used together (exit 1 with error message)
- [ ] Typecheck passes
- [ ] Tests pass

### US-003: E2E tests with on-chain state verification

**Description:** As a developer, I want E2E tests that verify actual ledger state after each offer operation so that we know the DEX integration is correct.

**Acceptance Criteria:**
- [ ] Test file `tests/e2e/offer/offer.validation.test.ts`: no-network tests for invalid args (missing --taker-pays, missing --taker-gets, missing key material, --immediate-or-cancel + --fill-or-kill mutual exclusion) — no `beforeAll`, runs in ~3s
- [ ] Test file `tests/e2e/offer/offer.core.test.ts`:
  - `beforeAll` funds 2 wallets via `fundFromFaucet`; sets up trust lines for `USD` between them using xrpl.js directly (not CLI) so tests are isolated
  - "offer create XRP→IOU": after `offer create`, query `account offers --json` and assert the new offer appears with correct `taker_pays`/`taker_gets`; also call `client.request({ command: "book_offers", ... })` and assert offer appears in order book
  - "offer cancel": after creating an offer (via xrpl.js directly in beforeAll), run `offer cancel --sequence <seq>` and assert the offer is gone from `account offers --json`
  - "offer create --json": assert output contains `hash`, `result: "tesSUCCESS"`, and `offerSequence` (number)
  - "offer create --dry-run": assert output contains `tx.TransactionType: "OfferCreate"`, no on-chain submission
  - "offer create --no-wait": assert exit 0 and 64-char hex hash in stdout
  - "offer create --sell flag": assert offer appears in account_offers (confirming it was submitted)
- [ ] Test file `tests/e2e/offer/offer.flags.test.ts`:
  - `beforeAll` funds wallets, sets up trust lines
  - "--passive flag": create offer with `--passive`, verify offer appears in `account_offers`
  - "--replace flag": create offer via xrpl.js, then run `offer create --replace <seq> ...`, verify original offer is gone and new offer exists
  - "--expiration flag": create offer with `--expiration` (future date), verify `Expiration` field present in account_offers entry
  - "--immediate-or-cancel flag": create IOC offer, verify it either filled or is absent from account_offers (does not linger)
- [ ] Typecheck passes
- [ ] Tests pass

## Functional Requirements

- FR-1: `xrpl offer create` takes `--taker-pays <amount>` (what the offer creator pays) and `--taker-gets <amount>` (what they receive). Both required.
- FR-2: Amount format: plain number = XRP (e.g. `1.5`), `value/CURRENCY/issuerAddress` = IOU (e.g. `10/USD/rIssuer...`)
- FR-3: Key material via `--seed`, `--mnemonic`, or `--account`/`--keystore`/`--password` (consistent with other commands)
- FR-4: `offer create` prints the offer sequence number to stdout on success (plain text: `Offer created. Sequence: 42`, JSON: `{ offerSequence: 42 }`)
- FR-5: `xrpl offer cancel` takes `--sequence <number>` (required) and the same key material options
- FR-6: `--expiration` accepts ISO 8601 string (e.g. `2026-12-31T00:00:00Z`) and converts to XRPL epoch (seconds since 2000-01-01T00:00:00Z)
- FR-7: `--replace <sequence>` sets the `OfferSequence` field on OfferCreate (XRPL atomically cancels that offer when the new one is placed)
- FR-8: Flags `--immediate-or-cancel` and `--fill-or-kill` are mutually exclusive; combining them exits 1 with message `--immediate-or-cancel and --fill-or-kill are mutually exclusive`
- FR-9: `--json` mode outputs structured JSON including `offerSequence` for create
- FR-10: Command file at `src/commands/offer.ts`; registered as `offer` with subcommands `create` (alias `c`) and `cancel` (alias `x`)

## Non-Goals

- No `offer list` subcommand — use existing `account offers` command
- No order book display (`book_offers` CLI wrapper) — out of scope
- No automatic offer matching/fulfillment logic — XRPL handles that on-ledger
- No support for MPT amounts in offers (MPT DEX is very new/experimental)

## Technical Considerations

- Follow `src/commands/trust.ts` as the reference pattern for flag handling and key material resolution
- XRPL epoch offset: `rippleTimeToUnixTime` / `unixTimeToRippleTime` helpers exist in xrpl.js — use them for `--expiration` conversion
- `account_offers` returns `seq` field on each offer — use this to find/verify the created offer in tests
- In `offer.core.test.ts`, set up a XRP→USD trust line in `beforeAll` using xrpl.js directly (not CLI) to avoid coupling tests
- For `book_offers` verification in tests, use xrpl.js client directly (not CLI) to keep test code simple

## Success Metrics

- All tests pass against testnet
- On-chain state is verified (not just exit codes) for create and cancel
- `offer cancel` correctly removes the offer from `account_offers`
- Typecheck clean

## Open Questions

- Should `offer create` accept `--destination <address>` (offer directed to a specific counterparty)? XRPL supports it but it's rarely used. Skipping for now.
