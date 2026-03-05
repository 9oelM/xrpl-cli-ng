# PRD: `xrpl account` — Account Commands + Wallet Aliases + Global `--node`

## Introduction

This PRD covers three tightly coupled features:

1. **Global `--node` flag** — move the XRPL node URL from per-command to the root `xrpl` command, resolving via flag → `XRPL_NODE` env var → default (`testnet`). Affects all existing and future commands.
2. **Wallet aliases** — add a `label` field to keystore files so wallets can be referenced by a human-readable name (e.g. `alice`) instead of their `r`-address. New `wallet alias` subcommands manage labels.
3. **`xrpl account` commands** — full account lifecycle: read-only queries (`info`, `balance`, `transactions`, `offers`, `trust-lines`, `channels`, `nfts`) and write commands (`set`, `delete`).

---

## Goals

- All commands use a single `--node` / `XRPL_NODE` configuration point
- Any command accepting an address also accepts an alias (resolved via keystore)
- Full read coverage of an XRPL account's on-ledger state
- Write commands (`account set`, `account delete`) use the same key material pattern as wallet commands
- Human-readable output by default; `--json` for scripting
- Every command covered by tests

---

## User Stories

### US-001: Add `label` field to keystore + `resolveAccount()` utility
**Description:** As a developer, I need keystore files to optionally store a human-readable alias and a utility to resolve an address-or-alias to a classic address.

**Acceptance Criteria:**
- [ ] Add `label?: string` to the `KeystoreFile` type in `src/utils/keystore.ts`
- [ ] `encryptKeystore` accepts an optional `label` parameter and includes it in the output JSON if provided
- [ ] Existing keystore files without `label` are still valid (field is optional)
- [ ] Add `resolveAccount(addressOrAlias: string, keystoreDir: string): string` to `src/utils/keystore.ts`
  - If input looks like an XRPL address (starts with `r`, length 25–34), return it unchanged
  - Otherwise, scan all `*.json` files in `keystoreDir` for a matching `label` field; return the `address` field of the match
  - Throw a clear error if alias is not found: `Error: no wallet with alias '<name>' found in keystore`
- [ ] Unit tests: `resolveAccount` returns address as-is; resolves a known alias; throws on unknown alias
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-002: `wallet alias set` and `wallet alias remove`
**Description:** As a user, I want to assign or remove a human-readable alias on an existing keystore entry so I can reference wallets by name.

**Acceptance Criteria:**
- [ ] Create `src/commands/wallet/alias.ts` with a `wallet alias` subcommand group registered in `src/commands/wallet/index.ts`
- [ ] `xrpl wallet alias set <address> <name>` reads the keystore file for `<address>`, sets `label` to `<name>`, writes back atomically
- [ ] `alias set` errors with exit 1 if `<address>` is not found in keystore
- [ ] `alias set` errors with exit 1 if `<name>` is already used by a different address, unless `--force` is passed
- [ ] `xrpl wallet alias remove <address>` removes the `label` field from the keystore file for `<address>`
- [ ] `alias remove` errors with exit 1 if `<address>` is not found in keystore
- [ ] Both subcommands respect `--keystore <dir>` / `XRPL_KEYSTORE` env var
- [ ] Both print confirmation: `Alias '<name>' set for <address>` / `Alias removed from <address>`
- [ ] E2E test: import a wallet, `alias set`, verify keystore JSON contains `label`, `alias remove`, verify `label` is gone
- [ ] E2E test: `alias set` with a duplicate name errors with exit 1; `--force` overwrites
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-003: `wallet alias list` — show all aliases
**Description:** As a user, I want to see all named wallets at a glance.

**Acceptance Criteria:**
- [ ] `xrpl wallet alias list` scans keystore directory, prints one `<alias> → <address>` line per wallet that has a label
- [ ] Wallets without a label are omitted
- [ ] `--json` outputs array of `{ alias, address }` objects
- [ ] Prints `(no aliases set)` if no labelled wallets exist
- [ ] Respects `--keystore <dir>` / `XRPL_KEYSTORE`
- [ ] E2E test: import two wallets with aliases, run `alias list`, assert both appear; import third without alias, assert it does not appear
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-004: `--alias` flag on `wallet import`
**Description:** As a user, I want to set an alias at import time without a separate command.

