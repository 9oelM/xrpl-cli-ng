# PRD: AMM Commands

## Introduction

Add `xrpl amm` subcommands to the CLI to create, deposit, withdraw, bid, vote, delete, claw back, and query Automated Market Maker pools on the XRP Ledger.

## Goals

- Implement all 7 AMM transaction types and the `amm info` query
- All network tests use `it.concurrent` with fresh independent wallets per test
- Tests complete reliably without hanging — no polling loops, no per-test WebSocket clients, no retry logic

## CRITICAL Test Rules (Ralph must follow these exactly)

**WHY AMM tests previously hung:** ralph created a dedicated `new Client(XRPL_WS)` connection inside each `it.concurrent` body, added polling loops with 5-minute timeouts, and set CLI subprocess timeout to 600 seconds. This caused 5 concurrent WebSocket connections to testnet, all polling in loops, hanging indefinitely.

**Rules that MUST be followed:**

1. **Single shared `client`** — created in `beforeAll`, used in ALL `it.concurrent` bodies for xrpl.js calls. Never create `new Client(...)` inside a test body.
2. **No polling loops** — never write `while (Date.now() < deadline)` or `waitFor*` helper functions. Use `await client.submitAndWait(...)` which resolves in ~5s on testnet.
3. **No retry logic** — no `for (let attempt = 0; attempt < 3; attempt++)` loops. One `submitAndWait` call per operation.
4. **No custom LLS** — never manually set `LastLedgerSequence`. Let `autofill()` handle it.
5. **No `CLI_TIMEOUT` constant** — never set a custom timeout on `runCLI`. Default is sufficient.
6. **Test timeout: 120_000ms** per `it.concurrent` — sufficient for testnet AMM ops.
7. **`beforeAll` timeout: 120_000ms** — sufficient.

**Correct minimal setup pattern** (copy this exactly):
```typescript
async function setupPool(
  issuer: Wallet,
  lp: Wallet,
  currency = "USD"
): Promise<string> {
  await client.submitAndWait(
    lp.sign(await client.autofill({
      TransactionType: "TrustSet",
      Account: lp.address,
      LimitAmount: { currency, issuer: issuer.address, value: "1000000" },
    })).tx_blob
  );
  await client.submitAndWait(
    issuer.sign(await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Destination: lp.address,
      Amount: { currency, issuer: issuer.address, value: "100000" },
    })).tx_blob
  );
  return `${currency}/${issuer.address}`;
}
```

## XRPL Testnet Facts

- Faucet: 100 XRP. Base reserve: 1 XRP. Owner reserve: 0.2 XRP per object.
- Budget formula: `TICKET_COUNT × 0.2 + N_wallets × amountXrp ≤ 99`
- AMM creation requires an elevated fee — let `autofill()` handle it automatically; do NOT set `Fee` manually
- Each test gets a unique AMM pool because each test has its own `issuer` wallet — AMM pools are identified by `(asset1, asset2_currency, asset2_issuer)` so a unique issuer = unique pool = no concurrent conflicts

## User Stories

### US-001: amm create + amm info commands

**Description:** As a liquidity provider, I want to create an AMM pool from the CLI and query its state.

