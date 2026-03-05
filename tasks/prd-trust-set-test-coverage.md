# PRD: `trust set` — Full Option Test Coverage

## Introduction

The existing `trust set` E2E tests cover the happy path and flag mutual exclusion but leave several options completely untested: `--account`/`--keystore`/`--password`, `--clear-no-ripple` (actual on-chain behaviour), `--quality-in`/`--quality-out`, `--freeze`/`--unfreeze` (issuer-side), and `--auth`. This PRD adds the missing tests to `tests/e2e/trust/trust.test.ts`.

---

## Goals

- Every option and flag on `trust set` is exercised by at least one test
- On-chain effects are verified (not just exit codes)

---

## User Stories

### US-001: Tests for `--account`/`--keystore`/`--password`, `--clear-no-ripple`, `--quality-in`, `--quality-out`

**Description:** As a developer, I want the simpler missing options covered so keystore-based signing and quality fields are verified.

**Acceptance Criteria:**
- [ ] Test `--account` + `--keystore` + `--password`: use `wallet new --save --password pw123 --keystore <tmpdir> --json` to create a keystore entry, then run `trust set --currency USD --issuer <issuer-address> --limit 1000 --account <address> --keystore <tmpdir> --password pw123 --node testnet`, assert exit 0 and stdout contains `tesSUCCESS`; clean up tmpdir in finally block
- [ ] Test `--clear-no-ripple`: first run `trust set --currency CNY --issuer <issuer> --limit 500 --no-ripple --seed <trustor-seed>`, then run `trust set --currency CNY --issuer <issuer> --limit 500 --clear-no-ripple --seed <trustor-seed>`, query `account trust-lines --json <trustor-address>`, find the CNY line and assert `no_ripple` is `false` or absent
- [ ] Test `--quality-in` + `--quality-out`: run `trust set --currency JPY --issuer <issuer> --limit 10000 --quality-in 950000000 --quality-out 950000000 --seed <trustor-seed>`, query `account trust-lines --json <trustor-address>`, find the JPY line and assert it has `quality_in` and `quality_out` fields set to `950000000`
- [ ] All new tests use the existing `trustor` and `issuer` wallets already funded in `beforeAll`
- [ ] Tests pass
- [ ] Typecheck passes

### US-002: Tests for `--freeze`, `--unfreeze`, and `--auth`

**Description:** As a developer, I want issuer-side flag operations tested so freeze/unfreeze and trust line authorization are verified on-chain.

**Acceptance Criteria:**
- [ ] Test `--freeze`: trustor runs `trust set --currency FRZ --issuer <issuer> --limit 1000 --seed <trustor-seed>` to establish the line; issuer then runs `trust set --currency FRZ --issuer <trustor-address> --limit 0 --freeze --seed <issuer-seed>`; query `account trust-lines --json <trustor-address>`, find the FRZ line and assert `freeze_peer: true`
- [ ] Test `--unfreeze`: continuing from freeze test (or re-establishing), issuer runs `trust set --currency FRZ --issuer <trustor-address> --limit 0 --unfreeze --seed <issuer-seed>`; query and assert the FRZ line no longer has `freeze_peer: true`
- [ ] Test `--auth`: in test setup (using xrpl.js Client directly), issuer submits an `AccountSet` tx with `SetFlag: AccountSetAsfFlags.asfRequireAuth` to enable RequireAuth; trustor creates trust line `trust set --currency AUT --issuer <issuer> --limit 100 --seed <trustor-seed>`; issuer authorizes with `trust set --currency AUT --issuer <trustor-address> --limit 0 --auth --seed <issuer-seed>`; query `account trust-lines --json <trustor-address>`, find the AUT line and assert `peer_authorized: true`
- [ ] All new tests use the existing `trustor` and `issuer` wallets from `beforeAll`
- [ ] Tests pass
- [ ] Typecheck passes

---

## Functional Requirements

- FR-1: All new tests are added to `tests/e2e/trust/trust.test.ts` — no new files
- FR-2: Use existing `trustor` and `issuer` wallets from `beforeAll`; do not fund new accounts
- FR-3: For `--auth` test setup, use `AccountSetAsfFlags.asfRequireAuth` from the `xrpl` package to build the AccountSet tx via xrpl.js Client directly (same pattern as payment E2E test setup for trust lines)
- FR-4: Use different currency codes per test to avoid trust line state conflicts between tests (existing tests use USD, EUR, GBP, CAD, MXN, XYZ — new tests should use CNY, JPY, FRZ, AUT)
- FR-5: Freeze/unfreeze and auth tests issue transactions from the issuer's perspective (`--issuer <trustor-address>`) — not the trustor's

---

## Non-Goals

- No changes to `src/commands/trust.ts`
- No new commands or options

---

## Technical Considerations

- `account_lines` response fields to assert: `no_ripple` (boolean), `quality_in` (number), `quality_out` (number), `freeze_peer` (boolean), `peer_authorized` (boolean)
- For `--clear-no-ripple`, the field may be absent rather than `false` — use `!line.no_ripple` as the assertion
- `AccountSetAsfFlags.asfRequireAuth` is value `2` — import from `xrpl`
- The `--auth` test must enable RequireAuth on the issuer before the trustor creates the trust line; order matters
- `freeze_peer` appears in `account_lines` for the trustor when the issuer has frozen; the issuer's own view shows `freeze: true` on that line

---

## Open Questions

- None — all XRPL field names above are confirmed from `account_lines` RPC spec.
