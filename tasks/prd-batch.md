# PRD: Batch Transaction Command

## Introduction

Add `xrpl batch` command to atomically bundle multiple XRPL transactions into a single submission. Also add a `--build-only` flag to every existing command so its output can be piped directly into `xrpl batch` via shell command substitution. The Batch amendment (XLS-56) allows atomic execution of up to N transactions with configurable failure semantics.

## Goals

- Add `--build-only` flag to all existing commands: outputs unsigned transaction JSON and exits, no network call
- Support `xrpl batch --tx "$(xrpl payment ...  --build-only)" --tx "$(xrpl nft mint ... --build-only)"` as the primary composable interface
- Support `--txs-file batch.json` as a fallback for complex/multi-account cases
- Support all four Batch atomicity modes: `all-or-nothing`, `only-one`, `until-failure`, `independent`
- Follow existing CLI patterns (seed/mnemonic/keystore, --json, --dry-run, --no-wait)
- All options covered by E2E tests

## User Stories

### US-001: `--build-only` flag on all commands

**Description:** As a developer, I want every command to support `--build-only` so I can generate unsigned transaction JSON for use in batch submissions.

**Acceptance Criteria:**
- [ ] Add `--build-only` boolean flag to every transaction command: `payment`, `trust`, `offer`, `channel`, `escrow`, `check`, `clawback`, `credential`, `nft`, `multisig`, `oracle`, `ticket`, `deposit-preauth`, `account set`, `account set-regular-key`, `account delete`, `did`, `mptoken issuance create/destroy/set`, `mptoken authorize`
- [ ] When `--build-only` is set: derive `Account` from key material (--seed/--mnemonic/--keystore) without connecting to the network; construct the transaction object with all command-specific fields + `Account`; print as JSON to stdout; exit 0
- [ ] `--build-only` output does NOT include: `Fee`, `Sequence`, `LastLedgerSequence`, `SigningPubKey`, `TxnSignature`, `Flags` (unless the command sets flags)
- [ ] `--build-only` is incompatible with `--dry-run`, `--no-wait`, `--json` — CLI exits with error if combined
- [ ] Key material (--seed/--mnemonic/--account+--keystore) is still required when using `--build-only`
- [ ] `tests/e2e/batch/batch.build-only.test.ts`: run `payment --build-only`, verify output is valid JSON containing `TransactionType` and `Account`; verify no `Fee` or `Sequence` in output; verify `--build-only` with `--dry-run` errors — no network
- [ ] Typecheck passes

### US-002: `xrpl batch` command

**Description:** As a developer, I want to submit multiple transactions atomically so I can guarantee they all succeed or handle failures according to a defined policy.

**Acceptance Criteria:**
- [ ] Read Batch transaction source at https://github.com/XRPLF/xrpl.js/blob/main/packages/xrpl/src/models/transactions/batch.ts before implementing
- [ ] Create `src/commands/batch.ts` and register it in `src/commands/index.ts` and `src/index.ts`
- [ ] `xrpl batch` with:
  - `--tx <json>` (repeatable) — inline JSON of an unsigned transaction (from `--build-only` output); at least 1 required unless `--txs-file` is used
  - `--txs-file <path>` — path to a JSON file containing an array of unsigned transaction objects; alternative to `--tx`
  - `--mode <mode>` (required) — one of: `all-or-nothing`, `only-one`, `until-failure`, `independent`
  - Standard key material: `--seed`, `--mnemonic`, `--account`/`--keystore`/`--password`
  - Standard output: `--node`, `--json`, `--dry-run`, `--no-wait`
