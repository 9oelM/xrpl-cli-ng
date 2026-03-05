# PRD: `trust set` — TrustSet Transaction

## Introduction

XRPL requires a trust line before an account can hold issued tokens. There is already an `account trust-lines` read command that queries existing trust lines, but there is no way to create or modify one via the CLI. This PRD covers `xrpl trust set`, a top-level command (following the same pattern as `xrpl payment`) that submits a TrustSet transaction to the ledger.

---

## Goals

- Let users create, modify, and remove trust lines from the CLI
- Support all TrustSet flags: NoRipple, Freeze, and Auth
- Support QualityIn / QualityOut rippling quality settings
- Follow the exact same command structure and output format as `xrpl payment`

---

## User Stories

### US-001: `trust set` core command

**Description:** As a user, I want to create or update a trust line so I can hold issued tokens from a specific issuer.

**Acceptance Criteria:**
- [ ] Create `src/commands/trust.ts` with a `trustCommand` exported as `new Command("trust")` containing a `set` subcommand (alias `s`)
- [ ] Register `trustCommand` in `src/commands/index.ts` and `src/index.ts`
- [ ] Required options: `--currency <code>` (3-char ASCII or 40-char hex currency code) and `--issuer <address-or-alias>` (the token issuer's address) and `--limit <value>` (trust line limit as decimal string; use "0" to remove the trust line)
- [ ] Key material (exactly one required): `--seed <seed>`, `--mnemonic <phrase>`, `--account <address-or-alias>` (loads from keystore; `--password` skips interactive prompt with insecure warning to stderr)
- [ ] Global `--node` / `-n` option respected via `getNodeUrl(cmd)`
- [ ] `--keystore <dir>` and `XRPL_KEYSTORE` env var respected when `--account` is used
- [ ] Builds `TrustSet` tx: `{ TransactionType: "TrustSet", Account: <signer>, LimitAmount: { currency, issuer, value } }`
- [ ] Calls `client.autofill(tx)`, signs, then `client.submitAndWait()` by default
- [ ] On success, human-readable output: `Transaction: <hash>`, `Result:      <result-code>`, `Fee:         <fee-xrp> XRP`, `Ledger:      <ledger-index>`
- [ ] `--no-wait`: calls `client.submit()` instead; prints only `Transaction: <hash>`
- [ ] `--json`: outputs `{ hash, result, fee, ledger }` (or `{ hash }` with `--no-wait`)
- [ ] `--dry-run`: prints `{ tx_blob, tx: <autofilled-tx-object> }` as JSON to stdout without submitting
- [ ] Exits 1 on tec*/tef*/tem* result codes with error message to stderr
- [ ] Catches TimeoutError and exits 1 with `Error: transaction expired (LastLedgerSequence exceeded)`
- [ ] E2E test: fund a testnet account, run `trust set --currency USD --issuer <funded-addr> --limit 1000 --seed <seed>`, assert exit 0 and stdout contains `tesSUCCESS`
- [ ] E2E test: `--dry-run` outputs JSON with `TransactionType: "TrustSet"` and does not submit
- [ ] E2E test: `--no-wait` exits 0 and output contains a 64-char hex hash
- [ ] Typecheck passes
- [ ] Tests pass

### US-002: TrustSet flags and quality options

**Description:** As a user, I want to control NoRipple, Freeze, and Auth flags on a trust line so I can configure rippling and compliance behaviour.

**Acceptance Criteria:**
- [ ] `--no-ripple`: sets `TrustSetFlags.tfSetNoRipple` (0x00020000) on `Flags`
- [ ] `--clear-no-ripple`: sets `TrustSetFlags.tfClearNoRipple` (0x00040000) on `Flags`
- [ ] `--freeze`: sets `TrustSetFlags.tfSetFreeze` (0x00100000) on `Flags` (issuer-initiated freeze)
- [ ] `--unfreeze`: sets `TrustSetFlags.tfClearFreeze` (0x00200000) on `Flags`
- [ ] `--auth`: sets `TrustSetFlags.tfSetfAuth` (0x00010000) on `Flags`
- [ ] Multiple flags combine via bitwise OR into a single `Flags` value
- [ ] `--quality-in <n>`: sets `QualityIn` field (unsigned integer, 0 = default/no adjustment)
- [ ] `--quality-out <n>`: sets `QualityOut` field (unsigned integer, 0 = default/no adjustment)
- [ ] Exits 1 if both `--no-ripple` and `--clear-no-ripple` are passed together
- [ ] Exits 1 if both `--freeze` and `--unfreeze` are passed together
- [ ] E2E test: run `trust set` with `--no-ripple`, query `account trust-lines --json`, assert trust line has `no_ripple: true`
- [ ] Typecheck passes
- [ ] Tests pass

---

## Functional Requirements

- FR-1: `xrpl trust set` is a top-level command group (parallel to `xrpl payment`, not nested under `xrpl account`)
- FR-2: `--limit 0` is the mechanism for removing a trust line (no separate `trust remove` subcommand); the CLI passes it through as-is and lets the ledger enforce the zero-balance precondition
- FR-3: `--currency` validates: exactly 3 uppercase ASCII chars OR exactly 40 hex chars; exits 1 with descriptive error otherwise
- FR-4: `--issuer` is resolved via `resolveAccount()` to support aliases
- FR-5: `LimitAmount` is always `{ currency, issuer, value }` — use `toXrplAmount` is NOT needed here since trust line limits are always IOU-style amounts (never XRP or MPT)
- FR-6: All flag options are mutually exclusive as described in US-002; validation happens before any network call
- FR-7: `QualityIn` and `QualityOut` are only added to the tx object when explicitly provided (not zero by default)
- FR-8: The `--dry-run` flag prints the autofilled tx and exits 0 without submitting, consistent with `xrpl payment --dry-run`

---

## Non-Goals

- No `trust remove` subcommand — use `trust set --limit 0`
- No reading trust line state — use existing `account trust-lines`
- No MPT-specific trust operations (MPTokenAuthorize is a separate transaction type)
- No ripple path finding or liquidity checking

---

## Technical Considerations

- Import `TrustSetFlags` from `xrpl` for flag values
- `TrustSet` type is available from `xrpl` — use it for the tx object type annotation
- Currency code validation: `/^[A-Z0-9]{3}$/.test(c) || /^[0-9A-Fa-f]{40}$/.test(c)`
- File location: `src/commands/trust.ts` (single file, not a subdirectory, since there is only one subcommand for now)
- E2E tests live in `tests/e2e/trust/trust.test.ts`
- For the `--no-ripple` E2E test, use `account_lines` RPC directly in the test assertion (same pattern as payment tests that use `account_transactions`)

---

## Success Metrics

- `xrpl trust set --currency USD --issuer rIssuer --limit 1000 --seed sSeed` creates a trust line in one command
- `xrpl trust set --currency USD --issuer rIssuer --limit 0 --seed sSeed` removes it
- All existing tests continue to pass

---

## Open Questions

- Should `--currency` auto-uppercase 3-char codes (e.g. `usd` → `USD`)? Recommendation: yes, silently uppercase for UX.
