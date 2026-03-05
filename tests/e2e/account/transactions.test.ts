import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

// Well-known testnet genesis address that has transaction history
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

describe("account transactions", () => {
  it("lists transactions for an account with history", () => {
    const result = runCLI(["--node", "testnet", "account", "transactions", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    // Should have at least one transaction line (ledger type result hash format)
    const lines = result.stdout.trim().split("\n");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).not.toBe("(no transactions)");
    // Each line should match: ledger  type  result  hash (4 space-separated columns)
    expect(lines[0]).toMatch(/^\d+\s+\S+\s+\S+\s+\S+$/);
  });

  it("alias 'txs' works", () => {
    const result = runCLI(["--node", "testnet", "account", "txs", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).not.toBe("");
  });

  it("--limit restricts number of results", () => {
    const result = runCLI(["--node", "testnet", "account", "transactions", "--limit", "3", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it("--json outputs transactions array and optional marker", () => {
    const result = runCLI(["--node", "testnet", "account", "transactions", "--json", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { transactions: unknown[]; marker?: unknown };
    expect(Array.isArray(data.transactions)).toBe(true);
    expect(data.transactions.length).toBeGreaterThan(0);
  });
});
