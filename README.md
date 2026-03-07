# xrpl-cli

A command-line interface for the XRP Ledger. Send transactions, query account state, and manage wallets without writing scripts.

> [!CAUTION]
> This is **alpha** software. Many features are still in testing and may contain bugs. Use with caution on mainnet.

Built with [xrpl.js](https://js.xrpl.org/) and [Commander.js](https://github.com/tj/commander.js).

## Requirements

- Node.js 22+

## Development

```bash
npm test            # run all tests (requires internet, hits XRPL testnet)
npm run typecheck   # TypeScript check only
npm run dev -- --node testnet account info <address>
```

## CLI Reference

### Root
```text
Usage: xrpl [options] [command]

CLI for interacting with the XRP Ledger

Options:
  -V, --version           output the version number
  -n, --node <url>        XRPL node URL or network name (mainnet|testnet|devnet) (default: "testnet")
  -h, --help              display help for command

Commands:
  account                 Account management commands
  wallet                  Wallet management commands
  payment|send [options]  Send a Payment transaction on the XRP Ledger
  trust                   Manage XRPL trust lines
  offer                   Manage DEX offers on the XRP Ledger
  channel                 Manage XRPL payment channels
  escrow                  Manage XRPL escrows
  check                   Manage XRPL Checks
  clawback [options]      Claw back issued tokens (IOU or MPT) from a holder account
  credential              Manage XRPL on-chain credentials
  nft                     Manage NFTs on the XRP Ledger
  multisig                Manage XRPL multi-signature signer lists
  oracle                  Manage on-chain price oracles
  ticket                  Manage XRPL Tickets
  deposit-preauth         Manage deposit preauthorizations on XRPL accounts
  mptoken                 Manage Multi-Purpose Tokens (MPT) on the XRP Ledger
  permissioned-domain     Manage XRPL permissioned domains
  vault                   Manage single-asset vaults on the XRP Ledger (devnet: SingleAssetVault amendment)
  did                     Manage Decentralized Identifiers (DIDs) on the XRP Ledger
  amm                     Manage AMM liquidity pools on the XRP Ledger
  help [command]          display help for command
```

### `account`
```text
Usage: xrpl account [options] [command]

Account management commands

Options:
  -h, --help                                      display help for command

Commands:
  info|i [options] <address-or-alias>             Get full on-ledger account information
  balance|bal [options] <address-or-alias>        Get the XRP balance of an account
  transactions|txs [options] <address-or-alias>   List recent transactions for an account
  offers|of [options] <address-or-alias>          List open DEX offers for an account
  trust-lines|lines [options] <address-or-alias>  List trust lines for an account
  channels|chan [options] <address-or-alias>      List payment channels for an account
  nfts|nft [options] <address-or-alias>           List NFTs owned by an account
  set [options]                                   Update account settings with an AccountSet transaction
  delete [options]                                Delete an account with an AccountDelete transaction (irreversible). Fee: ~2 XRP (owner reserve, non-refundable)
  set-regular-key [options]                       Assign or remove the regular signing key on an account (SetRegularKey)
```

#### `account info`
```text
Usage: xrpl account info|i [options] <address-or-alias>

Get full on-ledger account information

Arguments:
  address-or-alias  Account address or alias

Options:
  --json            Output raw JSON
  -h, --help        display help for command
```

#### `account set`
```text
Usage: xrpl account set [options]

Update account settings with an AccountSet transaction

Options:
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --domain <utf8-string>        Domain to set (auto hex-encoded)
  --email-hash <32-byte-hex>    Email hash (32-byte hex)
  --transfer-rate <integer>     Transfer rate (0 or 1000000000-2000000000)
  --tick-size <n>               Tick size (0 or 3-15)
  --set-flag <name>             Account flag to set (requireDestTag|requireAuth|disallowXRP|disableMaster|noFreeze|globalFreeze|defaultRipple|depositAuth)
  --clear-flag <name>           Account flag to clear (requireDestTag|requireAuth|disallowXRP|disableMaster|noFreeze|globalFreeze|defaultRipple|depositAuth)
  --allow-clawback              Enable clawback on this account (irreversible — requires --confirm) (default: false)
  --confirm                     Acknowledge irreversible operations (required with --allow-clawback) (default: false)
  --json                        Output as JSON (default: false)
  --dry-run                     Print unsigned tx JSON without submitting (default: false)
  -h, --help                    display help for command
```

#### `account delete`
```text
Usage: xrpl account delete [options]

Delete an account with an AccountDelete transaction (irreversible). Fee: ~2 XRP (owner reserve, non-refundable)

Options:
  --destination <address-or-alias>  Destination address or alias to receive remaining XRP
  --destination-tag <n>             Destination tag for the destination account
  --seed <seed>                     Family seed for signing
  --mnemonic <phrase>               BIP39 mnemonic for signing
  --account <address-or-alias>      Account address or alias to load from keystore
  --password <password>             Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>                  Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --confirm                         Acknowledge that this permanently deletes your account (required unless --dry-run) (default: false)
  --no-wait                         Submit without waiting for validation
  --json                            Output as JSON (default: false)
  --dry-run                         Print unsigned tx JSON without submitting (default: false)
  -h, --help                        display help for command
```

### `wallet`
```text
Usage: xrpl wallet [options] [command]

Wallet management commands

Options:
  -h, --help                               display help for command

Commands:
  new|n [options]                          Generate a new random XRPL wallet
  new-mnemonic|nm [options]                Generate a new BIP39 mnemonic wallet
  address|a [options]                      Derive XRPL address from key material
  private-key|pk [options]                 Derive private key from seed or mnemonic
  public-key|pubkey [options]              Derive public key from key material
  import|i [options] <key-material>        Import key material into encrypted keystore
  list|ls [options]                        List keystored accounts
  remove|rm [options] <address>            Remove a wallet from the keystore
  decrypt-keystore|dk [options] [address]  Decrypt a keystore file to retrieve the seed or private key
  change-password|cp [options] <address>   Re-encrypt a keystore file with a new password
  sign|s [options]                         Sign a message or XRPL transaction
  verify|v [options]                       Verify a message or transaction signature
  alias                                    Manage wallet aliases
  fund|f [options] <address-or-alias>      Fund an address from the testnet or devnet faucet
```

#### `wallet new`
```text
Usage: xrpl wallet new|n [options]

Generate a new random XRPL wallet

Options:
  --key-type <type>      Key algorithm: secp256k1 or ed25519 (default: "ed25519")
  --json                 Output as JSON (default: false)
  --save                 Encrypt and save the wallet to the keystore (default: false)
  --password <password>  Encryption password for --save (insecure, prefer interactive prompt)
  --alias <name>         Set a human-readable alias when saving to keystore
  --keystore <dir>       Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  -h, --help             display help for command
```

#### `wallet import`
```text
Usage: xrpl wallet import|i [options] <key-material>

Import key material into encrypted keystore

Arguments:
  key-material           Seed, mnemonic, or private key to import (use '-' to read from stdin)

Options:
  --key-type <type>      Key algorithm: secp256k1 or ed25519 (required for unprefixed hex private keys)
  --password <password>  Encryption password (insecure, prefer interactive prompt)
  --keystore <dir>       Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --force                Overwrite existing keystore entry (default: false)
  --alias <name>         Set a human-readable alias for this wallet at import time
  -h, --help             display help for command
```

### `payment`
```text
Usage: xrpl payment|send [options]

Send a Payment transaction on the XRP Ledger

Options:
  --to <address-or-alias>       Destination address or alias
  --amount <amount>             Amount to send (e.g. 1.5 for XRP, 10/USD/rIssuer for IOU, 100/<48-hex> for MPT)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --destination-tag <n>         Destination tag (unsigned 32-bit integer)
  --memo <text>                 Memo text to attach (repeatable) (default: [])
  --memo-type <hex>             MemoType hex for the last memo
  --memo-format <hex>           MemoFormat hex for the last memo
  --send-max <amount>           SendMax field; supports XRP, IOU, and MPT amounts
  --deliver-min <amount>        DeliverMin field; automatically adds tfPartialPayment flag
  --paths <json-or-file>        Payment paths as JSON array or path to a .json file
  --partial                     Set tfPartialPayment flag (default: false)
  --no-ripple-direct            Set tfNoRippleDirect flag (value 0x00010000)
  --limit-quality               Set tfLimitQuality flag (value 0x00080000) (default: false)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

### `trust`
```text
Usage: xrpl trust [options] [command]

Manage XRPL trust lines

Options:
  -h, --help       display help for command

Commands:
  set|s [options]  Create or update a trust line
```

#### `trust set`
```text
Usage: xrpl trust set|s [options]

Create or update a trust line

Options:
  --currency <code>             Currency code (3-char ASCII or 40-char hex)
  --issuer <address-or-alias>   Issuer address or alias
  --limit <value>               Trust line limit (0 removes the trust line)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  --no-ripple                   Set NoRipple flag on trust line
  --clear-no-ripple             Clear NoRipple flag on trust line (default: false)
  --freeze                      Freeze the trust line (default: false)
  --unfreeze                    Unfreeze the trust line (default: false)
  --auth                        Authorize the trust line (default: false)
  --quality-in <n>              Set QualityIn (unsigned integer)
  --quality-out <n>             Set QualityOut (unsigned integer)
  -h, --help                    display help for command
```

### `offer`
```text
Usage: xrpl offer [options] [command]

Manage DEX offers on the XRP Ledger

Options:
  -h, --help          display help for command

Commands:
  create|c [options]  Create a DEX offer on the XRP Ledger
  cancel|x [options]  Cancel an existing DEX offer on the XRP Ledger
```

#### `offer create`
```text
Usage: xrpl offer create|c [options]

Create a DEX offer on the XRP Ledger

Options:
  --taker-pays <amount>         Amount the taker pays (e.g. 1.5 for XRP, 10/USD/rIssuer for IOU)
  --taker-gets <amount>         Amount the taker gets (e.g. 1.5 for XRP, 10/USD/rIssuer for IOU)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --sell                        Set tfSell flag — offer consumes funds in order of taker_pays (default: false)
  --passive                     Set tfPassive flag — offer does not consume matching offers (default: false)
  --immediate-or-cancel         Set tfImmediateOrCancel — fill as much as possible, cancel remainder (default: false)
  --fill-or-kill                Set tfFillOrKill — fill completely or cancel entire offer (default: false)
  --expiration <iso>            Offer expiration as ISO 8601 string (e.g. 2030-01-01T00:00:00Z)
  --replace <sequence>          Cancel offer with this sequence and replace it atomically (OfferSequence field)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

#### `offer cancel`
```text
Usage: xrpl offer cancel|x [options]

Cancel an existing DEX offer on the XRP Ledger

Options:
  --sequence <n>                Sequence number of the offer to cancel
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

### `channel`
```text
Usage: xrpl channel [options] [command]

Manage XRPL payment channels

Options:
  -h, --help                display help for command

Commands:
  create [options]          Open a new payment channel
  fund [options]            Add XRP to an existing payment channel
  sign [options]            Sign an off-chain payment channel claim (offline)
  verify [options]          Verify an off-chain payment channel claim signature (offline)
  claim [options]           Redeem a signed payment channel claim or close a channel
  list [options] <address>  List open payment channels for an account
```

#### `channel create`
```text
Usage: xrpl channel create [options]

Open a new payment channel

Options:
  --to <address-or-alias>       Destination address or alias
  --amount <xrp>                Amount of XRP to lock in the channel (decimal, e.g. 10)
  --settle-delay <seconds>      Seconds the source must wait before closing with unclaimed funds
  --public-key <hex>            33-byte secp256k1/Ed25519 public key hex (derived from key material if omitted)
  --cancel-after <iso8601>      Expiry time in ISO 8601 format (converted to XRPL epoch)
  --destination-tag <n>         Destination tag (unsigned 32-bit integer)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

### `escrow`
```text
Usage: xrpl escrow [options] [command]

Manage XRPL escrows

Options:
  -h, --help                   display help for command

Commands:
  create|c [options]           Create an escrow on the XRP Ledger
  finish|f [options]           Release funds from an escrow
  cancel|x [options]           Cancel an expired escrow and return funds to the owner
  list|ls [options] <address>  List pending escrows for an account
```

#### `escrow create`
```text
Usage: xrpl escrow create|c [options]

Create an escrow on the XRP Ledger

Options:
  --to <address>                Destination address for escrowed funds
  --amount <xrp>                Amount to escrow in XRP (e.g. 10 or 1.5)
  --finish-after <iso>          Time after which funds can be released (ISO 8601)
  --cancel-after <iso>          Expiration time; escrow can be cancelled after this (ISO 8601)
  --condition <hex>             PREIMAGE-SHA-256 crypto-condition hex blob
  --destination-tag <n>         Destination tag (unsigned 32-bit integer)
  --source-tag <n>              Source tag (unsigned 32-bit integer)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

### `check`
```text
Usage: xrpl check [options] [command]

Manage XRPL Checks

Options:
  -h, --help                   display help for command

Commands:
  create|c [options]           Create a Check on the XRP Ledger
  cash [options]               Cash a Check on the XRP Ledger
  cancel|x [options]           Cancel a Check on the XRP Ledger
  list|ls [options] <address>  List pending checks for an account
```

#### `check create`
```text
Usage: xrpl check create|c [options]

Create a Check on the XRP Ledger

Options:
  --to <address>                Destination address that can cash the Check
  --send-max <amount>           Maximum amount the Check can debit (XRP decimal or value/CURRENCY/issuer)
  --expiration <iso>            Check expiration time (ISO 8601)
  --destination-tag <n>         Destination tag (unsigned 32-bit integer)
  --invoice-id <string>         Invoice identifier (plain string ≤32 bytes, auto hex-encoded to UInt256)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

### `clawback`
```text
Usage: xrpl clawback [options]

Claw back issued tokens (IOU or MPT) from a holder account

Options:
  --amount <amount>             For IOU tokens: value/CURRENCY/holder-address (holder-address is the account to claw back from, not the token issuer). For MPT tokens: value/MPT_ISSUANCE_ID
  --holder <address>            Holder address to claw back from (required for MPT mode only)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

### `credential`
```text
Usage: xrpl credential [options] [command]

Manage XRPL on-chain credentials

Options:
  -h, --help                display help for command

Commands:
  create [options]          Create an on-chain credential for a subject account
  accept [options]          Accept an on-chain credential issued to you
  delete [options]          Delete an on-chain credential (revoke or clean up)
  list [options] <address>  List credentials for an account
```

### `nft`
```text
Usage: xrpl nft [options] [command]

Manage NFTs on the XRP Ledger

Options:
  -h, --help        display help for command

Commands:
  mint [options]    Mint an NFT on the XRP Ledger
  burn [options]    Burn (destroy) an NFT on the XRP Ledger
  modify [options]  Modify the URI of a mutable NFT on the XRP Ledger
  offer             Manage NFT offers
```

#### `nft mint`
```text
Usage: xrpl nft mint [options]

Mint an NFT on the XRP Ledger

Options:
  --taxon <n>                   NFT taxon (UInt32)
  --uri <string>                Metadata URI (plain string, converted to hex)
  --transfer-fee <bps>          Secondary sale fee in basis points (0-50000); requires --transferable
  --burnable                    Allow issuer to burn the NFT (tfBurnable) (default: false)
  --only-xrp                    Restrict sales to XRP only (tfOnlyXRP) (default: false)
  --transferable                Allow peer-to-peer transfers (tfTransferable) (default: false)
  --mutable                     Allow URI modification via nft modify (tfMutable) (default: false)
  --issuer <address>            Issuer address (when minting on behalf of another account)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

### `multisig`
```text
Usage: xrpl multisig [options] [command]

Manage XRPL multi-signature signer lists

Options:
  -h, --help                display help for command

Commands:
  set [options]             Configure a multi-signature signer list on an account
  delete [options]          Remove the multi-signature signer list from an account
  list [options] <address>  Show the current signer list for an account
```

### `oracle`
```text
Usage: xrpl oracle [options] [command]

Manage on-chain price oracles

Options:
  -h, --help                                   display help for command

Commands:
  set [options]                                Publish or update an on-chain price oracle (OracleSet)
  delete [options]                             Delete an on-chain price oracle (OracleDelete)
  get [options] <owner-address> <document-id>  Query an on-chain price oracle
```

### `ticket`
```text
Usage: xrpl ticket [options] [command]

Manage XRPL Tickets

Options:
  -h, --help                   display help for command

Commands:
  create|c [options]           Reserve ticket sequence numbers on an XRPL account
  list|ls [options] <address>  List ticket sequence numbers for an account
```

### `deposit-preauth`
```text
Usage: xrpl deposit-preauth [options] [command]

Manage deposit preauthorizations on XRPL accounts

Options:
  -h, --help                display help for command

Commands:
  set [options]             Grant or revoke deposit preauthorization for an account or credential
  list [options] <address>  List deposit preauthorizations for an account
```

### `mptoken`
```text
Usage: xrpl mptoken [options] [command]

Manage Multi-Purpose Tokens (MPT) on the XRP Ledger

Options:
  -h, --help                         display help for command

Commands:
  issuance                           Manage MPT issuances
  authorize [options] <issuance-id>  Opt in to hold an MPT issuance, or grant/revoke holder authorization (MPTokenAuthorize)
```

#### `mptoken issuance`
```text
Usage: xrpl mptoken issuance [options] [command]

Manage MPT issuances

Options:
  -h, --help                       display help for command

Commands:
  create [options]                 Create a new MPT issuance (MPTokenIssuanceCreate)
  destroy [options] <issuance-id>  Destroy an MPT issuance (MPTokenIssuanceDestroy)
  set [options] <issuance-id>      Lock or unlock an MPT issuance (MPTokenIssuanceSet)
  list [options] <address>         List MPT issuances for an account
  get [options] <issuance-id>      Get MPT issuance details by ID
```

### `permissioned-domain`
```text
Usage: xrpl permissioned-domain [options] [command]

Manage XRPL permissioned domains

Options:
  -h, --help        display help for command

Commands:
  create [options]  Create a new permissioned domain with a set of accepted credentials
  update [options]  Update the accepted credentials of an existing permissioned domain (replaces the entire credentials list)
  delete [options]  Delete a permissioned domain you own, removing it from the ledger and reclaiming the reserve
```

### `vault`
```text
Usage: xrpl vault [options] [command]

Manage single-asset vaults on the XRP Ledger (devnet: SingleAssetVault amendment)

Options:
  -h, --help             display help for command

Commands:
  create|c [options]     Create a single-asset vault on the XRP Ledger
  set|s [options]        Update metadata, asset cap, or domain of a vault you own
  deposit|d [options]    Deposit assets into a vault and receive vault shares
  withdraw|w [options]   Withdraw assets from a vault by redeeming vault shares
  delete|del [options]   Delete an empty vault you own and reclaim the reserve
  clawback|cb [options]  Claw back assets from a vault holder (token/MPT issuer only; cannot claw back XRP)
```

#### `vault deposit`
```text
Usage: xrpl vault deposit|d [options]

Deposit assets into a vault and receive vault shares

Options:
  --vault-id <hash>             64-char hex VaultID to deposit into
  --amount <amount>             Amount to deposit: "10" for XRP, "10/USD/rIssuer" for IOU, "10/<48hex>" for MPT
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

### `did`
```text
Usage: xrpl did [options] [command]

Manage Decentralized Identifiers (DIDs) on the XRP Ledger

Options:
  -h, --help               display help for command

Commands:
  set [options]            Publish or update a Decentralized Identifier (DID) on-chain (DIDSet)
  delete [options]         Delete the sender's on-chain Decentralized Identifier (DIDDelete)
  get [options] <address>  Query the on-chain DID for an account
```

### `amm`
```text
Usage: xrpl amm [options] [command]

Manage AMM liquidity pools on the XRP Ledger

Options:
  -h, --help          display help for command

Commands:
  create [options]    Create a new AMM liquidity pool
  info [options]      Query AMM pool state via amm_info RPC
  deposit [options]   Deposit assets into an AMM pool
  withdraw [options]  Withdraw assets from an AMM pool
  bid [options]       Bid on an AMM auction slot to earn a reduced trading fee
  vote [options]      Vote on the trading fee for an AMM pool
  delete [options]    Delete an empty AMM pool (all LP tokens must have been returned first)
  clawback [options]  Claw back IOU assets from an AMM pool (issuer only)
```

#### `amm info`
```text
Usage: xrpl amm info [options]

Query AMM pool state via amm_info RPC

Options:
  --asset <spec>   First asset: "XRP" or "CURRENCY/issuer"
  --asset2 <spec>  Second asset: "XRP" or "CURRENCY/issuer"
  --json           Output raw amm_info result as JSON (default: false)
  -h, --help       display help for command
```

#### `amm create`
```text
Usage: xrpl amm create [options]

Create a new AMM liquidity pool

Options:
  --asset <spec>                First asset: "XRP" or "CURRENCY/issuer" (e.g. "USD/rIssuer")
  --asset2 <spec>               Second asset: "XRP" or "CURRENCY/issuer"
  --amount <value>              Amount of first asset (XRP: drops, IOU: decimal)
  --amount2 <value>             Amount of second asset (XRP: drops, IOU: decimal)
  --trading-fee <n>             Trading fee in units of 1/100000 (0–1000, where 1000 = 1%)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
