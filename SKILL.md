---
name: xrpl-cli
description: Command-line interface for the XRP Ledger — send transactions, manage wallets, query accounts, and interact with AMM/NFT/DeFi features without writing scripts
version: 0.1.3
---

## Installation

**Requirements:** Node.js 22 or higher.

```bash
# Global install (recommended)
npm install -g xrpl-cli-ng

# Zero-install alternative (no global install required)
npx xrpl-cli-ng <command>
```

Smoke-test after install:

```bash
xrpl --version
```

## Security Rules for Agents

> **These rules are mandatory. Never bypass them.**

1. **Never log, echo, or store `--seed` / `--private-key` values.** Treat them as ephemeral secrets that must not appear in stdout, stderr, log files, or shell history.
2. **Prefer `--keystore <path> --password <pass>` over raw `--seed` in automated pipelines.** Keystores encrypt the private key at rest; raw seeds do not.
3. **Never commit seed values to version control.** If a seed appears in a file that is tracked by git, rotate it immediately.
4. **Rotate any seed that appears in shell history or logs.** Run `history -c` or equivalent, then generate a new wallet with `xrpl wallet new`.
5. **`wallet private-key` output must be treated as a secret.** Do not forward it to downstream tools, store it in environment variables, or include it in CI/CD output.

## Global Options

These options apply to every command:

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--node <url\|mainnet\|testnet\|devnet>` | string | `testnet` | XRPL node WebSocket URL or named network shorthand |
| `--version` | — | — | Print the installed version and exit |
| `--help` | — | — | Show help for the command or subcommand and exit |

Named network shorthands:
- `mainnet` → `wss://xrplcluster.com`
- `testnet` → `wss://s.altnet.rippletest.net:51233`
- `devnet` → `wss://s.devnet.rippletest.net:51233`

**Example — query balance on testnet:**

```bash
xrpl --node testnet account balance rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```

## wallet

Manage XRPL wallets: create, import, sign, verify, and maintain an encrypted local keystore.

---

### wallet new

Generate a new random XRPL wallet.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--key-type <type>` | string | No | `ed25519` | Key algorithm: `secp256k1` or `ed25519` |
| `--save` | boolean | No | false | Encrypt and save the wallet to the keystore |
| `--show-secret` | boolean | No | false | Show the seed and private key (hidden by default) |
| `--password <password>` | string | No | — | Encryption password for `--save` (insecure; prefer interactive prompt) |
| `--alias <name>` | string | No | — | Human-readable alias when saving to keystore |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |
| `--json` | boolean | No | false | Output as JSON |

```bash
xrpl wallet new --key-type ed25519 --save --alias alice
```

---

### wallet new-mnemonic

Generate a new BIP39 mnemonic wallet.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--derivation-path <path>` | string | No | `m/44'/144'/0'/0/0` | BIP44 derivation path |
| `--key-type <type>` | string | No | `ed25519` | Key algorithm: `secp256k1` or `ed25519` |
| `--save` | boolean | No | false | Encrypt and save the wallet to the keystore |
| `--show-secret` | boolean | No | false | Show the mnemonic and private key (hidden by default) |
| `--password <password>` | string | No | — | Encryption password for `--save` |
| `--alias <name>` | string | No | — | Human-readable alias when saving to keystore |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |
| `--json` | boolean | No | false | Output as JSON |

```bash
xrpl wallet new-mnemonic --save --alias alice-mnemonic
```

---

### wallet import

