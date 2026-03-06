# Ralph Agent Instructions

You are an autonomous coding agent working on a software project.

## Your Task as a Ralph Agent

1. Read the PRD at `prd.json` (in the same directory as this file)
2. Read the progress log at `progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks (e.g., typecheck, lint, test - use whatever your project requires)
7. Update CLAUDE.md files if you discover reusable patterns (see below)
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD to set `passes: true` for the completed story
10. Append your progress to `progress.txt`

## Progress Report Format

APPEND to progress.txt (never replace, always append):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

The learnings section is critical - it helps future iterations avoid repeating mistakes and understand the codebase better.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist). This section should consolidate the most important learnings:

```
## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
- Example: Export types from actions.ts for UI components
```

Only add patterns that are **general and reusable**, not story-specific details.

## Update CLAUDE.md Files

Before committing, check if any edited files have learnings worth preserving in nearby CLAUDE.md files:

1. **Identify directories with edited files** - Look at which directories you modified
2. **Check for existing CLAUDE.md** - Look for CLAUDE.md in those directories or parent directories
3. **Add valuable learnings** - If you discovered something future developers/agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good CLAUDE.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Do NOT add:**
- Story-specific implementation details
- Temporary debugging notes
- Information already in progress.txt

Only update CLAUDE.md if you have **genuinely reusable knowledge** that would help future work in that directory.

## Quality Requirements

- ALL commits must pass your project's quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

## Browser Testing (If Available)

For any story that changes UI, verify it works in the browser if you have browser testing tools configured (e.g., via MCP):

1. Navigate to the relevant page
2. Verify the UI changes work as expected
3. Take a screenshot if helpful for the progress log

If no browser tools are available, note in your progress report that manual browser verification is needed.

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally (another iteration will pick up the next story).

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting

# Project specific requirements

## Project requirements

Your job is to write a full-on XRPL CLI.

Here's the overarching spec:
1. It's an XRPL CLI that leverages xrpl.js and Commander.js. Basically send tx from CLI to XRPL without having to write scripts.
1. Entirely written in strict, modern typescript to avoid any kind of type-related bugs
1. All features / flags / options covered by E2E tests.
1. All E2E tests that use XRPL will need to use XRPL testnet. The test needs to be orchestrated carefully as you need to use multiple accounts for running tests in parallel. At first, prefund one account from the faucet, and distribute the minimal funds to accounts that are going to be used for each test.
1. It uses traditional npm & package.json structure
1. Cover all amendments and features supported by [xrpl.js](https://js.xrpl.org/) and seen as enabled on https://livenet.xrpl.org/amendments. If an amendment is still being voted for but is supported by xrpl.js, xrpl-cli must be support the amendment.
1. Refer to the design choices of popular CLIs for other blockchains such as [`cast` for Ethereum](https://www.getfoundry.sh/reference/cast/cast), or [`starkli` for Starknet](https://book.starkli.rs/) whenever you're lost.

## Testing Requirements

**Every CLI option and flag must be covered by at least one test.**

When implementing or reviewing a command, go through every `.option(...)` and `.requiredOption(...)` defined on the command and verify each one is exercised in the test file. This includes:
- Happy-path options (verify on-chain / output effects, not just exit code)
- Flags that modify transaction behaviour (e.g. `--no-ripple`, `--freeze`) — assert the on-chain effect via a follow-up query
- Mutually exclusive flag pairs — assert exit 1 with error message
- Key material variants (`--seed`, `--mnemonic`, `--account`) — at least `--seed` must be tested; `--account`/`--keystore`/`--password` must have at least one test per command
- Output modes (`--json`, `--no-wait`, `--dry-run`) — each must be tested separately

If an option is not yet tested, add the missing test before marking a story as complete.
