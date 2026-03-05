# PRD: `xrpl wallet` — Wallet Management Commands

## Introduction

`xrpl wallet` provides full wallet lifecycle management for the XRP Ledger from the command line: key generation, derivation, encrypted local keystore, message/transaction signing, and verification. It mirrors the API surface of `cast wallet` (Foundry) adapted to XRPL's key formats and cryptographic primitives.

Vanity address generation and EIP-7702-style sign-auth are out of scope (XRPL has no equivalent).

---

## Goals

- Generate XRPL wallets from random entropy, BIP39 mnemonics, or imported key material
- Support both secp256k1 and ed25519 key types via a `--key-type` flag
- Persist wallets as password-encrypted JSON keystores in `~/.xrpl/keystore/` (configurable)
- Expose all key derivation utilities as standalone CLI commands
- Sign and verify arbitrary messages and raw XRPL transaction JSON blobs
- Every command covered by an E2E test

---

## User Stories

### US-001: `wallet new` — Generate a random wallet
**Description:** As a user, I want to generate a new random XRPL wallet so I have a fresh address and key pair.

**Acceptance Criteria:**
- [ ] `xrpl wallet new` prints: classic address, public key, private key, family seed
- [ ] `--key-type secp256k1|ed25519` flag selects key algorithm (default: `ed25519`)
- [ ] `--json` flag outputs a JSON object with fields `address`, `publicKey`, `privateKey`, `seed`, `keyType`
- [ ] Without `--json`, private key and seed are clearly labeled and printed to stdout (user opted in by running the command)
- [ ] Aliases: `xrpl wallet n`
- [ ] E2E test: run command, parse output, verify address starts with `r` and seed starts with `s`
- [ ] Typecheck passes

---

### US-002: `wallet new-mnemonic` — Generate a BIP39 mnemonic wallet
**Description:** As a user, I want to generate a wallet from a fresh BIP39 mnemonic so I can back it up as a word phrase.

**Acceptance Criteria:**
- [ ] `xrpl wallet new-mnemonic` prints: 12-word mnemonic, derivation path, classic address, public key, private key
- [ ] Default derivation path: `m/44'/144'/0'/0/0` (XRPL BIP44)
- [ ] `--derivation-path <path>` overrides the default
- [ ] `--key-type secp256k1|ed25519` flag (default: `ed25519`)
- [ ] `--json` outputs structured JSON
- [ ] Aliases: `xrpl wallet nm`
- [ ] E2E test: run command, verify mnemonic has 12 words, address starts with `r`
- [ ] Typecheck passes

---

### US-003: `wallet address` — Derive address from key material
**Description:** As a user, I want to derive the XRPL address from a seed, mnemonic, or private key so I can verify what address a given key controls.

**Acceptance Criteria:**
- [ ] Accepts exactly one of: `--seed <seed>`, `--mnemonic "<phrase>"`, `--private-key <hex>`
- [ ] `--key-type secp256k1|ed25519` (required when using `--private-key`; inferred from seed/mnemonic otherwise)
- [ ] Prints the classic XRPL address (`r...`)
- [ ] `--json` outputs `{ address, publicKey, keyType }`
- [ ] Errors with a clear message if no key material is provided or if multiple are provided simultaneously
- [ ] Aliases: `xrpl wallet a`, `xrpl wallet addr`
- [ ] E2E test: generate wallet with `wallet new --json`, pipe seed into `wallet address --seed`, assert addresses match
- [ ] Typecheck passes

---

### US-004: `wallet private-key` — Derive private key from seed or mnemonic
**Description:** As a user, I want to extract the raw private key from a seed or mnemonic for use in other tools.

**Acceptance Criteria:**
- [ ] Accepts `--seed <seed>` or `--mnemonic "<phrase>"`
- [ ] `--derivation-path` supported when using `--mnemonic`
- [ ] `--key-type secp256k1|ed25519`
- [ ] Prints the private key as a 66-char hex string (with `ED` prefix for ed25519, `00` prefix for secp256k1 — matching xrpl.js convention)
- [ ] `--json` outputs `{ privateKey, keyType }`
- [ ] Aliases: `xrpl wallet pk`
- [ ] E2E test: derive private key from known test seed, assert expected hex value
- [ ] Typecheck passes

---

### US-005: `wallet public-key` — Derive public key from key material
**Description:** As a user, I want to derive the public key from a seed, mnemonic, or private key.

**Acceptance Criteria:**
- [ ] Accepts `--seed <seed>`, `--mnemonic "<phrase>"`, or `--private-key <hex>`
- [ ] `--key-type secp256k1|ed25519`
- [ ] Prints the compressed public key as hex
- [ ] `--json` outputs `{ publicKey, keyType }`
- [ ] Aliases: `xrpl wallet pubkey`
- [ ] E2E test: derive public key from known test seed, assert expected hex value
- [ ] Typecheck passes

---

### US-006: Encrypted keystore file format
**Description:** As a developer, I need a secure keystore JSON format so wallet files can be stored and loaded reliably.

