# PRD: Account Delete Command

## Introduction

Add `xrpl account delete` subcommand to permanently delete an XRPL account and sweep its remaining XRP balance to a destination address. This is an irreversible action with a high transaction fee (owner reserve ≈ 2 XRP). The CLI must require explicit confirmation before submitting.

## Goals

- Support `AccountDelete` to delete an account and transfer remaining XRP to a destination
- Require `--confirm` flag to prevent accidental deletion
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `account delete` command

**Description:** As a developer, I want to permanently delete an XRPL account from the CLI so I can close unused accounts and recover their XRP balance.

**Acceptance Criteria:**
- [ ] Read AccountDelete docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/accountdelete.md before implementing
- [ ] Create `src/commands/account/delete.ts` and register it in `src/commands/account/index.ts`
- [ ] `xrpl account delete` subcommand with:
  - `--destination <address>` (required) — account to receive the remaining XRP balance
  - `--destination-tag <n>` (optional) — destination tag for the receiving account
  - `--confirm` (required flag) — must be explicitly passed; without it the CLI exits with an error explaining the action is irreversible
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if `--destination` is missing
- [ ] CLI exits with error if `--destination` is not a valid classic address
- [ ] CLI exits with error if `--confirm` is not provided (error message must say "This permanently deletes your account. Pass --confirm to proceed.")
- [ ] `--dry-run` bypasses the `--confirm` requirement (dry run is safe to run without confirmation)
- [ ] `tests/e2e/account/account.delete.validation.test.ts`: missing destination, invalid destination address, missing --confirm (without --dry-run) — no network
- [ ] `tests/e2e/account/account.delete.test.ts`: fund a fresh wallet, delete it with --destination pointing to another funded wallet, verify account no longer exists via account info; `--json`, `--dry-run`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `AccountDelete` transaction fields: `Destination` (AccountID, required), `DestinationTag` (UInt32, optional)
- FR-2: `--confirm` is a boolean flag; CLI checks for its presence before constructing the transaction (unless `--dry-run` is set)
- FR-3: Transaction fee must be at least the owner reserve (2,000,000 drops = 2 XRP); use xrpl.js `autofill` which handles this, but document the high fee in help text
- FR-4: Validate `--destination` with `isValidClassicAddress()` from xrpl.js
- FR-5: After successful deletion, account is no longer funded; `account info` on the deleted address returns a not-found error

## Non-Goals

- No `--fee` override flag (autofill handles the minimum; users cannot accidentally under-fee)
- No interactive prompt asking for confirmation (flag-only pattern, consistent with other CLI tools)
- No recovery of deleted accounts (protocol-level limitation, not CLI concern)

## Technical Considerations

- **Mandatory pre-implementation step:** Read AccountDelete docs (linked above) before writing code
- **High fee:** `AccountDelete` requires destroying at least the owner reserve in fees (~2 XRP). The `autofill` method in xrpl.js sets the correct fee. Add a note in the help text: "Fee: ~2 XRP (owner reserve, non-refundable)"
- **`tecTOO_SOON` guard:** The account's `Sequence + 256` must be less than the current ledger index. Freshly funded testnet wallets pass this easily since the ledger index is always much higher.
- **`tecHAS_OBLIGATIONS` guard:** The account must not own ledger objects (escrows, trustlines with balance, offers, etc.). In E2E tests, use a clean wallet with no owned objects.
- **E2E test pattern:** Fund a new wallet from the faucet in `beforeAll`; immediately delete it (no owned objects, no trustlines); verify with `account info` that it returns not-found

## Success Metrics

- `account delete --destination <addr> --confirm` successfully deletes the account
- `account info <deleted-addr>` returns not-found after deletion
- Missing `--confirm` is caught before any network call
- `--dry-run` works without `--confirm`
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
