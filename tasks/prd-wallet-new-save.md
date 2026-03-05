# PRD: `wallet new --save` — Generate and Save to Keystore in One Step

## Introduction

`xrpl wallet new` currently only prints key material to stdout. Users who want to persist the wallet must run a separate `xrpl wallet import` command. Adding a `--save` flag to `wallet new` (and `wallet new-mnemonic`) collapses this into a single command, matching the ergonomics of `cast wallet new --keystore`.

---

## Goals

- Let users generate and store a wallet in one command
- Reuse all existing keystore infrastructure (`encryptKeystore`, `getKeystoreDir`)
- Support the same `--alias`, `--keystore`, and `--password` options already on `wallet import`

---

## User Stories

### US-001: `--save` flag on `wallet new` and `wallet new-mnemonic`
**Description:** As a user, I want to save a newly generated wallet to the keystore in one step so I don't have to pipe seed output into a separate import command.

**Acceptance Criteria:**
- [ ] Add `--save` flag to `src/commands/wallet/new.ts`
- [ ] When `--save` is passed: after generating the wallet, call `encryptKeystore` and write `<address>.json` to the keystore directory using the same `getKeystoreDir` resolution as `wallet import`
- [ ] `--password <pw>` skips interactive password prompt (prints insecure warning to stderr); without it, prompts interactively (twice, with confirmation)
- [ ] `--alias <name>` sets a label in the keystore file (same uniqueness rules as `wallet import --alias`)
- [ ] `--keystore <dir>` overrides the keystore directory; `XRPL_KEYSTORE` env var also respected
- [ ] When `--save` is used, append to output: `Saved to <filepath>` (human-readable) or add `keystorePath` field to `--json` output
- [ ] `--save` without `--password` in a non-TTY context (e.g. piped) exits 1 with: `Error: --password is required when --save is used in non-interactive mode`
- [ ] Add `--save` flag to `src/commands/wallet/new-mnemonic.ts` with identical behaviour (saves the mnemonic phrase as the keystore secret, same as `wallet import` does for mnemonics)
- [ ] E2E test (`wallet new`): run `wallet new --save --password test123 --keystore <tmpdir>`, assert exit 0, assert `<address>.json` exists in tmpdir, assert `wallet list --keystore <tmpdir>` shows the address
- [ ] E2E test (`wallet new --alias`): run with `--alias bob`, assert keystore JSON contains `"label": "bob"`, assert `wallet alias list --keystore <tmpdir>` shows bob
- [ ] E2E test (`wallet new-mnemonic`): run `wallet new-mnemonic --save --password test123 --keystore <tmpdir>`, assert keystore file exists, assert `wallet decrypt-keystore` with correct password returns the mnemonic phrase
- [ ] E2E test: run `wallet new --save --keystore <tmpdir>` with no TTY (pipe stdin from /dev/null) and no `--password`, assert exit 1 and stderr contains `--password is required`
- [ ] Tests pass
- [ ] Typecheck passes

---

## Functional Requirements

- FR-1: `--save` is opt-in — existing `wallet new` behaviour is unchanged when `--save` is not passed
- FR-2: Keystore write uses `encryptKeystore` from `src/utils/keystore.ts` — no duplicate encryption logic
- FR-3: All keystore options (`--keystore`, `--alias`, `--password`) behave identically to `wallet import`
- FR-4: Non-interactive safety check: detect missing TTY via `process.stdin.isTTY === false || process.stdout.isTTY === false` and require `--password` explicitly

---

## Non-Goals

- No `--save` on other wallet subcommands (`address`, `private-key`, etc.)
- No changes to `wallet import` behaviour

---

## Success Metrics

- `xrpl wallet new --save` replaces the two-step new + import workflow
- All existing `wallet new` and `wallet new-mnemonic` tests still pass
