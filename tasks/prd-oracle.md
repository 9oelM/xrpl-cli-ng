# PRD: Oracle Commands

## Introduction

Add `xrpl oracle` sub-commands to create, update, delete, and query on-chain price oracles on the XRP Ledger. The Price Oracle amendment lets data providers publish asset prices (e.g. BTC/USD, ETH/XRP) directly on-ledger, enabling DeFi applications to consume trustworthy price feeds without off-chain infrastructure.

## Goals

- Support `OracleSet` to create and update price oracle objects with up to 10 price pairs
- Support `OracleDelete` to remove a price oracle
- Support querying an oracle's current price data via `oracle get`
- Accept price data as both a repeatable shorthand flag and a JSON string
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `oracle set` command

**Description:** As a data provider, I want to publish or update asset prices on-chain from the CLI so DeFi applications can consume reliable price feeds.

**Acceptance Criteria:**
- [ ] Read OracleSet docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/oracleset.md before implementing
- [ ] `src/commands/oracle.ts` created and registered in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl oracle set` subcommand with:
  - `--document-id <n>` (required) — OracleDocumentID; unique unsigned 32-bit integer per owner account
  - `--price <base/quote:price:scale>` (repeatable, conditionally required) — shorthand price entry; e.g. `--price BTC/USD:155000:6` (scale optional, defaults to 0); at least 1 required unless `--price-data` is used
  - `--price-data <json>` (conditionally required) — JSON array of price objects e.g. `'[{"base":"BTC","quote":"USD","price":155000,"scale":6}]'`; alternative to `--price`
  - `--provider <string>` (optional for updates, required on create) — provider name as plain string, auto hex-encoded via `convertStringToHex`
  - `--provider-hex <hex>` (optional) — provider as raw hex; mutually exclusive with `--provider`
  - `--asset-class <string>` (optional for updates, required on create) — asset class as plain string, auto hex-encoded (e.g. `"currency"`, `"commodity"`, `"index"`)
  - `--asset-class-hex <hex>` (optional) — asset class as raw hex; mutually exclusive with `--asset-class`
  - `--last-update-time <unix-ts>` (optional) — Unix timestamp in seconds; defaults to `Math.floor(Date.now() / 1000)` if omitted; must be within 300s of ledger close time
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if both `--price` and `--price-data` are provided
- [ ] CLI exits with error if neither `--price` nor `--price-data` is provided
- [ ] CLI exits with error if `--price` format is invalid (missing `/`, missing `:` for price, non-numeric price or scale)
- [ ] CLI exits with error if both `--provider` and `--provider-hex` are provided
- [ ] CLI exits with error if both `--asset-class` and `--asset-class-hex` are provided
- [ ] CLI exits with error if more than 10 price pairs are provided
- [ ] `tests/e2e/oracle/oracle.validation.test.ts`: missing document-id, missing price data, both --price and --price-data, invalid --price format, >10 prices, conflicting provider flags — no network
- [ ] `tests/e2e/oracle/oracle.set.test.ts`: create oracle with `--price`, create with `--price-data` JSON, update oracle (change price), `--last-update-time`, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `oracle delete` and `oracle get` commands

**Description:** As a data provider, I want to delete an oracle I own and query oracle price data so I can manage oracle lifecycle and verify published prices.

**Acceptance Criteria:**
- [ ] Read OracleDelete docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/oracledelete.md before implementing
- [ ] `xrpl oracle delete` subcommand with:
  - `--document-id <n>` (required) — OracleDocumentID to delete
  - Standard key material and output options
- [ ] `xrpl oracle get <owner-address> <document-id>` subcommand:
  - Uses `ledger_entry` RPC with `{ oracle: { account: owner, oracle_document_id: id } }`
  - Default human-readable output: document ID, provider (decoded from hex), asset class (decoded), last update time (ISO8601), then each price pair as `BASE/QUOTE: price × 10^-scale`
  - `--json` outputs raw JSON ledger entry
  - `--node` supported
- [ ] `tests/e2e/oracle/oracle.delete.test.ts`: create then delete oracle, verify `oracle get` returns error after deletion; `--json`, `--dry-run`
- [ ] `tests/e2e/oracle/oracle.get.test.ts`: create oracle, verify `oracle get` returns correct price pairs, provider, asset class; `--json`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `OracleSet` — OracleDocumentID (UInt32), Provider (hex blob), AssetClass (hex blob), LastUpdateTime (Unix epoch seconds), PriceDataSeries (array of 1-10 PriceData objects)
- FR-2: `PriceData` object: `{ BaseAsset: string, QuoteAsset: string, AssetPrice?: string (UInt64 as string), Scale?: number (0-10) }`
- FR-3: `--price BTC/USD:155000:6` parsed as: BaseAsset="BTC", QuoteAsset="USD", AssetPrice="155000", Scale=6. If scale omitted (`BTC/USD:155000`), Scale defaults to 0. If price omitted (`BTC/USD`), omit AssetPrice and Scale (deletes that pair on update).
- FR-4: `--price-data` JSON parsed directly into PriceDataSeries; fields: `base`, `quote`, `price` (optional), `scale` (optional)
- FR-5: `--last-update-time` defaults to `Math.floor(Date.now() / 1000)`; user override accepted
- FR-6: Provider and AssetClass encoding: `convertStringToHex(str)` from xrpl.js for plain string flags
- FR-7: `oracle get` uses `ledger_entry` with `{ oracle: { account: ownerAddress, oracle_document_id: documentId } }`
- FR-8: Display price: `actualPrice = AssetPrice × 10^(-Scale)`; show as `BTC/USD: 0.155000` (6 decimal places matching scale)
- FR-9: Hex-encoded Provider and AssetClass decoded back to UTF-8 string for human-readable display

## Non-Goals

- No aggregation across multiple oracle sources (query single oracle only)
- No price feed subscription or streaming
- No validation that `LastUpdateTime` is within 300s of actual ledger close time (protocol enforces this; CLI just defaults to now)

## Technical Considerations

- **Mandatory pre-implementation step:** Read both doc pages (linked above) before writing code
- **AssetPrice as UInt64 string:** XRPL represents AssetPrice as a 64-bit unsigned integer string (not a float) — store `"155000"` not `155000`
- **Scale:** 0-10 integer; actual price = `AssetPrice * 10^(-Scale)`. Scale=6 with AssetPrice=155000 → actual price 0.155
- **`ledger_entry` oracle lookup:** `{ command: "ledger_entry", oracle: { account: ownerAddress, oracle_document_id: documentId } }`
- **E2E test timing:** `LastUpdateTime` must be within 300s of ledger close — defaulting to `Date.now()` handles this automatically in tests

## Success Metrics

- `oracle set` publishes price data on-chain, verifiable via `oracle get`
- `oracle delete` removes the oracle, confirmed by `oracle get` returning not-found
- `--price` shorthand and `--price-data` JSON produce identical on-chain results
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
