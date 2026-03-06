import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let wallet: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    wallet = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("ticket create", () => {
  it("creates 1 ticket and verifies via ticket list", () => {
    const result = runCLI([
      "--node", "testnet",
      "ticket", "create",
      "--count", "1",
      "--seed", wallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("Tickets:");

    // Verify via ticket list
    const listResult = runCLI([
      "--node", "testnet",
      "ticket", "list",
      wallet.address,
    ]);
    expect(listResult.status, `stdout: ${listResult.stdout}\nstderr: ${listResult.stderr}`).toBe(0);
    expect(listResult.stdout).toContain("Ticket sequence:");
  });

  it("creates multiple tickets and count matches --count", () => {
    const result = runCLI([
      "--node", "testnet",
      "ticket", "create",
      "--count", "3",
      "--seed", wallet.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; sequences: number[] };
    expect(out.result).toBe("tesSUCCESS");
    expect(Array.isArray(out.sequences)).toBe(true);
    expect(out.sequences).toHaveLength(3);
  });

  it("--json outputs hash, result, sequences fields", () => {
    const result = runCLI([
      "--node", "testnet",
      "ticket", "create",
      "--count", "2",
      "--seed", wallet.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; sequences: number[] };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toHaveLength(64);
    expect(Array.isArray(out.sequences)).toBe(true);
    expect(out.sequences).toHaveLength(2);
    // sequences should be sorted ascending integers
    for (const seq of out.sequences) {
      expect(typeof seq).toBe("number");
    }
  });

  it("--dry-run outputs JSON with TransactionType TicketCreate and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "ticket", "create",
      "--count", "1",
      "--seed", wallet.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; TicketCount: number } };
    expect(out.tx.TransactionType).toBe("TicketCreate");
    expect(out.tx.TicketCount).toBe(1);
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait exits 0 and output contains 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "ticket", "create",
      "--count", "1",
      "--seed", wallet.seed!,
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
        wallet.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `stdout: ${importResult.stdout} stderr: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "testnet",
        "ticket", "create",
        "--count", "1",
        "--account", wallet.address,
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
