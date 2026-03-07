# PRD: Permissioned Domain Commands

## Introduction

Add `xrpl permissioned-domain` commands to create, update, and delete permissioned domains on the XRP Ledger. Permissioned domains are ledger objects that define a set of accepted credentials — they allow domain owners to gate access to certain XRPL features (e.g. AMM pools, lending protocols) by requiring participants to hold specific credentials issued by trusted issuers.

Two transaction types back this feature: `PermissionedDomainSet` (create or update) and `PermissionedDomainDelete`.

## Goals

- Expose `create`, `update`, and `delete` subcommands under `xrpl permissioned-domain`
- Accept `AcceptedCredentials` via repeatable `--credential` flag or `--credentials-json` escape hatch
- Support all standard output modes (`--json`, `--dry-run`, `--no-wait`) and key material options
- Full E2E test coverage on testnet

## User Stories

### US-001: `permissioned-domain create` command

**Description:** As a CLI user, I want to create a permissioned domain with a set of accepted credentials so that I can define which credential holders are permitted in my domain.

**Acceptance Criteria:**
- [ ] `xrpl permissioned-domain create --credential <issuer>:<type>` submits a `PermissionedDomainSet` tx with no `DomainID` (creates new)
- [ ] `--credential` is repeatable; 1–10 credentials accepted; error if 0 or >10 provided
- [ ] `--credentials-json <json>` accepts a JSON array of `{"issuer":"r...","credential_type":"hex..."}` objects as an alternative to `--credential`; mutually exclusive with `--credential`
- [ ] `<type>` in `--credential <issuer>:<type>` is treated as a UTF-8 string and auto-encoded to hex; `--credential-type-hex` variant accepts raw hex directly (or support `issuer:hex:` prefix convention — see technical notes)
- [ ] On success, outputs `Domain ID: <hash>` extracted from `CreatedNode` in tx metadata
- [ ] `--json` outputs `{"result":"success","domainId":"<hash>","tx":"<hash>"}`
- [ ] `--dry-run` prints the unsigned tx JSON and exits without submitting
- [ ] `--no-wait` submits without waiting for validation
- [ ] Supports `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password` key material
- [ ] Validation tests (no network): missing credentials, >10 credentials, both `--credential` and `--credentials-json`, invalid issuer format
- [ ] E2E tests on testnet: happy path (1 credential), multiple credentials (3), `--json`, `--dry-run`, `--no-wait`

### US-002: `permissioned-domain update` command

**Description:** As a CLI user, I want to update the accepted credentials of an existing permissioned domain I own so that I can change which credentials grant access.

**Acceptance Criteria:**
- [ ] `xrpl permissioned-domain update --domain-id <hash> --credential <issuer>:<type>` submits `PermissionedDomainSet` with the given `DomainID`
- [ ] `--domain-id` is required; error if missing or not a valid 64-char hex hash
- [ ] Same `--credential` / `--credentials-json` rules as `create` (1–10, mutually exclusive)
- [ ] The update **replaces** the entire credentials list (not a merge) — document this clearly in `--help`
- [ ] On success, outputs `Domain ID: <hash>` and `Tx: <hash>`
- [ ] `--json`, `--dry-run`, `--no-wait` supported
- [ ] Same key material options as `create`
- [ ] Validation tests: missing `--domain-id`, invalid domain-id format, missing credentials
- [ ] E2E tests: update domain created in `beforeAll`, verify new credential list, `--json`, `--dry-run`

### US-003: `permissioned-domain delete` command

**Description:** As a CLI user, I want to delete a permissioned domain I own so that I can remove it from the ledger and reclaim the reserve.

**Acceptance Criteria:**
- [ ] `xrpl permissioned-domain delete --domain-id <hash>` submits `PermissionedDomainDelete`
- [ ] `--domain-id` is required; error if missing or not a valid 64-char hex hash
- [ ] On success, outputs `Deleted domain: <hash>` and `Tx: <hash>`
- [ ] `--json` outputs `{"result":"success","domainId":"<hash>","tx":"<hash>"}`
- [ ] `--dry-run`, `--no-wait` supported
- [ ] Same key material options
- [ ] Validation tests: missing `--domain-id`, invalid domain-id format
- [ ] E2E tests: create then delete (verify domain gone via `account_objects`), `--json`, `--dry-run`, `--no-wait`

## Functional Requirements

- FR-1: Register `permissioned-domain` as a top-level command in `src/commands/index.ts` and `src/index.ts`
- FR-2: Implement all three subcommands in `src/commands/permissioned-domain.ts`
- FR-3: `--credential <issuer>:<type>` flag is repeatable; `<type>` is UTF-8 auto-encoded to hex via `convertStringToHex`
- FR-4: `--credentials-json <json>` accepts raw JSON array; each entry must have `issuer` (valid r-address) and `credential_type` (hex string)
- FR-5: `--credential` and `--credentials-json` are mutually exclusive; error if both provided
- FR-6: Validate credential count: 1–10 inclusive; exit with error otherwise
- FR-7: For `create`, extract `DomainID` from `CreatedNode` where `LedgerEntryType === "PermissionedDomain"` in tx metadata
- FR-8: For `update`/`delete`, `--domain-id` must be a 64-character hex string; validate before submitting
- FR-9: All subcommands support standard output modes: `--json`, `--dry-run`, `--no-wait`
- FR-10: All subcommands support standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`

## Non-Goals

- No `list` or `get` query subcommands (out of scope for this PRD)
- No credential validation against on-chain credential objects (just pass through what the user provides)
- No support for modifying individual credentials (update always replaces the full list — this is how the protocol works)

## Technical Considerations

- `PermissionedDomainSet` tx fields: `DomainID` (optional UInt256), `AcceptedCredentials` (required array of `{Issuer, CredentialType}`)
- `PermissionedDomainDelete` tx fields: `DomainID` (required UInt256)
- `AcceptedCredentials` array entries use `Issuer` (classic address) and `CredentialType` (hex-encoded)
- `convertStringToHex` from `xrpl` handles UTF-8 → hex for credential type strings
- Domain ID is in `CreatedNode.LedgerIndex` where `LedgerEntryType === "PermissionedDomain"` in `meta.AffectedNodes`
- Requires `PermissionedDomains` and `Credentials` amendments to be enabled on the network; testnet should have these enabled
- For `--credentials-json`, parse with `JSON.parse` and validate each entry has `issuer` and `credential_type` fields

## Success Metrics

- All three subcommands work end-to-end on testnet
- Validation tests run in <5s (no network)
- Full `--json`, `--dry-run`, `--no-wait` coverage in E2E tests
- TypeScript strict mode passes with no errors

## Open Questions

- Is `PermissionedDomains` amendment currently enabled on XRPL testnet? If not, E2E tests will need to use devnet or be skipped. Verify before implementing.
