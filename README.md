# xrpl-cli

A command-line interface for the XRP Ledger. Send transactions, query account state, and manage wallets without writing scripts.

Built with [xrpl.js](https://js.xrpl.org/) and [Commander.js](https://github.com/tj/commander.js).

## Requirements

- Node.js 22+

## Installation

```bash
npm install
npm run build
npm link   # makes 'xrpl' available globally
```

## Usage

All commands accept `--node <url>` to specify a node. Use `--node testnet` as a shorthand for the XRPL testnet.

```bash
xrpl --node testnet <command> [options]
```

### Payments

```bash
# Send XRP
xrpl payment send --to <address> --amount 10 --seed <seed> --node testnet

# Send an IOU
xrpl payment send --to <address> --amount 1/USD/<issuer> --seed <seed> --node testnet

# Path payment with partial delivery
xrpl payment send --to <address> --amount 1/USD/<issuer> --partial --deliver-min 0.5/USD/<issuer> --seed <seed> --node testnet
```

### Trust lines

```bash
xrpl trust set --issuer <address> --currency USD --limit 1000 --seed <seed> --node testnet
xrpl account trust-lines <address> --node testnet
```

### Offers (DEX)

```bash
# Create an offer (taker-pays and taker-gets use "value/CURRENCY/issuer" for IOU, plain number for XRP)
xrpl offer create --taker-pays 1/USD/<issuer> --taker-gets 10 --seed <seed> --node testnet
xrpl offer cancel --sequence <N> --seed <seed> --node testnet
```

### Account

```bash
xrpl account info <address> --node testnet
xrpl account balance <address> --node testnet
xrpl account transactions <address> --node testnet
xrpl account offers <address> --node testnet
xrpl account nfts <address> --node testnet
xrpl account channels <address> --node testnet
xrpl account set --domain example.com --seed <seed> --node testnet
xrpl account delete --destination <address> --seed <seed> --node testnet
```

### Wallet

```bash
xrpl wallet new                        # generate a new wallet
xrpl wallet new-mnemonic               # generate a wallet with BIP39 mnemonic
xrpl wallet import --seed <seed>       # import into encrypted keystore
xrpl wallet fund <address> --node testnet   # fund from testnet faucet
xrpl wallet list                       # list saved wallets
xrpl wallet sign --message "hello" --seed <seed>
xrpl wallet verify --message "hello" --signature <sig> --public-key <key>
```

## Key material

Every transaction command accepts one of:

- `--seed <seed>` - family seed (sXXX...)
- `--mnemonic "<words>"` - BIP39 mnemonic
- `--account <name> --keystore <dir> --password <pw>` - encrypted keystore entry

## Common flags

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON |
| `--dry-run` | Serialize the transaction without submitting |
| `--no-wait` | Submit without waiting for ledger validation |
| `--node <url>` | WebSocket node URL, or `testnet` / `mainnet` shorthand |

## Development

```bash
npm test            # run all tests (requires internet, hits XRPL testnet)
npm run typecheck   # TypeScript check only
npm run dev -- --node testnet account info <address>
```
