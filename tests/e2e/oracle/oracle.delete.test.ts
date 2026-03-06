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

describe("oracle delete", () => {
  it("creates then deletes an oracle; get returns not-found", () => {
    // Create oracle
    const createResult = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:155000:6",
      "--provider", "pyth",
      "--asset-class", "currency",
      "--seed", oracle.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);
    expect(createResult.stdout).toContain("tesSUCCESS");

    // Delete oracle
    const deleteResult = runCLI([
      "--node", "testnet",
      "oracle", "delete",
      "--document-id", "1",
      "--seed", oracle.seed!,
    ]);
    expect(deleteResult.status, `delete stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");

    // Verify oracle is gone
    const getResult = runCLI([
      "--node", "testnet",
      "oracle", "get",
      oracle.address,
      "1",
    ]);
    expect(getResult.status).toBe(1);
    expect(getResult.stderr).toMatch(/error|not found|entryNotFound/i);
  });

  it("--json outputs structured JSON on delete", () => {
    // Create oracle first
    const createResult = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "2",
      "--price", "ETH/USD:3000:3",
      "--provider", "pyth",
      "--asset-class", "currency",
      "--seed", oracle.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    // Delete with --json
    const deleteResult = runCLI([
      "--node", "testnet",
      "oracle", "delete",
      "--document-id", "2",
      "--json",
      "--seed", oracle.seed!,
    ]);
    expect(deleteResult.status, `delete stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    const out = JSON.parse(deleteResult.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  });

  it("--dry-run on delete prints tx_blob without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "oracle", "delete",
      "--document-id", "99",
      "--dry-run",
      "--seed", oracle.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; OracleDocumentID: number } };
    expect(out.tx.TransactionType).toBe("OracleDelete");
    expect(out.tx.OracleDocumentID).toBe(99);
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait on delete exits 0 and outputs hash", () => {
    // Create oracle first
    const createResult = runCLI([
      "--node", "testnet",
      "oracle", "set",
      "--document-id", "3",
      "--price", "XRP/USD:5000:6",
      "--provider", "test",
      "--asset-class", "currency",
      "--seed", oracle.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    const deleteResult = runCLI([
      "--node", "testnet",
      "oracle", "delete",
      "--document-id", "3",
      "--no-wait",
      "--seed", oracle.seed!,
    ]);
    expect(deleteResult.status, `stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });
});
