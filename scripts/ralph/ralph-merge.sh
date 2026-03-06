#!/usr/bin/env bash
# ralph-merge.sh — Merge completed Ralph worktree branches into the current branch.
#
# For each branch:
#   1. Attempt git merge --no-ff
#   2. If clean → done
#   3. If conflicts in known trivial files (src/commands/index.ts, src/index.ts)
#      → auto-resolve by keeping both sides (these files only ever get additions)
#   4. If complex conflicts remain → write a context file from progress.txt + diffs,
#      then invoke claude (or amp) to resolve, or print instructions to do it manually
#
# Usage:
#   ./ralph-merge.sh [OPTIONS] [branch ...]
#   ./ralph-merge.sh                        # auto-detect from .worktrees/
#   ./ralph-merge.sh ralph/offer ralph/escrow
#
# Options:
#   --tool amp|claude|manual   How to resolve complex conflicts (default: claude)
#                              manual = print context and stop, let the human invoke Claude
#   --dry-run                  Show what would be merged, do nothing
#   --help                     Show this help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKTREES_DIR="$REPO_ROOT/.worktrees"

TOOL="claude"
DRY_RUN=false
BRANCHES=()

# ── Trivially resolvable files ────────────────────────────────────────────────
# These files only ever receive additive changes from Ralph branches
# (new imports, new addCommand calls). Keeping both sides is always correct.
TRIVIAL_FILES=(
  "src/commands/index.ts"
  "src/index.ts"
)

# Files where we always take HEAD (ours) — Ralph working files that are
# different in every branch but belong to whichever feature was last merged.
OURS_FILES=(
  "scripts/ralph/prd.json"
  "scripts/ralph/progress.txt"
  "scripts/ralph/.last-branch"
)

is_trivial() {
  local f="$1"
  for t in "${TRIVIAL_FILES[@]}"; do
    [[ "$f" == "$t" ]] && return 0
  done
  return 1
}

is_ours() {
  local f="$1"
  for t in "${OURS_FILES[@]}"; do
    [[ "$f" == "$t" ]] && return 0
  done
  return 1
}

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)         TOOL="$2";    shift 2 ;;
    --tool=*)       TOOL="${1#*=}"; shift ;;
    --dry-run)      DRY_RUN=true; shift ;;
    --help|-h)
      sed -n '2,18p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    -*)             echo "Unknown option: $1" >&2; exit 1 ;;
    *)              BRANCHES+=("$1"); shift ;;
  esac
done

if [[ "$TOOL" != "amp" && "$TOOL" != "claude" && "$TOOL" != "manual" ]]; then
  echo "Error: --tool must be 'amp', 'claude', or 'manual'" >&2
  exit 1
fi