**Acceptance Criteria:**
- [ ] Add `--alias <name>` option to `src/commands/wallet/import.ts`
- [ ] If provided, passes `label` to `encryptKeystore` so it is stored in the keystore file
- [ ] Alias uniqueness check applied (same rule as `alias set`): error if name already taken, `--force` overrides
- [ ] Printed confirmation updated to: `Imported account <address> (alias: <name>) to <filepath>` when alias is given
- [ ] E2E test: `wallet import --alias alice`, verify keystore contains `"label": "alice"`, verify `wallet alias list` shows it
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-005: `wallet list` shows alias column
**Description:** As a user, I want `wallet list` to show aliases alongside addresses so I can see the full picture at a glance.

**Acceptance Criteria:**
- [ ] `wallet list` output shows `<address>  <alias>` (alias column right-padded, blank if unset)
- [ ] `--json` output changes from `string[]` to `{ address: string, alias?: string }[]`
- [ ] Existing E2E tests for `wallet list` updated to match new output format
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-006: Global `--node` flag on root command
**Description:** As a developer, I need a single place to configure the XRPL node so users don't have to repeat `--node` on every subcommand.

**Acceptance Criteria:**
- [ ] Add `.option('-n, --node <url>', 'XRPL node URL or network name (mainnet|testnet|devnet)', process.env.XRPL_NODE ?? 'testnet')` to the root `program` in `src/index.ts`
- [ ] Create `src/utils/node.ts` exporting `getNodeUrl(cmd: Command): string` that calls `cmd.optsWithGlobals().node` then `resolveNodeUrl()`
- [ ] Remove `--node` option from `src/commands/account.ts` (the existing stub)
- [ ] All future commands use `getNodeUrl(cmd)` — do not add `--node` to individual subcommands
- [ ] `XRPL_NODE` env var sets the default (already handled via the option default expression)
- [ ] E2E test: `XRPL_NODE=mainnet xrpl account info <address>` uses mainnet URL (use a known mainnet address); `--node testnet` overrides env var
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-007: `account info` — full account info (rewrite stub)
**Description:** As a user, I want to see the full on-ledger state of an XRPL account.

**Acceptance Criteria:**
- [ ] Rewrite `src/commands/account.ts` as `src/commands/account/index.ts` (command group) + `src/commands/account/info.ts`; update `src/commands/index.ts`
- [ ] `xrpl account info <address-or-alias>` fetches `account_info` with `ledger_index: 'validated'`
- [ ] Printed fields (labelled lines): Address, Balance (XRP), Sequence, Owner Count, Flags (hex + decoded names), Domain (hex decoded to UTF-8 if set), Email Hash, Transfer Rate (raw + human: `<rate>/1e9`), Tick Size, Account Index
- [ ] `--json` outputs the raw `account_data` object from the XRPL response
- [ ] Accepts alias via `resolveAccount()` with keystore dir from `XRPL_KEYSTORE` / `~/.xrpl/keystore/`
- [ ] Alias: `xrpl account i`, `xrpl account addr` removed (not applicable for account)
- [ ] Uses `getNodeUrl(cmd)` for node resolution
- [ ] E2E test (testnet): fund a fresh account from faucet, run `account info`, assert Address matches and Balance is a positive number
- [ ] E2E test: `--json` output contains `Account` and `Balance` fields
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-008: `account balance` — XRP balance shorthand
**Description:** As a user, I want a quick one-liner to check an account's XRP balance without the full info dump.

**Acceptance Criteria:**
- [ ] `xrpl account balance <address-or-alias>` prints a single line: `<amount> XRP`
- [ ] `--drops` flag prints the raw drops value instead
- [ ] `--json` outputs `{ address, balanceXrp, balanceDrops }`
- [ ] Uses `getNodeUrl(cmd)`
- [ ] Alias: `xrpl account bal`
- [ ] E2E test: fund testnet account, run `account balance`, assert output matches `\d+(\.\d+)? XRP`
- [ ] E2E test: `--drops` output is a plain integer string
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-009: `account transactions` — list recent transactions
**Description:** As a user, I want to see an account's recent transactions with the most important fields visible at a glance.

