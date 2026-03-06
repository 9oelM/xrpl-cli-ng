# PRD: MPToken Issuance Commands

## Introduction

Add `xrpl mptoken` command group to manage Multi-Purpose Token (MPT) issuances on the XRP Ledger. The existing `payment` command already handles MPT transfers; this PRD covers the issuance lifecycle — creating an MPT definition, destroying it, locking/unlocking holders, authorizing accounts to hold the token, and querying issuances.

## Goals

- Support `MPTokenIssuanceCreate` to define a new MPT with configurable flags, scale, cap, and metadata
- Support `MPTokenIssuanceDestroy` to remove an MPT issuance (when no holders exist)
- Support `MPTokenIssuanceSet` to lock/unlock an issuance globally or per holder
- Support `MPTokenAuthorize` for both holder opt-in and issuer allow-listing
- Support querying issuances via `mptoken issuance list` and `mptoken issuance get`
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `mptoken issuance create` command

**Description:** As a token issuer, I want to define a new MPT issuance from the CLI so I can issue fungible tokens with customizable properties.

**Acceptance Criteria:**
- [ ] Read MPTokenIssuanceCreate docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/mptokenissuancecreate.md before implementing
- [ ] Create `src/commands/mptoken.ts` and register it in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl mptoken issuance create` subcommand with:
  - `--asset-scale <n>` (optional, 0–255, default 0) — decimal precision; display amount = raw amount × 10^(-scale)
  - `--max-amount <string>` (optional) — maximum issuable amount as a base-10 string; default is 2^63-1
  - `--transfer-fee <n>` (optional, 0–50000) — secondary-sale fee in units of 0.001%; requires `can-transfer` flag
  - `--flags <list>` (optional) — comma-separated flag names from: `can-lock`, `require-auth`, `can-escrow`, `can-trade`, `can-transfer`, `can-clawback`
  - `--metadata <string>` (optional) — metadata as plain UTF-8 string, auto hex-encoded via `convertStringToHex`
  - `--metadata-hex <hex>` (optional) — metadata as raw hex; mutually exclusive with `--metadata` and `--metadata-file`
  - `--metadata-file <path>` (optional) — path to a file whose contents are read and hex-encoded; mutually exclusive with `--metadata` and `--metadata-hex`
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] After successful create, print the resulting `MPTokenIssuanceID` prominently (it is needed for all subsequent commands)
- [ ] CLI exits with error if an unknown flag name is given in `--flags`
- [ ] CLI exits with error if `--transfer-fee` is set without `can-transfer` in `--flags`
- [ ] CLI exits with error if more than one of `--metadata`, `--metadata-hex`, `--metadata-file` is provided
- [ ] CLI exits with error if `--metadata-file` path does not exist
- [ ] `tests/e2e/mptoken/mptoken.validation.test.ts`: unknown flag name, transfer-fee without can-transfer, multiple metadata flags — no network
- [ ] `tests/e2e/mptoken/mptoken.create.test.ts`: create basic issuance, create with flags and transfer fee, create with --metadata, create with --metadata-file; verify via `mptoken issuance get`; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `mptoken issuance destroy` and `mptoken issuance set` commands

**Description:** As a token issuer, I want to delete an MPT issuance and lock/unlock token balances so I can manage the issuance lifecycle and compliance controls.

**Acceptance Criteria:**
- [ ] Read MPTokenIssuanceDestroy docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/mptokenissuancedestroy.md before implementing
- [ ] Read MPTokenIssuanceSet docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/mptokenissuanceset.md before implementing
- [ ] `xrpl mptoken issuance destroy <issuance-id>` subcommand:
  - Takes `MPTokenIssuanceID` as positional argument
  - Standard key material and output options
- [ ] `xrpl mptoken issuance set <issuance-id>` subcommand:
  - Takes `MPTokenIssuanceID` as positional argument
  - `--lock` (boolean flag) — lock the issuance globally or for the specified holder
  - `--unlock` (boolean flag) — unlock; mutually exclusive with `--lock`
  - `--holder <address>` (optional) — apply to a specific holder; omit to apply globally
  - Standard key material and output options
- [ ] CLI exits with error if neither `--lock` nor `--unlock` is provided for `issuance set`
- [ ] CLI exits with error if both `--lock` and `--unlock` are provided
- [ ] `tests/e2e/mptoken/mptoken.issuance.test.ts`: create issuance, lock globally, unlock globally, lock per-holder, destroy issuance; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-003: `mptoken authorize` command

**Description:** As a token holder or issuer, I want to opt in to holding an MPT or grant/revoke allow-list permissions so I can receive and manage MPT balances.

**Acceptance Criteria:**
- [ ] Read MPTokenAuthorize docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/mptokenauthorize.md before implementing
- [ ] `xrpl mptoken authorize <issuance-id>` subcommand:
  - Takes `MPTokenIssuanceID` as positional argument
  - `--holder <address>` (optional) — issuer-side: authorize or revoke a specific holder; omit when holder opts in/out themselves
  - `--unauthorize` (boolean flag) — revoke instead of grant; holder uses this to opt out (balance must be zero); issuer uses to revoke allow-list permission
  - Standard key material and output options
- [ ] `tests/e2e/mptoken/mptoken.authorize.test.ts`: holder opts in (creates MPToken entry), holder opts out, issuer authorizes holder on allow-listed issuance, issuer revokes; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-004: `mptoken issuance list` and `mptoken issuance get` commands

**Description:** As a token issuer or developer, I want to query MPT issuances so I can verify properties and track issuance state.

**Acceptance Criteria:**
- [ ] `xrpl mptoken issuance list <address>` subcommand:
  - Uses `account_objects` RPC with `type: "mpt_issuance"`
  - Default output: each issuance on its own line with ID, AssetScale, MaximumAmount, OutstandingAmount, flags
  - Shows `No MPT issuances.` if the account has none
  - `--json` outputs raw JSON
  - `--node` supported
- [ ] `xrpl mptoken issuance get <issuance-id>` subcommand:
  - Uses `ledger_entry` RPC with `{ mpt_issuance: issuanceId }`
  - Default output: ID, Issuer, AssetScale, MaximumAmount, OutstandingAmount, TransferFee, flags (decoded names), Metadata (decoded from hex to UTF-8)
  - `--json` outputs raw JSON ledger entry
  - `--node` supported
- [ ] `tests/e2e/mptoken/mptoken.query.test.ts`: create issuance, verify `mptoken issuance list` shows it, verify `mptoken issuance get` shows correct properties; `--json`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `MPTokenIssuanceCreate` flags bitmap: `can-lock`=2, `require-auth`=4, `can-escrow`=8, `can-trade`=16, `can-transfer`=32, `can-clawback`=64; combine with bitwise OR
- FR-2: `--flags` validation: split on comma, trim whitespace, reject any unknown name with a clear error listing valid names
- FR-3: `--transfer-fee` validation: integer 0–50000; error if `can-transfer` not in `--flags`
- FR-4: `--metadata` → `convertStringToHex(str)`; `--metadata-hex` → as-is; `--metadata-file` → read file synchronously, then `convertStringToHex(contents)`. All three are mutually exclusive.
- FR-5: `MPTokenIssuanceSet` flags: `--lock` → `Flags: 1` (`tfMPTLock`); `--unlock` → `Flags: 2` (`tfMPTUnlock`)
- FR-6: `MPTokenAuthorize` with `--unauthorize` → `Flags: 1` (`tfMPTUnauthorize`); without → `Flags: 0`
- FR-7: `mptoken issuance get` uses `{ command: "ledger_entry", mpt_issuance: issuanceId }`
- FR-8: `mptoken issuance list` uses `account_objects` with `type: "mpt_issuance"` and follows `marker` for pagination
- FR-9: Metadata display in `mptoken issuance get`: attempt `Buffer.from(hex, 'hex').toString('utf8')`; if result is not valid UTF-8, show raw hex

## Non-Goals

- No MPT payment commands (already handled by `xrpl payment`)
- No `DomainID` support (requires PermissionedDomains + SingleAssetVault amendments, not yet widely available)
- No `mptoken holders list <issuance-id>` (querying all holders requires scanning the ledger — out of scope)

## Technical Considerations

- **Mandatory pre-implementation step:** Read all four MPToken doc pages (linked above) before writing code
- **MPTokenIssuanceID format:** 48 hex character string (UInt192); displayed by the node in the transaction metadata after `MPTokenIssuanceCreate` succeeds; extract from `tx.meta.AffectedNodes` or the `CreatedNode` entry with `LedgerEntryType: "MPTokenIssuance"`
- **E2E test pattern:** Fund one issuer wallet and one holder wallet in `beforeAll`; issuer creates issuance; holder opts in via `authorize`; issuer authorizes holder (if require-auth); payment sent; verify balance; test lock/unlock; destroy
- **`can-transfer` + `transfer-fee` dependency:** enforced at the CLI level before submitting; the protocol also enforces it (`temMALFORMED`)

## Success Metrics

- `mptoken issuance create --flags can-transfer --transfer-fee 100` creates a verifiable issuance
- `mptoken issuance get <id>` shows correct AssetScale, flags, and decoded metadata
- `mptoken authorize` correctly creates/deletes MPToken holder entries
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
