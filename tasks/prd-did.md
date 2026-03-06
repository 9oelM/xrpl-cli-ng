# PRD: DID Commands

## Introduction

Add `xrpl did` command group to create, update, delete, and query Decentralized Identifiers (DIDs) on the XRP Ledger. The DID amendment lets accounts publish identity credentials and DID documents directly on-ledger, enabling self-sovereign identity use cases without off-chain infrastructure.

## Goals

- Support `DIDSet` to create or update a DID with `URI`, `Data`, and/or `DIDDocument` fields
- Support clearing individual DID fields via explicit flags or empty string
- Support `DIDDelete` to remove a DID ledger entry
- Support querying a DID via `did get`
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `did set` command

**Description:** As an identity provider, I want to publish or update a DID on-chain from the CLI so I can associate identity credentials with my XRPL account.

**Acceptance Criteria:**
- [ ] Read DIDSet docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/didset.md before implementing
- [ ] Create `src/commands/did.ts` and register it in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl did set` subcommand with:
  - `--uri <string>` — URI as plain UTF-8 string, auto hex-encoded via `convertStringToHex`
  - `--uri-hex <hex>` — URI as raw hex blob; mutually exclusive with `--uri`
  - `--data <string>` — Data as plain UTF-8 string, auto hex-encoded
  - `--data-hex <hex>` — Data as raw hex blob; mutually exclusive with `--data`
  - `--did-document <string>` — DIDDocument as plain UTF-8 string, auto hex-encoded
  - `--did-document-hex <hex>` — DIDDocument as raw hex blob; mutually exclusive with `--did-document`
  - `--clear-uri` — clears the URI field (sends `URI: ""`)
  - `--clear-data` — clears the Data field (sends `Data: ""`)
  - `--clear-did-document` — clears the DIDDocument field (sends `DIDDocument: ""`)
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if none of `--uri`, `--uri-hex`, `--data`, `--data-hex`, `--did-document`, `--did-document-hex`, `--clear-uri`, `--clear-data`, `--clear-did-document` are provided
- [ ] CLI exits with error if both `--uri` and `--uri-hex` are provided (same for data/did-document pairs)
- [ ] CLI exits with error if both `--uri` (or `--uri-hex`) and `--clear-uri` are provided for the same field
- [ ] Passing `--uri ""` is equivalent to `--clear-uri` (empty string → `URI: ""`)
- [ ] `tests/e2e/did/did.validation.test.ts`: no fields provided, conflicting plain/hex flags, conflicting set/clear for same field — no network
- [ ] `tests/e2e/did/did.set.test.ts`: create DID with --uri, create with --data, create with --did-document, update URI, clear a field; --json, --dry-run
- [ ] Typecheck passes

### US-002: `did delete` and `did get` commands

**Description:** As an identity provider, I want to delete my DID and query DID data so I can manage my on-chain identity lifecycle and verify published data.

**Acceptance Criteria:**
- [ ] Read DIDDelete docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/diddelete.md before implementing
- [ ] `xrpl did delete` subcommand:
  - No DID-specific flags; standard key material and output options only
- [ ] `xrpl did get <address>` subcommand:
  - Uses `account_objects` RPC with `type: "did"` to fetch the DID entry
  - Default human-readable output: URI (decoded from hex to UTF-8), Data (shown as raw hex), DIDDocument (decoded from hex to UTF-8)
  - Shows `No DID found for <address>.` if the account has no DID entry
  - `--json` outputs raw JSON ledger entry
  - `--node` supported
- [ ] `tests/e2e/did/did.delete.test.ts`: create DID, delete it, verify `did get` returns not-found after deletion; --json, --dry-run
- [ ] `tests/e2e/did/did.get.test.ts`: create DID with all fields, verify `did get` returns correct decoded values; --json
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `DIDSet` fields: `URI` (hex blob, optional), `Data` (hex blob, optional), `DIDDocument` (hex blob, optional) — at least one must be non-empty
- FR-2: Plain string flags encoded via `convertStringToHex(str)`; hex flags used as-is
- FR-3: Clear a field by setting it to `""` in the transaction; `--clear-uri` / empty `--uri ""` both produce `URI: ""`
- FR-4: `DIDDelete` has no transaction-specific fields; just common fields
- FR-5: `did get` uses `account_objects` with `type: "did"` and returns the first result; decode `URI` and `DIDDocument` from hex to UTF-8 for display; display `Data` as raw hex
- FR-6: Validate field combinations before submitting: no field set + no clear flag = error

## Non-Goals

- No DID document validation (well-formedness of JSON-LD DID documents is the user's responsibility)
- No resolution of external DID documents (only on-ledger data)
- No `did resolve` command aggregating multiple sources

## Technical Considerations

- **Mandatory pre-implementation step:** Read both DID doc pages (linked above) before writing code
- **All three fields are optional individually** but the transaction requires at least one non-empty field; an update that would result in all three being empty fails with `tecEMPTY_DID`
- **`account_objects` for did get:** Use `{ command: "account_objects", account: address, type: "did" }`; the response `account_objects` array will contain at most one DID entry per account
- **E2E test pattern:** Fund one wallet in `beforeAll`; create DID; verify with `did get`; update; verify again; delete; verify not-found

## Success Metrics

- `did set --uri "ipfs://..."` creates a DID verifiable via `did get`
- `did delete` removes the DID, confirmed by `did get` returning not-found
- `--clear-uri` and `--uri ""` both produce `URI: ""` in the transaction
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
