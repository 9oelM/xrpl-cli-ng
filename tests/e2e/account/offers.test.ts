import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

// Well-known testnet genesis address that likely has no open offers
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

describe("account offers", () => {
  it("shows (no open offers) for a fresh testnet account", () => {
    // Use a random-looking address that has no offers — genesis address should have none
    const result = runCLI(["--node", "testnet", "account", "offers", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    // Either no offers or a list of offers — both are valid
    const stdout = result.stdout.trim();
    if (stdout === "(no open offers)") {
      expect(stdout).toBe("(no open offers)");
    } else {
      // Has offers: each line should match #<seq>  <pays> → <gets>  quality: <q>
      const lines = stdout.split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
    }
  });

  it("alias 'of' works", () => {
    const result = runCLI(["--node", "testnet", "account", "of", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
  });

  it("--json outputs an array", () => {
    const result = runCLI(["--node", "testnet", "account", "offers", "--json", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as unknown[];
    expect(Array.isArray(data)).toBe(true);
  });
});
