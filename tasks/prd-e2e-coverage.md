# PRD: E2E Test Coverage Improvements

## Introduction

Several existing E2E tests only verify transaction success (`tesSUCCESS` or exit code 0) without querying the ledger to confirm the actual state change occurred. Additionally, a number of CLI options across `payment`, `trust`, `account set`, and `offer` commands are not covered by any test. This PRD closes both gaps: add ledger-state assertions to existing tests and add tests for every uncovered option.

## Goals

- Every mutating CLI command has at least one test that verifies an on-chain state change (not just exit 0)
- Every `.option()` and `.requiredOption()` on every command is exercised by at least one test
- `--mnemonic` and `--account`/`--keystore`/`--password` key-material paths are covered for each command
- Tests remain split by concern (validation / core / flags) per the established file structure

## User Stories

### US-001: Payment — balance verification + missing key-material tests

**Description:** As a developer, I want payment tests to verify XRP and IOU balance changes, and to cover `--memo-type`, `--memo-format`, `--mnemonic`, and `--account`/`--keystore`/`--password`.

**Acceptance Criteria:**
- [ ] In `payment.core.test.ts`, the "sends 1 XRP" test queries sender balance before and after and asserts it decreased by at least 1 XRP (accounting for fee); queries recipient balance and asserts it increased by 1 XRP
- [ ] In `payment.iou.test.ts`, after sending the IOU payment, query the recipient's trust line via `account trust-lines --json <address>` and assert the balance reflects the received amount
- [ ] Add test for `--memo-type` and `--memo-format`: use `--dry-run` and assert the serialized tx JSON contains the expected `Memos[0].Memo.MemoType` and `MemoFormat` hex-encoded values
- [ ] Add test for `--mnemonic` key material: fund a wallet from faucet using its mnemonic, send payment with `--mnemonic <mnemonic>`, assert exit 0
- [ ] Add test for `--account`/`--keystore`/`--password` key material: create a keystore entry, send payment with `--account <address> --keystore <dir> --password <pw>`, assert exit 0
- [ ] Typecheck passes
- [ ] Tests pass

### US-002: Payment — routing flag coverage + `--partial`/`--deliver-min` verification

**Description:** As a developer, I want tests for `--no-ripple-direct`, `--limit-quality`, and proper delivered-amount verification for partial payments.

**Acceptance Criteria:**
- [ ] Add test for `--no-ripple-direct`: run `payment send` with `--no-ripple-direct --dry-run`; parse tx JSON and assert `Flags` field has bit `0x00040000` set (tfNoRippleDirect)
- [ ] Add test for `--limit-quality`: run `payment send` with `--limit-quality --dry-run`; parse tx JSON and assert `Flags` field has bit `0x00080000` set (tfLimitQuality)
- [ ] In `payment.paths.test.ts`, the `--partial --deliver-min` test must assert the delivered amount (from `--json` output `meta.delivered_amount`) is >= the `--deliver-min` value and > 0
- [ ] Typecheck passes
- [ ] Tests pass

### US-003: Trust set — ledger-state verification + `--mnemonic` coverage

**Description:** As a developer, I want trust-set tests to verify the trust line actually appeared on-chain, and to cover the `--mnemonic` key-material path.

**Acceptance Criteria:**
- [ ] In `trust.core.test.ts`, the "creates USD trust line" test queries `account trust-lines --json <address>` after the CLI call and asserts a trust line with currency "USD" and the correct issuer address exists
- [ ] In `trust.core.test.ts`, the "alias 's'" test similarly asserts the trust line exists after the command
- [ ] In `trust.core.test.ts`, the `--account`/`--keystore`/`--password` test asserts the trust line exists after the command
- [ ] Add a new test for `--mnemonic` key material: fund a wallet from faucet using its mnemonic, run `trust set` with `--mnemonic <mnemonic>`, assert exit 0 and trust line appears
- [ ] Typecheck passes
- [ ] Tests pass

### US-004: Account set — `--email-hash`, `--transfer-rate`, `--tick-size` with on-chain verification

**Description:** As a developer, I want tests for account set fields that verify the ledger reflects the change via `account info --json`.

**Acceptance Criteria:**
- [ ] Add test for `--email-hash <hash>`: run `account set --email-hash <32-char-hex> --seed <seed> --node testnet`; query `account info --json <address>` and assert `account_data.EmailHash` equals the submitted value (uppercase hex)
- [ ] Add test for `--transfer-rate <rate>`: run `account set --transfer-rate 1005000000 --seed <seed> --node testnet` (1.005× = 1005000000); query `account info --json <address>` and assert `account_data.TransferRate === 1005000000`
- [ ] Add test for `--tick-size <n>`: run `account set --tick-size 5 --seed <seed> --node testnet`; query `account info --json <address>` and assert `account_data.TickSize === 5`
- [ ] Each test lives in a new file `tests/e2e/account/account.set.fields.test.ts` with its own `beforeAll` faucet funding
- [ ] Typecheck passes
- [ ] Tests pass

### US-005: Account set — `--set-flag`/`--clear-flag` on-chain verification + key-material coverage

**Description:** As a developer, I want `--set-flag` to have on-chain verification and `--clear-flag`, `--mnemonic`, and `--account`/`--keystore`/`--password` to be tested.