**Acceptance Criteria:**
- [ ] Keystore file schema:
  ```json
  {
    "version": 1,
    "address": "r...",
    "keyType": "ed25519" | "secp256k1",
    "kdf": "pbkdf2",
    "kdfparams": { "iterations": 600000, "keylen": 32, "digest": "sha256", "salt": "<hex>" },
    "cipher": "aes-256-gcm",
    "cipherparams": { "iv": "<hex>", "tag": "<hex>" },
    "ciphertext": "<hex>"
  }
  ```
- [ ] `ciphertext` is the AES-256-GCM encryption of the UTF-8 family seed string
- [ ] `salt`, `iv` are randomly generated per file
- [ ] Helper functions `encryptKeystore(seed, password)` and `decryptKeystore(file, password)` implemented in `src/utils/keystore.ts`
- [ ] Unit tests for encrypt/decrypt round-trip
- [ ] Typecheck passes

---

### US-007: `wallet import` — Import key material into the keystore
**Description:** As a user, I want to save an existing key into the encrypted local keystore so I can reference it by address in future commands.

**Acceptance Criteria:**
- [ ] `xrpl wallet import <seed|mnemonic|private-key>` accepts key material as a positional argument or via stdin (if argument is `-`)
- [ ] `--key-type secp256k1|ed25519` (required when input is a raw private key hex)
- [ ] Prompts for password interactively (twice, confirms match); `--password <pw>` skips prompt for scripting
- [ ] `--keystore <dir>` overrides the keystore directory (default: `~/.xrpl/keystore/`); also reads `XRPL_KEYSTORE` env var
- [ ] Writes `<address>.json` to the keystore directory
- [ ] Errors if a keystore file for that address already exists, unless `--force` is passed
- [ ] Prints: `Imported account <address> to <filepath>`
- [ ] Aliases: `xrpl wallet i`
- [ ] E2E test: import a known seed, verify the JSON file exists in keystore dir, verify address field matches
- [ ] Typecheck passes

---

### US-008: `wallet list` — List keystored accounts
**Description:** As a user, I want to see all accounts I've saved in the keystore.

**Acceptance Criteria:**
- [ ] `xrpl wallet list` reads all `*.json` files in the keystore directory
- [ ] Prints one address per line
- [ ] `--json` outputs a JSON array of address strings
- [ ] `--keystore <dir>` / `XRPL_KEYSTORE` env var respected
- [ ] Prints `(empty)` if no keystores exist
- [ ] Aliases: `xrpl wallet ls`
- [ ] E2E test: import two wallets, run list, assert both addresses appear
- [ ] Typecheck passes

---

### US-009: `wallet remove` — Remove a wallet from the keystore
**Description:** As a user, I want to delete a keystore entry so I can clean up accounts I no longer use.

**Acceptance Criteria:**
- [ ] `xrpl wallet remove <address>` deletes `<address>.json` from keystore directory
- [ ] Errors with a clear message if the address is not found in the keystore
- [ ] `--keystore <dir>` / `XRPL_KEYSTORE` env var respected
- [ ] Prints: `Removed <address>`
- [ ] Aliases: `xrpl wallet rm`
- [ ] E2E test: import a wallet, remove it, verify file no longer exists, verify `wallet list` no longer shows it
- [ ] Typecheck passes

---

### US-010: `wallet decrypt-keystore` — Decrypt a keystore file
**Description:** As a user, I want to decrypt a keystore file to retrieve the raw seed or private key for export.

**Acceptance Criteria:**
- [ ] `xrpl wallet decrypt-keystore <address>` looks up `<address>.json` in the keystore directory
- [ ] Alternatively: `xrpl wallet decrypt-keystore --file <path>` accepts an explicit file path
- [ ] Prompts for password interactively; `--password <pw>` skips prompt
- [ ] Prints the family seed (and private key hex with `--show-private-key`)
- [ ] `--json` outputs `{ address, seed, privateKey, keyType }`
- [ ] `--keystore <dir>` / `XRPL_KEYSTORE` respected
- [ ] Errors clearly on wrong password
- [ ] Aliases: `xrpl wallet dk`
- [ ] E2E test: import a wallet with known seed, decrypt it, assert seed matches
- [ ] Typecheck passes

---

### US-011: `wallet change-password` — Change keystore password
**Description:** As a user, I want to re-encrypt a keystore file with a new password.

**Acceptance Criteria:**
- [ ] `xrpl wallet change-password <address>` looks up the keystore file
- [ ] Prompts for current password, then new password (twice); `--password` / `--new-password` flags for scripting
- [ ] Decrypts with old password, re-encrypts with new password, overwrites the file atomically (write to temp, then rename)
- [ ] `--keystore <dir>` / `XRPL_KEYSTORE` respected
- [ ] Prints: `Password changed for <address>`
- [ ] Errors clearly on wrong current password
- [ ] Aliases: `xrpl wallet cp`
- [ ] E2E test: import wallet, change password, decrypt with new password, assert seed unchanged
- [ ] Typecheck passes

---

### US-012: `wallet sign` — Sign a message or XRPL transaction
**Description:** As a user, I want to sign data with a wallet so I can produce verifiable signatures or sign XRPL transactions offline.

