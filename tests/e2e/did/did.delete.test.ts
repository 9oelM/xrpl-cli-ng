import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let owner: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    owner = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("did delete", () => {
  it("creates DID then deletes it; did get returns not-found", () => {
    // Create DID
    const createResult = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/delete-test",
      "--seed", owner.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);
    expect(createResult.stdout).toContain("tesSUCCESS");

    // Delete DID
    const deleteResult = runCLI([
      "--node", "testnet",
      "did", "delete",
      "--seed", owner.seed!,
    ]);
    expect(deleteResult.status, `delete stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");

    // Verify DID is gone
    const getResult = runCLI([
      "--node", "testnet",
      "did", "get",
      owner.address,
    ]);
    expect(getResult.status).toBe(0);
    expect(getResult.stdout).toContain(`No DID found for ${owner.address}`);
  }, 90_000);

  it("--json outputs structured result on delete", () => {
    // Create DID first
    const createResult = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/json-delete",
      "--seed", owner.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const deleteResult = runCLI([
      "--node", "testnet",
      "did", "delete",
      "--json",
      "--seed", owner.seed!,
    ]);
    expect(deleteResult.status, `delete stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    const out = JSON.parse(deleteResult.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  }, 90_000);

  it("--dry-run prints tx_blob without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "delete",
      "--dry-run",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("DIDDelete");
    expect(typeof out.tx_blob).toBe("string");
  }, 30_000);

  it("--no-wait exits 0 with a hash", () => {
    // Create DID first to have something to delete
    runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/nowait-delete",
      "--seed", owner.seed!,
    ]);

    const result = runCLI([
      "--node", "testnet",
      "did", "delete",
      "--no-wait",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 90_000);
});
