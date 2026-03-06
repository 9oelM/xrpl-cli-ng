# PRD: Clawback Commands

## Introduction

Add `xrpl clawback` command and `--allow-clawback` flag on `account set` to support the XRPL Clawback amendment. Clawback lets token issuers recover issued tokens from a holder's account — useful for regulatory compliance, fraud recovery, and error correction. Supported for trust line (IOU) tokens and MPTs. XRP cannot be clawed back.

## Goals

- Support `Clawback` transaction for both IOU trust line tokens and MPTs
- Add `account set --allow-clawback` to enable clawback on an issuer account (with irreversibility warning + `--confirm`)
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `clawback` command

**Description:** As a token issuer, I want to claw back tokens from a holder's account from the CLI so I can recover issued tokens for compliance or error correction.

**Acceptance Criteria:**
- [ ] Read Clawback docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/clawback.md before implementing
- [ ] `src/commands/clawback.ts` created and registered in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl clawback` command with:
  - `--amount <amount>` (required) — amount to claw back
    - IOU mode: `value/CURRENCY/holder-address` — the third field is the **token holder's address** (not an issuer); help text must clarify: "For IOU tokens, use value/CURRENCY/holder-address where holder-address is the account to claw back from"
    - MPT mode: `value/MPT_ISSUANCE_ID` — the issuance ID identifies the token type
  - `--holder <address>` (optional) — **required for MPT mode**; identifies the holder to claw back from; omit for IOU mode (holder is encoded in `--amount`)
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI detects mode automatically: if `--holder` is present → MPT mode; if absent → IOU mode
- [ ] CLI exits with error if `--holder` is provided together with an IOU-format `--amount` (i.e. `value/CURRENCY/address` with three parts) — use `--holder` only with MPT amounts
- [ ] CLI exits with error if MPT-format `--amount` is provided without `--holder`
- [ ] CLI exits with error if amount value is zero
- [ ] On success, output prints transaction hash
- [ ] `tests/e2e/clawback/clawback.validation.test.ts`: zero amount, IOU with --holder flag, MPT without --holder, missing key material — no network
- [ ] `tests/e2e/clawback/clawback.iou.test.ts`: issuer claws back IOU from holder (setup: enable clawback on issuer account, set trust line, issue tokens, claw back), `--json`, `--dry-run`
- [ ] `tests/e2e/clawback/clawback.mpt.test.ts`: issuer claws back MPT from holder (setup: create MPT issuance with clawback enabled, authorize holder, transfer tokens, claw back), `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `account set --allow-clawback` flag

**Description:** As a token issuer, I want to enable clawback on my account before issuing tokens so I can later recover tokens if needed.

**Acceptance Criteria:**
- [ ] Read account set docs and verify `asfAllowTrustLineClawback` flag value before implementing
- [ ] Add `--allow-clawback` flag to the existing `xrpl account set` command in `src/commands/account/set.ts`
- [ ] When `--allow-clawback` is passed **without** `--confirm`, CLI exits with a clear error:
  ```
  Error: --allow-clawback is irreversible. Once enabled it cannot be disabled.
  To proceed, add --confirm to your command.
  ```
- [ ] When `--allow-clawback` is passed **with** `--confirm`, the transaction is submitted normally
- [ ] `--confirm` is a general flag added to `account set` (used only to acknowledge irreversible operations)
- [ ] `tests/e2e/account/account.set.clawback.test.ts`: attempt without --confirm exits 1 with error message, attempt with --confirm succeeds and flag is set on-chain (verify via `account info` that `lsfAllowTrustLineClawback` is set)
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `Clawback` transaction — `Amount` (IOU: `{value, currency, issuer: holderAddress}`, MPT: `{value, mpt_issuance_id}`), optional `Holder` (MPT only)
- FR-2: IOU mode: parse `--amount value/CURRENCY/holder-address`; map to `Amount = { value, currency, issuer: holderAddress }`; the "issuer" position in the amount string is the **holder**, not the token issuer
- FR-3: MPT mode: parse `--amount value/MPT_ISSUANCE_ID` + `--holder address`; map to `Amount = { value, mpt_issuance_id }` and `Holder = address`
- FR-4: Amount value must be non-zero; reject with error if zero
- FR-5: `asfAllowTrustLineClawback` account flag value — verify exact numeric value from xrpl.js `AccountSetAsfFlags` enum before using
- FR-6: `--confirm` flag on `account set` gates irreversible operations; currently only used by `--allow-clawback`
- FR-7: If clawback amount exceeds holder's balance, the protocol recovers the full balance (not an error — document in help text)

## Non-Goals

- No XRP clawback (XRP has no issuer)
- No `AMMClawback` transaction (AMM pool clawback is a separate, more complex transaction — out of scope)
- No batch clawback across multiple holders in one transaction

## Technical Considerations

- **Mandatory pre-implementation step:** Read Clawback docs (linked in US-001) before writing code
- **IOU amount parsing quirk:** The third segment of `value/CURRENCY/holder-address` maps to `Amount.issuer` in the transaction — this is intentional XRPL protocol design for clawback; the help text must explicitly say "holder-address" not "issuer"
- **MPT amount format:** Reuse the existing MPT amount parsing from `src/utils/amount.ts` (already used in payment command)
- **`asfAllowTrustLineClawback`:** Import from xrpl.js `AccountSetAsfFlags` enum; do not hardcode the numeric value
- **E2E test setup for IOU clawback:** Requires a funded issuer with `lsfAllowTrustLineClawback` set, a holder with a trust line, and some issued tokens. Use `distributeToWallets` for multiple accounts
- **E2E test setup for MPT clawback:** Requires an MPT issuance created with clawback enabled (`tfMPTCanClawback` flag), an authorized holder, and tokens transferred to the holder. The MPT issuance creation is done via the existing `xrpl` CLI if MPT issuance commands exist, or directly via xrpl.js in `beforeAll`
- **`--confirm` implementation:** Add `.option("--confirm", "Confirm irreversible account flag changes")` to `account set`; check in the `--allow-clawback` handler

## Success Metrics

- `xrpl clawback` recovers IOU and MPT tokens from a holder against testnet
- `--allow-clawback` without `--confirm` exits 1 with clear error message
- `--allow-clawback --confirm` sets the flag on-chain (verified via `account info`)
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