Import key material (seed, mnemonic, or private key) into the encrypted keystore.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--key-type <type>` | string | No | — | Key algorithm (required for unprefixed hex private keys) |
| `--password <password>` | string | No | — | Encryption password (insecure; prefer interactive prompt) |
| `--alias <name>` | string | No | — | Human-readable alias for this wallet |
| `--force` | boolean | No | false | Overwrite existing keystore entry |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |

```bash
xrpl wallet import sEd... --alias bob
```

---

### wallet list

List accounts stored in the keystore.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |
| `--json` | boolean | No | false | Output as JSON array |

```bash
xrpl wallet list --json
```

---

### wallet address

Derive the XRPL address from key material.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--seed <seed>` | string | No | — | Family seed (`sXXX...`) |
| `--mnemonic <phrase>` | string | No | — | BIP39 mnemonic phrase |
| `--private-key <hex>` | string | No | — | Raw private key hex (ED- or 00-prefixed) |
| `--key-type <type>` | string | No | — | Key algorithm (required for unprefixed hex private keys) |
| `--derivation-path <path>` | string | No | `m/44'/144'/0'/0/0` | BIP44 derivation path (with `--mnemonic`) |
| `--json` | boolean | No | false | Output as JSON |

```bash
xrpl wallet address --seed sEd...
```

---

### wallet public-key

Derive the public key from key material.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--seed <seed>` | string | No | — | Family seed (`sXXX...`) |
| `--mnemonic <phrase>` | string | No | — | BIP39 mnemonic phrase |
| `--private-key <hex>` | string | No | — | Raw private key hex |
| `--key-type <type>` | string | No | — | Key algorithm |
| `--derivation-path <path>` | string | No | `m/44'/144'/0'/0/0` | BIP44 derivation path (with `--mnemonic`) |
| `--json` | boolean | No | false | Output as JSON |

```bash
xrpl wallet public-key --seed sEd...
```

---

### wallet private-key

> **Secret output — see Security Rules.** Do not forward this output to other tools.

Derive the private key from a seed or mnemonic.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--seed <seed>` | string | No | — | Family seed (`sXXX...`) |
| `--mnemonic <phrase>` | string | No | — | BIP39 mnemonic phrase |
| `--key-type <type>` | string | No | — | Key algorithm |
| `--derivation-path <path>` | string | No | `m/44'/144'/0'/0/0` | BIP44 derivation path (with `--mnemonic`) |
| `--json` | boolean | No | false | Output as JSON |

```bash
xrpl wallet private-key --seed sEd...
```

---

### wallet sign

Sign a UTF-8 message or an XRPL transaction blob.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--message <string>` | string | No | — | UTF-8 message to sign |
| `--from-hex` | boolean | No | false | Treat `--message` as hex-encoded |
| `--tx <json-or-path>` | string | No | — | Transaction JSON (inline or file path) to sign |
| `--seed <seed>` | string | No | — | Family seed for signing |
| `--mnemonic <phrase>` | string | No | — | BIP39 mnemonic for signing |
| `--account <address>` | string | No | — | Account address to load from keystore |
| `--key-type <type>` | string | No | — | Key algorithm |
| `--password <password>` | string | No | — | Keystore decryption password |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |
| `--json` | boolean | No | false | Output as JSON |

```bash
xrpl wallet sign --message "hello xrpl" --seed sEd...
```

---

### wallet verify

Verify a message signature or a signed transaction blob.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--message <msg>` | string | No | — | Message to verify (UTF-8 or hex if `--from-hex`) |
| `--from-hex` | boolean | No | false | Treat `--message` as hex-encoded |
| `--signature <hex>` | string | No | — | Signature hex (used with `--message`) |
| `--public-key <hex>` | string | No | — | Signer public key hex (used with `--message`) |
| `--tx <tx_blob_hex>` | string | No | — | Signed transaction blob hex to verify |
| `--json` | boolean | No | false | Output as JSON `{valid: boolean}` |

```bash
xrpl wallet verify --message "hello xrpl" --signature <hex> --public-key <hex>
```

---

### wallet fund

Fund an address from the testnet or devnet faucet.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--json` | boolean | No | false | Output as JSON |

```bash
xrpl wallet fund rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

### wallet alias

Manage human-readable aliases for keystore entries.

**wallet alias set** — Assign an alias to a keystore address.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--force` | boolean | No | false | Overwrite existing alias |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |

```bash
xrpl wallet alias set rXXX... alice
```

**wallet alias list** — List all aliases.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--json` | boolean | No | false | Output as JSON array |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |

