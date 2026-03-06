import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

function futureIso(secondsAhead = 300): string {
  return new Date(Date.now() + secondsAhead * 1000).toISOString();
}

let sender: Wallet;
let receiver: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    sender = await fundFromFaucet(client);
    receiver = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("check create", () => {
  it("creates an XRP check and prints tesSUCCESS + Check ID", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "create",
      "--to", receiver.address,
      "--send-max", "10",
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toMatch(/CheckId:\s+[0-9A-Fa-f]{64}/i);
  });

  it("--expiration appears in dry-run tx", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "create",
      "--to", receiver.address,
      "--send-max", "5",
      "--expiration", futureIso(600),
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { TransactionType: string; Expiration?: number } };
    expect(out.tx.TransactionType).toBe("CheckCreate");
    expect(typeof out.tx.Expiration).toBe("number");
  });

  it("--destination-tag appears in dry-run tx", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "create",
      "--to", receiver.address,
      "--send-max", "5",
      "--destination-tag", "42",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { DestinationTag?: number } };
    expect(out.tx.DestinationTag).toBe(42);
  });

  it("--invoice-id is hex-encoded in dry-run tx", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "create",
      "--to", receiver.address,
      "--send-max", "5",
      "--invoice-id", "order-123",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { InvoiceID?: string } };
    // "order-123" hex-encoded and zero-padded to 64 chars
    expect(typeof out.tx.InvoiceID).toBe("string");
    expect(out.tx.InvoiceID).toHaveLength(64);
    // Starts with hex of "order-123"
    expect(out.tx.InvoiceID!.toLowerCase()).toMatch(/^6f726465722d313233/);
  });

  it("--json output includes hash, result, checkId fields", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "create",
      "--to", receiver.address,
      "--send-max", "5",
      "--seed", sender.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; checkId: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toHaveLength(64);
    expect(typeof out.checkId).toBe("string");
    expect(out.checkId).toHaveLength(64);
  });

  it("--dry-run outputs JSON with TransactionType CheckCreate and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "create",
      "--to", receiver.address,
      "--send-max", "5",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CheckCreate");
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait exits 0 and output contains 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "create",
      "--to", receiver.address,
      "--send-max", "5",
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--account + --keystore + --password key material creates successfully", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-test-keystore-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        sender.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `stdout: ${importResult.stdout} stderr: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "testnet",
        "check", "create",
        "--to", receiver.address,
        "--send-max", "5",
        "--account", sender.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
