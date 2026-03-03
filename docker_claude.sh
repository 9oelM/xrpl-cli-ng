#!/bin/sh

docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  --network none \
  node:22 \
  npx claude --dangerously-skip-permissions \
  --disallowedTools "Bash(rm:*)" \
  -p "your task here"