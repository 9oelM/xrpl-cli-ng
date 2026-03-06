import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet } from "../../helpers/testnet.js";

let oracle: Wallet;

beforeAll(async () => {
  const client = new Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  try {
    oracle = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }

  // Create oracle with known values for get tests
  const createResult = runCLI([
    "--node", "testnet",
    "oracle", "set",
    "--document-id", "1",
    "--price", "BTC/USD:155000:6",
    "--price", "ETH/USD:3000000:9",
    "--provider", "pyth",
    "--asset-class", "currency",
    "--seed", oracle.seed!,
  ]);
  if (createResult.status !== 0) {
    throw new Error(`Oracle setup failed: ${createResult.stderr}`);
  }
}, 180_000);

describe("oracle get", () => {
  it("returns human-readable price pairs with decoded provider and asset class", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "get",
      oracle.address,
      "1",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    // Provider decoded from hex to UTF-8
    expect(result.stdout).toContain("pyth");
    // Asset class decoded from hex to UTF-8
    expect(result.stdout).toContain("currency");
    // BTC/USD price: 155000 * 10^(-6) = 0.155000
    expect(result.stdout).toMatch(/BTC\/USD/);
    // ETH/USD price: 3000000 * 10^(-9) = 0.003000
    expect(result.stdout).toMatch(/ETH\/USD/);
    // Document ID shown
    expect(result.stdout).toContain("1");
  });

  it("--json outputs raw ledger entry as JSON", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "get",
      oracle.address,
      "1",
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      node: {
        LedgerEntryType: string;
        OracleDocumentID: number;
        PriceDataSeries: unknown[];
      };
    };
    expect(out.node.LedgerEntryType).toBe("Oracle");
    expect(out.node.OracleDocumentID).toBe(1);
    expect(Array.isArray(out.node.PriceDataSeries)).toBe(true);
  });

  it("returns error for non-existent oracle", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "get",
      oracle.address,
      "9999",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/error/i);
  });

  it("--node option is accepted on oracle get", () => {
    const result = runCLI([
      "--node", "wss://s.altnet.rippletest.net:51233",
      "oracle", "get",
      oracle.address,
      "1",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("pyth");
  });
});
