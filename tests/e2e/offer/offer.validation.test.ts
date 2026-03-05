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

describe("offer validation (no network)", () => {
  it("missing --taker-pays exits 1", () => {
    const result = runCLI([
      "offer", "create",
      "--taker-gets", "10",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
  });

  it("missing --taker-gets exits 1", () => {
    const result = runCLI([
      "offer", "create",
      "--taker-pays", `1/USD/${DUMMY_ADDRESS}`,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
  });

  it("missing key material exits 1 with error message", () => {
    const result = runCLI([
      "offer", "create",
      "--taker-pays", `1/USD/${DUMMY_ADDRESS}`,
      "--taker-gets", "10",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--immediate-or-cancel and --fill-or-kill together exits 1 with mutual exclusion error", () => {
    const result = runCLI([
      "offer", "create",
      "--taker-pays", `1/USD/${DUMMY_ADDRESS}`,
      "--taker-gets", "10",
      "--seed", DUMMY_SEED,
      "--immediate-or-cancel",
      "--fill-or-kill",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--immediate-or-cancel and --fill-or-kill are mutually exclusive");
  });
});
