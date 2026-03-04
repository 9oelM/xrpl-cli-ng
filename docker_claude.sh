#!/bin/sh

# Note: run this after building claude-code-devcontainer/Dockerfile

docker run -it --rm \
  -v "$(pwd)":/workspace \
  -w /workspace \
  --network none \
  claude-code-devcontainer \
  claude --dangerously-skip-permissions
