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
}, 180_000);

describe("oracle set", () => {
  it("creates an oracle with --price and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:155000:6",
      "--provider", "pyth",
      "--asset-class", "currency",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("creates an oracle with --price-data JSON", () => {
    const priceData = JSON.stringify([
      { BaseAsset: "ETH", QuoteAsset: "USD", AssetPrice: 3000000, Scale: 6 },
      { BaseAsset: "BTC", QuoteAsset: "USD", AssetPrice: 60000000, Scale: 6 },
    ]);
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "2",
      "--price-data", priceData,
      "--provider", "pyth",
      "--asset-class", "currency",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("updates an oracle price (uses same document-id)", () => {
    // First create
    const createResult = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "3",
      "--price", "XRP/USD:5000:6",
      "--provider", "chainlink",
      "--asset-class", "currency",
      "--seed", oracle.seed!,
    ]);
    expect(createResult.status, `stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    // Then update
    const updateResult = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "3",
      "--price", "XRP/USD:5500:6",
      "--seed", oracle.seed!,
    ]);
    expect(updateResult.status, `stdout: ${updateResult.stdout} stderr: ${updateResult.stderr}`).toBe(0);
    expect(updateResult.stdout).toContain("tesSUCCESS");
  });

  it("--last-update-time override is accepted", () => {
    const ts = Math.floor(Date.now() / 1000);
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "4",
      "--price", "SOL/USD:200000:6",
      "--provider", "test",
      "--asset-class", "currency",
      "--last-update-time", String(ts),
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json outputs structured JSON", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "5",
      "--price", "BTC/USD:155000:6",
      "--provider", "pyth",
      "--asset-class", "currency",
      "--json",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  });

  it("--dry-run prints tx_blob and tx without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "6",
      "--price", "BTC/USD:155000:6",
      "--provider", "pyth",
      "--asset-class", "currency",
      "--dry-run",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; OracleDocumentID: number } };
    expect(out.tx.TransactionType).toBe("OracleSet");
    expect(out.tx.OracleDocumentID).toBe(6);
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait exits 0 and outputs a hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "7",
      "--price", "BTC/USD:155000:6",
      "--provider", "pyth",
      "--asset-class", "currency",
      "--no-wait",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--provider-hex sets provider without encoding", () => {
    // "pyth" in hex
    const pythHex = Buffer.from("pyth").toString("hex");
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "8",
      "--price", "BTC/USD:155000:6",
      "--provider-hex", pythHex,
      "--asset-class", "currency",
      "--dry-run",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Provider?: string } };
    expect(out.tx.Provider?.toUpperCase()).toBe(pythHex.toUpperCase());
  });

  it("--asset-class-hex sets asset class without encoding", () => {
    // "currency" in hex
    const currencyHex = Buffer.from("currency").toString("hex");
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "9",
      "--price", "BTC/USD:155000:6",
      "--provider", "pyth",
      "--asset-class-hex", currencyHex,
      "--dry-run",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { AssetClass?: string } };
    expect(out.tx.AssetClass?.toUpperCase()).toBe(currencyHex.toUpperCase());
  });

  it("price pair without scale defaults to Scale 0 in dry-run", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "10",
      "--price", "BTC/USD:155000",
      "--provider", "pyth",
      "--asset-class", "currency",
      "--dry-run",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx: { PriceDataSeries: Array<{ PriceData: { Scale?: number } }> };
    };
    expect(out.tx.PriceDataSeries[0].PriceData.Scale).toBe(0);
  });
});