**Acceptance Criteria:**
- [ ] `xrpl account transactions <address-or-alias>` fetches `account_tx` with `ledger_index_min: -1`
- [ ] Default `--limit 20`; `--limit <n>` overrides (max 400, matching XRPL server limit)
- [ ] `--marker <marker-json>` enables pagination (accepts the JSON marker from previous `--json` output)
- [ ] Human-readable output: one line per tx — `<ledger>  <type>  <result>  <hash>`
- [ ] `--json` outputs `{ transactions: [...], marker?: ... }` (raw tx objects from XRPL)
- [ ] Uses `getNodeUrl(cmd)`
- [ ] Alias: `xrpl account txs`
- [ ] E2E test: submit a payment on testnet, run `account transactions`, assert the tx hash appears in output
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-010: `account offers` — list open DEX offers
**Description:** As a user, I want to see all open DEX offers placed by an account.

**Acceptance Criteria:**
- [ ] `xrpl account offers <address-or-alias>` fetches `account_offers`
- [ ] Human-readable output: one line per offer — `#<seq>  <taker-pays> → <taker-gets>  quality: <quality>`
- [ ] Amounts shown as `<value> <currency>` (XRP for drops converted, issued tokens as `<value>/<currency>/<issuer>`)
- [ ] `--json` outputs raw `offers` array
- [ ] `--limit <n>` and `--marker` for pagination
- [ ] Uses `getNodeUrl(cmd)`
- [ ] Alias: `xrpl account of`
- [ ] E2E test: prints `(no open offers)` for a fresh account
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-011: `account trust-lines` — list trust lines
**Description:** As a user, I want to see all trust lines an account has established.

**Acceptance Criteria:**
- [ ] `xrpl account trust-lines <address-or-alias>` fetches `account_lines`
- [ ] Human-readable output: one line per line — `<currency>/<account>  balance: <bal>  limit: <limit>`
- [ ] `--peer <address>` filters to trust lines with a specific issuer
- [ ] `--json` outputs raw `lines` array
- [ ] `--limit <n>` and `--marker` for pagination
- [ ] Uses `getNodeUrl(cmd)`
- [ ] Alias: `xrpl account lines`
- [ ] E2E test: prints `(no trust lines)` for a fresh account
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-012: `account channels` — list payment channels
**Description:** As a user, I want to see all payment channels where an account is the source.

**Acceptance Criteria:**
- [ ] `xrpl account channels <address-or-alias>` fetches `account_channels`
- [ ] Human-readable output: one line per channel — `<channel-id>  dest: <dest>  amount: <xrp> XRP  balance: <xrp> XRP`
- [ ] `--destination-account <address>` filters by destination
- [ ] `--json` outputs raw `channels` array
- [ ] `--limit <n>` and `--marker` for pagination
- [ ] Uses `getNodeUrl(cmd)`
- [ ] Alias: `xrpl account chan`
- [ ] E2E test: prints `(no payment channels)` for a fresh account
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-013: `account nfts` — list NFTs owned
**Description:** As a user, I want to see all NFTs an account owns.

**Acceptance Criteria:**
- [ ] `xrpl account nfts <address-or-alias>` fetches `account_nfts`
- [ ] Human-readable output: one line per NFT — `<nft-id>  taxon: <taxon>  serial: <serial>  flags: <flags>`
- [ ] `--json` outputs raw `account_nfts` array
- [ ] `--limit <n>` and `--marker` for pagination
- [ ] Uses `getNodeUrl(cmd)`
- [ ] Alias: `xrpl account nft`
- [ ] E2E test: prints `(no NFTs)` for a fresh account
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-014: `account set` — AccountSet transaction
**Description:** As a user, I want to update my account's settings on-ledger (domain, email hash, transfer rate, flags).

