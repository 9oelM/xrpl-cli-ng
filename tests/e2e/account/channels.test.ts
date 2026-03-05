import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

// Well-known testnet genesis address — typically has no payment channels
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

describe("account channels", () => {
  it("shows (no payment channels) for a fresh testnet account", () => {
    const result = runCLI(["--node", "testnet", "account", "channels", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const stdout = result.stdout.trim();
    if (stdout === "(no payment channels)") {
      expect(stdout).toBe("(no payment channels)");
    } else {
      // Has channels: each line should contain dest: and amount:
      const lines = stdout.split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(/dest:\s+r\w+\s+amount:/);
      }
    }
  });

  it("alias 'chan' works", () => {
    const result = runCLI(["--node", "testnet", "account", "chan", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
  });

  it("--json outputs an array", () => {
    const result = runCLI(["--node", "testnet", "account", "channels", "--json", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as unknown[];
    expect(Array.isArray(data)).toBe(true);
  });
});
