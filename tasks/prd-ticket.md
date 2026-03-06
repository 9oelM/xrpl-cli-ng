# PRD: Ticket Commands

## Introduction

Add `xrpl ticket` command group to create and list tickets on XRPL accounts. Tickets reserve sequence numbers so they can be used out-of-order, enabling parallel transaction submission without sequence conflicts. A single `TicketCreate` transaction reserves 1–250 tickets at once.

## Goals

- Support `TicketCreate` to reserve one or more ticket sequence numbers
- Support querying existing tickets for an account via `ticket list`
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `ticket create` command

**Description:** As a developer, I want to reserve ticket sequence numbers from the CLI so I can submit transactions out-of-order or in parallel without sequence conflicts.

**Acceptance Criteria:**
- [ ] Read TicketCreate docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ticketcreate.md before implementing
- [ ] Create `src/commands/ticket.ts` and register it in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl ticket create` subcommand with:
  - `--count <n>` (required) — number of tickets to create; must be 1–250
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if `--count` is missing
- [ ] CLI exits with error if `--count` is not a positive integer between 1 and 250
- [ ] `tests/e2e/ticket/ticket.validation.test.ts`: missing count, count=0, count=251, count=-1, non-integer count — no network
- [ ] `tests/e2e/ticket/ticket.create.test.ts`: create 1 ticket and verify via `ticket list`; create multiple tickets; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `ticket list` command

**Description:** As a developer, I want to query the current ticket list for an account so I can see which sequence numbers are reserved.

**Acceptance Criteria:**
- [ ] `xrpl ticket list <address>` subcommand:
  - Uses `account_objects` RPC with `type: "ticket"`
  - Default human-readable output: each ticket on its own line as `Ticket sequence: <n>`
  - Shows `No tickets.` if the account has none
  - `--json` outputs raw JSON
  - `--node` supported
- [ ] `tests/e2e/ticket/ticket.list.test.ts`: create tickets, verify `ticket list` shows correct sequences; verify count matches `--count`; `--json`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `TicketCreate` transaction field: `TicketCount` (UInt32, 1–250)
- FR-2: Validate `--count` in range [1, 250]; emit clear error for out-of-range values
- FR-3: `ticket list` uses `account_objects` with `type: "ticket"`; display `TicketSequence` field from each Ticket entry
- FR-4: `ticket list` paginates if `account_objects` returns a `marker` (follow marker until exhausted)

## Non-Goals

- No command for using a ticket in another transaction (that is a general `--ticket-sequence` flag concern, not specific to this command group)
- No deleting individual tickets (tickets are consumed automatically when used or can be canceled via `TicketCreate` with an existing sequence — out of scope)

## Technical Considerations

- **Mandatory pre-implementation step:** Read TicketCreate docs (linked above) before writing code
- **Sequence bump:** `TicketCreate` increases the account's sequence number by `1 + TicketCount`; `--json` output showing the transaction result will reflect this
- **250-ticket limit:** The protocol rejects the transaction if the account would exceed 250 total tickets; CLI validates count alone but cannot pre-check current ticket count (server enforces)
- **E2E test:** Fund one wallet in `beforeAll`; create tickets; verify via `ticket list`

## Success Metrics

- `ticket create --count 3` creates exactly 3 tickets verifiable via `ticket list`
- `ticket list` shows correct sequence numbers
- Out-of-range `--count` caught before any network call
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
