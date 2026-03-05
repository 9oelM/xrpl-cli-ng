import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

const E2E_PATH = `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`;

function runCLI(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: E2E_PATH,
      ...extraEnv,
    },
    timeout: 120_000,
  });
}

describe("wallet fund", () => {
  it("funds a fresh address on testnet and prints Funded/Balance lines", () => {
    // Generate a fresh wallet address
    const newResult = runCLI(["wallet", "new", "--json"]);
    expect(newResult.status).toBe(0);
    const wallet = JSON.parse(newResult.stdout) as { address: string };
    expect(wallet.address).toMatch(/^r/);

    // Fund it from testnet faucet
    const fundResult = runCLI(["--node", "testnet", "wallet", "fund", wallet.address]);
    expect(fundResult.status).toBe(0);
    expect(fundResult.stdout).toContain(`Funded ${wallet.address}`);
    expect(fundResult.stdout).toContain("Balance:");
  });

  it("--json output contains address, balanceXrp, and balanceDrops fields with non-zero values", () => {
    const newResult = runCLI(["wallet", "new", "--json"]);
    expect(newResult.status).toBe(0);
    const wallet = JSON.parse(newResult.stdout) as { address: string };

    const fundResult = runCLI(["--node", "testnet", "wallet", "fund", wallet.address, "--json"]);
    expect(fundResult.status).toBe(0);
    const data = JSON.parse(fundResult.stdout) as {
      address: string;
      balanceXrp: number;
      balanceDrops: string;
    };
    expect(data.address).toBe(wallet.address);
    expect(typeof data.balanceXrp).toBe("number");
    expect(data.balanceXrp).toBeGreaterThan(0);
    expect(typeof data.balanceDrops).toBe("string");
    expect(data.balanceDrops).toMatch(/^\d+$/);
    expect(Number(data.balanceDrops)).toBeGreaterThan(0);
  });

  it("exits 1 with error on mainnet", () => {
    const result = runCLI(["--node", "wss://xrplcluster.com", "wallet", "fund", "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("only available on testnet and devnet");
  });

  it("alias 'f' works", () => {
    const newResult = runCLI(["wallet", "new", "--json"]);
    expect(newResult.status).toBe(0);
    const wallet = JSON.parse(newResult.stdout) as { address: string };

    const fundResult = runCLI(["--node", "testnet", "wallet", "f", wallet.address]);
    expect(fundResult.status).toBe(0);
    expect(fundResult.stdout).toContain(`Funded ${wallet.address}`);
  });
});