**Acceptance Criteria:**
- [ ] In the existing `account.set.test.ts` (or a new `account.set.flags.test.ts`), add verification for `--set-flag`: after `account set --set-flag 8` (asfDefaultRipple), query `account info --json <address>` and assert `account_data.Flags` has bit `0x00800000` set
- [ ] Add test for `--clear-flag`: set a flag then clear it with `account set --clear-flag 8`; query `account info --json` and assert the flag bit is no longer set
- [ ] Add test for `--mnemonic` key material: `account set --domain example.com --mnemonic <mnemonic>`, assert exit 0
- [ ] Add test for `--account`/`--keystore`/`--password` key material: `account set --domain example2.com --account <addr> --keystore <dir> --password <pw>`, assert exit 0
- [ ] Typecheck passes
- [ ] Tests pass

### US-006: Offer — cancel output modes + `--fill-or-kill` + key-material coverage

**Description:** As a developer, I want offer cancel output modes and offer create's `--fill-or-kill` and key-material paths to be covered by tests.

**Acceptance Criteria:**
- [ ] Add test for `offer cancel --json`: pre-create an offer, cancel it with `--json`, assert stdout parses as JSON with `hash` (64-char hex) and `result: "tesSUCCESS"`
- [ ] Add test for `offer cancel --dry-run`: assert stdout parses as JSON with `tx.TransactionType === "OfferCancel"` and `tx_blob` string; assert no change in account offers
- [ ] Add test for `offer cancel --no-wait`: assert exit 0 and stdout matches `/[0-9A-Fa-f]{64}/`
- [ ] Add test for `offer create --fill-or-kill`: run offer create with `--fill-or-kill`; assert exit 0 (tecKILLED is non-fatal); assert the offer is NOT present in `account offers --json` (IOC/FOK offers that fail are not placed)
- [ ] Add test for `offer create --mnemonic`: fund a wallet, run `offer create` with `--mnemonic <mnemonic>`, assert exit 0
- [ ] Add test for `offer create --account`/`--keystore`/`--password`: create a keystore entry, run `offer create` with `--account <addr> --keystore <dir> --password <pw>`, assert exit 0
- [ ] Tests should be added to the existing `offer.core.test.ts` or `offer.flags.test.ts` as appropriate; add a new file only if a separate `beforeAll` is needed
- [ ] Typecheck passes
- [ ] Tests pass

## Functional Requirements

- FR-1: Payment XRP test asserts sender balance decreased and recipient balance increased by the exact payment amount (1 XRP = 1,000,000 drops)
- FR-2: Payment IOU test asserts trust-line balance changed by the sent IOU amount
- FR-3: `--memo-type` and `--memo-format` tests use `--dry-run` and inspect the `Memos` array in the serialized tx
- FR-4: `--no-ripple-direct` and `--limit-quality` tests use `--dry-run` and inspect the `Flags` bitmask
- FR-5: `--partial`/`--deliver-min` test asserts `meta.delivered_amount` from `--json` output is >= deliver-min
- FR-6: Trust set tests query `account trust-lines --json` and assert the expected trust line exists
- FR-7: Account set field tests query `account info --json` and check `account_data.EmailHash`, `account_data.TransferRate`, `account_data.TickSize`
- FR-8: Account set flag tests query `account info --json` and check the `Flags` bitmask
- FR-9: All new key-material tests (`--mnemonic`, `--account`/`--keystore`/`--password`) assert exit 0; at least one also verifies the on-chain effect
- FR-10: Offer cancel output-mode tests follow the same patterns as offer create (pre-create offer via xrpl.js, then exercise CLI)

## Non-Goals

- MPT balance ledger verification (no CLI for `account_objects` yet — tracked in MEMORY.md for future implementation)
- Adding new commands (this PRD only improves existing test coverage)
- Changing any source command implementation (only test files change)
- Testing `wallet` or `account delete` commands (out of scope for this pass)

## Technical Considerations

- Use `account trust-lines --json <address>` CLI command (already implemented) for trust line state queries
- Use `account info --json <address>` CLI command (already implemented) for account field queries
- Use `account offers --json <address>` CLI command (already implemented) for offer state queries
- XRP balance queries via `account info --json` — `account_data.Balance` is in drops (string)
- For `--mnemonic` tests: derive wallet from a known mnemonic using xrpl.js `Wallet.fromMnemonic()` to get the expected address, then fund that address from faucet
- For `--account`/`--keystore`/`--password` tests: use `wallet import` or create keystore entry programmatically in `beforeAll`; clean up in `afterAll`
- asfDefaultRipple flag value: 8 (sets `0x00800000` in account Flags); verify with `(account_data.Flags & 0x00800000) !== 0`

## Success Metrics

- Zero untested CLI options across all mutating commands
- Every mutating test (that changes ledger state) has at least one assertion on the post-transaction ledger state
- Test suite continues to pass without flakiness

## Open Questions

- Should `--account`/`--keystore`/`--password` tests create the keystore entry via `wallet import` CLI or directly write the keystore file? (Prefer `wallet import` CLI if available.)
- Should new account.set tests reuse the existing `account.set.test.ts` `beforeAll` or create separate files? (Prefer separate file `account.set.fields.test.ts` to avoid long serial runs.)
