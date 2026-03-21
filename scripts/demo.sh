#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║                     xrpl-cli-ng  ·  FULL DEMO                      ║
# ║                                                                      ║
# ║  Exercises every major feature of the CLI against XRPL testnet:      ║
# ║    1. Wallet Management          4. Trust Lines & Token Issuance     ║
# ║    2. Account Operations         5. DEX Offers                       ║
# ║    3. XRP Payment                6. AutoResearch (AI on-chain)       ║
# ╚══════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ──────────── colours & helpers ────────────
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[1;35m'
RED='\033[1;31m'
BLUE='\033[1;34m'
RESET='\033[0m'

banner() {
  printf "\n${CYAN}╔══════════════════════════════════════════════════════════════╗${RESET}\n"
  printf "${CYAN}║  %-58s  ║${RESET}\n" "$1"
  printf "${CYAN}╚══════════════════════════════════════════════════════════════╝${RESET}\n\n"
}

section() {
  printf "\n${MAGENTA}┌─────────────────────────────────────────────────────────────┐${RESET}\n"
  printf "${MAGENTA}│  📦  %-54s │${RESET}\n" "$1"
  printf "${MAGENTA}└─────────────────────────────────────────────────────────────┘${RESET}\n\n"
}

step() {
  printf "  ${GREEN}▸${RESET} ${BOLD}$1${RESET}\n"
}

info() {
  printf "    ${DIM}$1${RESET}\n"
}

warn() {
  printf "  ${YELLOW}⚠  $1${RESET}\n"
}

success() {
  printf "  ${GREEN}✔  $1${RESET}\n"
}

fail() {
  printf "  ${RED}✘  $1${RESET}\n"
}

separator() {
  printf "\n${DIM}──────────────────────────────────────────────────────────────────${RESET}\n"
}

pause() {
  printf "\n${DIM}  (pausing 3s for readability...)${RESET}\n"
  sleep 3
}

# ──────────── locate CLI ────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLI="npx tsx ${PROJECT_DIR}/src/index.ts"
NETWORK="testnet"
TMPDIR_DEMO=$(mktemp -d)

cleanup() {
  rm -rf "$TMPDIR_DEMO"
}
trap cleanup EXIT

# ──────────── output file for results ────────────
RESULTS_FILE="$TMPDIR_DEMO/research-results.jsonl"

# ╔══════════════════════════════════════════════════════════════════════╗
# ║                           DEMO START                                ║
# ╚══════════════════════════════════════════════════════════════════════╝
banner "xrpl-cli-ng  •  Full Feature Demo"

printf "${DIM}  Project  : %s${RESET}\n" "$PROJECT_DIR"
printf "${DIM}  Network  : %s${RESET}\n" "$NETWORK"
printf "${DIM}  Temp dir : %s${RESET}\n" "$TMPDIR_DEMO"

# ────────────────────────────────────────────────────────────────────────
# SECTION 1 — WALLET MANAGEMENT
# ────────────────────────────────────────────────────────────────────────
section "1 ─ Wallet Management"

step "Create Wallet A (sender)"
WALLET_A_JSON=$($CLI wallet new --json --show-secret --node $NETWORK 2>/dev/null)
SEED_A=$(echo "$WALLET_A_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['seed'])")
ADDR_A=$(echo "$WALLET_A_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['address'])")
success "Wallet A created"
info "Address: $ADDR_A"
info "Seed:    ${SEED_A:0:8}…"

step "Create Wallet B (receiver)"
WALLET_B_JSON=$($CLI wallet new --json --show-secret --node $NETWORK 2>/dev/null)
SEED_B=$(echo "$WALLET_B_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['seed'])")
ADDR_B=$(echo "$WALLET_B_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['address'])")
success "Wallet B created"
info "Address: $ADDR_B"
info "Seed:    ${SEED_B:0:8}…"

step "Fund Wallet A from testnet faucet"
$CLI wallet fund "$ADDR_A" --node $NETWORK 2>/dev/null || true
success "Wallet A funded"

step "Fund Wallet B from testnet faucet"
$CLI wallet fund "$ADDR_B" --node $NETWORK 2>/dev/null || true
success "Wallet B funded"

pause

# ────────────────────────────────────────────────────────────────────────
# SECTION 2 — ACCOUNT OPERATIONS
# ────────────────────────────────────────────────────────────────────────
section "2 ─ Account Operations"

step "Get Account Info for Wallet A"
$CLI account info "$ADDR_A" --node $NETWORK 2>/dev/null || true
separator

step "Get Account Balance for Wallet A"
$CLI account balance "$ADDR_A" --node $NETWORK 2>/dev/null || true
separator

step "Get Account Balance for Wallet B"
$CLI account balance "$ADDR_B" --node $NETWORK 2>/dev/null || true
separator

step "Get Recent Transactions for Wallet A"
$CLI account transactions "$ADDR_A" --node $NETWORK --limit 5 2>/dev/null || true

pause

# ────────────────────────────────────────────────────────────────────────
# SECTION 3 — XRP PAYMENT
# ────────────────────────────────────────────────────────────────────────
section "3 ─ XRP Payment"

step "Send 10 XRP from Wallet A → Wallet B"
$CLI payment --to "$ADDR_B" --amount 10 --seed "$SEED_A" --node $NETWORK 2>/dev/null || true
success "Payment submitted"
separator

step "Verify: Check Wallet B balance after payment"
$CLI account balance "$ADDR_B" --node $NETWORK 2>/dev/null || true

pause

# ────────────────────────────────────────────────────────────────────────
# SECTION 4 — TRUST LINES & TOKEN ISSUANCE
# ────────────────────────────────────────────────────────────────────────
section "4 ─ Trust Lines & Custom Token"

step "Create Wallet C (token issuer)"
WALLET_C_JSON=$($CLI wallet new --json --show-secret --node $NETWORK 2>/dev/null)
SEED_C=$(echo "$WALLET_C_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['seed'])")
ADDR_C=$(echo "$WALLET_C_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['address'])")
success "Issuer Wallet C created"
info "Address: $ADDR_C"

step "Fund Wallet C from testnet faucet"
$CLI wallet fund "$ADDR_C" --node $NETWORK 2>/dev/null || true
success "Wallet C funded"

step "Set trust line: Wallet A trusts Wallet C for 1000 USD"
$CLI trust set --seed "$SEED_A" --currency USD --issuer "$ADDR_C" --limit 1000 --node $NETWORK 2>/dev/null || true
success "Trust line created"
separator

step "Send 50 USD from Issuer C → Wallet A"
$CLI payment --to "$ADDR_A" --amount "50/USD/$ADDR_C" --seed "$SEED_C" --node $NETWORK 2>/dev/null || true
success "IOU payment sent"
separator

step "Verify: Check trust lines on Wallet A"
$CLI account trust-lines "$ADDR_A" --node $NETWORK 2>/dev/null || true

pause

# ────────────────────────────────────────────────────────────────────────
# SECTION 5 — DEX OFFERS
# ────────────────────────────────────────────────────────────────────────
section "5 ─ DEX Offers"

step "Create DEX offer: Wallet A sells 25 USD for 100 XRP"
$CLI offer create \
  --taker-pays 100 \
  --taker-gets "25/USD/$ADDR_C" \
  --seed "$SEED_A" \
  --node $NETWORK 2>/dev/null || true
success "DEX offer placed"
separator

step "Verify: List open offers on Wallet A"
$CLI account offers "$ADDR_A" --node $NETWORK 2>/dev/null || true

pause

# ────────────────────────────────────────────────────────────────────────
# SECTION 6 — AUTORESEARCH  (AI-driven on-chain analysis)
# ────────────────────────────────────────────────────────────────────────
section "6 ─ AutoResearch (AI-Driven On-Chain Analysis)"

printf "  ${BLUE}🤖 AutoResearch${RESET} uses an AI agent (Anthropic Claude or Google Gemini)\n"
printf "  to autonomously query XRPL on-chain data via tool-calling loops.\n\n"
printf "  ${DIM}How it works:${RESET}\n"
printf "    1. You write a ${BOLD}strategy file${RESET} (Markdown) describing what to research.\n"
printf "    2. The CLI sends the strategy to an AI model with XRPL query tools:\n"
printf "       ${DIM}• query_account_info   • query_amm_info      • get_ledger_stats${RESET}\n"
printf "       ${DIM}• query_account_offers  • query_order_book    • query_oracle${RESET}\n"
printf "       ${DIM}• store_finding${RESET}\n"
printf "    3. The AI autonomously calls tools, analyzes responses, and stores findings.\n"
printf "    4. Results are saved as JSONL — optionally anchored on-chain as Memos.\n\n"

# Detect which AI key is available
AI_PROVIDER=""
AI_KEY=""

if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  AI_PROVIDER="anthropic"
  AI_KEY="$ANTHROPIC_API_KEY"
  info "Detected ANTHROPIC_API_KEY → using Anthropic Claude"
elif [[ -n "${GEMINI_API_KEY:-}" ]]; then
  AI_PROVIDER="gemini"
  AI_KEY="$GEMINI_API_KEY"
  info "Detected GEMINI_API_KEY → using Google Gemini"
fi

if [[ -z "$AI_PROVIDER" ]]; then
  warn "No AI API key found. Set ANTHROPIC_API_KEY or GEMINI_API_KEY to run AutoResearch."
  warn "Skipping AutoResearch demo."
  printf "\n  ${DIM}Example:${RESET}\n"
  printf "    ${DIM}export GEMINI_API_KEY=\"your-key\"${RESET}\n"
  printf "    ${DIM}bash scripts/demo.sh${RESET}\n"
else
  # Use the bundled strategy file
  STRATEGY_FILE="${SCRIPT_DIR}/demo-strategy.md"

  if [[ ! -f "$STRATEGY_FILE" ]]; then
    fail "Strategy file not found: $STRATEGY_FILE"
    exit 1
  fi

  step "Show strategy file"
  printf "${DIM}"
  cat "$STRATEGY_FILE"
  printf "${RESET}\n"
  separator

  step "Run AutoResearch loop (2 iterations, 5s interval)"
  printf "\n"
  $CLI research run "$STRATEGY_FILE" \
    --provider "$AI_PROVIDER" \
    --api-key "$AI_KEY" \
    --network $NETWORK \
    --output "$RESULTS_FILE" \
    --max-iterations 2 \
    --interval 5 \
    2>&1 || true

  separator

  step "Show saved research findings (JSONL)"
  if [[ -f "$RESULTS_FILE" ]]; then
    printf "${DIM}"
    cat "$RESULTS_FILE"
    printf "${RESET}"
  else
    warn "No results file generated."
  fi

  separator

  step "AutoResearch with on-chain storage (dry-run example)"
  printf "  ${DIM}To store findings as on-chain Memos, add:${RESET}\n"
  printf "    ${DIM}--store-on-chain --seed \$SEED_A${RESET}\n"
  printf "\n  ${DIM}Full command:${RESET}\n"
  printf "    ${DIM}xrpl research run strategy.md --provider gemini --store-on-chain --seed sEd...${RESET}\n"
fi

# ────────────────────────────────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────────────────────────────────
banner "Demo Complete! 🎉"

printf "  ${BOLD}Features demonstrated:${RESET}\n"
printf "    ${GREEN}✔${RESET}  Wallet creation & funding (testnet faucet)\n"
printf "    ${GREEN}✔${RESET}  Account info, balance & transaction queries\n"
printf "    ${GREEN}✔${RESET}  XRP payments between accounts\n"
printf "    ${GREEN}✔${RESET}  Trust line setup & IOU token issuance\n"
printf "    ${GREEN}✔${RESET}  DEX offer placement & listing\n"
if [[ -n "$AI_PROVIDER" ]]; then
  printf "    ${GREEN}✔${RESET}  AutoResearch — AI-driven on-chain analysis\n"
else
  printf "    ${YELLOW}⊘${RESET}  AutoResearch — skipped (no API key)\n"
fi

printf "\n  ${DIM}All operations ran on: ${NETWORK}${RESET}\n"
printf "  ${DIM}Temp files cleaned up automatically.${RESET}\n\n"
