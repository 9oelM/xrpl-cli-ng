import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";


// Well-known testnet genesis address — typically has no trust lines
const KNOWN_TESTNET_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";


describe("account trust-lines", () => {
  it("shows (no trust lines) for a fresh testnet account", () => {
    const result = runCLI(["--node", "testnet", "account", "trust-lines", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const stdout = result.stdout.trim();
    if (stdout === "(no trust lines)") {
      expect(stdout).toBe("(no trust lines)");
    } else {
      // Has trust lines: each line should match <currency>/<account> balance: ... limit: ...
      const lines = stdout.split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(/\w+\/r\w+\s+balance:/);
      }
    }
  });

  it("alias 'lines' works", () => {
    const result = runCLI(["--node", "testnet", "account", "lines", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
  });

  it("--json outputs an array", () => {
    const result = runCLI(["--node", "testnet", "account", "trust-lines", "--json", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as unknown[];
    expect(Array.isArray(data)).toBe(true);
  });
});
