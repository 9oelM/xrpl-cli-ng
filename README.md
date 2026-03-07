# xrpl-cli-ng

```
             _         _ _             
 _ _ ___ ___| |___ ___| |_|___ ___ ___ 
|_'_|  _| . | |___|  _| | |___|   | . |
|_,_|_| |  _|_|   |___|_|_|   |_|_|_  |
        |_|                       |___|
```

A command-line interface for the XRP Ledger. Send transactions, query account state, and manage wallets without writing scripts.

> [!CAUTION]
> This is **alpha** software. Many features are still in testing and may contain bugs. Use with caution on mainnet.

Built with [xrpl.js](https://js.xrpl.org/) and [Commander.js](https://github.com/tj/commander.js).

## Requirements

- Node.js 22+

## Full CLI Reference

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

#### `account balance`
```text
Usage: xrpl account balance|bal [options] <address-or-alias>

Get the XRP balance of an account

Arguments:
  address-or-alias  Account address or alias

Options:
  --drops           Output raw drops as a plain integer string
  --json            Output JSON with address and balance fields
  -h, --help        display help for command
```

#### `account transactions`
```text
Usage: xrpl account transactions|txs [options] <address-or-alias>

List recent transactions for an account

Arguments:
  address-or-alias        Account address or alias

Options:
  --limit <n>             Number of transactions to return (max 400) (default: "20")
  --marker <json-string>  Pagination marker from a previous --json response
  --json                  Output raw JSON with transactions and optional marker
  -h, --help              display help for command
```

#### `account offers`
```text
Usage: xrpl account offers|of [options] <address-or-alias>

List open DEX offers for an account

Arguments:
  address-or-alias        Account address or alias

Options:
  --limit <n>             Number of offers to return
  --marker <json-string>  Pagination marker from a previous --json response
  --json                  Output raw JSON offers array
  -h, --help              display help for command
```

#### `account trust-lines`
```text
Usage: xrpl account trust-lines|lines [options] <address-or-alias>

List trust lines for an account

Arguments:
  address-or-alias        Account address or alias

Options:
  --peer <address>        Filter to trust lines with a specific peer
  --limit <n>             Number of trust lines to return
  --marker <json-string>  Pagination marker from a previous --json response
  --json                  Output raw JSON lines array
  -h, --help              display help for command
```

#### `account channels`
```text
Usage: xrpl account channels|chan [options] <address-or-alias>

List payment channels for an account

Arguments:
  address-or-alias                 Account address or alias

Options:
  --destination-account <address>  Filter by destination account
  --limit <n>                      Number of channels to return
  --marker <json-string>           Pagination marker from a previous --json response
  --json                           Output raw JSON channels array
  -h, --help                       display help for command
```

#### `account nfts`
```text
Usage: xrpl account nfts|nft [options] <address-or-alias>

List NFTs owned by an account

Arguments:
  address-or-alias        Account address or alias

Options:
  --limit <n>             Number of NFTs to return
  --marker <json-string>  Pagination marker from a previous --json response
  --json                  Output raw JSON NFTs array
  -h, --help              display help for command
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

#### `account set-regular-key`
```text
Usage: xrpl account set-regular-key [options]

Assign or remove the regular signing key on an account (SetRegularKey)

Options:
  --key <address>               Base58 address of the new regular key to assign
  --remove                      Remove the existing regular key (omits RegularKey field from tx) (default: false)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --json                        Output as JSON (default: false)
  --dry-run                     Print unsigned tx JSON without submitting (default: false)
  --no-wait                     Submit without waiting for validation
  -h, --help                    display help for command
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

#### `wallet new-mnemonic`
```text
Usage: xrpl wallet new-mnemonic|nm [options]

Generate a new BIP39 mnemonic wallet

Options:
  --derivation-path <path>  BIP44 derivation path (default: "m/44'/144'/0'/0/0")
  --key-type <type>         Key algorithm: secp256k1 or ed25519 (default: "ed25519")
  --json                    Output as JSON (default: false)
  --save                    Encrypt and save the wallet to the keystore (default: false)
  --password <password>     Encryption password for --save (insecure, prefer interactive prompt)
  --alias <name>            Set a human-readable alias when saving to keystore
  --keystore <dir>          Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  -h, --help                display help for command
```

#### `wallet address`
```text
Usage: xrpl wallet address|a [options]

Derive XRPL address from key material

Options:
  --seed <seed>             Family seed (sXXX...)
  --mnemonic <phrase>       BIP39 mnemonic phrase
  --private-key <hex>       Raw private key as hex (ED-prefixed for ed25519, 00-prefixed for secp256k1)
  --key-type <type>         Key algorithm: secp256k1 or ed25519 (required when --private-key is used without a recognised prefix)
  --derivation-path <path>  BIP44 derivation path (used with --mnemonic) (default: "m/44'/144'/0'/0/0")
  --json                    Output as JSON (default: false)
  -h, --help                display help for command
```

#### `wallet private-key`
```text
Usage: xrpl wallet private-key|pk [options]

Derive private key from seed or mnemonic

Options:
  --seed <seed>             Family seed (sXXX...)
  --mnemonic <phrase>       BIP39 mnemonic phrase
  --key-type <type>         Key algorithm: secp256k1 or ed25519
  --derivation-path <path>  BIP44 derivation path (used with --mnemonic) (default: "m/44'/144'/0'/0/0")
  --json                    Output as JSON (default: false)
  -h, --help                display help for command
```

#### `wallet public-key`
```text
Usage: xrpl wallet public-key|pubkey [options]

Derive public key from key material

Options:
  --seed <seed>             Family seed (sXXX...)
  --mnemonic <phrase>       BIP39 mnemonic phrase
  --private-key <hex>       Raw private key as hex (ED-prefixed for ed25519, 00-prefixed for secp256k1)
  --key-type <type>         Key algorithm: secp256k1 or ed25519
  --derivation-path <path>  BIP44 derivation path (used with --mnemonic) (default: "m/44'/144'/0'/0/0")
  --json                    Output as JSON (default: false)
  -h, --help                display help for command
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

#### `wallet list`
```text
Usage: xrpl wallet list|ls [options]

List keystored accounts

Options:
  --keystore <dir>  Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --json            Output as JSON array (default: false)
  -h, --help        display help for command
```

#### `wallet remove`
```text
Usage: xrpl wallet remove|rm [options] <address>

Remove a wallet from the keystore

Arguments:
  address           XRPL address to remove from keystore

Options:
  --keystore <dir>  Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  -h, --help        display help for command
```

#### `wallet decrypt-keystore`
```text
Usage: xrpl wallet decrypt-keystore|dk [options] [address]

Decrypt a keystore file to retrieve the seed or private key

Arguments:
  address                XRPL address to look up in keystore (required unless --file is used)

Options:
  --file <path>          Explicit keystore file path (overrides address lookup)
  --password <password>  Decryption password (insecure, prefer interactive prompt)
  --show-private-key     Also print the private key hex (default: false)
  --json                 Output as JSON {address, seed, privateKey, keyType} (default: false)
  --keystore <dir>       Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  -h, --help             display help for command
```

#### `wallet change-password`
```text
Usage: xrpl wallet change-password|cp [options] <address>

Re-encrypt a keystore file with a new password

Arguments:
  address               XRPL address of the keystore entry to update

Options:
  --password <current>  Current password (insecure, prefer interactive prompt)
  --new-password <new>  New password (insecure, prefer interactive prompt)
  --keystore <dir>      Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  -h, --help            display help for command
```

#### `wallet sign`
```text
Usage: xrpl wallet sign|s [options]

Sign a message or XRPL transaction

Options:
  --message <string>     UTF-8 message to sign (use --from-hex for hex-encoded)
  --from-hex             Treat --message value as already hex-encoded (default: false)
  --tx <json-or-path>    Transaction JSON (inline or file path) to sign
  --seed <seed>          Family seed for signing
  --mnemonic <phrase>    BIP39 mnemonic for signing
  --account <address>    Account address to load from keystore (requires --password)
  --key-type <type>      Key algorithm: secp256k1 or ed25519 (used with --seed or --mnemonic)
  --password <password>  Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>       Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --json                 Output as JSON (default: false)
  -h, --help             display help for command
```

#### `wallet verify`
```text
Usage: xrpl wallet verify|v [options]

Verify a message or transaction signature

Options:
  --message <msg>     Message to verify (UTF-8 string, or hex if --from-hex)
  --from-hex          Treat --message value as hex-encoded (default: false)
  --signature <hex>   Signature hex string (used with --message)
  --public-key <hex>  Signer public key hex (used with --message)
  --tx <tx_blob_hex>  Signed transaction blob hex to verify
  --json              Output as JSON {valid: boolean} (default: false)
  -h, --help          display help for command
```

#### `wallet alias set`
```text
Usage: xrpl wallet alias set [options] <address> <name>

Set a human-readable alias on a keystore entry

Arguments:
  address           XRPL address of the wallet
  name              Alias name to set

Options:
  --keystore <dir>  Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --force           Overwrite existing alias even if used by another address (default: false)
  -h, --help        display help for command
```

#### `wallet alias list`
```text
Usage: xrpl wallet alias list [options]

List all wallets with aliases

Options:
  --keystore <dir>  Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --json            Output as JSON array (default: false)
  -h, --help        display help for command
```

#### `wallet alias remove`
```text
Usage: xrpl wallet alias remove [options] <address>

Remove alias from a keystore entry

Arguments:
  address           XRPL address of the wallet

Options:
  --keystore <dir>  Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  -h, --help        display help for command
```

#### `wallet fund`
```text
Usage: xrpl wallet fund|f [options] <address-or-alias>

Fund an address from the testnet or devnet faucet

Arguments:
  address-or-alias  Account address or alias to fund

Options:
  --json            Output as JSON (default: false)
  -h, --help        display help for command
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

#### `channel fund`
```text
Usage: xrpl channel fund [options]

Add XRP to an existing payment channel

Options:
  --channel <hex>               64-character payment channel ID
  --amount <xrp>                Amount of XRP to add to the channel (decimal, e.g. 5)
  --expiration <iso8601>        New expiration time in ISO 8601 format (converted to XRPL epoch)
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

#### `channel sign`
```text
Usage: xrpl channel sign [options]

Sign an off-chain payment channel claim (offline)

Options:
  --channel <hex>               64-character payment channel ID
  --amount <xrp>                Amount of XRP to authorize (decimal, e.g. 5)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias to load from keystore
  --password <password>         Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --json                        Output as JSON (default: false)
  -h, --help                    display help for command
```

#### `channel verify`
```text
Usage: xrpl channel verify [options]

Verify an off-chain payment channel claim signature (offline)

Options:
  --channel <hex>     64-character payment channel ID
  --amount <xrp>      Amount of XRP in the claim (decimal, e.g. 5)
  --signature <hex>   Hex-encoded signature to verify
  --public-key <hex>  Hex-encoded public key of the signer
  --json              Output as JSON (default: false)
  -h, --help          display help for command
```

#### `channel claim`
```text
Usage: xrpl channel claim [options]

Redeem a signed payment channel claim or close a channel

Options:
  --channel <hex>               64-character payment channel ID
  --amount <xrp>                Amount of XRP authorized by the signature (decimal, converted to drops)
  --balance <xrp>               Total XRP delivered by this claim (decimal, converted to drops)
  --signature <hex>             Hex-encoded claim signature
  --public-key <hex>            Hex-encoded public key of the channel source
  --close                       Request channel closure (sets tfClose flag) (default: false)
  --renew                       Clear channel expiration (sets tfRenew flag, source only) (default: false)
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

#### `channel list`
```text
Usage: xrpl channel list [options] <address>

List open payment channels for an account

Arguments:
  address                  Account address to query channels for

Options:
  --destination <address>  Filter channels by destination account
  --json                   Output as JSON array (default: false)
  -h, --help               display help for command
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

#### `escrow finish`
```text
Usage: xrpl escrow finish|f [options]

Release funds from an escrow

Options:
  --owner <address>             Address of the account that created the escrow
  --sequence <n>                Sequence number of the EscrowCreate transaction
  --condition <hex>             PREIMAGE-SHA-256 condition hex blob (must pair with --fulfillment)
  --fulfillment <hex>           Matching crypto-condition fulfillment hex blob (must pair with --condition)
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

#### `escrow cancel`
```text
Usage: xrpl escrow cancel|x [options]

Cancel an expired escrow and return funds to the owner

Options:
  --owner <address>             Address of the account that created the escrow
  --sequence <n>                Sequence number of the EscrowCreate transaction
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

#### `escrow list`
```text
Usage: xrpl escrow list|ls [options] <address>

List pending escrows for an account

Arguments:
  address     Account address to query

Options:
  --json      Output as JSON array (default: false)
  -h, --help  display help for command
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

#### `check cash`
```text
Usage: xrpl check cash [options]

Cash a Check on the XRP Ledger

Options:
  --check <id>                  64-character Check ID (hex)
  --amount <amount>             Exact amount to cash (XRP decimal or value/CURRENCY/issuer)
  --deliver-min <amount>        Minimum amount to receive (XRP decimal or value/CURRENCY/issuer)
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

#### `check cancel`
```text
Usage: xrpl check cancel|x [options]

Cancel a Check on the XRP Ledger

Options:
  --check <id>                  64-character Check ID (hex)
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

#### `check list`
```text
Usage: xrpl check list|ls [options] <address>

List pending checks for an account

Arguments:
  address     Account address to query

Options:
  --json      Output as JSON array (default: false)
  -h, --help  display help for command
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

#### `credential create`
```text
Usage: xrpl credential create [options]

Create an on-chain credential for a subject account

Options:
  --subject <address>           Subject account address
  --credential-type <string>    Credential type as plain string (auto hex-encoded, max 64 bytes)
  --credential-type-hex <hex>   Credential type as raw hex (2-128 hex chars)
  --uri <string>                URI as plain string (auto hex-encoded, max 256 bytes)
  --uri-hex <hex>               URI as raw hex (max 512 hex chars)
  --expiration <ISO8601>        Expiration date/time in ISO 8601 format
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

#### `credential accept`
```text
Usage: xrpl credential accept [options]

Accept an on-chain credential issued to you

Options:
  --issuer <address>            Address of the credential issuer
  --credential-type <string>    Credential type as plain string (auto hex-encoded, max 64 bytes)
  --credential-type-hex <hex>   Credential type as raw hex (2-128 hex chars)
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

#### `credential delete`
```text
Usage: xrpl credential delete [options]

Delete an on-chain credential (revoke or clean up)

Options:
  --credential-type <string>    Credential type as plain string (auto hex-encoded, max 64 bytes)
  --credential-type-hex <hex>   Credential type as raw hex (2-128 hex chars)
  --subject <address>           Subject account address (defaults to sender if omitted)
  --issuer <address>            Issuer account address (defaults to sender if omitted)
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

#### `credential list`
```text
Usage: xrpl credential list [options] <address>

List credentials for an account

Arguments:
  address     Account address to query credentials for

Options:
  --json      Output as JSON array (default: false)
  -h, --help  display help for command
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

#### `nft burn`
```text
Usage: xrpl nft burn [options]

Burn (destroy) an NFT on the XRP Ledger

Options:
  --nft <hex>                   64-char NFTokenID to burn
  --owner <address>             NFT owner address (when issuer burns a burnable token they don't hold)
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

#### `nft modify`
```text
Usage: xrpl nft modify [options]

Modify the URI of a mutable NFT on the XRP Ledger

Options:
  --nft <hex>                   64-char NFTokenID to modify
  --uri <string>                New metadata URI (plain string, converted to hex)
  --clear-uri                   Explicitly clear the existing URI (default: false)
  --owner <address>             NFT owner address (if different from signer)
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

#### `nft offer create`
```text
Usage: xrpl nft offer create [options]

Create a buy or sell offer for an NFT

Options:
  --nft <hex>                   64-char NFTokenID
  --amount <amount>             Offer amount (XRP decimal or value/CURRENCY/issuer; '0' valid for XRP sell giveaways)
  --sell                        Create a sell offer (absence = buy offer) (default: false)
  --owner <address>             NFT owner address (required for buy offers)
  --expiration <ISO8601>        Offer expiration (ISO 8601 datetime)
  --destination <address>       Only this account may accept the offer
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

#### `nft offer accept`
```text
Usage: xrpl nft offer accept [options]

Accept a buy or sell NFT offer (direct or brokered mode)

Options:
  --sell-offer <hex>            Sell offer ID (64-char hex)
  --buy-offer <hex>             Buy offer ID (64-char hex)
  --broker-fee <amount>         Broker fee (XRP decimal or value/CURRENCY/issuer; only valid with both offers)
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

#### `nft offer cancel`
```text
Usage: xrpl nft offer cancel [options]

Cancel one or more NFT offers

Options:
  --offer <hex>                 NFTokenOffer ID to cancel (repeat for multiple) (default: [])
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

#### `nft offer list`
```text
Usage: xrpl nft offer list [options] <nft-id>

List buy and sell offers for an NFT

Arguments:
  nft-id      64-char NFTokenID

Options:
  --json      Output as JSON (default: false)
  -h, --help  display help for command
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

#### `multisig set`
```text
Usage: xrpl multisig set [options]

Configure a multi-signature signer list on an account

Options:
  --quorum <n>                  Required signature weight threshold (must be > 0; use 'multisig delete' to remove)
  --signer <address:weight>     Signer entry (repeatable); e.g. --signer rAlice...:3 --signer rBob...:2 (default: [])
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

#### `multisig delete`
```text
Usage: xrpl multisig delete [options]

Remove the multi-signature signer list from an account

Options:
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

#### `multisig list`
```text
Usage: xrpl multisig list [options] <address>

Show the current signer list for an account

Arguments:
  address     Account address to query

Options:
  --json      Output as JSON (default: false)
  -h, --help  display help for command
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

#### `oracle set`
```text
Usage: xrpl oracle set [options]

Publish or update an on-chain price oracle (OracleSet)

Options:
  --document-id <n>                 Oracle document ID (UInt32)
  --price <BASE/QUOTE:PRICE:SCALE>  Price pair (repeatable; omit price to delete pair on update; e.g. BTC/USD:155000:6) (default: [])
  --price-data <json>               JSON array of price pairs (alternative to --price)
  --provider <string>               Oracle provider string (auto hex-encoded)
  --provider-hex <hex>              Oracle provider as raw hex (mutually exclusive with --provider)
  --asset-class <string>            Asset class string (auto hex-encoded)
  --asset-class-hex <hex>           Asset class as raw hex (mutually exclusive with --asset-class)
  --last-update-time <unix-ts>      Unix timestamp for LastUpdateTime (defaults to now)
  --seed <seed>                     Family seed for signing
  --mnemonic <phrase>               BIP39 mnemonic for signing
  --account <address-or-alias>      Account address or alias to load from keystore
  --password <password>             Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>                  Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                         Submit without waiting for validation
  --json                            Output as JSON (default: false)
  --dry-run                         Print signed tx without submitting (default: false)
  -h, --help                        display help for command
```

#### `oracle delete`
```text
Usage: xrpl oracle delete [options]

Delete an on-chain price oracle (OracleDelete)

Options:
  --document-id <n>             Oracle document ID (UInt32)
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

#### `oracle get`
```text
Usage: xrpl oracle get [options] <owner-address> <document-id>

Query an on-chain price oracle

Arguments:
  owner-address  Oracle owner account address
  document-id    Oracle document ID (UInt32)

Options:
  --json         Output raw JSON ledger entry (default: false)
  -h, --help     display help for command
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

#### `ticket create`
```text
Usage: xrpl ticket create|c [options]

Reserve ticket sequence numbers on an XRPL account

Options:
  --count <n>                   Number of tickets to create (1-250)
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

#### `ticket list`
```text
Usage: xrpl ticket list|ls [options] <address>

List ticket sequence numbers for an account

Arguments:
  address     Account address to query

Options:
  --json      Output as JSON array (default: false)
  -h, --help  display help for command
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

#### `deposit-preauth set`
```text
Usage: xrpl deposit-preauth set [options]

Grant or revoke deposit preauthorization for an account or credential

Options:
  --authorize <address>              Preauthorize an account to send payments
  --unauthorize <address>            Revoke preauthorization from an account
  --authorize-credential <issuer>    Preauthorize a credential (by issuer address)
  --unauthorize-credential <issuer>  Revoke credential-based preauthorization (by issuer address)
  --credential-type <string>         Credential type as plain string (auto hex-encoded, max 64 bytes)
  --credential-type-hex <hex>        Credential type as raw hex (2-128 hex chars)
  --seed <seed>                      Family seed for signing
  --mnemonic <phrase>                BIP39 mnemonic for signing
  --account <address-or-alias>       Account address or alias to load from keystore
  --password <password>              Keystore decryption password (insecure, prefer interactive prompt)
  --keystore <dir>                   Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)
  --no-wait                          Submit without waiting for validation
  --json                             Output as JSON (default: false)
  --dry-run                          Print signed tx without submitting (default: false)
  -h, --help                         display help for command
```

#### `deposit-preauth list`
```text
Usage: xrpl deposit-preauth list [options] <address>

List deposit preauthorizations for an account

Arguments:
  address     Account address to query

Options:
  --json      Output as JSON (default: false)
  -h, --help  display help for command
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

#### `mptoken issuance create`
```text
Usage: xrpl mptoken issuance create [options]

Create a new MPT issuance (MPTokenIssuanceCreate)

Options:
  --asset-scale <n>             Decimal precision for display (0–255, default 0)
  --max-amount <string>         Maximum token supply as base-10 UInt64 string
  --transfer-fee <n>            Transfer fee in basis points × 10 (0–50000). Requires can-transfer flag
  --flags <list>                Comma-separated flags: can-lock,require-auth,can-escrow,can-trade,can-transfer,can-clawback
  --metadata <string>           Metadata as plain string (auto hex-encoded, max 1024 bytes)
  --metadata-hex <hex>          Metadata as raw hex
  --metadata-file <path>        Path to file whose contents are hex-encoded as metadata
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

#### `mptoken issuance destroy`
```text
Usage: xrpl mptoken issuance destroy [options] <issuance-id>

Destroy an MPT issuance (MPTokenIssuanceDestroy)

Arguments:
  issuance-id                   MPTokenIssuanceID to destroy

Options:
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

#### `mptoken issuance set`
```text
Usage: xrpl mptoken issuance set [options] <issuance-id>

Lock or unlock an MPT issuance (MPTokenIssuanceSet)

Arguments:
  issuance-id                   MPTokenIssuanceID to modify

Options:
  --lock                        Lock the issuance (or a holder's balance) (default: false)
  --unlock                      Unlock the issuance (or a holder's balance) (default: false)
  --holder <address>            Holder address for per-holder lock/unlock
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

#### `mptoken issuance list`
```text
Usage: xrpl mptoken issuance list [options] <address>

List MPT issuances for an account

Arguments:
  address     Account address to query

Options:
  --json      Output as JSON array (default: false)
  -h, --help  display help for command
```

#### `mptoken issuance get`
```text
Usage: xrpl mptoken issuance get [options] <issuance-id>

Get MPT issuance details by ID

Arguments:
  issuance-id  MPTokenIssuanceID to query

Options:
  --json       Output raw JSON (default: false)
  -h, --help   display help for command
```

#### `mptoken authorize`
```text
Usage: xrpl mptoken authorize [options] <issuance-id>

Opt in to hold an MPT issuance, or grant/revoke holder authorization (MPTokenAuthorize)

Arguments:
  issuance-id                   MPTokenIssuanceID

Options:
  --holder <address>            Holder address (issuer-side: authorize/unauthorize a specific holder)
  --unauthorize                 Revoke authorization instead of granting (default: false)
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

#### `permissioned-domain create`
```text
Usage: xrpl permissioned-domain create [options]

Create a new permissioned domain with a set of accepted credentials

Options:
  --credential <issuer:type>    Accepted credential in <issuer>:<type> format (type is UTF-8, auto hex-encoded); repeatable, 1-10 total (default: [])
  --credentials-json <json>     JSON array of {issuer, credential_type} objects (credential_type must be hex)
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

#### `permissioned-domain update`
```text
Usage: xrpl permissioned-domain update [options]

Update the accepted credentials of an existing permissioned domain (replaces the entire credentials list)

Options:
  --domain-id <hash>            64-hex-char domain ID of the permissioned domain to update
  --credential <issuer:type>    Accepted credential in <issuer>:<type> format (type is UTF-8, auto hex-encoded); repeatable, 1-10 total (default: [])
  --credentials-json <json>     JSON array of {issuer, credential_type} objects (credential_type must be hex)
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

#### `permissioned-domain delete`
```text
Usage: xrpl permissioned-domain delete [options]

Delete a permissioned domain you own, removing it from the ledger and reclaiming the reserve

Options:
  --domain-id <hash>            64-hex-char domain ID of the permissioned domain to delete
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

#### `vault create`
```text
Usage: xrpl vault create|c [options]

Create a single-asset vault on the XRP Ledger

Options:
  --asset <asset>               Asset type: "0" for XRP, "0/USD/rIssuer" for IOU, "0/<48-char-hex>" for MPT
  --assets-maximum <n>          Maximum total assets the vault can hold (UInt64 string)
  --data <hex>                  Arbitrary metadata hex blob (max 256 bytes)
  --mpt-metadata <hex>          MPTokenMetadata for vault shares (max 1024 bytes)
  --domain-id <hash>            64-char hex DomainID for a private vault
  --private                     Set tfVaultPrivate flag (requires --domain-id) (default: false)
  --non-transferable            Set tfVaultShareNonTransferable flag (default: false)
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

#### `vault set`
```text
Usage: xrpl vault set|s [options]

Update metadata, asset cap, or domain of a vault you own

Options:
  --vault-id <hash>             64-char hex VaultID to update
  --data <hex>                  Updated metadata hex blob (max 256 bytes)
  --assets-maximum <n>          Updated maximum total assets cap (UInt64 string)
  --domain-id <hash>            Updated 64-char hex DomainID
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

#### `vault withdraw`
```text
Usage: xrpl vault withdraw|w [options]

Withdraw assets from a vault by redeeming vault shares

Options:
  --vault-id <hash>             64-char hex VaultID to withdraw from
  --amount <amount>             Amount to withdraw: "10" for XRP, "10/USD/rIssuer" for IOU, "10/<48hex>" for MPT
  --destination <address>       Send redeemed assets to a different account
  --destination-tag <n>         Destination tag (requires --destination)
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

#### `vault delete`
```text
Usage: xrpl vault delete|del [options]

Delete an empty vault you own and reclaim the reserve

Options:
  --vault-id <hash>             64-char hex VaultID to delete
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

#### `vault clawback`
```text
Usage: xrpl vault clawback|cb [options]

Claw back assets from a vault holder (token/MPT issuer only; cannot claw back XRP)

Options:
  --vault-id <hash>             64-char hex VaultID
  --holder <address>            Address of the account whose shares to claw back
  --amount <amount>             Amount to claw back (omit to claw back all); IOU or MPT only
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

#### `did set`
```text
Usage: xrpl did set [options]

Publish or update a Decentralized Identifier (DID) on-chain (DIDSet)

Options:
  --uri <string>                URI for the DID (auto hex-encoded; pass empty string to clear)
  --uri-hex <hex>               URI as raw hex (mutually exclusive with --uri)
  --data <string>               Public attestation data (auto hex-encoded; pass empty string to clear)
  --data-hex <hex>              Data as raw hex (mutually exclusive with --data)
  --did-document <string>       DID document (auto hex-encoded; pass empty string to clear)
  --did-document-hex <hex>      DID document as raw hex (mutually exclusive with --did-document)
  --clear-uri                   Clear the URI field (sends URI as empty string) (default: false)
  --clear-data                  Clear the Data field (sends Data as empty string) (default: false)
  --clear-did-document          Clear the DIDDocument field (sends DIDDocument as empty string) (default: false)
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

#### `did delete`
```text
Usage: xrpl did delete [options]

Delete the sender's on-chain Decentralized Identifier (DIDDelete)

Options:
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

#### `did get`
```text
Usage: xrpl did get [options] <address>

Query the on-chain DID for an account

Arguments:
  address     Account address to query

Options:
  --json      Output raw JSON ledger entry (default: false)
  -h, --help  display help for command
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

#### `amm deposit`
```text
Usage: xrpl amm deposit [options]

Deposit assets into an AMM pool

Options:
  --asset <spec>                First asset: "XRP" or "CURRENCY/issuer"
  --asset2 <spec>               Second asset: "XRP" or "CURRENCY/issuer"
  --amount <value>              Amount of first asset to deposit (XRP: drops, IOU: decimal)
  --amount2 <value>             Amount of second asset to deposit (XRP: drops, IOU: decimal)
  --lp-token-out <value>        LP token amount to receive (auto-fetches currency/issuer)
  --ePrice <value>              Maximum effective price per LP token received
  --for-empty                   Use tfTwoAssetIfEmpty mode (deposit to empty pool) (default: false)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias from keystore
  --password <password>         Keystore decryption password (insecure)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

#### `amm withdraw`
```text
Usage: xrpl amm withdraw [options]

Withdraw assets from an AMM pool

Options:
  --asset <spec>                First asset: "XRP" or "CURRENCY/issuer"
  --asset2 <spec>               Second asset: "XRP" or "CURRENCY/issuer"
  --lp-token-in <value>         LP token amount to redeem (auto-fetches currency/issuer)
  --amount <value>              Amount of first asset to withdraw (XRP: drops, IOU: decimal)
  --amount2 <value>             Amount of second asset to withdraw (XRP: drops, IOU: decimal)
  --ePrice <value>              Minimum effective price in LP tokens per unit withdrawn
  --all                         Withdraw all LP tokens (tfWithdrawAll or tfOneAssetWithdrawAll) (default: false)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias from keystore
  --password <password>         Keystore decryption password (insecure)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

#### `amm bid`
```text
Usage: xrpl amm bid [options]

Bid on an AMM auction slot to earn a reduced trading fee

Options:
  --asset <spec>                First asset: "XRP" or "CURRENCY/issuer"
  --asset2 <spec>               Second asset: "XRP" or "CURRENCY/issuer"
  --bid-min <value>             Minimum LP token amount to bid (auto-fetches currency/issuer)
  --bid-max <value>             Maximum LP token amount to bid (auto-fetches currency/issuer)
  --auth-account <address>      Address to authorize for discounted trading (repeatable, max 4) (default: [])
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias from keystore
  --password <password>         Keystore decryption password (insecure)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

#### `amm vote`
```text
Usage: xrpl amm vote [options]

Vote on the trading fee for an AMM pool

Options:
  --asset <spec>                First asset: "XRP" or "CURRENCY/issuer"
  --asset2 <spec>               Second asset: "XRP" or "CURRENCY/issuer"
  --trading-fee <n>             Desired trading fee in units of 1/100000 (0–1000)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias from keystore
  --password <password>         Keystore decryption password (insecure)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

#### `amm delete`
```text
Usage: xrpl amm delete [options]

Delete an empty AMM pool (all LP tokens must have been returned first)

Options:
  --asset <spec>                First asset: "XRP" or "CURRENCY/issuer"
  --asset2 <spec>               Second asset: "XRP" or "CURRENCY/issuer"
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias from keystore
  --password <password>         Keystore decryption password (insecure)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```

#### `amm clawback`
```text
Usage: xrpl amm clawback [options]

Claw back IOU assets from an AMM pool (issuer only)

Options:
  --asset <spec>                IOU asset to claw back: "CURRENCY/issuer" (issuer must match signing account)
  --asset2 <spec>               Other asset in the pool: "XRP" or "CURRENCY/issuer"
  --holder <address>            Account holding the asset to be clawed back
  --amount <value>              Maximum amount to claw back (default: all available)
  --both-assets                 Claw back both assets proportionally (tfClawTwoAssets) (default: false)
  --seed <seed>                 Family seed for signing
  --mnemonic <phrase>           BIP39 mnemonic for signing
  --account <address-or-alias>  Account address or alias from keystore
  --password <password>         Keystore decryption password (insecure)
  --keystore <dir>              Keystore directory (default: ~/.xrpl/keystore/)
  --no-wait                     Submit without waiting for validation
  --json                        Output as JSON (default: false)
  --dry-run                     Print signed tx without submitting (default: false)
  -h, --help                    display help for command
```