# ── Auto-detect branches from .worktrees/ if none provided ───────────────────
if [[ ${#BRANCHES[@]} -eq 0 ]]; then
  if [[ ! -d "$WORKTREES_DIR" ]]; then
    echo "No branches specified and no .worktrees/ directory found." >&2
    exit 1
  fi
  for dir in "$WORKTREES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    NAME="$(basename "$dir")"
    if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/ralph/$NAME" 2>/dev/null; then
      BRANCHES+=("ralph/$NAME")
    fi
  done
  if [[ ${#BRANCHES[@]} -eq 0 ]]; then
    echo "No ralph/* branches found in .worktrees/." >&2
    exit 1
  fi
fi

echo "Branches to merge: ${BRANCHES[*]}"
echo "Target: $(git -C "$REPO_ROOT" branch --show-current)"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "(dry-run — no changes made)"
  for BRANCH in "${BRANCHES[@]}"; do
    echo "  would merge: $BRANCH"
    git -C "$REPO_ROOT" log --oneline "HEAD..$BRANCH" | sed 's/^/    /'
  done
  exit 0
fi

# ── Auto-resolve trivial conflict markers (keep both sides) ───────────────────
# For files that only ever receive additions, the correct resolution is to
# include both sides of every conflict marker. We use Python to handle
# multi-line conflict blocks safely.
resolve_trivial_file() {
  local filepath="$1"
  python3 - "$filepath" <<'PYEOF'
import re, sys

path = sys.argv[1]
content = open(path).read()

def keep_both(m):
    ours   = m.group(1)   # content between <<<< and ====
    theirs = m.group(2)   # content between ==== and >>>>
    return ours + theirs

pattern = re.compile(
    r'<<<<<<< [^\n]*\n'   # <<<<<<< HEAD / branch
    r'(.*?)'              # our side
    r'=======\n'
    r'(.*?)'              # their side
    r'>>>>>>> [^\n]*\n',  # >>>>>>> branch
    re.DOTALL
)

resolved = pattern.sub(keep_both, content)
open(path, 'w').write(resolved)
print(f"  resolved: {path}")
PYEOF
}

# ── Build a context file for complex conflicts ────────────────────────────────
build_context_file() {
  local branch="$1"
  local name="$2"
  local worktree="$3"
  local context_file="$4"

  {
    echo "# Merge Conflict Context"
    echo ""
    echo "Branch being merged: $branch"
    echo "Target branch: $(git -C "$REPO_ROOT" branch --show-current)"
    echo ""
    echo "---"
    echo ""
    echo "## What Ralph implemented in this branch"
    echo ""
    if [[ -f "$worktree/scripts/ralph/progress.txt" ]]; then
      cat "$worktree/scripts/ralph/progress.txt"
    else
      echo "(no progress.txt found — check $worktree/scripts/ralph/)"
    fi
    echo ""
    echo "---"
    echo ""
    echo "## Files with unresolved conflicts"
    echo ""
    git -C "$REPO_ROOT" diff --name-only --diff-filter=U
    echo ""
    echo "---"
    echo ""
    echo "## Full diff of this branch vs current HEAD"
    echo ""
    git -C "$REPO_ROOT" diff HEAD..."$branch" 2>/dev/null || true
  } > "$context_file"
}

# ── Claude prompt for complex conflict resolution ─────────────────────────────
conflict_resolution_prompt() {
  local context_file="$1"
  local conflicted_files="$2"

  cat <<PROMPT
You are resolving git merge conflicts in the XRPL CLI project at $REPO_ROOT.

## Your job

1. Read the context file at $context_file — it contains:
   - What the Ralph agent implemented in this branch (progress.txt)
   - The full diff of the branch

2. For each conflicted file listed below, read it (it will contain <<<<<<, =======, >>>>>>> markers)

3. Resolve each conflict correctly:
   - For src/commands/index.ts or src/index.ts: ALWAYS keep both sides (both branches add independent imports/commands)
   - For other files: use the context from the progress log to understand what each side intended, then produce the correct merged result that includes both features

4. After resolving all conflicts:
   - Run typecheck: PATH="/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:\$PATH" /workspace/node_modules/.bin/tsc --noEmit
   - Stage resolved files with: git -C $REPO_ROOT add <file>
   - Complete the merge with: GIT_EDITOR=true git -C $REPO_ROOT merge --continue --no-edit

Conflicted files:
$conflicted_files

Context file: $context_file
PROMPT
}

# ── Main merge loop ───────────────────────────────────────────────────────────
FAILED=()
SUCCEEDED=()

for BRANCH in "${BRANCHES[@]}"; do
  NAME="${BRANCH#ralph/}"
  WORKTREE="$WORKTREES_DIR/$NAME"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ Merging $BRANCH"

  # Attempt the merge. GIT_EDITOR=true prevents any editor prompt for the
  # merge commit message. We do NOT silence stderr — real errors should be visible.
  if GIT_EDITOR=true git -C "$REPO_ROOT" merge --no-ff --no-edit "$BRANCH"; then
    echo "  ✓ Clean merge"
    SUCCEEDED+=("$BRANCH")
    continue
  fi

  # Collect conflicted files
  mapfile -t CONFLICTED < <(git -C "$REPO_ROOT" diff --name-only --diff-filter=U)
  echo "  Conflicts in: ${CONFLICTED[*]}"

  # Auto-resolve trivial and ours files
  COMPLEX=()
  for f in "${CONFLICTED[@]}"; do
    if is_trivial "$f"; then
      resolve_trivial_file "$REPO_ROOT/$f"
      git -C "$REPO_ROOT" add "$f"
      echo "  auto-resolved (keep both): $f"
    elif is_ours "$f"; then
      # Take HEAD's version — these are Ralph working files, not source code
      git -C "$REPO_ROOT" checkout HEAD -- "$f"
      git -C "$REPO_ROOT" add "$f"
      echo "  auto-resolved (keep ours): $f"
    else
      COMPLEX+=("$f")
    fi
  done

  # If all conflicts were auto-resolvable — complete the merge
  if [[ ${#COMPLEX[@]} -eq 0 ]]; then
    GIT_EDITOR=true git -C "$REPO_ROOT" merge --continue --no-edit
    echo "  ✓ All conflicts auto-resolved (trivial additions)"
    SUCCEEDED+=("$BRANCH")
    continue
  fi

  # Complex conflicts remain — need AI or manual intervention
  echo "  Complex conflicts: ${COMPLEX[*]}"
  CONTEXT_FILE="$WORKTREES_DIR/merge-context-$NAME.md"
  build_context_file "$BRANCH" "$NAME" "$WORKTREE" "$CONTEXT_FILE"
  echo "  Context written to: $CONTEXT_FILE"
  echo ""

  if [[ "$TOOL" == "manual" ]]; then
    echo "  ── Manual resolution required ──────────────────────────────────"
    echo "  Ask Claude Code to resolve conflicts by pasting this:"
    echo ""
    echo "  > Resolve the merge conflicts for $BRANCH."
    echo "  > Context is in $CONTEXT_FILE."
    echo "  > Conflicted files: ${COMPLEX[*]}"
    echo "  > After resolving, run: GIT_EDITOR=true git -C $REPO_ROOT merge --continue --no-edit"
    echo ""
    echo "  Then re-run this script to continue."
    echo "  ────────────────────────────────────────────────────────────────"
    FAILED+=("$BRANCH (manual resolution needed)")
    # Abort the failed merge so the repo stays clean
    git -C "$REPO_ROOT" merge --abort 2>/dev/null || true

  elif [[ "$TOOL" == "claude" ]]; then
    echo "  Invoking claude to resolve..."
    PROMPT="$(conflict_resolution_prompt "$CONTEXT_FILE" "${COMPLEX[*]}")"
    if claude --dangerously-skip-permissions --print <<< "$PROMPT"; then
      echo "  ✓ claude resolved conflicts"
      SUCCEEDED+=("$BRANCH")
    else
      echo "  ✗ claude failed to resolve — aborting merge"
      git -C "$REPO_ROOT" merge --abort 2>/dev/null || true
      FAILED+=("$BRANCH (claude resolution failed)")
    fi

  elif [[ "$TOOL" == "amp" ]]; then
    echo "  Invoking amp to resolve..."
    PROMPT="$(conflict_resolution_prompt "$CONTEXT_FILE" "${COMPLEX[*]}")"
    if echo "$PROMPT" | amp --dangerously-allow-all; then
      echo "  ✓ amp resolved conflicts"
      SUCCEEDED+=("$BRANCH")
    else
      echo "  ✗ amp failed to resolve — aborting merge"
      git -C "$REPO_ROOT" merge --abort 2>/dev/null || true
      FAILED+=("$BRANCH (amp resolution failed)")
    fi
  fi

  echo ""
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
[[ ${#SUCCEEDED[@]} -gt 0 ]] && echo "Merged (${#SUCCEEDED[@]}): ${SUCCEEDED[*]}"
[[ ${#FAILED[@]} -gt 0 ]]   && echo "Failed  (${#FAILED[@]}):  ${FAILED[*]}"
echo ""

if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "All branches merged successfully."
  echo ""
  echo "Clean up worktrees when done:"
  for BRANCH in "${BRANCHES[@]}"; do
    NAME="${BRANCH#ralph/}"
    echo "  git worktree remove --force .worktrees/$NAME"
  done
  exit 0
else
  exit 1
fi