**Acceptance Criteria:**
- [ ] `xrpl account set` submits an `AccountSet` transaction
- [ ] Key material: `--seed <seed>`, `--mnemonic <phrase>`, or `--account <address-or-alias>` (loads from keystore, prompts password; `--password` skips prompt)
- [ ] Settable fields (at least one required): `--domain <utf8-string>` (hex-encodes automatically), `--email-hash <hex>`, `--transfer-rate <rate>` (integer, 0 = no fee, 1000000000–2000000000), `--tick-size <n>` (3–15 or 0 to disable)
- [ ] Flag operations: `--set-flag <flag-name>` and `--clear-flag <flag-name>` (accepts names: `requireDestTag`, `requireAuth`, `disallowXRP`, `disableMaster`, `noFreeze`, `globalFreeze`, `defaultRipple`, `depositAuth`)
- [ ] Uses `client.autofill()` before signing
- [ ] Prints: `Transaction submitted: <hash>` on success
- [ ] `--json` outputs `{ hash, result, tx_blob }`
- [ ] `--dry-run` prints the unsigned tx JSON without submitting
- [ ] Uses `getNodeUrl(cmd)`
- [ ] E2E test: set domain on testnet account, run `account info`, assert Domain field matches
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-015: `account delete` — AccountDelete transaction
**Description:** As a user, I want to delete an account and sweep its XRP to a destination.

**Acceptance Criteria:**
- [ ] `xrpl account delete --destination <address-or-alias>` submits an `AccountDelete` transaction
- [ ] `--destination-tag <n>` optional destination tag
- [ ] Key material: `--seed`, `--mnemonic`, or `--account <address-or-alias>` (same pattern as `account set`)
- [ ] Prints a warning to stderr before submitting: `Warning: AccountDelete is irreversible. The account will be removed from the ledger.`
- [ ] `--yes` flag skips the warning prompt; without it, prompts `Confirm? [y/N]` interactively
- [ ] Uses `client.autofill()` before signing
- [ ] Prints: `Account deleted. Transaction hash: <hash>`
- [ ] `--json` outputs `{ hash, result, tx_blob }`
- [ ] `--dry-run` prints unsigned tx JSON without submitting
- [ ] Uses `getNodeUrl(cmd)`
- [ ] E2E test: fund a testnet account, delete it to another address, assert `account info` on deleted address returns `actNotFound` error
- [ ] Typecheck passes
- [ ] Tests pass

---

## Functional Requirements

- FR-1: All `xrpl account` subcommands live in `src/commands/account/` (one file per subcommand)
- FR-2: The root `xrpl` program option `--node` resolves via `cmd.optsWithGlobals()` in all action handlers
- FR-3: `XRPL_NODE` env var sets the fallback default for `--node`; flag overrides env var
- FR-4: `resolveAccount(addressOrAlias, keystoreDir)` is used by every command that accepts an address argument
- FR-5: All write commands (`account set`, `account delete`) call `client.autofill()` before signing
- FR-6: Human-readable output goes to stdout; errors and warnings go to stderr
- FR-7: All list commands print `(no <items>)` rather than an empty output when results are empty
- FR-8: `--dry-run` on write commands must never call `client.submit()` or `client.submitAndWait()`
- FR-9: Keystore dir for alias resolution resolves in order: `XRPL_KEYSTORE` env var → `~/.xrpl/keystore/`

---

## Non-Goals

- No multi-sig AccountSet or multi-signed AccountDelete
- No account re-keying (SetRegularKey) — separate PRD
- No `account objects` dump (covered by individual object-type commands above)
- No ENS-style on-chain name resolution — aliases are local keystore only
- No `account balance` for issued tokens — that is `account trust-lines`

---

## Technical Considerations

- Restructure: `src/commands/account.ts` → `src/commands/account/index.ts` + per-subcommand files; update `src/commands/index.ts`
- `getNodeUrl(cmd: Command): string` in `src/utils/node.ts` calls `cmd.optsWithGlobals()` — Commander requires action handler to receive the `Command` instance as the last argument for `optsWithGlobals()` to work
- XRP flag decoding: `xrpl.parseAccountRootFlags(flags)` returns a `Record<string, boolean>`; use it in `account info`
- AccountDelete requires the account to have a balance > owner reserve × (2 + owner count) + base reserve; surface this as a clear error if the tx fails with `tecTOO_MANY_ITEMS` or `tecINSUFF_FEE`
- E2E tests that submit transactions need a funded testnet account — use `tests/helpers/testnet.ts` `fundFromFaucet()`

---

## Success Metrics

- `xrpl account --help` lists all 9 subcommands with descriptions
- All 15 user stories pass their E2E tests
- No command duplicates `--node` as its own flag
- `resolveAccount` used consistently — no command does its own alias lookup
