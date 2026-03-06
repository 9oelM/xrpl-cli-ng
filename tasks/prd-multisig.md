# PRD: Multisig Commands

## Introduction

Add `xrpl multisig` command group to create, update, delete, and query multi-signature signer lists on XRPL accounts. Multi-sig allows an account to require signatures from multiple parties before a transaction is authorised — useful for shared treasuries, corporate accounts, and enhanced security setups.

## Goals

- Support `SignerListSet` to create or update a signer list with quorum and weighted signers
- Support deleting a signer list (`SignerQuorum: 0`, no entries)
- Support querying the current signer list for an account
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `multisig set` command

**Description:** As a developer, I want to configure a multi-signature signer list on my account from the CLI so I can require multiple parties to authorise transactions.

**Acceptance Criteria:**
- [ ] Read SignerListSet docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/signerlistset.md before implementing
- [ ] `src/commands/multisig.ts` created and registered in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl multisig set` subcommand with:
  - `--quorum <n>` (required) — SignerQuorum; must be > 0 and ≤ sum of all signer weights
  - `--signer <address>:<weight>` (repeatable, at least 1 required) — a signer entry; weight is a positive integer; help text must show example:
    ```
    --signer rAlice...XYZ:3 --signer rBob...ABC:2 --quorum 4
    ```
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if no `--signer` is provided
- [ ] CLI exits with error if `--quorum` exceeds sum of all signer weights
- [ ] CLI exits with error if `--quorum` is 0 (use `multisig delete` instead)
- [ ] CLI exits with error if more than 32 signers are provided
- [ ] CLI exits with error if a signer address appears more than once
- [ ] CLI exits with error if `address:weight` format is invalid (missing colon, non-integer weight, weight ≤ 0)
- [ ] `tests/e2e/multisig/multisig.validation.test.ts`: no signers, quorum > sum of weights, quorum = 0, > 32 signers, duplicate address, invalid format — no network
- [ ] `tests/e2e/multisig/multisig.set.test.ts`: set a 2-of-3 signer list, verify via `multisig list`; update existing signer list with new signers; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `multisig delete` and `multisig list` commands

**Description:** As a developer, I want to delete a signer list and query the current signers so I can manage multi-sig lifecycle.

**Acceptance Criteria:**
- [ ] `xrpl multisig delete` subcommand:
  - Sends `SignerListSet` with `SignerQuorum: 0` and no `SignerEntries`
  - Standard key material and output options
  - No additional flags required
- [ ] `xrpl multisig list <address>` subcommand:
  - Uses `account_objects` RPC with `type: "signer_list"`
  - Default human-readable output: quorum value, then each signer on its own line with address and weight
  - `--json` outputs raw JSON
  - `--node` supported
- [ ] `tests/e2e/multisig/multisig.delete.test.ts`: set a signer list then delete it, verify `multisig list` shows empty result after deletion; `--json`, `--dry-run`
- [ ] `tests/e2e/multisig/multisig.list.test.ts`: set a signer list, verify `multisig list` shows correct quorum and all signers with correct weights; `--json`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `SignerListSet` — `SignerQuorum` (UInt32 > 0), `SignerEntries` array of `{ Account, SignerWeight }` objects
- FR-2: `--signer address:weight` parsed by splitting on the last `:` to support addresses that may contain colons (none do in practice, but defensive parsing)
- FR-3: Quorum validation: `quorum > 0` AND `quorum <= sum(weights)`; enforce in CLI before submitting
- FR-4: Signer list constraints: 1-32 entries, no duplicates, account submitting tx cannot appear as a signer
- FR-5: Delete: `SignerQuorum: 0`, `SignerEntries` field omitted entirely
- FR-6: `multisig list` uses `account_objects` with `type: "signer_list"`; display quorum and each `SignerEntry` (Address + SignerWeight)
- FR-7: `multisig list` shows "No signer list configured" if the account has no signer list

## Non-Goals

- No multi-sig transaction *signing* (collecting and combining signatures from multiple parties) — that is a separate workflow requiring offline coordination
- No `--disable-master` flag (disabling master key after setting up multisig is an `AccountSet` concern)
- No signing with the signer list itself (existing `--seed` key material handles signing `SignerListSet` with the current master/regular key)

## Technical Considerations

- **Mandatory pre-implementation step:** Read SignerListSet docs (linked above) before writing code
- **`--signer` parsing:** Split `"rAlice...XYZ:3"` on last `:` → `{ Account: "rAlice...XYZ", SignerWeight: 3 }`; validate address with xrpl.js `isValidAddress()` and weight is a positive integer
- **Quorum validation:** Compute `sum = signers.reduce((acc, s) => acc + s.weight, 0)` and check `quorum <= sum`
- **E2E test pattern:** Fund 3+ wallets in `beforeAll`; use one as the account, others as signers; `multisig set` then `multisig list` to verify; `multisig delete` then list again to confirm cleared
- **Signer list deletion edge case:** The protocol rejects deletion if the signer list is the account's only signing method (master key disabled) — document in error output but do not add extra CLI logic

## Success Metrics

- `multisig set` creates a valid signer list verifiable via `multisig list`
- `multisig delete` removes the signer list, confirmed by empty `multisig list` output
- Quorum > sum-of-weights is caught by the CLI before any network call
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
