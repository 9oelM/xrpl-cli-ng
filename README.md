# xrpl-cli

A sandboxed environment for running Claude Code and the Ralph autonomous agent loop.

## Setup

Build the devcontainer image once:

```sh
docker build -t claude-code-devcontainer ./claude-code-devcontainer
```

## Running Claude interactively

Mount your project and open an interactive Claude session:

```sh
cd /your/project
bash /path/to/xrpl-cli/docker_claude.sh
```

Claude runs with no network access and full file access to the mounted workspace.

## Running Ralph (autonomous agent loop)

Ralph reads a `prd.json` and implements user stories one at a time until all pass.

1. Create a `prd.json` in `scripts/ralph/` (see `ralph/prd.json.example`)
2. Run the loop:

```sh
cd scripts/ralph
./ralph.sh --tool claude 10
```

The second argument is the max number of iterations. Ralph stops early when all stories are marked complete.

Progress is logged to `scripts/ralph/progress.txt`. Previous runs are archived to `scripts/ralph/archive/`.
