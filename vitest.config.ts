import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxConcurrency: 3,
    poolOptions: {
      forks: {
        maxForks: 3,
      },
    },
  },
});