```bash
xrpl wallet alias list
```

**wallet alias remove** — Remove the alias for an address.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |

```bash
xrpl wallet alias remove rXXX...
```

---

### wallet change-password

Re-encrypt a keystore entry with a new password.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--password <current>` | string | No | — | Current password (insecure; prefer interactive prompt) |
| `--new-password <new>` | string | No | — | New password (insecure; prefer interactive prompt) |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |

```bash
xrpl wallet change-password rXXX...
```

---

### wallet decrypt-keystore

Decrypt a keystore file to retrieve the seed or private key.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--file <path>` | string | No | — | Explicit keystore file path (overrides address lookup) |
| `--password <password>` | string | No | — | Decryption password (insecure; prefer interactive prompt) |
| `--show-private-key` | boolean | No | false | Also print the private key hex |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |
| `--json` | boolean | No | false | Output as JSON `{address, seed, privateKey, keyType}` |

```bash
xrpl wallet decrypt-keystore rXXX... --show-private-key
```

---

### wallet remove

Remove a wallet from the keystore.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |

```bash
xrpl wallet remove rXXX...
```

## account

Query and configure XRPL accounts: balances, settings, trust lines, offers, channels, transactions, NFTs, and MPTs.

---

### account info

Get full on-ledger account information (balance, sequence, owner count, flags, reserve).

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--json` | boolean | No | false | Output raw JSON |

```bash
xrpl account info rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```

---

### account balance

Get the XRP balance of an account.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--drops` | boolean | No | false | Output raw drops as a plain integer string |
| `--json` | boolean | No | false | Output JSON with address and balance fields |

```bash
xrpl account balance rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```

---

### account set

Update account settings with an AccountSet transaction.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--seed <seed>` | string | No* | — | Family seed for signing |
| `--mnemonic <phrase>` | string | No* | — | BIP39 mnemonic for signing |
| `--account <address-or-alias>` | string | No* | — | Account address or alias to load from keystore |
| `--password <password>` | string | No | — | Keystore decryption password (insecure; prefer interactive prompt) |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |
| `--domain <utf8-string>` | string | No | — | Domain to set (auto hex-encoded) |
| `--email-hash <32-byte-hex>` | string | No | — | Email hash (32-byte hex) |
| `--transfer-rate <integer>` | string | No | — | Transfer rate (0 or 1000000000–2000000000) |
| `--tick-size <n>` | string | No | — | Tick size (0 or 3–15) |
| `--set-flag <name>` | string | No | — | Account flag to set: `requireDestTag\|requireAuth\|disallowXRP\|disableMaster\|noFreeze\|globalFreeze\|defaultRipple\|depositAuth` |
| `--clear-flag <name>` | string | No | — | Account flag to clear (same names as `--set-flag`) |
| `--allow-clawback` | boolean | No | false | Enable clawback (irreversible — requires `--confirm`) |
| `--confirm` | boolean | No | false | Acknowledge irreversible operations |
| `--json` | boolean | No | false | Output as JSON |
| `--dry-run` | boolean | No | false | Print unsigned tx JSON without submitting |

\* Exactly one of `--seed`, `--mnemonic`, or `--account` is required.

```bash
xrpl account set --seed sEd... --set-flag defaultRipple
```

---

### account delete

> **Warning:** Permanently removes the account from the ledger; requires destination and fee reserve. This operation is irreversible and costs ~2 XRP (owner reserve, non-refundable).

Submit an AccountDelete transaction to delete an account and send remaining XRP to a destination.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--destination <address-or-alias>` | string | Yes | — | Destination address or alias to receive remaining XRP |
| `--destination-tag <n>` | string | No | — | Destination tag for the destination account |
| `--seed <seed>` | string | No* | — | Family seed for signing |
| `--mnemonic <phrase>` | string | No* | — | BIP39 mnemonic for signing |
| `--account <address-or-alias>` | string | No* | — | Account address or alias to load from keystore |
| `--password <password>` | string | No | — | Keystore decryption password (insecure; prefer interactive prompt) |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |
| `--confirm` | boolean | No | false | Acknowledge permanent account deletion (required unless `--dry-run`) |
| `--no-wait` | boolean | No | false | Submit without waiting for validation |
| `--json` | boolean | No | false | Output as JSON |
| `--dry-run` | boolean | No | false | Print unsigned tx JSON without submitting |

