import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    issuer = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("mptoken issuance create", () => {
  it("creates a basic issuance and prints MPTokenIssuanceID", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("MPTokenIssuanceID:");
  });

  it("creates an issuance with flags and transfer fee", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--flags", "can-transfer,can-clawback",
      "--transfer-fee", "500",
      "--max-amount", "1000000000",
      "--asset-scale", "6",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("MPTokenIssuanceID:");

    // Extract issuance ID and verify with get
    const idMatch = result.stdout.match(/MPTokenIssuanceID:\s+([0-9A-Fa-f]+)/);
    expect(idMatch).toBeTruthy();
    const issuanceId = idMatch![1];

    const getResult = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "get",
      issuanceId,
      "--json",
    ]);
    expect(getResult.status, `stdout: ${getResult.stdout} stderr: ${getResult.stderr}`).toBe(0);
    const entry = JSON.parse(getResult.stdout) as {
      node: {
        TransferFee: number;
        AssetScale: number;
        MaximumAmount: string;
      };
    };
    expect(entry.node.TransferFee).toBe(500);
    expect(entry.node.AssetScale).toBe(6);
    expect(entry.node.MaximumAmount).toBe("1000000000");
  }, 90_000);

  it("creates an issuance with --metadata and verifies via get", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--metadata", "test-token-metadata",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("MPTokenIssuanceID:");

    // Extract issuance ID and verify metadata via get
    const idMatch = result.stdout.match(/MPTokenIssuanceID:\s+([0-9A-Fa-f]+)/);
    expect(idMatch).toBeTruthy();
    const issuanceId = idMatch![1];

    const getResult = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "get",
      issuanceId,
    ]);
    expect(getResult.status, `stdout: ${getResult.stdout} stderr: ${getResult.stderr}`).toBe(0);
    expect(getResult.stdout).toContain("test-token-metadata");
  }, 90_000);

  it("--json outputs hash, result, fee, ledger, issuanceId", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--seed", issuer.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
      issuanceId: string;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
    expect(typeof out.issuanceId).toBe("string");
    expect(out.issuanceId).toMatch(/^[0-9A-Fa-f]+$/i);
  });

  it("--dry-run outputs JSON with TransactionType MPTokenIssuanceCreate", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("MPTokenIssuanceCreate");
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait submits without waiting and outputs transaction hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--seed", issuer.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  });
});
