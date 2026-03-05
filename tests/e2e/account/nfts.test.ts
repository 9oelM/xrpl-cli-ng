import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

// Well-known testnet genesis address — typically has no NFTs
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

describe("account nfts", () => {
  it("shows (no NFTs) for a fresh testnet account", () => {
    const result = runCLI(["--node", "testnet", "account", "nfts", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const stdout = result.stdout.trim();
    if (stdout === "(no NFTs)") {
      expect(stdout).toBe("(no NFTs)");
    } else {
      // Has NFTs: each line should contain taxon: and serial:
      const lines = stdout.split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(/taxon:\s+\d+\s+serial:\s+\d+/);
      }
    }
  });

  it("alias 'nft' works", () => {
    const result = runCLI(["--node", "testnet", "account", "nft", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
  });

  it("--json outputs an array", () => {
    const result = runCLI(["--node", "testnet", "account", "nfts", "--json", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as unknown[];
    expect(Array.isArray(data)).toBe(true);
  });
});