\* Exactly one of `--seed`, `--mnemonic`, or `--account` is required.

```bash
xrpl account delete --seed sEd... --destination rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX --confirm
```

---

### account set-regular-key

Assign or remove the regular signing key on an account (SetRegularKey).

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--key <address>` | string | No† | — | Base58 address of the new regular key to assign |
| `--remove` | boolean | No† | false | Remove the existing regular key |
| `--seed <seed>` | string | No* | — | Family seed for signing |
| `--mnemonic <phrase>` | string | No* | — | BIP39 mnemonic for signing |
| `--account <address-or-alias>` | string | No* | — | Account address or alias to load from keystore |
| `--password <password>` | string | No | — | Keystore decryption password (insecure; prefer interactive prompt) |
| `--keystore <dir>` | string | No | `~/.xrpl/keystore/` | Keystore directory (env: `XRPL_KEYSTORE`) |
| `--json` | boolean | No | false | Output as JSON |
| `--dry-run` | boolean | No | false | Print unsigned tx JSON without submitting |
| `--no-wait` | boolean | No | false | Submit without waiting for validation |

\* Exactly one of `--seed`, `--mnemonic`, or `--account` is required.
† Exactly one of `--key` or `--remove` is required; they are mutually exclusive.

```bash
xrpl account set-regular-key --seed sEd... --key rRegularKeyAddress...
```

---

### account trust-lines

List trust lines for an account.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--peer <address>` | string | No | — | Filter to trust lines with a specific peer |
| `--limit <n>` | string | No | — | Number of trust lines to return |
| `--marker <json-string>` | string | No | — | Pagination marker from a previous `--json` response |
| `--json` | boolean | No | false | Output raw JSON lines array |

```bash
xrpl account trust-lines rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```

---

### account offers

List open DEX offers for an account.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--limit <n>` | string | No | — | Number of offers to return |
| `--marker <json-string>` | string | No | — | Pagination marker from a previous `--json` response |
| `--json` | boolean | No | false | Output raw JSON offers array |

```bash
xrpl account offers rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```

---

### account channels

List payment channels for an account.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--destination-account <address>` | string | No | — | Filter by destination account |
| `--limit <n>` | string | No | — | Number of channels to return |
| `--marker <json-string>` | string | No | — | Pagination marker from a previous `--json` response |
| `--json` | boolean | No | false | Output raw JSON channels array |

```bash
xrpl account channels rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```

---

### account transactions

List recent transactions for an account.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--limit <n>` | string | No | `20` | Number of transactions to return (max 400) |
| `--marker <json-string>` | string | No | — | Pagination marker from a previous `--json` response |
| `--json` | boolean | No | false | Output raw JSON with transactions and optional marker |

```bash
xrpl account transactions rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh --limit 10
```

---

### account nfts

List NFTs owned by an account.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--limit <n>` | string | No | — | Number of NFTs to return |
| `--marker <json-string>` | string | No | — | Pagination marker from a previous `--json` response |
| `--json` | boolean | No | false | Output raw JSON NFTs array |

```bash
xrpl account nfts rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```

---

### account mptokens

List Multi-Purpose Tokens (MPT) held by an account.

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--limit <n>` | string | No | `20` | Number of tokens to return |
| `--marker <json-string>` | string | No | — | Pagination marker from a previous `--json` response |
| `--json` | boolean | No | false | Output raw JSON tokens array |

```bash
xrpl account mptokens rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```
