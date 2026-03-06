# PRD: Escrow Commands

## Introduction

Add `xrpl escrow` sub-commands to create, finish, cancel, and list XRPL escrows. Escrows lock XRP or tokens on-ledger until a time condition, a crypto-condition, or both are satisfied. This lets users trustlessly schedule payments or implement hash-time-locked contracts (HTLCs) from the CLI without writing scripts.

## Goals

- Support all three escrow transaction types: `EscrowCreate`, `EscrowFinish`, `EscrowCancel`
- Support both time-based conditions (`FinishAfter`, `CancelAfter`) and crypto-conditions (PREIMAGE-SHA-256)
- Support querying pending escrows for an account via `escrow list`
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `escrow create` command

**Description:** As a developer, I want to lock XRP into an escrow from the CLI so I can schedule or condition a payment without writing a script.

**Acceptance Criteria:**
- [ ] `src/commands/escrow.ts` is created and registered in `src/commands/index.ts`
- [ ] `xrpl escrow create` subcommand exists with the following options:
  - `--to <address>` (required) — destination address
  - `--amount <xrp>` (required) — XRP amount as a decimal string (e.g. `10.5`); converted to drops
  - `--finish-after <iso8601>` (optional) — earliest datetime the escrow can be finished (e.g. `2026-03-07T12:00:00Z`); converted to XRPL epoch (Unix timestamp minus 946684800)
  - `--cancel-after <iso8601>` (optional) — expiry datetime; after this the escrow can only be cancelled; converted to XRPL epoch
  - `--condition <hex>` (optional) — PREIMAGE-SHA-256 crypto-condition hex string
  - `--destination-tag <n>` (optional) — unsigned 32-bit destination tag
  - `--source-tag <n>` (optional) — unsigned 32-bit source tag
  - `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password` — key material (same pattern as payment command)
  - `--node <url>` — node URL or shorthand
  - `--json` — output raw JSON
  - `--dry-run` — serialize without submitting
  - `--no-wait` — submit without waiting for validation
- [ ] CLI rejects if neither `--finish-after` nor `--condition` is provided (at least one is required)
- [ ] CLI rejects if `--cancel-after` is set without `--finish-after` or `--condition` (invalid combination per protocol)
- [ ] On success, output prints the transaction hash and the sequence number of the EscrowCreate (needed for finish/cancel)
- [ ] `tests/e2e/escrow/escrow.validation.test.ts` covers: missing `--to`, missing `--amount`, missing both `--finish-after` and `--condition`, invalid ISO date, missing key material — no network required
- [ ] `tests/e2e/escrow/escrow.create.test.ts` covers: time-based create (FinishAfter in past so finish is immediate), create with CancelAfter, `--json` output, `--dry-run`
- [ ] Typecheck passes

### US-002: `escrow finish` command

**Description:** As a developer, I want to release funds from a time-locked or condition-locked escrow so the destination receives the XRP.

**Acceptance Criteria:**
- [ ] `xrpl escrow finish` subcommand exists with the following options:
  - `--owner <address>` (required) — address of the account that created the escrow
  - `--sequence <n>` (required) — sequence number of the original `EscrowCreate` transaction
  - `--condition <hex>` (optional) — crypto-condition hex (required if the escrow was created with a condition)
  - `--fulfillment <hex>` (optional) — PREIMAGE-SHA-256 fulfillment hex (required if `--condition` is provided)
  - `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password` — key material
  - `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI rejects if `--condition` is provided without `--fulfillment` (and vice versa)
- [ ] `tests/e2e/escrow/escrow.finish.test.ts` covers: finish a time-based escrow (FinishAfter set to past), finish a crypto-condition escrow (using a known preimage), `--json`, `--dry-run`
- [ ] Typecheck passes

### US-003: `escrow cancel` command

**Description:** As a developer, I want to cancel an expired escrow so the locked XRP is returned to the sender.

**Acceptance Criteria:**
- [ ] `xrpl escrow cancel` subcommand exists with the following options:
  - `--owner <address>` (required) — address of the account that created the escrow
  - `--sequence <n>` (required) — sequence number of the original `EscrowCreate` transaction
  - `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password` — key material
  - `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] `tests/e2e/escrow/escrow.cancel.test.ts` covers: cancel an escrow whose CancelAfter has passed (set CancelAfter to 1 second in future at create time, wait, then cancel), `--json`, `--dry-run`
