import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { runCLI } from "../../helpers/cli.js";

function withTmpStrategy(fn: (strategyPath: string) => void): void {
  const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-research-test-"));
  const strategyPath = resolve(tmpDir, "strategy.md");
  writeFileSync(strategyPath, "# Research Goal\nTest strategy.\n");
  try {
    fn(strategyPath);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("research run validation (no network, no API)", () => {
  it.concurrent("missing strategy file exits 1 with error", () => {
    const result = runCLI(["research", "run", "/nonexistent/strategy.md", "--api-key", "dummy"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it.concurrent("invalid provider exits 1 with error", () => {
    withTmpStrategy((strategyPath) => {
      const result = runCLI([
        "research", "run", strategyPath,
        "--provider", "openai",
        "--api-key", "dummy",
      ]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Error:");
    });
  });

  it.concurrent("missing API key exits 1 with error", () => {
    withTmpStrategy((strategyPath) => {
      const result = runCLI(
        ["research", "run", strategyPath],
        { ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "" }
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Error:");
    });
  });

  it.concurrent("--store-on-chain without --seed exits 1 mentioning --seed", () => {
    withTmpStrategy((strategyPath) => {
      const result = runCLI([
        "research", "run", strategyPath,
        "--api-key", "dummy",
        "--store-on-chain",
      ]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("--seed");
    });
  });

  it.concurrent("non-integer --max-iterations exits 1 with error", () => {
    withTmpStrategy((strategyPath) => {
      const result = runCLI([
        "research", "run", strategyPath,
        "--api-key", "dummy",
        "--max-iterations", "abc",
      ]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Error:");
    });
  });
});
