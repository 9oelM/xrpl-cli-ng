# PRD: Payment Channel Commands

## Introduction

Add `xrpl channel` sub-commands to create, fund, claim, close, and list XRPL payment channels, plus off-chain claim signing and verification utilities. Payment channels enable high-throughput XRP micropayments between two parties: the source locks XRP on-ledger, then signs off-chain claims that the destination can redeem at any time — settling only the final balance on-ledger.

## Goals

- Support all three payment-channel transaction types: `PaymentChannelCreate`, `PaymentChannelFund`, `PaymentChannelClaim`
- Provide off-chain claim signing (`channel sign`) and verification (`channel verify`) so both parties can operate the channel without on-chain transactions for each payment
- Support querying open channels for an account via `channel list`
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `channel create` command

**Description:** As a developer, I want to open a payment channel from the CLI so I can lock XRP for a streaming payment relationship.

**Acceptance Criteria:**
- [ ] `src/commands/channel.ts` created and registered in `src/commands/index.ts`
- [ ] `xrpl channel create` subcommand with:
  - `--to <address>` (required) — destination address; cannot equal source
  - `--amount <xrp>` (required) — XRP to lock (decimal, converted to drops)
  - `--settle-delay <seconds>` (required) — seconds source must wait before closing if destination hasn't claimed
  - `--public-key <hex>` (optional) — 33-byte hex public key for signing off-chain claims; if omitted, derived from the key material being used to sign the transaction
  - `--cancel-after <iso8601>` (optional) — immutable expiry; converted to XRPL epoch
  - `--destination-tag <n>` (optional)
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] On success, output prints the channel ID (needed for all subsequent operations)
- [ ] `tests/e2e/channel/channel.validation.test.ts`: missing `--to`, missing `--amount`, missing `--settle-delay`, invalid ISO date for `--cancel-after`, missing key material (no network)
- [ ] `tests/e2e/channel/channel.create.test.ts`: create a channel, verify channel ID in output, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-002: `channel fund` command

**Description:** As a developer, I want to add more XRP to an existing channel so I can extend its capacity without reopening it.

**Acceptance Criteria:**
- [ ] `xrpl channel fund` subcommand with:
  - `--channel <id>` (required) — 64-hex-char channel ID
  - `--amount <xrp>` (required) — additional XRP to deposit (decimal, converted to drops)
  - `--expiration <iso8601>` (optional) — mutable expiry update; must be after `now + settle_delay`; converted to XRPL epoch
  - Standard key material and output options
- [ ] `tests/e2e/channel/channel.fund.test.ts`: fund an existing channel, verify new total in `channel list` output, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-003: `channel sign` and `channel verify` commands

**Description:** As a developer, I want to sign and verify off-chain payment claims so I can conduct micropayments without on-chain transactions.

**Acceptance Criteria:**
- [ ] `xrpl channel sign` subcommand with:
  - `--channel <id>` (required) — 64-hex-char channel ID
  - `--amount <xrp>` (required) — cumulative XRP amount authorized so far (decimal, converted to drops)
  - `--seed` (or `--mnemonic` or `--account`/`--keystore`/`--password`) — key to sign with
  - Outputs the hex signature string (no network call needed; `--node` not required)
  - Uses xrpl.js `signPaymentChannelClaim(channelId, amountDrops, privateKeyHex)`
- [ ] `xrpl channel verify` subcommand with:
  - `--channel <id>` (required)
  - `--amount <xrp>` (required) — cumulative amount in the claim
  - `--signature <hex>` (required) — the claim signature
  - `--public-key <hex>` (required) — public key of the signer
  - Outputs `valid` or `invalid` (no network call needed)
  - Uses xrpl.js `verifyPaymentChannelClaim(channelId, amountDrops, signature, publicKey)`
- [ ] `tests/e2e/channel/channel.sign.test.ts`: sign a claim, verify it passes `channel verify`, verify a tampered signature fails — no network required
- [ ] Typecheck passes

### US-004: `channel claim` command

**Description:** As a developer, I want to redeem an off-chain claim on-ledger or close a channel so funds are settled correctly.

