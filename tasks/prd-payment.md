# PRD: `xrpl payment` — Payment Transaction Command

## Introduction

`xrpl payment` submits a Payment transaction to the XRP Ledger. It supports all three XRPL currency amount types (XRP, issued tokens, MPT), cross-currency path payments, partial payments, memos, and destination tags. It is the most fundamental write command in the CLI and establishes the pattern that all future transaction commands follow.

Reference: [XRPL Payment transaction](https://xrpl.org/docs/references/protocol/transactions/types/payment)

---

## Goals

- Send XRP, issued tokens, and MPT in a single unified command
- Support full Payment transaction feature set: paths, partial payments, send-max, deliver-min
- Default to waiting for ledger validation; `--no-wait` for fire-and-forget
- Dry-run mode to inspect the signed tx without submitting
- Establish the standard pattern for key material, output, and error handling used by all future tx commands

---

## Amount Format Specification

All `--amount`, `--send-max`, and `--deliver-min` flags use the same format:

| Type | CLI format | Example |
|---|---|---|
| XRP | plain decimal number | `1` or `1.5` (converted to drops internally) |
| XRP drops | integer with `drops` suffix | `1000000drops` |
| Issued token | `<value>/<currency>/<issuer>` | `10/USD/rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh` |
| MPT | `<value>/<mpt_issuance_id>` (48-char hex) | `131/0000012FFD9EE5DA93AC614B4DB94D7E0FCE415CA51BED47` |

The CLI detects the type automatically:
- No slash → XRP
- One value + 3-char currency code + issuer address → issued token
- One value + 48-char hex string → MPT

---

## User Stories

### US-001: Amount parser utility
**Description:** As a developer, I need a shared amount parsing utility so all payment-related commands parse currency amounts consistently.

**Acceptance Criteria:**
- [ ] Create `src/utils/amount.ts` exporting `parseAmount(input: string): XRPAmount | IssuedTokenAmount | MPTAmount`
- [ ] `XRPAmount`: `{ type: 'xrp', drops: string }` — plain decimal input multiplied by 1,000,000 and rounded to integer; `drops`-suffixed input used as-is
- [ ] `IssuedTokenAmount`: `{ type: 'iou', value: string, currency: string, issuer: string }` — parsed from `value/currency/issuer`; currency must be 3 ASCII chars or 40-char hex; issuer must start with `r`
- [ ] `MPTAmount`: `{ type: 'mpt', value: string, mpt_issuance_id: string }` — parsed from `value/<48-char-hex>`
- [ ] `toXrplAmount(parsed)` converts to the xrpl.js-compatible amount object: string drops for XRP, `{ value, currency, issuer }` for IOU, `{ value, mpt_issuance_id }` for MPT
- [ ] `formatAmount(parsed)` returns human-readable string: `<n> XRP`, `<value> <currency> (issued by <issuer>)`, `<value> MPT:<id>`
- [ ] Throws descriptive error on invalid format: `Error: invalid amount '<input>' — use '1.5' for XRP, '10/USD/rIssuer' for issued token, or '100/0000...48hexchars' for MPT`
- [ ] Unit tests covering: XRP decimal, XRP drops, IOU 3-char currency, IOU hex currency, MPT, invalid inputs
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-002: `xrpl payment` — core command (XRP payments)
**Description:** As a user, I want to send XRP to another address so I can transfer value on the ledger.

**Acceptance Criteria:**
- [ ] Create `src/commands/payment.ts` registered in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl payment --to <address-or-alias> --amount <amount>` submits a Payment transaction
- [ ] Key material (exactly one required): `--seed <seed>`, `--mnemonic <phrase>`, `--account <address-or-alias>` (loads from keystore, prompts password; `--password` skips prompt with insecure warning)
- [ ] Calls `client.autofill(tx)` before signing
- [ ] Default behaviour: calls `client.submitAndWait()`, waits for validation, prints:
  ```
  Transaction: <hash>
  Result:      <result-code>
  Fee:         <fee-in-xrp> XRP
  Ledger:      <ledger-index>
  ```
- [ ] `--no-wait` flag: calls `client.submit()` instead, prints only `Transaction: <hash>`
- [ ] `--json` outputs `{ hash, result, fee, ledger }` (or just `{ hash }` with `--no-wait`)
- [ ] `--dry-run` prints signed tx JSON to stdout without submitting (includes `tx_blob` and decoded tx object)
- [ ] Exits 1 with tec/tef/tem error code and message on transaction failure
- [ ] Uses `getNodeUrl(cmd)` and `resolveAccount()` throughout
- [ ] Alias: `xrpl payment send` (subcommand alias, not a separate command)
- [ ] E2E test: fund two testnet accounts, send 1 XRP between them, assert exit 0 and output contains `tesSUCCESS`
- [ ] E2E test: `--dry-run` prints JSON with `TransactionType: 'Payment'` and does not submit
- [ ] E2E test: `--no-wait` exits 0 and output contains a 64-char hex hash
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-003: Destination tag and memo support
**Description:** As a user, I want to attach a destination tag and/or memo to a payment so I can identify it on exchanges or add context.

**Acceptance Criteria:**
- [ ] `--destination-tag <n>` sets the `DestinationTag` field (unsigned 32-bit integer; error if out of range)
- [ ] `--memo <text>` sets a Memos entry with `MemoData` as the UTF-8 hex-encoded string; flag can be repeated for multiple memos (e.g. `--memo "hello" --memo "world"`)
- [ ] `--memo-type <hex>` sets `MemoType` on the most recently specified `--memo` (optional)
- [ ] `--memo-format <hex>` sets `MemoFormat` on the most recently specified `--memo` (optional)
- [ ] Human-readable output shows `Destination Tag: <n>` when set
- [ ] `--json` output includes `destinationTag` and `memos` fields when present
- [ ] E2E test: send payment with `--destination-tag 12345`, run `account transactions`, assert tx has DestinationTag 12345 in decoded tx
- [ ] E2E test: send with `--memo "test memo"`, assert tx metadata includes the memo
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-004: Issued token and MPT payments
**Description:** As a user, I want to send issued tokens and MPTs so I can transact with non-XRP assets.

**Acceptance Criteria:**
- [ ] `--amount 10/USD/rIssuer` builds correct IOU amount object `{ value: "10", currency: "USD", issuer: "rIssuer" }`
- [ ] `--amount 131/0000012F...48chars` builds correct MPT amount object `{ value: "131", mpt_issuance_id: "0000012F..." }`
- [ ] Error on malformed amount format using message from `parseAmount` in US-001
- [ ] `--send-max <amount>` sets `SendMax` field (required for cross-currency payments; also supports all three amount types)
- [ ] When `--send-max` is set without a matching currency in `--amount`, the transaction is a cross-currency path payment
- [ ] `--deliver-min <amount>` sets `DeliverMin` field and automatically sets `tfPartialPayment` flag
- [ ] E2E test (IOU): establish a trust line on testnet, send an IOU payment, assert exit 0
- [ ] E2E test (MPT): create an MPT issuance on testnet, send MPT payment, assert exit 0
- [ ] E2E test: invalid amount format exits 1 with descriptive error
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-005: Path payments and payment flags
**Description:** As a user, I want to send cross-currency path payments and control payment behaviour with flags.

**Acceptance Criteria:**
- [ ] `--paths <json-array>` sets the `Paths` field directly (accepts inline JSON or a file path ending in `.json`)
- [ ] `--partial` flag sets `tfPartialPayment` (required when `--deliver-min` is used; can also be set standalone)
- [ ] `--no-ripple-direct` flag sets `tfNoRippleDirect`
- [ ] `--limit-quality` flag sets `tfLimitQuality`
- [ ] When `--partial` is set, `--json` output includes `deliveredAmount` from tx metadata
- [ ] E2E test: send with `--partial --deliver-min 1/USD/rIssuer --send-max 2/USD/rIssuer`, assert exit 0 and delivered amount is between deliver-min and send-max
- [ ] E2E test: `--paths` with an explicit empty array `[]` is accepted
- [ ] Typecheck passes
- [ ] Tests pass

---

## Functional Requirements

- FR-1: `src/utils/amount.ts` is the single source of truth for amount parsing — payment command and all future commands import from it
- FR-2: All three amount types (XRP, IOU, MPT) supported on `--amount`, `--send-max`, and `--deliver-min`
- FR-3: Default behaviour is `submitAndWait`; `--no-wait` uses `submit`
- FR-4: `--dry-run` never calls `client.submit()` or `client.submitAndWait()`
- FR-5: Transaction failures (tec*, tef*, tem*) exit with code 1 and print the error code + message to stderr
- FR-6: `--account` keystore loading follows the same pattern as `account set` (getKeystoreDir, interactive/--password prompt)
- FR-7: `xrpl payment --help` output shows the amount format examples in the option description

---

## Non-Goals

- No auto path-finding (XRPL `path_find` websocket subscription) — paths must be provided explicitly or omitted
- No multi-signed payments (covered by future `xrpl signer-list` PRD)
- No batch/multi-payment in one command
- No EscrowFinish, PaymentChannelClaim, or other "payment-like" transactions — those are separate commands

---

## Technical Considerations

- `parseAmount` must handle both 3-char ASCII currency codes and 40-char hex currency codes (non-standard currencies)
- MPT issuance ID is exactly 48 hex chars — use this to distinguish from IOU in the parser
- `client.autofill()` handles `Sequence`, `Fee`, `LastLedgerSequence` — always call it before signing
- For `submitAndWait`, catch `TimeoutError` and exit 1 with `Error: transaction expired (LastLedgerSequence exceeded)`
- Use `xrpl.isFinalResult(result)` to check if a tec* code is final before reporting failure
- `--memo` values stored as UTF-8 → hex: `Buffer.from(text, 'utf8').toString('hex').toUpperCase()`

---

## Success Metrics

- `xrpl payment --to <addr> --amount 1 --seed <seed>` sends 1 XRP end-to-end
- All three amount types have passing E2E tests
- `xrpl payment --help` clearly documents the amount format

---

## Open Questions

- Should `--amount` accept `1 XRP` with a space (shell would split it), or only `1` for XRP? (Suggestion: only plain decimal; the `XRP` unit label is for output only)
- Should `--memo` accept hex directly via `--memo-hex <hex>` as an alternative to UTF-8 auto-encoding?

Sources:
- [XRPL Currency Formats](https://xrpl.org/docs/references/protocol/data-types/currency-formats)
- [MPT Multi-Purpose Tokens](https://xrpl.org/docs/concepts/tokens/fungible-tokens/multi-purpose-tokens)
- [MPTokenIssuanceCreate](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuancecreate)
