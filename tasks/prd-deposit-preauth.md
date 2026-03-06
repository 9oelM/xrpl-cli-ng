# PRD: Deposit Preauth Commands

## Introduction

Add `xrpl deposit-preauth` command group to grant and revoke deposit preauthorization on XRPL accounts. When an account enables Deposit Authorization, only preauthorized senders can deliver payments. This command lets a user manage their preauth list — by account address or by credential type — and query the list of existing preauthorizations.

## Goals

- Support `DepositPreauth` to authorize or unauthorize a single account
- Support `DepositPreauth` to authorize or unauthorize a credential type (issuer + CredentialType blob)
- Support querying existing deposit preauthorizations via `deposit-preauth list`
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `deposit-preauth` set command

**Description:** As an account owner, I want to grant or revoke deposit preauthorization from the CLI so I can control who can send payments to my account when Deposit Authorization is enabled.

**Acceptance Criteria:**
- [ ] Read DepositPreauth docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/depositpreauth.md before implementing
- [ ] Create `src/commands/deposit-preauth.ts` and register it in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl deposit-preauth` command with exactly one of the following main flags (required):
  - `--authorize <address>` — grant deposit preauthorization to an account
  - `--unauthorize <address>` — revoke deposit preauthorization from an account
  - `--authorize-credential <issuer>` — grant preauth for a credential type (requires `--credential-type` or `--credential-type-hex`)
  - `--unauthorize-credential <issuer>` — revoke preauth for a credential type (requires `--credential-type` or `--credential-type-hex`)
- [ ] `--credential-type <string>` — CredentialType as plain UTF-8 string, auto hex-encoded via `convertStringToHex`
- [ ] `--credential-type-hex <hex>` — CredentialType as raw hex blob; mutually exclusive with `--credential-type`
- [ ] Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
- [ ] Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if none of the four main flags are provided
- [ ] CLI exits with error if more than one of the four main flags are provided
- [ ] CLI exits with error if `--credential-type` or `--credential-type-hex` is used without `--authorize-credential` or `--unauthorize-credential`
- [ ] CLI exits with error if both `--credential-type` and `--credential-type-hex` are provided
- [ ] CLI exits with error if `--authorize-credential` or `--unauthorize-credential` is used without `--credential-type` or `--credential-type-hex`
- [ ] `tests/e2e/deposit-preauth/deposit-preauth.validation.test.ts`: no main flag, multiple main flags, credential-type without credential flag, both credential-type flags, credential flag without credential-type — no network
- [ ] `tests/e2e/deposit-preauth/deposit-preauth.set.test.ts`: authorize account, unauthorize account, authorize by credential, unauthorize by credential; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `deposit-preauth list` command

**Description:** As an account owner, I want to query the list of existing deposit preauthorizations so I can verify who is authorized to send payments.

**Acceptance Criteria:**
- [ ] `xrpl deposit-preauth list <address>` subcommand:
  - Uses `account_objects` RPC with `type: "deposit_preauth"`
  - Default human-readable output: each preauth on its own line — `Account: <address>` for account-based, `Credential: <issuer> / <credential-type-decoded>` for credential-based
  - Shows `No deposit preauthorizations.` if the account has none
  - `--json` outputs raw JSON
  - `--node` supported
- [ ] `tests/e2e/deposit-preauth/deposit-preauth.list.test.ts`: authorize an account, verify it appears in list; authorize a credential, verify it appears; unauthorize and verify removal; `--json`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `DepositPreauth` transaction fields: `Authorize` (AccountID) OR `AuthorizeCredentials` (array of `{Credential: {Issuer, CredentialType}}`) OR `Unauthorize` (AccountID) OR `UnauthorizeCredentials` (array) — exactly one
- FR-2: `--authorize-credential <issuer>` maps to `AuthorizeCredentials: [{Credential: {Issuer: issuer, CredentialType: hex}}]`
- FR-3: `--unauthorize-credential <issuer>` maps to `UnauthorizeCredentials: [{Credential: {Issuer: issuer, CredentialType: hex}}]`
- FR-4: `--credential-type <str>` → `convertStringToHex(str)`; `--credential-type-hex <hex>` → use as-is
- FR-5: `deposit-preauth list` uses `account_objects` with `type: "deposit_preauth"`; decode `CredentialType` hex to UTF-8 for human display
- FR-6: Validate `--authorize` and `--unauthorize` addresses with `isValidClassicAddress()` from xrpl.js

## Non-Goals

- No enabling/disabling Deposit Authorization itself (that is done via `account set --require-dest` / `AccountSet` flags — a separate command)
- No batch authorize (authorize multiple accounts in one transaction)

## Technical Considerations

- **Mandatory pre-implementation step:** Read DepositPreauth docs (linked above) before writing code
- **Credential preauth format:** `AuthorizeCredentials` takes an array but in practice only one credential per transaction; the array always has exactly one element when using the CLI
- **E2E test setup:** Enable Deposit Authorization on the account under test (`AccountSet` with `asfDepositAuth` flag) to make preauth meaningful; use a second funded wallet as the sender to verify preauth works

## Success Metrics

- Authorize an account → that account can successfully send to the authorizing account with Deposit Authorization enabled
- Unauthorize → subsequent payment attempt fails
- `deposit-preauth list` correctly shows and removes entries
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