**Acceptance Criteria:**
- [ ] Read AMMCreate docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammcreate.md
- [ ] Create `src/commands/amm.ts` and register in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl amm create --asset <spec> --asset2 <spec> --amount <value> --amount2 <value> --trading-fee <n>`: Asset spec is `XRP` or `CURRENCY/issuer`. Amounts are plain numbers (XRP in drops, IOU in decimal). trading-fee 0–1000.
- [ ] After success, print `AMM Account: <address>` and `LP Token: <currency>`
- [ ] `xrpl amm info --asset <spec> --asset2 <spec>`: calls `amm_info` RPC; prints AMM account, pool balances, LP token supply, trading fee; `--json` for raw; `--node` supported
- [ ] Standard key material + output options on `amm create`
- [ ] `tests/e2e/amm/amm.validation.test.ts`: no network; invalid trading fee exits 1; same asset for both slots exits 1
- [ ] `tests/e2e/amm/amm.create-info.test.ts`: follow ALL critical test rules above; `beforeAll` timeout 120_000; `afterAll` disconnects; `initTicketPool(client, master, 12)`; each `it.concurrent` calls `createFunded(client, master, 2, 5)` for `[issuer, lp]`; calls `setupPool(issuer, lp)` (using shared `client`, no polling, no retry); then calls CLI `amm create`; tests: create XRP/IOU pool + verify output, `--json`, `--dry-run`, `amm info` shows correct balances, `--no-wait`; per-test timeout 120_000; budget: 12×0.2 + 10×5 = 52 ≤ 99 ✓
- [ ] Typecheck passes

### US-002: amm deposit + amm withdraw commands

**Description:** As a liquidity provider, I want to deposit assets into and withdraw from an AMM pool.

**Acceptance Criteria:**
- [ ] Read AMMDeposit docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammdeposit.md
- [ ] Read AMMWithdraw docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammwithdraw.md
- [ ] `xrpl amm deposit --asset --asset2 --amount [--amount2] [--lp-token-out] [--ePrice] [--for-empty]`: mode inferred from flag combo; LP token amount auto-fetched via `amm_info`
- [ ] `xrpl amm withdraw --asset --asset2 [--lp-token-in] [--amount] [--amount2] [--all]`: mode inferred from flag combo; LP token amount auto-fetched via `amm_info`
- [ ] CLI exits with error if flag combination doesn't match any valid mode
- [ ] Standard key material + output options on both
- [ ] `tests/e2e/amm/amm.deposit-withdraw.test.ts`: follow ALL critical test rules; `initTicketPool(client, master, 16)`; each `it.concurrent` calls `createFunded(client, master, 2, 5)` for `[issuer, lp]`; calls `setupPool(issuer, lp)` then CLI `amm create` to create pool; deposit tests use CLI `amm deposit`; withdraw tests deposit first via xrpl.js `AMMDeposit` tx (setup only) then CLI `amm withdraw`; tests: double-asset deposit, single-asset deposit, LP-token withdraw, single-asset withdraw, `--json`, `--dry-run`; per-test timeout 120_000; budget: 16×0.2 + 12×5 = 62.4 ≤ 99 ✓
- [ ] Typecheck passes

### US-003: amm bid + amm vote commands

**Description:** As an LP token holder, I want to bid on the auction slot and vote on the trading fee.

**Acceptance Criteria:**
- [ ] Read AMMBid docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammbid.md
- [ ] Read AMMVote docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammvote.md
- [ ] `xrpl amm bid --asset --asset2 [--bid-min <n>] [--bid-max <n>] [--auth-account <addr>]` (repeatable, max 4); LP token amounts auto-fetched via `amm_info`
- [ ] `xrpl amm vote --asset --asset2 --trading-fee <n>` (0–1000)
- [ ] CLI exits with error if > 4 `--auth-account` values; exits with error if `--trading-fee` out of range
- [ ] Standard key material + output options on both
- [ ] `tests/e2e/amm/amm.bid-vote.test.ts`: follow ALL critical test rules; `initTicketPool(client, master, 12)`; each `it.concurrent` calls `createFunded(client, master, 2, 5)` for `[issuer, lp]`; calls `setupPool(issuer, lp)` then CLI `amm create`; bid tests: CLI `amm bid`; vote tests: CLI `amm vote` then verify new fee via `amm info`; tests: bid on slot, vote on fee, `--json`, `--dry-run`; per-test timeout 120_000; budget: 12×0.2 + 10×5 = 52 ≤ 99 ✓
- [ ] Typecheck passes

### US-004: amm delete + amm clawback commands

**Description:** As a developer, I want to delete empty AMM pools and claw back IOU assets from pools.

**Acceptance Criteria:**
- [ ] Read AMMDelete docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammdelete.md
- [ ] Read AMMClawback docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/ammclawback.md
- [ ] `xrpl amm delete --asset --asset2`: standard key material + output options
- [ ] `xrpl amm clawback --asset --asset2 --holder <address> [--amount <value>] [--both-assets]`
- [ ] Standard key material + output options on both
- [ ] `tests/e2e/amm/amm.delete.test.ts`: follow ALL critical test rules; `initTicketPool(client, master, 10)`; each `it.concurrent` calls `createFunded(client, master, 2, 5)` for `[issuer, lp]`; calls `setupPool` then CLI `amm create`; withdraw all LP via xrpl.js `AMMWithdraw` tx (setup), then CLI `amm delete`; tests: delete after withdraw-all, `--json`, `--dry-run`; per-test timeout 120_000; budget: 10×0.2 + 8×5 = 42 ≤ 99 ✓
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Asset spec `XRP` = native XRP; `CURRENCY/issuer` = IOU
- FR-2: All amount flags are plain numbers — XRP in drops (integer string), IOU in decimal string
- FR-3: LP token currency/issuer auto-fetched via `amm_info` RPC when `--lp-token-in/out` or `--bid-min/max` are given
- FR-4: Mode inference for deposit/withdraw: check which flag combination was supplied, map to the correct `tf*` flag
- FR-5: `amm info` uses `amm_info` RPC (not a transaction)
- FR-6: Single shared `client` per test file — never create a new `Client` inside a test body

## Non-Goals

- No MPT support for AMM
- No cross-chain AMM
- No `amm clawback` network tests (requires complex issuer setup with clawback enabled — skip network test, validation only)

## Technical Considerations

- `setupPool` helper must use the shared `client` — NOT a new connection
- AMMCreate elevated fee: let `autofill()` handle it — do not set `Fee` manually
- Unique AMM per test is guaranteed by unique `issuer.address`
- AMM amounts for tests: `--amount 100000` (0.1 XRP in drops), `--amount2 10` (10 USD) — small amounts avoid reserve issues
