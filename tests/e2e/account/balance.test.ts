import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";


const KNOWN_TESTNET_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";


describe("account balance", () => {
  it("outputs balance in XRP format", () => {
    const result = runCLI(["--node", "testnet", "account", "balance", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+(\.\d+)? XRP$/);
  });

  it("alias 'bal' works", () => {
    const result = runCLI(["--node", "testnet", "account", "bal", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+(\.\d+)? XRP$/);
  });

  it("--drops outputs a plain integer string with no 'XRP' suffix", () => {
    const result = runCLI(["--node", "testnet", "account", "balance", "--drops", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const output = result.stdout.trim();
    expect(output).toMatch(/^\d+$/);
    expect(output).not.toContain("XRP");
  });

  it("--json outputs address, balanceXrp, and balanceDrops fields", () => {
    const result = runCLI(["--node", "testnet", "account", "balance", "--json", KNOWN_TESTNET_ADDRESS]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { address: string; balanceXrp: number; balanceDrops: string };
    expect(data.address).toBe(KNOWN_TESTNET_ADDRESS);
    expect(typeof data.balanceXrp).toBe("number");
    expect(typeof data.balanceDrops).toBe("string");
    expect(data.balanceDrops).toMatch(/^\d+$/);
  });
});
