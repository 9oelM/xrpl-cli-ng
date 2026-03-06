import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";


// A well-known funded testnet account (Ripple testnet genesis)
const KNOWN_TESTNET_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";


describe("account info", () => {
  it("returns account data with --node testnet flag", () => {
    const result = runCLI(["--node", "testnet", "account", "info", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Address:");
    expect(result.stdout).toContain("Balance:");
    expect(result.stdout).toContain("Sequence:");
    expect(result.stdout).toContain("Owner Count:");
    expect(result.stdout).toContain("Reserve:");
    expect(result.stdout).toContain("Flags:");
  });

  it("returns account data using XRPL_NODE env var", () => {
    const result = runCLI(["account", "info", KNOWN_TESTNET_ADDRESS], {
      XRPL_NODE: "testnet",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Address:");
    expect(result.stdout).toContain("Balance:");
  });

  it("--json outputs Account and Balance fields", () => {
    const result = runCLI(["--node", "testnet", "account", "info", "--json", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { Account: string; Balance: string };
    expect(data.Account).toBe(KNOWN_TESTNET_ADDRESS);
    expect(typeof data.Balance).toBe("string");
  });

  it("alias 'i' works", () => {
    const result = runCLI(["--node", "testnet", "account", "i", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Address:");
  });
});
