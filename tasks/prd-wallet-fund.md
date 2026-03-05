# PRD: `xrpl wallet fund` — Testnet/Devnet Faucet Command

## Introduction

`xrpl wallet fund <address>` requests XRP from the testnet or devnet faucet for a given address. This removes the need to visit a web faucet when setting up test accounts. It is only available on testnet and devnet — running it against mainnet is an error.

---

## Goals

- Fund any XRPL address from the testnet or devnet faucet via a single CLI command
- Block accidental use on mainnet
- Print the resulting balance after the account appears on-ledger
- Integrate with the existing alias system (`<address-or-alias>` input)

---

## User Stories

### US-001: `wallet fund <address>` — fund from faucet
**Description:** As a developer, I want to fund a testnet address from the faucet so I can test transactions without visiting a web UI.

**Acceptance Criteria:**
- [ ] Create `src/commands/wallet/fund.ts` registered in `src/commands/wallet/index.ts`
- [ ] `xrpl wallet fund <address-or-alias>` sends a POST to the faucet URL for the active network
  - Testnet faucet: `https://faucet.altnet.rippletest.net/accounts`
  - Devnet faucet: `https://faucet.devnet.rippletest.net/accounts`
  - Request body: `{ "destination": "<address>" }`
- [ ] Resolves alias to address via `resolveAccount()` using keystore dir from `getKeystoreDir({ keystore: undefined })`
- [ ] Determines network from `getNodeUrl(cmd)`: if resolved URL contains `altnet`, use testnet faucet; if `devnet`, use devnet faucet; any other URL (including mainnet) exits 1 with: `Error: wallet fund is only available on testnet and devnet`
- [ ] After faucet POST succeeds, polls `account_info` on the XRPL node until the account appears (max 10 retries, 2 s delay between each)
- [ ] On success, prints:
  ```
  Funded <address>
  Balance: <amount> XRP
  ```
- [ ] `--json` outputs `{ address, balanceXrp, balanceDrops }`
- [ ] Exits 1 with faucet error message if the POST returns a non-2xx status
- [ ] Exits 1 if account does not appear on-ledger after max retries: `Error: account did not appear on ledger after 10 retries`
- [ ] Uses native `fetch` (Node 22 built-in) — no extra HTTP library
- [ ] Alias: `xrpl wallet f`
- [ ] E2E test: run `xrpl wallet fund <fresh-address> --node testnet`, assert exit 0 and output contains `Funded` and `Balance:`
- [ ] E2E test: run against mainnet node URL, assert exit 1 and stderr contains `only available on testnet and devnet`
- [ ] E2E test: `--json` output has `address`, `balanceXrp`, `balanceDrops` fields
- [ ] Tests pass
- [ ] Typecheck passes

---

## Functional Requirements

- FR-1: `wallet fund` is only valid when `--node` resolves to testnet or devnet
- FR-2: Faucet URL is selected automatically based on the resolved node URL — no separate `--faucet` flag
- FR-3: The command blocks until the funded account is confirmed on-ledger (or times out)
- FR-4: Input accepts address or alias; alias resolution uses the standard `resolveAccount()` + `getKeystoreDir()` pattern
- FR-5: Uses the global `--node` flag via `getNodeUrl(cmd)` — no local `--node` option

---

## Non-Goals

- No auto-generate-and-fund (address is required)
- No `--amount` flag — faucet amount is controlled by the faucet server
- No mainnet support
- No custom faucet URL override

---

## Success Metrics

- `xrpl wallet fund <address>` funds an account end-to-end in a single command
- Running it on mainnet fails fast with a clear error
