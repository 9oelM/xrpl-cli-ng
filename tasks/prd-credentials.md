# PRD: Credential Commands

## Introduction

Add `xrpl credential` sub-commands to create, accept, delete, and list XRPL Credentials. Credentials are on-chain attestations issued by one account about another — used for identity verification, KYC, access control, and as prerequisites for deposit preauthorization. The lifecycle is: issuer creates → subject accepts → either party deletes.

## Goals

- Support all three credential transaction types: `CredentialCreate`, `CredentialAccept`, `CredentialDelete`
- Support querying credentials for an account via `credential list`
- Accept `CredentialType` and `URI` as either plain string (auto hex-encoded) or raw hex (via separate flags)
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `credential create` command

**Description:** As a credential issuer, I want to create an on-chain credential for a subject account so I can attest to their identity or permissions.

**Acceptance Criteria:**
- [ ] Read CredentialCreate docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/credentialcreate.md before implementing
- [ ] `src/commands/credential.ts` created and registered in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl credential create` subcommand with:
  - `--subject <address>` (required) — account the credential is issued to
  - `--credential-type <string>` (conditionally required) — credential type as plain string, auto hex-encoded via `convertStringToHex`; max 64 bytes after encoding
  - `--credential-type-hex <hex>` (conditionally required) — credential type as raw hex string, used as-is; must be 2-128 hex chars (1-64 bytes)
  - Exactly one of `--credential-type` or `--credential-type-hex` must be provided; error if both or neither
  - `--uri <string>` (optional) — additional metadata as plain string, auto hex-encoded; max 256 bytes after encoding
  - `--uri-hex <hex>` (optional) — additional metadata as raw hex, used as-is; max 512 hex chars (256 bytes)
  - `--expiration <iso8601>` (optional) — expiry datetime; converted to XRPL epoch (`Math.floor(new Date(s).getTime()/1000) - 946684800`)
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if both `--uri` and `--uri-hex` are provided
- [ ] On success, output prints the Credential ledger entry ID (from tx metadata `CreatedNode` with `LedgerEntryType: "Credential"`)
- [ ] `tests/e2e/credential/credential.validation.test.ts`: missing subject, missing credential-type (neither flag), both credential-type flags, both uri flags, expired expiration, missing key material — no network
- [ ] `tests/e2e/credential/credential.create.test.ts`: create with `--credential-type`, create with `--credential-type-hex`, create with `--uri`, create with `--expiration`, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `credential accept` command

**Description:** As a credential subject, I want to accept a credential issued to me so it becomes active on-chain.

**Acceptance Criteria:**
- [ ] Read CredentialAccept docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/credentialaccept.md before implementing
- [ ] `xrpl credential accept` subcommand with:
  - `--issuer <address>` (required) — address of the account that issued the credential
  - `--credential-type <string>` (conditionally required) — credential type as plain string, auto hex-encoded
  - `--credential-type-hex <hex>` (conditionally required) — credential type as raw hex
  - Exactly one of the two type flags required; error if both or neither
  - Standard key material and output options
- [ ] `tests/e2e/credential/credential.accept.test.ts`: issuer creates credential, subject accepts it, verify accepted status via `credential list`; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-003: `credential delete` command

**Description:** As an issuer or subject, I want to delete a credential from the ledger to revoke it or clean up expired entries.

**Acceptance Criteria:**
- [ ] Read CredentialDelete docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/credentialdelete.md before implementing
- [ ] `xrpl credential delete` subcommand with:
  - `--credential-type <string>` (conditionally required) — plain string, auto hex-encoded
  - `--credential-type-hex <hex>` (conditionally required) — raw hex
  - Exactly one of the two type flags required; error if both or neither
  - `--subject <address>` (optional) — credential subject; defaults to transaction sender if omitted
  - `--issuer <address>` (optional) — credential issuer; defaults to transaction sender if omitted
  - At least one of `--subject` or `--issuer` must differ from the sender — the CLI does not enforce this (protocol enforces it with `tecNO_PERMISSION`)
  - Standard key material and output options
- [ ] `tests/e2e/credential/credential.delete.test.ts`: issuer deletes own credential, subject deletes own credential, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-004: `credential list` query command

**Description:** As a developer, I want to list credentials for an account so I can see what has been issued, accepted, or is pending.

**Acceptance Criteria:**
- [ ] `xrpl credential list <address>` subcommand using `account_objects` RPC with `type: "credential"`
- [ ] Default human-readable output per credential: credential ID, issuer, subject, credential type (decoded from hex to string if valid UTF-8, otherwise shown as hex), URI (decoded if valid UTF-8, else hex, or "none"), expiration (ISO8601 or "none"), accepted (yes/no)
- [ ] XRPL epoch timestamps converted to ISO8601: `new Date((epoch + 946684800) * 1000).toISOString()`
- [ ] `--json` outputs raw JSON array
- [ ] `--node` supported
- [ ] `tests/e2e/credential/credential.list.test.ts`: create and accept a credential, verify it appears in list with accepted=yes; create without accepting, verify accepted=no; `--json` output
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `CredentialCreate` — Subject (address), CredentialType (hex blob 1-64 bytes), optional URI (hex blob 1-256 bytes), optional Expiration (XRPL epoch)
- FR-2: `CredentialAccept` — Issuer (address), CredentialType (hex blob); sender must be the credential subject
- FR-3: `CredentialDelete` — CredentialType (hex blob), optional Subject (defaults to sender), optional Issuer (defaults to sender)
- FR-4: Plain string encoding: `convertStringToHex(str)` from xrpl.js; validate byte length after encoding (not char count)
- FR-5: Raw hex validation: must be even-length, valid hex characters only; length within bounds for the field
- FR-6: Credential ledger entry ID retrieval after create: scan `AffectedNodes` for `CreatedNode` with `LedgerEntryType: "Credential"`
- FR-7: `credential list` uses `account_objects` with `type: "credential"`
- FR-8: For display, attempt `Buffer.from(hexStr, 'hex').toString('utf8')` and show decoded string if result is valid printable UTF-8; otherwise show raw hex

## Non-Goals

- No credential-based DepositPreauth integration (covered in DepositPreauth PRD)
- No credential verification or signature checking (credentials are simple on-chain attestations)
- No batch credential creation

## Technical Considerations

- **Mandatory pre-implementation step:** Read all three doc pages (linked per story) before writing code
- **Credentials amendment:** Must be enabled on testnet; verify before testing
- **`convertStringToHex`:** Imported from xrpl.js; byte length = `str.length` for ASCII, use `Buffer.byteLength(str, 'utf8')` for accurate multi-byte check
- **Credential ID:** From `AffectedNodes` → `CreatedNode` → `LedgerIndex` where `LedgerEntryType === "Credential"`
- **Accepted flag:** In `account_objects` response, a credential has `lsfAccepted` flag set once accepted via `CredentialAccept`
- **E2E test pattern:** Create credential in `beforeAll` with issuer wallet; accept with subject wallet; list to verify

## Success Metrics

- Full lifecycle (create → accept → delete) works against testnet
- `--credential-type` and `--credential-type-hex` are mutually exclusive with clear errors
- `credential list` shows both accepted and pending credentials
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
