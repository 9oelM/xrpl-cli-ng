# PRD: Check Commands

## Introduction

Add `xrpl check` sub-commands to create, cash, cancel, and list XRPL Checks. A Check is a deferred payment: the sender authorises a maximum amount that the recipient can pull at any time before the check expires. Unlike a Payment, the funds only move when the recipient explicitly cashes the check — useful for invoicing, subscriptions, and escrow-free conditional payments.

## Goals

- Support all three check transaction types: `CheckCreate`, `CheckCash`, `CheckCancel`
- Support querying pending checks for an account via `check list`
- Support both XRP and IOU amounts across all commands
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `check create` command

**Description:** As a developer, I want to issue a check from the CLI so a recipient can pull funds at their convenience without me having to send a payment directly.

**Acceptance Criteria:**
- [ ] Read CheckCreate docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/checkcreate.md before implementing
- [ ] `src/commands/check.ts` created and registered in `src/commands/index.ts`
- [ ] `xrpl check create` subcommand with:
  - `--to <address>` (required) — destination address
  - `--send-max <amount>` (required) — maximum amount sender authorises; XRP as decimal (e.g. `10.5`) or IOU as `value/CURRENCY/issuer` (e.g. `100/USD/rIssuer`)
  - `--expiration <iso8601>` (optional) — expiry datetime; converted to XRPL epoch (`Math.floor(new Date(s).getTime()/1000) - 946684800`)
  - `--destination-tag <n>` (optional) — unsigned 32-bit destination tag
  - `--invoice-id <string>` (optional) — invoice identifier as a plain string (auto hex-encoded via `convertStringToHex`; must be 32 bytes or fewer — CLI rejects longer strings with an error)
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] On success, output prints the Check ID (64-char hex, from transaction metadata `CreatedNode` with `LedgerEntryType: "Check"`)
- [ ] `tests/e2e/check/check.validation.test.ts`: missing `--to`, missing `--send-max`, invalid ISO date for `--expiration`, missing key material — no network required
- [ ] `tests/e2e/check/check.create.test.ts`: create XRP check, create IOU check (with trust line), `--expiration`, `--destination-tag`, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `check cash` command

**Description:** As a developer, I want to cash a check from the CLI so I can pull funds that have been authorised for me.

**Acceptance Criteria:**
- [ ] Read CheckCash docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/checkcash.md before implementing
- [ ] `xrpl check cash` subcommand with:
  - `--check <id>` (required) — 64-char hex Check ID
  - `--amount <amount>` (optional) — cash for exactly this amount; XRP decimal or IOU `value/CURRENCY/issuer`
  - `--deliver-min <amount>` (optional) — cash for at least this amount (flex delivery)
  - Standard key material and output options
- [ ] CLI exits with error if both `--amount` and `--deliver-min` are provided (mutually exclusive)
- [ ] CLI exits with error if neither `--amount` nor `--deliver-min` is provided
- [ ] `tests/e2e/check/check.cash.test.ts`: cash an XRP check with `--amount`, cash with `--deliver-min`, cash an IOU check, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-003: `check cancel` command

**Description:** As a developer, I want to cancel a check from the CLI so locked reserve is returned to the sender.

**Acceptance Criteria:**
- [ ] Read CheckCancel docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/checkcancel.md before implementing
- [ ] `xrpl check cancel` subcommand with:
  - `--check <id>` (required) — 64-char hex Check ID
  - Standard key material and output options
- [ ] `tests/e2e/check/check.cancel.test.ts`: sender cancels own check, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-004: `check list` query command

**Description:** As a developer, I want to list all pending checks for an account so I know which check IDs to cash or cancel.

**Acceptance Criteria:**
- [ ] `xrpl check list <address>` subcommand using `account_objects` RPC with `type: "check"`
- [ ] Default human-readable output per check: check ID, send-max (formatted as XRP decimal or `value/CURRENCY/issuer`), destination, expiration (ISO8601 or "none"), invoice-id (hex or "none")
- [ ] XRPL epoch timestamps converted to ISO8601: `new Date((epoch + 946684800) * 1000).toISOString()`
- [ ] `--json` outputs raw JSON array
- [ ] `--node` supported
- [ ] `tests/e2e/check/check.list.test.ts`: create a check then verify it appears in list; `--json` output
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `CheckCreate` — Destination, SendMax (XRP drops or IOU object), optional Expiration (XRPL epoch), DestinationTag, InvoiceID (`convertStringToHex(input)` — reject if input is longer than 32 bytes)
- FR-2: Amount parsing for `--send-max`, `--amount`, `--deliver-min` reuses the existing `parseAmount` / `toXrplAmount` utilities from `src/utils/amount.ts`
- FR-3: ISO 8601 conversion: `Math.floor(new Date(s).getTime() / 1000) - 946684800`
- FR-4: `CheckCash` — CheckID (hex), exactly one of: Amount or DeliverMin
- FR-5: `CheckCancel` — CheckID (hex); any account can cancel an expired check; only source/destination can cancel unexpired
- FR-6: `check create` prints Check ID on success (from `CreatedNode` in tx metadata)
- FR-7: `check list` uses `account_objects` with `type: "check"`

## Non-Goals

- No `--sender` filter on `check list` (shows checks where address is source or destination — use `account_objects` as-is)
- No multi-sign support (out of scope for all commands)
- No automatic trust line creation before cashing an IOU check

## Technical Considerations

- **Mandatory pre-implementation step:** Read all three doc pages (linked in each story's acceptance criteria) before writing code
- **Amount format:** `SendMax`, `Amount`, and `DeliverMin` use the same format as the existing `payment` command — reuse `parseAmount(str)` and `toXrplAmount(parsed)` from `src/utils/amount.ts`
- **Check ID retrieval:** After `CheckCreate` is validated, find the Check ID from `tx.result.meta.AffectedNodes` — look for `CreatedNode` where `LedgerEntryType === "Check"`, then use `NewFields.index` or the node's `LedgerIndex`
- **IOU check test setup:** Cashing an IOU check requires the destination to have a trust line to the issuer — set up trust line in `beforeAll` before creating the check
- **`account_objects` pagination:** For `check list`, handle `marker` for accounts with many objects (simple loop or just use `limit: 400` for now)

## Success Metrics

- `check create` / `cash` / `cancel` / `list` all exit 0 on the happy path against testnet
- `--amount` and `--deliver-min` mutual exclusion is enforced with a clear error message
- Typecheck passes with strict mode

## Open Questions

- `check list` shows outgoing checks only (account_objects). Incoming checks (where account is destination) are out of scope.
