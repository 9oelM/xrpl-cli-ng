# PRD: Vault Commands

## Introduction

Add `xrpl vault` commands to create, manage, deposit into, withdraw from, and delete single-asset vaults on the XRP Ledger. Vaults are ledger objects that pool a single asset (XRP, IOU, or MPT) and issue share tokens (as MPTs) to depositors representing their proportional claim. They underpin lending protocols and other DeFi primitives on XRPL.

Six transaction types back this feature: `VaultCreate`, `VaultSet`, `VaultDelete`, `VaultDeposit`, `VaultWithdraw`, `VaultClawback`.

> **Important:** The `SingleAssetVault` amendment is not yet live on testnet. All E2E tests must run against **devnet** (`wss://s.devnet.rippletest.net:51233` / faucet `https://faucet.devnet.rippletest.net/accounts`).

## Goals

- Expose `create`, `set`, `delete`, `deposit`, `withdraw`, and `clawback` subcommands under `xrpl vault`
- Reuse the existing `--amount` format (`10`, `10/USD/rIssuer...`, `10/mpt_issuance_id`) for all asset/amount fields
- Support all standard output modes (`--json`, `--dry-run`, `--no-wait`) and key material options
- Full E2E test coverage on devnet

## User Stories

### US-001: `vault create` command

**Description:** As a CLI user, I want to create a single-asset vault so that I can pool assets and issue shares to depositors.

**Acceptance Criteria:**
- [ ] `xrpl vault create --asset <asset>` submits a `VaultCreate` tx where `--asset` uses the standard amount format to identify the asset type (value ignored — use `0` or `0/USD/rIssuer` to specify asset type only)
- [ ] `--assets-maximum <n>` sets the optional `AssetsMaximum` cap (UInt64 string)
- [ ] `--data <hex>` sets optional arbitrary metadata (max 256 bytes hex)
- [ ] `--mpt-metadata <hex>` sets optional `MPTokenMetadata` for vault shares (max 1024 bytes hex)
- [ ] `--domain-id <hash>` sets optional `DomainID` for a private vault (64-char hex)
- [ ] `--private` flag sets `tfVaultPrivate`; requires `--domain-id` when set
- [ ] `--non-transferable` flag sets `tfVaultShareNonTransferable`
- [ ] On success, outputs `Vault ID:  <hash>` extracted from `CreatedNode` where `LedgerEntryType === "Vault"` in tx metadata
- [ ] `--json` outputs `{"result":"success","vaultId":"<hash>","tx":"<hash>"}`
- [ ] `--dry-run` prints unsigned tx JSON and exits without submitting
- [ ] `--no-wait` submits without waiting for validation
- [ ] Supports `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
- [ ] Validation tests (no network): missing `--asset`, `--private` without `--domain-id`, invalid `--domain-id` format
- [ ] E2E tests on devnet: XRP vault, IOU vault, `--private` + `--domain-id`, `--assets-maximum`, `--json`, `--dry-run`, `--no-wait`

### US-002: `vault set` command

**Description:** As a CLI user, I want to update a vault I own so that I can change its metadata, asset cap, or domain.

**Acceptance Criteria:**
- [ ] `xrpl vault set --vault-id <hash>` submits a `VaultSet` tx
- [ ] `--vault-id` is required; must be 64-char hex; error if missing or malformed
- [ ] `--data <hex>` updates metadata (max 256 bytes)
- [ ] `--assets-maximum <n>` updates the asset cap; error if lower than current holdings (enforced by ledger, not CLI)
- [ ] `--domain-id <hash>` updates the domain for a private vault; required when vault is private
- [ ] At least one of `--data`, `--assets-maximum`, `--domain-id` must be provided; error otherwise
- [ ] On success, outputs `Vault ID: <hash>` and `Tx: <hash>`
- [ ] `--json`, `--dry-run`, `--no-wait` supported
- [ ] Validation tests: missing `--vault-id`, invalid `--vault-id`, no update fields provided
- [ ] E2E tests on devnet: update `--data`, update `--assets-maximum`, `--json`, `--dry-run`

### US-003: `vault delete` command

**Description:** As a CLI user, I want to delete an empty vault I own so that I can remove it from the ledger and reclaim the reserve.

**Acceptance Criteria:**
- [ ] `xrpl vault delete --vault-id <hash>` submits a `VaultDelete` tx
- [ ] `--vault-id` is required; must be 64-char hex
- [ ] On success, outputs `Deleted vault: <hash>` and `Tx: <hash>`
- [ ] `--json` outputs `{"result":"success","vaultId":"<hash>","tx":"<hash>"}`
- [ ] `--dry-run`, `--no-wait` supported
- [ ] Validation tests: missing `--vault-id`, invalid `--vault-id` format
- [ ] E2E tests on devnet: create then delete (verify gone via `ledger_entry`), `--json`, `--dry-run`, `--no-wait`

### US-004: `vault deposit` command

**Description:** As a CLI user, I want to deposit assets into a vault so that I receive vault shares in return.

**Acceptance Criteria:**
- [ ] `xrpl vault deposit --vault-id <hash> --amount <amount>` submits a `VaultDeposit` tx
- [ ] `--vault-id` required; 64-char hex
- [ ] `--amount` required; uses standard format (`10`, `10/USD/rIssuer`, `10/mpt_issuance_id`)
- [ ] On success, outputs `Vault ID: <hash>` and `Tx: <hash>`
- [ ] `--json`, `--dry-run`, `--no-wait` supported
- [ ] Validation tests: missing `--vault-id`, missing `--amount`, invalid `--vault-id`
- [ ] E2E tests on devnet: XRP deposit, IOU deposit, `--json`, `--dry-run`, `--no-wait`

### US-005: `vault withdraw` command

**Description:** As a CLI user, I want to withdraw assets from a vault by redeeming my shares so that I can recover my deposited funds.

**Acceptance Criteria:**
- [ ] `xrpl vault withdraw --vault-id <hash> --amount <amount>` submits a `VaultWithdraw` tx
- [ ] `--vault-id` required; 64-char hex
- [ ] `--amount` required; can specify asset quantity (burns necessary shares) or share quantity to redeem — both use standard amount format
- [ ] `--destination <address>` optionally sends redeemed assets to a different account
- [ ] `--destination-tag <n>` optional UInt32 tag (only valid with `--destination`)
- [ ] On success, outputs `Vault ID: <hash>` and `Tx: <hash>`
- [ ] `--json`, `--dry-run`, `--no-wait` supported
- [ ] Validation tests: missing `--vault-id`, missing `--amount`, `--destination-tag` without `--destination`
- [ ] E2E tests on devnet: deposit then withdraw XRP, deposit then withdraw IOU, `--destination`, `--json`, `--dry-run`, `--no-wait`

### US-006: `vault clawback` command

**Description:** As a token issuer, I want to claw back assets from a vault holder so that I can recover funds when regulatory or compliance requirements demand it.

**Acceptance Criteria:**
- [ ] `xrpl vault clawback --vault-id <hash> --holder <address>` submits a `VaultClawback` tx
- [ ] `--vault-id` required; 64-char hex
- [ ] `--holder` required; valid r-address of the account whose shares to claw back
- [ ] `--amount <amount>` optional; if omitted or `0`, claws back all available funds; uses standard amount format
- [ ] Cannot claw back XRP (ledger enforces; document in `--help`)
- [ ] On success, outputs `Vault ID: <hash>`, `Holder: <address>`, `Tx: <hash>`
- [ ] `--json`, `--dry-run`, `--no-wait` supported
- [ ] Validation tests: missing `--vault-id`, missing `--holder`, invalid `--holder` address
- [ ] E2E tests on devnet: IOU vault clawback (issuer claws back from holder), `--amount` partial clawback, `--json`, `--dry-run`

## Functional Requirements

- FR-1: Register `vault` as a top-level command in `src/commands/index.ts` and `src/index.ts`
- FR-2: Implement all six subcommands in `src/commands/vault.ts` using Commander subcommand structure
- FR-3: Reuse `parseAmount`/`toXrplAmount` from `src/utils/amount.js` for all `--amount` and `--asset` fields
- FR-4: `--vault-id` must be validated as a 64-character hex string before any network call; exit code 1 with descriptive error if invalid
- FR-5: Extract `VaultID` from `CreatedNode.LedgerIndex` where `LedgerEntryType === "Vault"` in `meta.AffectedNodes` after `VaultCreate`
- FR-6: `VaultCreate` fee is elevated (0.2 XRP = 200000 drops); set `Fee: "200000"` explicitly or ensure autofill picks it up
- FR-7: `--private` flag maps to `tfVaultPrivate`; `--non-transferable` maps to `tfVaultShareNonTransferable`; combine with bitwise OR
- FR-8: All subcommands support `--json`, `--dry-run`, `--no-wait`, and standard key material options
- FR-9: All E2E tests connect to devnet (`wss://s.devnet.rippletest.net:51233`) and use devnet faucet (`https://faucet.devnet.rippletest.net/accounts`)
- FR-10: `VaultClawback` docs note it cannot claw back XRP — document this in the `--help` text for `vault clawback`

