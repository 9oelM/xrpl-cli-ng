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
