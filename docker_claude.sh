#!/bin/sh

# Note: run this after building claude-code-devcontainer/Dockerfile

# This will prompt you to verify your account on platform.claude.com

docker run -it --rm \
  -v "$(pwd)":/workspace \
  -w /workspace \
  claude-code-devcontainer \
  claude --dangerously-skip-permissions