## Non-Goals

- No `vault get` or `vault list` query subcommands (read-only queries, out of scope)
- No automatic share-to-asset conversion display (the ledger handles exchange rate)
- No support for the `WithdrawalPolicy` field in `VaultCreate` (defaults to `0x0001`, FCFS — sufficient for now)
- No multi-asset vaults (not supported by XRPL)

## Technical Considerations

- `VaultCreate` fields: `Asset` (Issue/MPT), `AssetsMaximum?` (UInt64), `Data?` (Blob), `MPTokenMetadata?` (Blob), `DomainID?` (Hash256), flags `tfVaultPrivate`/`tfVaultShareNonTransferable`
- `VaultSet` fields: `VaultID` (Hash256), `Data?`, `AssetsMaximum?`, `DomainID?`
- `VaultDelete` fields: `VaultID` (Hash256)
- `VaultDeposit` fields: `VaultID` (Hash256), `Amount` (Amount)
- `VaultWithdraw` fields: `VaultID` (Hash256), `Amount` (Amount), `Destination?` (AccountID), `DestinationTag?` (UInt32)
- `VaultClawback` fields: `VaultID` (Hash256), `Holder` (AccountID), `Amount?` (Amount, 0 = all)
- All require `SingleAssetVault` amendment; `VaultCreate` with `DomainID` also requires `PermissionedDomains`
- For IOU vault E2E tests: set up issuer, create trust lines, issue tokens, then create vault — this requires careful beforeAll ordering
- `resolveWallet` pattern: follow same shape as `src/commands/escrow.ts`

## Success Metrics

- All 6 subcommands work end-to-end on devnet
- Validation tests run in <5s (no network)
- Full `--json`, `--dry-run`, `--no-wait` coverage per subcommand
- TypeScript strict mode passes with no errors

## Open Questions

- Does devnet currently have `SingleAssetVault` amendment enabled? Verify with `server_info` before starting E2E tests.
- Does xrpl.js `submitAndWait` work with devnet, or does the devnet WS URL need special client config?
- What is the correct xrpl.js type for `Asset` in `VaultCreate` — is it `Issue` (same as trust line currency)? Confirm from xrpl.js type definitions.