- [ ] Typecheck passes

### US-004: `escrow list` query command

**Description:** As a developer, I want to list all pending escrows for an account so I know what sequence numbers to use for finish/cancel.

**Acceptance Criteria:**
- [ ] `xrpl escrow list <address>` subcommand exists
- [ ] Uses `account_objects` with `type: "escrow"` to fetch all escrow objects for the account
- [ ] Default output (human-readable) prints: sequence, amount (in XRP), destination, FinishAfter (ISO 8601 or "none"), CancelAfter (ISO 8601 or "none"), Condition (hex or "none")
- [ ] `--json` outputs raw JSON array
- [ ] `tests/e2e/escrow/escrow.list.test.ts` covers: list after creating an escrow (verifies the new escrow appears), `--json` output
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `EscrowCreate` — Amount in drops (convert decimal XRP input), Destination, optional FinishAfter, CancelAfter (XRPL epoch), Condition (hex blob), DestinationTag, SourceTag
- FR-2: ISO 8601 datetime strings must be parsed and converted to XRPL epoch: `Math.floor(new Date(str).getTime() / 1000) - 946684800`
- FR-3: `EscrowFinish` — Owner, OfferSequence (the EscrowCreate sequence), optional Condition + Fulfillment hex; transaction fee increases when Fulfillment is present (330 drops + 10 drops per 16 bytes of preimage)
- FR-4: `EscrowCancel` — Owner, OfferSequence; only works after CancelAfter has passed
- FR-5: `escrow list` uses `account_objects` RPC with `type: "escrow"`; convert XRPL epoch timestamps back to ISO 8601 for display
- FR-6: On success, `escrow create` prints the escrow sequence number prominently so the user can reference it for finish/cancel
- FR-7: All commands support `--node`, `--json`, `--dry-run`, `--no-wait`

## Non-Goals

- No token (IOU/MPT) escrow support (XRP only for now; token escrows require CancelAfter which adds complexity)
- No helper command for generating PREIMAGE-SHA-256 conditions (user supplies hex strings)
- No escrow by ticket (OfferSequence from ticket) — standard sequence only
- No CredentialIDs support on EscrowFinish (DepositAuth interaction)

## Technical Considerations

- **Mandatory pre-implementation step:** Read the xrpl-dev-portal transaction type docs before coding:
  - `EscrowCreate`: https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/escrowcreate.md
  - `EscrowFinish`: https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/escrowfinish.md
  - `EscrowCancel`: https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/escrowcancel.md
- **XRPL epoch:** Ripple uses seconds since 2000-01-01T00:00:00Z. Conversion: `Math.floor(new Date(isoStr).getTime() / 1000) - 946684800`
- **EscrowFinish fee with fulfillment:** `Math.ceil((fulfillmentHex.length / 2 + 15) / 16) * 10 + 330` drops minimum; use `autofill` and bump if needed, or set fee explicitly
- **Test strategy for time-based escrows:** Set `FinishAfter` to a past XRPL epoch timestamp (e.g., 1 second before `Date.now()`) so the escrow can be finished immediately in tests. For cancel tests, set `CancelAfter` to now + a few ledger close times (~5s), then poll until the cancel succeeds.
- **Crypto-condition test data:** Use a fixed known preimage (32 zero bytes = `"0000...0000"`) to derive condition hex deterministically in tests — avoids needing a crypto-condition library at test time. Alternatively use the `five-bells-condition` npm package if already a transitive dependency.
- **File structure:** `src/commands/escrow.ts` — single file with all four sub-commands; `tests/e2e/escrow/` directory with four test files

## Success Metrics

- `xrpl escrow create` / `finish` / `cancel` / `list` all exit 0 on the happy path against testnet
- No test failures due to timing issues (FinishAfter set in past eliminates the time-wait problem for create/finish tests)
- Typecheck passes with strict mode

## Open Questions

- Should `--finish-after` and `--cancel-after` also accept raw Unix timestamps as integers (for power users)? (Current spec: ISO 8601 strings only — simpler to document.)
- Should a future story add IOU/token escrow support? (Tokens require `CancelAfter`, which limits the UX. Out of scope for now.)
