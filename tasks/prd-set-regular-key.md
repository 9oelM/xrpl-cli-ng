# PRD: Set Regular Key Command

## Introduction

Add `xrpl account set-regular-key` to assign or remove a regular signing key on an XRPL account. A regular key allows an account to sign transactions without exposing its master key — improving security by keeping the master key offline. If the regular key is compromised, the master key can be used to replace or remove it.

## Goals

- Support `SetRegularKey` transaction to assign a regular signing key to an account
- Support removing an existing regular key via `--remove` flag
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `account set-regular-key` command

**Description:** As a developer, I want to assign or remove a regular signing key on my account from the CLI so I can sign future transactions without exposing my master key.

**Acceptance Criteria:**
- [ ] Read SetRegularKey docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/setregularkey.md before implementing
- [ ] `xrpl account set-regular-key` subcommand added to `src/commands/account/index.ts`
- [ ] New file `src/commands/account/set-regular-key.ts` implementing the command
- [ ] Options:
  - `--key <address>` (optional) — base58 address of the new regular key to assign
  - `--remove` (flag) — removes the existing regular key (omits `RegularKey` field in tx)
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if both `--key` and `--remove` are provided (mutually exclusive)
- [ ] CLI exits with error if neither `--key` nor `--remove` is provided
- [ ] CLI exits with error if `--key` address equals the master key address of the signing account
- [ ] On success, output prints transaction hash and confirmation message
- [ ] `tests/e2e/account/account.set-regular-key.validation.test.ts`: both `--key` and `--remove` together errors; neither provided errors; missing key material errors — no network
- [ ] `tests/e2e/account/account.set-regular-key.test.ts`:
  - Set a regular key, then verify it works by signing a subsequent tx with `--seed <regular-key-seed>`
  - Remove the regular key with `--remove`, verify the key is cleared via `account info`
  - `--json`, `--dry-run`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `SetRegularKey` transaction — optional `RegularKey` field (address); omit field entirely when `--remove` is used
- FR-2: `--key` and `--remove` are mutually exclusive; at least one must be provided
- FR-3: When `--remove` is used, the `RegularKey` field is omitted from the transaction (not set to empty string or zero)
- FR-4: After setting a regular key, subsequent CLI commands can use `--seed <regular-key-seed>` to sign transactions for that account
- FR-5: `account info` output already shows `RegularKey` field if set — no new query command needed

## Non-Goals

- No `wallet` group integration (SetRegularKey is an on-chain account operation, not local key storage)
- No automatic key generation (user provides the address of an existing key pair)
- No disabling of the master key (`AccountSet` with `asfDisableMaster` flag — separate concern)

## Technical Considerations

- **Mandatory pre-implementation step:** Read SetRegularKey docs (linked above) before writing code
- **File location:** `src/commands/account/set-regular-key.ts`; register in `src/commands/account/index.ts` alongside `set.ts`, `delete.ts`
- **Key material for signing:** The master key (or current regular key) is used to sign the `SetRegularKey` transaction itself — passed via `--seed`/`--mnemonic`/`--account`
- **E2E test pattern:** Fund two wallets in `beforeAll`; use wallet A as the account, wallet B's address as the regular key; after setting, sign a dummy tx (e.g. `account info`) — actually verify by submitting a payment signed with wallet B's seed from wallet A's account
- **`account info` verification:** After removing the regular key, `account info <address> --json` should show no `RegularKey` field in the result

## Success Metrics

- `account set-regular-key --key <address>` sets the regular key on-chain, verifiable via `account info`
- After setting, signing a transaction with the regular key seed works correctly
- `account set-regular-key --remove` clears the regular key on-chain
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
