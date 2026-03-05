import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");
const E2E_PATH = `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`;

// Static dummy values — these tests exit before any network call
const DUMMY_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const DUMMY_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

function runCLI(args: string[]) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: { ...process.env, PATH: E2E_PATH },
    timeout: 15_000,
  });
}

describe("trust set validation (no network)", () => {
  it("invalid currency exits 1 with descriptive error", () => {
    const result = runCLI([
      "trust", "set",
      "--currency", "TOOLONG",
      "--issuer", DUMMY_ADDRESS,
      "--limit", "100",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid currency");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "trust", "set",
      "--currency", "USD",
      "--issuer", DUMMY_ADDRESS,
      "--limit", "100",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "trust", "set",
      "--currency", "USD",
      "--issuer", DUMMY_ADDRESS,
      "--limit", "100",
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--no-ripple and --clear-no-ripple together exits 1", () => {
    const result = runCLI([
      "trust", "set",
      "--currency", "USD",
      "--issuer", DUMMY_ADDRESS,
      "--limit", "100",
      "--seed", DUMMY_SEED,
      "--no-ripple",
      "--clear-no-ripple",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("--freeze and --unfreeze together exits 1", () => {
    const result = runCLI([
      "trust", "set",
      "--currency", "USD",
      "--issuer", DUMMY_ADDRESS,
      "--limit", "100",
      "--seed", DUMMY_SEED,
      "--freeze",
      "--unfreeze",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });
});
