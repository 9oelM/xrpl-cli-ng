import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

// A well-known funded testnet account (Ripple testnet genesis)
const KNOWN_TESTNET_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";

function runCLI(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`,
      ...extraEnv,
    },
    timeout: 30_000,
  });
}

describe("account info (global --node)", () => {
  it("returns account data with --node testnet flag", () => {
    const result = runCLI(["--node", "testnet", "account", "info", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Account:");
    expect(result.stdout).toContain("Balance:");
  });

  it("returns account data using XRPL_NODE env var", () => {
    const result = runCLI(["account", "info", KNOWN_TESTNET_ADDRESS], {
      XRPL_NODE: "testnet",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Account:");
    expect(result.stdout).toContain("Balance:");
  });
});
