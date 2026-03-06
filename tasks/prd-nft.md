# PRD: NFT Commands

## Introduction

Add `xrpl nft` sub-commands to mint, burn, modify, and trade Non-Fungible Tokens (NFTs) on the XRP Ledger. NFTs are unique digital assets that can represent art, collectibles, game items, or any on-chain record of ownership. The CLI will expose all five NFT transaction types plus a query command for listing offers, giving developers a complete NFT workflow without writing scripts.

## Goals

- Support all NFT transaction types: `NFTokenMint`, `NFTokenBurn`, `NFTokenModify`, `NFTokenCreateOffer`, `NFTokenAcceptOffer`, `NFTokenCancelOffer`
- Support querying buy/sell offers for a specific NFT via `nft offer list`
- Support both direct and brokered offer acceptance
- Note: `account nfts <address>` query already exists — do not duplicate it
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `nft mint` command

**Description:** As a developer, I want to mint an NFT from the CLI so I can create on-chain digital assets with configurable properties.

**Acceptance Criteria:**
- [ ] Read NFTokenMint docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/nftokenmint.md before implementing
- [ ] `src/commands/nft.ts` created and registered in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl nft mint` subcommand with:
  - `--taxon <n>` (required) — unsigned 32-bit NFTokenTaxon; shared identifier for a collection
  - `--uri <string>` (optional) — metadata URI (plain string, converted to hex internally via `convertStringToHex` from xrpl.js)
  - `--transfer-fee <bps>` (optional) — secondary sale royalty in basis points (0-50000 = 0.000%-50.000%); requires `--transferable` to also be set — CLI errors if `--transfer-fee` is used without `--transferable`
  - `--burnable` (flag) — sets tfBurnable (issuer can burn the token)
  - `--only-xrp` (flag) — sets tfOnlyXRP (token tradeable in XRP only)
  - `--transferable` (flag) — sets tfTransferable (token can be transferred to others)
  - `--mutable` (flag) — sets tfMutable (URI can be updated via nft modify)
  - `--issuer <address>` (optional) — mint on behalf of another account (that account's NFTokenMinter must be set to sender)
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI exits with error if `--transfer-fee` is set without `--transferable`
- [ ] On success, output prints the NFTokenID (from transaction metadata `CreatedNode` with `LedgerEntryType: "NFTokenPage"`, or from the `nftoken_id` field in metadata if available)
- [ ] `tests/e2e/nft/nft.validation.test.ts`: missing `--taxon`, invalid `--transfer-fee` (>50000), `--transfer-fee` without `--transferable`, missing key material — no network
- [ ] `tests/e2e/nft/nft.mint.test.ts`: mint with taxon only, mint with URI, mint with transfer-fee + transferable, mint with all flags, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `nft burn` and `nft modify` commands

**Description:** As a developer, I want to burn an NFT I own and update a mutable NFT's URI so I can manage the lifecycle of on-chain tokens.

**Acceptance Criteria:**
- [ ] Read NFTokenBurn docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/nftokenburn.md before implementing
- [ ] Read NFTokenModify docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/nftokenmodify.md before implementing
- [ ] `xrpl nft burn` subcommand with:
  - `--nft <id>` (required) — 64-char hex NFTokenID
  - `--owner <address>` (optional) — required when issuer burns a token they don't hold (burnable flag)
  - Standard key material and output options
- [ ] `xrpl nft modify` subcommand with:
  - `--nft <id>` (required) — 64-char hex NFTokenID
  - `--uri <string>` (optional) — new URI (plain string, hex-encoded)
  - `--clear-uri` (flag) — explicitly deletes the existing URI (sets URI to empty)
  - `--owner <address>` (optional) — NFT owner if different from sender
  - Standard key material and output options
- [ ] CLI exits with error if neither `--uri` nor `--clear-uri` is provided (must explicitly state intent)
- [ ] CLI exits with error if both `--uri` and `--clear-uri` are provided
- [ ] `tests/e2e/nft/nft.burn.test.ts`: mint then burn an NFT, `--json`, `--dry-run`
- [ ] `tests/e2e/nft/nft.modify.test.ts`: mint with `--mutable`, modify URI, verify new URI via `account nfts`, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-003: `nft offer create` command

**Description:** As a developer, I want to create buy or sell offers for NFTs from the CLI so I can participate in the NFT marketplace.

**Acceptance Criteria:**
- [ ] Read NFTokenCreateOffer docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/nftokencreateoffer.md before implementing
- [ ] `xrpl nft offer create` subcommand with:
  - `--nft <id>` (required) — 64-char hex NFTokenID
  - `--amount <amount>` (required) — XRP decimal or `value/CURRENCY/issuer` IOU; use `0` for XRP giveaways on sell offers
  - `--sell` (flag) — sets tfSellNFToken (creates a sell offer); absence = buy offer
  - `--owner <address>` (required for buy offers) — current NFT owner; CLI validates this is present when `--sell` is not set
  - `--expiration <iso8601>` (optional) — XRPL epoch conversion
  - `--destination <address>` (optional) — restrict offer acceptance to a specific account
  - Standard key material and output options
- [ ] CLI exits with error if creating a buy offer without `--owner`
- [ ] On success, output prints the NFTokenOfferID (from tx metadata `CreatedNode` with `LedgerEntryType: "NFTokenOffer"`)
- [ ] `tests/e2e/nft/nft.offer.create.test.ts`: create sell offer, create buy offer, `--expiration`, `--destination`, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-004: `nft offer accept` and `nft offer cancel` commands

**Description:** As a developer, I want to accept NFT offers (direct or brokered) and cancel outstanding offers from the CLI.

**Acceptance Criteria:**
- [ ] Read NFTokenAcceptOffer docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/nftokenacceptoffer.md before implementing
- [ ] Read NFTokenCancelOffer docs at https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/nftokencanceloffer.md before implementing
- [ ] `xrpl nft offer accept` subcommand with:
  - `--sell-offer <id>` (optional) — NFTokenSellOffer ID (64-char hex)
  - `--buy-offer <id>` (optional) — NFTokenBuyOffer ID (64-char hex)
  - `--broker-fee <amount>` (optional) — broker's cut in XRP or IOU; only valid when both `--sell-offer` and `--buy-offer` are provided
  - Standard key material and output options
- [ ] CLI exits with error if neither `--sell-offer` nor `--buy-offer` is provided
- [ ] CLI exits with error if `--broker-fee` is provided without both offer IDs (brokered mode requires both)
- [ ] `xrpl nft offer cancel` subcommand with:
  - `--offer <id>` (repeatable) — NFTokenOffer ID(s) to cancel; e.g. `--offer <id1> --offer <id2>`
  - Standard key material and output options
- [ ] CLI exits with error if no `--offer` is provided
- [ ] `tests/e2e/nft/nft.offer.accept.test.ts`: accept a sell offer (direct), accept a buy offer (direct), brokered accept, `--json`, `--dry-run`
- [ ] `tests/e2e/nft/nft.offer.cancel.test.ts`: cancel a single offer, cancel multiple offers in one tx, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-005: `nft offer list` query command

**Description:** As a developer, I want to list all buy and sell offers for a specific NFT so I can decide which to accept or cancel.

**Acceptance Criteria:**
- [ ] `xrpl nft offer list <nft-id>` subcommand
- [ ] Fetches both sell offers (via `nft_sell_offers` RPC) and buy offers (via `nft_buy_offers` RPC) in parallel
- [ ] Default human-readable output groups offers into "Sell Offers" and "Buy Offers" sections, each showing: offer ID, amount (XRP decimal or IOU), owner, expiration (ISO8601 or "none"), destination (or "any")
- [ ] `--json` outputs `{ "sellOffers": [...], "buyOffers": [...] }`
- [ ] `--node` supported
- [ ] `tests/e2e/nft/nft.offer.list.test.ts`: mint NFT, create sell and buy offers, verify both appear in list output; `--json` output
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `NFTokenMint` — NFTokenTaxon (UInt32), optional URI (hex-encoded from plain string), TransferFee (0-50000, requires tfTransferable), flags: tfBurnable, tfOnlyXRP, tfTransferable, tfMutable, optional Issuer
- FR-2: URI encoding: `import { convertStringToHex } from "xrpl"` and apply to the `--uri` value
- FR-3: NFTokenID retrieval after mint: check `tx.result.meta` for `nftoken_id` field (xrpl.js populates this); fallback to scanning `AffectedNodes` for `CreatedNode` with `LedgerEntryType: "NFTokenPage"`
- FR-4: NFTokenOfferID retrieval after `nft offer create`: scan `AffectedNodes` for `CreatedNode` with `LedgerEntryType: "NFTokenOffer"`
- FR-5: `NFTokenCreateOffer` amount of `"0"` is valid for XRP sell offers (giveaways); treat `--amount 0` as `"0"` drops
- FR-6: `NFTokenCancelOffer` NFTokenOffers array is built from all `--offer` values
- FR-7: `NFTokenAcceptOffer` brokered mode requires both `--sell-offer` and `--buy-offer`; direct mode uses exactly one
- FR-8: XRPL epoch conversion for `--expiration`: `Math.floor(new Date(s).getTime() / 1000) - 946684800`
- FR-9: `nft offer list` uses `nft_sell_offers` and `nft_buy_offers` RPC methods
- FR-10: `tfTrustLine` flag (0x00000004) must NOT be used — it is deprecated and invalid per fixRemoveNFTokenAutoTrustLine amendment

## Non-Goals

- No `NFTokenMint` with `Amount`/`Destination`/`Expiration` fields on the mint itself (those are for the initial offer embedded in mint — out of scope)
- No batch minting
- No metadata fetching/display (URI is stored as hex on-chain; display as decoded string but do not fetch remote content)
- No royalty splitting or complex fee distribution

## Technical Considerations

- **Mandatory pre-implementation step:** Read all linked doc pages before writing code
- **`account nfts` already exists** at `src/commands/account/nfts.ts` — do not re-implement; only add new `nft` command group
- **NFTokenID format:** 64-char hex string; xrpl.js metadata field `nftoken_id` is the easiest way to get it after mint
- **URI encoding:** `convertStringToHex("https://example.com")` → store hex in `URI` field; display decoded when listing
- **TransferFee validation:** Must be integer 0-50000; maps to 0.000%-50.000% in increments of 0.001%
- **IOU amounts in NFT offers:** Use existing `parseAmount`/`toXrplAmount` utilities from `src/utils/amount.ts`
- **Test NFT IDs:** After minting in `beforeAll`, capture the NFTokenID from stdout (parse JSON output with `--json` flag) to use in subsequent test steps

## Success Metrics

- Full NFT round-trip (mint → create sell offer → accept → burn) works against testnet
- Brokered mode accept works with two separate wallets creating matching offers
- `nft offer list` correctly shows both buy and sell sides
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
