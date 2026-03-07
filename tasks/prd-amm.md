# PRD: AMM Commands

## Introduction

Add `xrpl amm` command group to interact with the XRP Ledger's Automated Market Maker. AMM allows permissionless liquidity pools for any asset pair (XRP or IOU). This covers the full lifecycle: creating a pool, adding/removing liquidity, bidding on the auction slot, voting on fees, deleting an empty pool, issuer clawback from pools, and querying pool state.

## Goals

- Support all 7 AMM transaction types: `AMMCreate`, `AMMDeposit`, `AMMWithdraw`, `AMMBid`, `AMMVote`, `AMMDelete`, `AMMClawback`
- Support `amm info` query via the `amm_info` RPC
- Support all deposit and withdraw modes (inferred from which flags are provided)
- Use consistent asset specification format: `XRP`, `CURRENCY/issuer`, or `<MPTokenIssuanceID>`
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `amm create` command

**Description:** As a liquidity provider, I want to create a new AMM pool from the CLI so I can earn trading fees on my deposited assets.

**Acceptance Criteria:**
- [ ] Read AMMCreate docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammcreate.md before implementing
- [ ] Create `src/commands/amm.ts` and register it in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl amm create` subcommand with:
  - `--asset <spec>` (required) — first asset: `XRP` or `CURRENCY/issuer` (e.g. `USD/rIssuer`)
  - `--asset2 <spec>` (required) — second asset, same format
  - `--amount <value>` (required) — initial deposit of first asset as a plain number; asset type inferred from `--asset` (e.g. `--asset XRP --amount 1000000` = 1000000 drops; `--asset USD/rIssuer --amount 10` = 10 USD)
  - `--amount2 <value>` (required) — initial deposit of second asset as a plain number; asset type inferred from `--asset2`
  - `--trading-fee <n>` (required) — fee in units of 1/100,000 (0–1000; e.g. 500 = 0.5%)
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if `--trading-fee` is outside 0–1000
- [ ] CLI exits with error if both assets have the same spec
- [ ] After successful create, print the AMM account address and LP token currency code
- [ ] `tests/e2e/amm/amm.validation.test.ts`: invalid trading fee, same asset for both slots — no network
- [ ] `tests/e2e/amm/amm.create.test.ts`: create XRP/IOU pool; verify via `amm info`; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `amm deposit` command

**Description:** As a liquidity provider, I want to deposit assets into an existing AMM pool so I can receive LP tokens representing my share.

**Acceptance Criteria:**
- [ ] Read AMMDeposit docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammdeposit.md before implementing
- [ ] `xrpl amm deposit` subcommand with:
  - `--asset <spec>` and `--asset2 <spec>` (required) — identify the AMM
  - `--amount <value>` (optional) — first asset amount to deposit as a plain number; asset type inferred from `--asset`
  - `--amount2 <value>` (optional) — second asset amount to deposit as a plain number; asset type inferred from `--asset2`
  - `--lp-token-out <value>` (optional) — LP tokens to receive as a plain number; CLI auto-fetches LP token currency/issuer via `amm_info` using `--asset`/`--asset2`
  - `--ePrice <value>` (optional) — effective price limit for `tfLimitLPToken` mode as a plain number
  - `--for-empty` (boolean flag) — use `tfTwoAssetIfEmpty` mode (for empty AMMs only)
  - Standard key material and output options
- [ ] Mode inferred from flags (see FR-2 for full mapping); CLI exits with error if combination is invalid
- [ ] `tests/e2e/amm/amm.deposit.test.ts`: double-asset deposit; single-asset deposit; LP-token deposit; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-003: `amm withdraw` command

**Description:** As a liquidity provider, I want to withdraw assets from an AMM pool by returning LP tokens so I can recover my liquidity.

**Acceptance Criteria:**
- [ ] Read AMMWithdraw docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammwithdraw.md before implementing
- [ ] `xrpl amm withdraw` subcommand with:
  - `--asset <spec>` and `--asset2 <spec>` (required) — identify the AMM
  - `--lp-token-in <value>` (optional) — LP tokens to return as a plain number; CLI auto-fetches LP token currency/issuer via `amm_info` using `--asset`/`--asset2`
  - `--amount <value>` (optional) — first asset amount to receive as a plain number; asset type inferred from `--asset`
  - `--amount2 <value>` (optional) — second asset amount to receive as a plain number; asset type inferred from `--asset2`
  - `--all` (boolean flag) — return all LP tokens (`tfWithdrawAll` or `tfOneAssetWithdrawAll`)
  - Standard key material and output options
- [ ] Mode inferred from flags (see FR-3 for full mapping); CLI exits with error if combination is invalid
- [ ] `tests/e2e/amm/amm.withdraw.test.ts`: LP-token withdraw (get both assets); single-asset withdraw; withdraw-all; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-004: `amm bid` and `amm vote` commands

**Description:** As an LP token holder, I want to bid on the AMM auction slot and vote on the trading fee so I can get discounted trades and influence pool economics.

**Acceptance Criteria:**
- [ ] Read AMMBid docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammbid.md before implementing
- [ ] Read AMMVote docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammvote.md before implementing
- [ ] `xrpl amm bid` subcommand with:
  - `--asset <spec>` and `--asset2 <spec>` (required) — identify the AMM
  - `--bid-min <value>` (optional) — minimum bid as a plain number; CLI auto-fetches LP token currency/issuer via `amm_info`
  - `--bid-max <value>` (optional) — maximum bid as a plain number; CLI auto-fetches LP token currency/issuer; fails if cost exceeds this
  - `--auth-account <address>` (repeatable, up to 4) — accounts that can trade at discounted fee
  - Standard key material and output options
- [ ] `xrpl amm vote` subcommand with:
  - `--asset <spec>` and `--asset2 <spec>` (required)
  - `--trading-fee <n>` (required) — proposed fee 0–1000
  - Standard key material and output options
- [ ] CLI exits with error if `--trading-fee` outside 0–1000 on vote
- [ ] CLI exits with error if more than 4 `--auth-account` values provided on bid
- [ ] `tests/e2e/amm/amm.bid.test.ts`: bid on auction slot; `--json`, `--dry-run`
- [ ] `tests/e2e/amm/amm.vote.test.ts`: vote on trading fee; verify fee updated via `amm info`; `--json`, `--dry-run`
- [ ] Typecheck passes

### US-005: `amm delete`, `amm clawback`, and `amm info` commands

**Description:** As a developer or token issuer, I want to delete empty AMM pools, claw back tokens from pools, and query pool state so I can manage AMM lifecycle and verify pool data.

**Acceptance Criteria:**
- [ ] Read AMMDelete docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammdelete.md before implementing
- [ ] Read AMMClawback docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammclawback.md before implementing
- [ ] `xrpl amm delete` subcommand:
  - `--asset <spec>` and `--asset2 <spec>` (required)
  - Standard key material and output options
- [ ] `xrpl amm clawback` subcommand:
  - `--asset <spec>` (required) — the token being clawed back; issuer must match signing account
  - `--asset2 <spec>` (required) — the other asset in the AMM pool
  - `--holder <address>` (required) — account holding LP tokens in the AMM
  - `--amount <value>` (optional) — maximum clawback amount as a plain number; asset type inferred from `--asset`
  - `--both-assets` (boolean flag) — sets `tfClawTwoAssets`; only valid when issuer issued both pool assets
  - Standard key material and output options
- [ ] `xrpl amm info` subcommand:
  - `--asset <spec>` and `--asset2 <spec>` (required)
  - Uses `amm_info` RPC: `{ command: "amm_info", asset: {...}, asset2: {...} }`
  - Default output: AMM account address, pool balances (asset1 + asset2), LP token supply, trading fee, auction slot (if active)
  - `--json` outputs raw JSON
  - `--node` supported
- [ ] `tests/e2e/amm/amm.delete.test.ts`: create AMM, withdraw all liquidity, delete; verify `amm info` returns not-found; `--json`, `--dry-run`
- [ ] `tests/e2e/amm/amm.info.test.ts`: create AMM, verify `amm info` returns correct balances and fee; `--json`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Asset spec parsing — `"XRP"` → `{ currency: "XRP" }`; `"USD/rIssuer"` → `{ currency: "USD", issuer: "rIssuer" }`. Validate with `isValidClassicAddress` for IOU issuer. No MPT support.
- FR-1b: Amount construction — `--amount` and `--amount2` are plain numbers. Convert to the correct format based on the corresponding `--asset`/`--asset2` spec: XRP → string of drops (e.g. `"1000000"`); IOU → `{ value: "10", currency: "USD", issuer: "rIssuer" }`.
- FR-1c: LP token amount construction — `--lp-token-out`, `--lp-token-in`, `--bid-min`, `--bid-max` are plain numbers. Before constructing the transaction, call `amm_info` with `--asset`/`--asset2` to retrieve the LP token's `currency` and `issuer` (the AMM account address), then construct `{ value: "<n>", currency: "<hex>", issuer: "<amm-account>" }`.
- FR-2: AMMDeposit mode inference:
  - `--amount` + `--amount2` + `--lp-token-out` → `tfLPToken` (0x00010000)
  - `--amount` + `--amount2` + `--for-empty` → `tfTwoAssetIfEmpty` (0x00800000)
  - `--amount` + `--amount2` (no others) → `tfTwoAsset` (0x00100000)
  - `--amount` + `--lp-token-out` (no `--amount2`) → `tfOneAssetLPToken` (0x00200000)
  - `--amount` + `--ePrice` → `tfLimitLPToken` (0x00400000)
  - `--amount` only → `tfSingleAsset` (0x00080000)
  - Any other combination → error with valid combinations listed
- FR-3: AMMWithdraw mode inference:
  - `--lp-token-in` only → `tfLPToken` (0x00010000)
  - `--all` only → `tfWithdrawAll` (0x00020000)
  - `--all` + `--amount` → `tfOneAssetWithdrawAll` (0x00040000)
  - `--amount` only → `tfSingleAsset` (0x00080000)
  - `--amount` + `--amount2` → `tfTwoAsset` (0x00100000)
  - `--amount` + `--lp-token-in` → `tfLimitLPToken` (0x00200000)
  - Any other combination → error
- FR-4: `amm_info` RPC asset format: XRP → `{ currency: "XRP" }`; IOU → `{ currency: "USD", issuer: "rIssuer" }`
- FR-5: `AMMCreate` has a higher transaction fee (owner reserve); use `client.autofill()` which handles this automatically
- FR-6: LP token value format: `"<amount>/<currency-code>/<amm-account>"` — currency code is a 40-char hex derived from the AMM's hash

## Non-Goals

- No AMM price calculation or slippage estimation
- No monitoring or streaming of pool price changes
- No aggregation across multiple AMM pools
- No `--max-slippage` guard (protocol enforces via EPrice; CLI exposes `--ePrice` directly)

## Technical Considerations

- **Mandatory pre-implementation step:** Read all AMM doc pages (linked above) before writing code

- **AMMCreate fee:** Higher than standard; `autofill` handles it automatically
- **LP token currency code:** A 40-char uppercase hex derived from a hash of the AMM's two assets. After `amm create`, extract from transaction metadata (`AffectedNodes` → `CreatedNode` with `LedgerEntryType: "AMM"` → `LPTokenBalance.currency`)
- **E2E test setup:** Fund two wallets (depositor + trader); create IOU trust lines before depositing IOU assets; `amm create` XRP/IOU pool; run deposit/withdraw/bid/vote tests; drain and delete pool
- **`amm_info` asset format** matches `Amount`/`Amount2` field format in AMM transactions

## Success Metrics

- `amm create` creates a pool verifiable via `amm info`
- `amm deposit` and `amm withdraw` correctly update pool balances
- All 6 deposit modes and 6 withdraw modes are supported and tested
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