- [ ] CLI adds the following to each inner tx before submitting: `tfInnerBatchTxn` flag (bitwise OR into `Flags`), `Fee: "0"`, `SigningPubKey: ""`, `TxnSignature: null`, `Signers: null`, `LastLedgerSequence: null`
- [ ] Outer `Batch` tx `Flags` set from `--mode`: `all-or-nothing` → `tfAllOrNothing` (0x00010000), `only-one` → `tfOnlyOne` (0x00020000), `until-failure` → `tfUntilFailure` (0x00040000), `independent` → `tfIndependent` (0x00080000)
- [ ] CLI exits with error if neither `--tx` nor `--txs-file` is provided
- [ ] CLI exits with error if both `--tx` and `--txs-file` are provided
- [ ] CLI exits with error if `--mode` is missing or not one of the four valid values
- [ ] CLI exits with error if any `--tx` value is not valid JSON
- [ ] CLI exits with error if `--txs-file` path does not exist or is not valid JSON array
- [ ] CLI exits with error if a nested `Batch` is detected in any inner tx
- [ ] `tests/e2e/batch/batch.validation.test.ts`: no --tx/--txs-file, both provided, invalid JSON, missing --mode, invalid --mode, nested batch — no network
- [ ] `tests/e2e/batch/batch.test.ts`: 2-tx batch using `--tx "$(xrpl payment ... --build-only)"` syntax; batch via `--txs-file`; `--mode all-or-nothing`; `--mode independent`; `--json`, `--dry-run`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `--build-only` added to all transaction commands; outputs `JSON.stringify(txObject)` to stdout; uses `Wallet.fromSeed()` / `Wallet.fromMnemonic()` or keystore to derive `Account`; no network connection made
- FR-2: `--build-only` incompatible with `--dry-run`, `--no-wait`, `--json`
- FR-3: `xrpl batch` accepts `--tx` (repeatable string, parsed as JSON) or `--txs-file` (path to JSON array); mutually exclusive
- FR-4: Inner tx preparation: set `Flags |= tfInnerBatchTxn`; set `Fee: "0"`, `SigningPubKey: ""`, delete `TxnSignature`, `Signers`, `LastLedgerSequence`
- FR-5: Mode → flags mapping: `all-or-nothing` → `0x00010000`, `only-one` → `0x00020000`, `until-failure` → `0x00040000`, `independent` → `0x00080000`
- FR-6: Outer tx: `{ TransactionType: "Batch", RawTransactions: [{ RawTransaction: tx }, ...], Flags: <mode> }`; autofill then sign with provided key material
- FR-7: Detect nested Batch: check each inner tx `TransactionType !== "Batch"`; error if found
- FR-8: `tfInnerBatchTxn` global flag value: `0x40000000` (from `GlobalFlags` in xrpl.js)

## Non-Goals

- No multi-account `BatchSigners` support (the `BatchSigners` field for collecting per-account signatures is out of scope; use `--txs-file` with pre-constructed inner txs if needed)
- No interactive batch builder (the shell substitution pattern is the intended UX)
- No nested Batch transactions (forbidden by the protocol)

## Technical Considerations

- **Mandatory pre-implementation step:** Read the Batch transaction model in xrpl.js (linked above) before writing code
- **`tfInnerBatchTxn`**: This is a global flag (`GlobalFlags.tfInnerBatchTxn`); import from xrpl.js to get the correct value
- **`--build-only` implementation pattern:** Extract a `buildTransaction(cmd, opts)` helper that returns the raw tx object; existing submit path calls this then autofills/signs; `--build-only` path calls this and prints JSON only
- **E2E test for `--build-only`**: Can run without testnet (no network call) — put in validation test file
- **E2E test for batch**: Fund two wallets; use payment + offer as inner txs; verify both effects on-chain after `all-or-nothing` succeeds

## Success Metrics

- `xrpl batch --tx "$(xrpl payment --to rBob --amount 1 --build-only --seed snX)" --tx "$(xrpl offer create ... --build-only --seed snX)" --mode all-or-nothing --seed snX` submits successfully
- `--build-only` on any command outputs valid parseable JSON with no Fee/Sequence fields
- Invalid JSON in `--tx` caught before any network call
- Typecheck passes with strict mode

## Open Questions

- None outstanding.