**Acceptance Criteria:**
- [ ] `xrpl channel claim` subcommand with:
  - `--channel <id>` (required) — 64-hex-char channel ID
  - `--amount <xrp>` (optional) — cumulative authorized amount (decimal, converted to drops); required when redeeming a signed claim
  - `--balance <xrp>` (optional) — cumulative total to deliver via this tx (must be ≥ prior balance, ≤ amount); required when redeeming
  - `--signature <hex>` (optional) — claim signature; required when redeeming
  - `--public-key <hex>` (optional) — public key matching the signature; required when redeeming
  - `--close` (flag) — sets `tfClose` flag to initiate channel closure
  - `--renew` (flag) — sets `tfRenew` flag to clear the mutable expiration (source only)
  - Standard key material and output options
- [ ] CLI rejects if `--signature` is provided without `--public-key`, `--amount`, and `--balance`
- [ ] `tests/e2e/channel/channel.claim.test.ts`: destination redeems a signed claim, source closes a channel with `--close`, `--json`, `--dry-run`
- [ ] Typecheck passes

### US-005: `channel list` query command

**Description:** As a developer, I want to list all open payment channels for an account so I can see their IDs, balances, and expiry.

**Acceptance Criteria:**
- [ ] `xrpl channel list <address>` subcommand using `account_channels` RPC
- [ ] Optional `--destination <address>` to filter by destination
- [ ] Default human-readable output per channel: channel ID, amount (XRP), balance (XRP), destination, settle-delay (seconds), expiration (ISO8601 or "none"), cancel-after (ISO8601 or "none")
- [ ] XRPL epoch timestamps converted back to ISO8601: `new Date((epoch + 946684800) * 1000).toISOString()`
- [ ] `--json` outputs raw JSON array
- [ ] `--node` supported
- [ ] `tests/e2e/channel/channel.list.test.ts`: create a channel then verify it appears in list; `--json` output; `--destination` filter
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `PaymentChannelCreate` — Amount (drops), Destination, SettleDelay (seconds), PublicKey (33-byte hex); optional CancelAfter (XRPL epoch), DestinationTag
- FR-2: If `--public-key` omitted on create, derive hex public key from the signing key material: `wallet.publicKey`
- FR-3: `PaymentChannelFund` — Channel (64-hex), Amount (drops); optional Expiration (XRPL epoch)
- FR-4: `PaymentChannelClaim` — Channel (64-hex); optional Amount (drops), Balance (drops), PublicKey (hex), Signature (hex), flags tfClose/tfRenew
- FR-5: ISO 8601 conversion: `Math.floor(new Date(s).getTime() / 1000) - 946684800`
- FR-6: Off-chain claim amounts are cumulative (each new claim must be ≥ the previous one)
- FR-7: `channel create` must print channel ID on success; channel ID is derived from the transaction hash and account sequence
- FR-8: All transaction commands support `--json`, `--dry-run`, `--no-wait`

## Non-Goals

- No streaming / daemon mode that auto-submits claims at an interval
- No multi-hop payment channel routing
- No CredentialIDs on PaymentChannelClaim
- No IOU/token payment channels (XRP only per protocol)

## Technical Considerations

- **Mandatory pre-implementation step:** Read docs before coding:
  - PaymentChannelCreate: https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/paymentchannelcreate.md
  - PaymentChannelFund: https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/paymentchannelfund.md
  - PaymentChannelClaim: https://github.com/XRPLF/xrpl-dev-portal/blob/master/docs/references/protocol/transactions/types/paymentchannelclaim.md
- **Channel ID:** xrpl.js does not expose a helper to compute channel ID before submission; retrieve it from the transaction metadata (`CreatedNode` with `LedgerEntryType: "PaymentChannel"`) or from `account_channels` after creation
- **xrpl.js utilities:** `signPaymentChannelClaim(channelId, amount, privateKey)` and `verifyPaymentChannelClaim(channelId, amount, signature, publicKey)` are exported from the `xrpl` package
- **Private key format:** xrpl.js private keys include a `00` prefix for secp256k1 keys; pass `wallet.privateKey` directly
- **Claim amounts:** Always in drops (string). Convert decimal XRP input with `xrpToDrops()`
- **Test strategy:** Create a channel in `beforeAll`; sign a claim with `channel sign`; redeem with `channel claim` in the same test file to keep it self-contained

## Success Metrics

- Full round-trip (create → sign → verify → claim → close) works against testnet
- `channel sign` / `channel verify` run offline with no `--node` needed
- Typecheck passes with strict mode

## Open Questions

- Should `channel sign` support `--mnemonic` and keystore in addition to `--seed`? (Current spec: yes, same key material options as all other commands.)
- Should we surface the channel's `public_key_hex` field from `channel list` output? (Currently yes, shown as part of default output.)