**Acceptance Criteria:**
- [ ] `xrpl wallet sign --message <hex|utf8-string>` signs an arbitrary message
  - `--from-hex` flag treats the message as already hex-encoded; otherwise UTF-8 encode first
  - Prints signature as hex
- [ ] `xrpl wallet sign --tx <json-file|inline-json>` signs an XRPL transaction blob
  - Input: raw transaction JSON (without `TxnSignature` / `SigningPubKey`)
  - Output: prints `tx_blob` (signed hex) and `hash`
  - `--json` outputs `{ tx_blob, hash }`
- [ ] Key material: `--seed <seed>`, `--mnemonic "<phrase>"`, `--account <address>` (loads from keystore, prompts password)
- [ ] `--key-type secp256k1|ed25519` when using raw key material
- [ ] Aliases: `xrpl wallet s`
- [ ] E2E test (message): sign a known message with a known seed, assert deterministic signature
- [ ] E2E test (tx): sign a minimal Payment tx JSON, verify `tx_blob` decodes to valid XRPL binary
- [ ] Typecheck passes

---

### US-013: `wallet verify` — Verify a signature
**Description:** As a user, I want to verify that a signature was produced by the private key corresponding to a given public key or address.

**Acceptance Criteria:**
- [ ] `xrpl wallet verify --message <msg> --signature <hex> --public-key <hex>` verifies a message signature
  - `--from-hex` flag for hex-encoded messages
  - Exits `0` and prints `✓ Valid signature` on success
  - Exits `1` and prints `✗ Invalid signature` on failure
- [ ] `xrpl wallet verify --tx <tx_blob_hex>` verifies the signature embedded in a signed transaction blob
  - Decodes the blob, extracts `SigningPubKey` and `TxnSignature`, runs verification
- [ ] Aliases: `xrpl wallet v`
- [ ] E2E test: sign a message, verify it → assert exit 0; tamper with signature, verify → assert exit 1
- [ ] E2E test: sign a tx blob, verify it → assert exit 0
- [ ] Typecheck passes

---

## Functional Requirements

- FR-1: All `xrpl wallet` subcommands are registered under a `wallet` Commander command group in `src/commands/wallet/`
- FR-2: Each subcommand has a short alias matching `cast wallet` conventions (listed per US above)
- FR-3: A `--key-type secp256k1|ed25519` flag is available on every command that generates or reads key material; defaults to `ed25519`
- FR-4: A `--json` flag is available on every command that produces structured output; non-JSON output goes to stdout, errors go to stderr
- FR-5: Keystore directory resolves in order: `--keystore` flag → `XRPL_KEYSTORE` env var → `~/.xrpl/keystore/`
- FR-6: Password prompts use `readline` (no third-party prompt library) and never echo input
- FR-7: The `--password` flag is accepted for non-interactive/scripting use but emits a warning to stderr: `Warning: passing passwords via flag is insecure`
- FR-8: Private keys and seeds are never written to any log file or error output; only printed to stdout when explicitly requested
- FR-9: All cryptographic operations (PBKDF2, AES-256-GCM) use Node.js built-in `crypto` module only
- FR-10: The keystore file for an address is always named `<classic-address>.json`

---

## Non-Goals

- No vanity address generation
- No multi-sig wallet creation or management (covered by future `xrpl multisig` command)
- No hardware wallet (Ledger/Trezor) integration
- No X-address output (classic `r...` addresses only for now)
- No `sign-auth` equivalent (EIP-7702 is Ethereum-specific)
- No automatic submission of signed transactions (that is `xrpl tx submit`)
- No cloud/remote keystore backends

---

## Technical Considerations

- Use `xrpl.Wallet.generate()`, `xrpl.Wallet.fromSeed()`, `xrpl.Wallet.fromMnemonic()` for all key operations — do not reimplement XRPL cryptography
- `xrpl.decode()` / `xrpl.encode()` for tx blob serialization in `sign` and `verify`
- Keystore crypto: Node.js `crypto.pbkdf2Sync` for KDF, `crypto.createCipheriv('aes-256-gcm')` for encryption
- File writes for keystore updates must be atomic: write to `<file>.tmp`, then `fs.renameSync` to avoid partial writes on crash
- All commands must call `process.exit(1)` with a message on stderr for any error condition (no unhandled rejections)
- Source files: `src/commands/wallet/index.ts` (command group) + one file per subcommand, e.g. `src/commands/wallet/new.ts`
- Keystore utilities: `src/utils/keystore.ts`

---

## Success Metrics

- All 12 wallet subcommands implemented with correct aliases
- `npm test` passes with E2E coverage for every subcommand
- No private key or seed appears in any error message or log output
- `xrpl wallet --help` and `xrpl wallet <cmd> --help` output is accurate and complete

---

## Open Questions

- Should `wallet sign --tx` call `client.autofill()` to fill `Sequence`/`Fee`/`LastLedgerSequence` before signing, or require the tx JSON to be fully pre-populated? (Suggestion: add an `--autofill --node <url>` flag, off by default)
- Should `wallet list` show key type alongside the address?
- Should `wallet new` optionally write directly to the keystore (with `--save` flag) rather than requiring a separate `wallet import` step?
