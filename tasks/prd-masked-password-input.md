# PRD: Masked Password Input for All CLI Prompts

## Introduction

Every interactive password prompt in the CLI currently echoes characters back to the terminal as the user types, making passwords visible on screen. This is a basic security and UX problem — anyone watching the screen can read the password. The fix is to mask each typed character with `*` and handle backspace correctly, matching the behaviour of standard Unix password prompts (e.g. `ssh`, `gpg`).

---

## Goals

- All interactive password prompts print `*` for each character typed instead of the actual character
- Backspace removes the last `*` and the last character from the buffer
- Ctrl+C during a password prompt exits cleanly with code 1
- A single shared utility handles all masking logic — no duplication across command files
- The `--password <flag>` path is unchanged (it already bypasses interactive prompts)

---

## User Stories

### US-001: Shared masked password prompt utility

**Description:** As a developer, I want a single `promptPassword` utility so that masking logic is written once and all commands benefit automatically.

**Acceptance Criteria:**
- [ ] Create `src/utils/prompt.ts` exporting two functions:
  - `promptPassword(prompt?: string): Promise<string>` — default prompt `"Password: "`
  - `promptPasswordWithConfirmation(prompt?: string, confirmPrompt?: string): Promise<string>` — prompts twice; defaults `"Password: "` / `"Confirm password: "`; exits 1 with `"Error: passwords do not match\n"` on stderr if they differ
- [ ] Both functions use raw mode (`process.stdin.setRawMode(true)`) to intercept keystrokes
- [ ] Each printable character writes `*` to stderr and appends to the internal buffer
- [ ] Backspace (`\u007f` or `\b`) removes the last character from the buffer and erases the last `*` on screen (`\b \b`)
- [ ] Enter (`\r` or `\n`) finalises input, restores stdin, and writes a newline to stderr
- [ ] Ctrl+C (`\u0003`) writes a newline to stderr and calls `process.exit(1)`
- [ ] `process.stdin.setRawMode` is only called when `process.stdin.isTTY` is true (guard against non-TTY piped contexts)
- [ ] Typecheck passes

### US-002: Replace inline `promptPassword` in all command files

**Description:** As a user, I want every command that asks for a password to mask my input so my password is never visible while I type.

**Acceptance Criteria:**
- [ ] The following 7 files are updated to import `promptPassword` from `../../utils/prompt.js` (or `../utils/prompt.js` for top-level commands) and remove their local implementation:
  - `src/commands/wallet/import.ts`
  - `src/commands/wallet/decrypt-keystore.ts`
  - `src/commands/wallet/sign.ts`
  - `src/commands/wallet/change-password.ts` (uses `promptPassword("Current password: ")` and `promptPassword("New password: ")` — the utility must accept a custom prompt string)
  - `src/commands/account/delete.ts`
  - `src/commands/account/set.ts`
  - `src/commands/payment.ts`
- [ ] No file retains a local `promptPassword` definition or a local `createInterface` import used solely for password prompts
- [ ] Typecheck passes

### US-003: Replace `promptPasswordWithConfirmation` in `wallet new` and `wallet new-mnemonic`

**Description:** As a user generating a new wallet with `--save`, I want my password to be masked during both the initial entry and the confirmation prompt.

**Acceptance Criteria:**
- [ ] `src/commands/wallet/new.ts` imports `promptPasswordWithConfirmation` from `../../utils/prompt.js` and removes its local implementation
- [ ] `src/commands/wallet/new-mnemonic.ts` does the same
- [ ] Typecheck passes

### US-004: E2E tests for masked input utility

**Description:** As a developer, I want tests that verify the masking utility behaves correctly so regressions are caught automatically.

**Acceptance Criteria:**
- [ ] Create `src/utils/prompt.test.ts` with unit tests using vitest
- [ ] Test: correct password returned when characters + Enter are simulated via the data event
- [ ] Test: backspace removes the last character from the returned string
- [ ] Test: `promptPasswordWithConfirmation` resolves when both entries match
- [ ] Test: `promptPasswordWithConfirmation` calls `process.exit(1)` when entries do not match
- [ ] Tests pass

---

## Functional Requirements

- FR-1: `promptPassword(prompt?)` writes the prompt to `process.stderr`, reads raw keystrokes, echoes `*` per character, and resolves with the typed string on Enter
- FR-2: `promptPasswordWithConfirmation(prompt?, confirmPrompt?)` calls `promptPassword` twice and exits 1 if the two values differ
- FR-3: Backspace handling: on `\u007f` or `\b`, if buffer is non-empty, pop the last character and write `\b \b` to stderr
- FR-4: Ctrl+C handling: on `\u0003`, write `\n` to stderr and call `process.exit(1)`
- FR-5: Raw mode guard: only call `process.stdin.setRawMode(true)` when `process.stdin.isTTY === true`; if not a TTY, fall back to standard `readline` `rl.question` (non-interactive piped input doesn't need masking)
- FR-6: After input completes, always restore stdin: call `process.stdin.setRawMode(false)` and `process.stdin.pause()`
- FR-7: All existing `--password <flag>` code paths are untouched

---

## Non-Goals

- No masking for non-password prompts (e.g. the "Are you sure?" confirmation in `account delete`)
- No changes to how `--password <flag>` is handled (insecure warning is already in place)
- No third-party libraries for this (implement with Node.js built-ins only)

---

## Technical Considerations

- Raw mode is only available when stdin is a TTY. The guard in FR-5 ensures the utility degrades gracefully when stdin is piped (e.g. in E2E tests that pass `--password` explicitly)
- `process.stdin` data events emit one character at a time in raw mode on most terminals, but multi-byte UTF-8 sequences (e.g. arrow keys as escape sequences) should be ignored — only append a character to the buffer if it is a single printable character (char codes 0x20–0x7e plus any char with code > 0x7f)
- The utility file lives at `src/utils/prompt.ts`; import path for commands under `src/commands/wallet/` is `../../utils/prompt.js`; for `src/commands/payment.ts`, `src/commands/account/*.ts` it is `../utils/prompt.js`

---

## Success Metrics

- Running `xrpl wallet import <seed>` and typing a password shows only `*` on screen
- All existing E2E tests for password-protected commands still pass
- No local `promptPassword` function remains in any command file

---

## Open Questions

- Should multi-byte characters (e.g. accented letters, emoji) be accepted in passwords? Current recommendation: accept any char with code > 0x7e as a single character unit, but this can be revisited.
