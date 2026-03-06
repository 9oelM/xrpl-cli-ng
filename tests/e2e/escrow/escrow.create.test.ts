import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

// A PREIMAGE-SHA-256 condition for a 32-byte zero preimage (for dry-run tests)
// SHA-256(0x00 * 32) = 66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925
const TEST_CONDITION =
  "A025802066687AADF862BD776C8FC18B8E9F8E20089714856EE233B3902A591D0D5F2925810120";

// Timestamp ~15 seconds in the future (small enough to be releasable quickly in finish tests)
function nearFutureIso(): string {
  return new Date(Date.now() + 15_000).toISOString();
}

// Timestamp in the future
function futureIso(secondsAhead = 120): string {
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

describe("escrow create", () => {
  it("creates a time-based escrow with near-future FinishAfter and prints tesSUCCESS + sequence", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", nearFutureIso(),
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toMatch(/Sequence:/);
  });

  it("creates an escrow with --cancel-after and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", nearFutureIso(),
      "--cancel-after", futureIso(300),
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json output includes hash, result, sequence fields", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", nearFutureIso(),
      "--seed", sender.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; sequence: number; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toHaveLength(64);
    expect(typeof out.sequence).toBe("number");
  });

  it("--dry-run outputs JSON with TransactionType EscrowCreate and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "2",
      "--finish-after", futureIso(600),
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; Amount: string; FinishAfter: number } };
    expect(out.tx.TransactionType).toBe("EscrowCreate");
    expect(typeof out.tx_blob).toBe("string");
    expect(out.tx.Amount).toBe("2000000");
    expect(typeof out.tx.FinishAfter).toBe("number");
  });

  it("--no-wait exits 0 and output contains 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", nearFutureIso(),
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--destination-tag appears in dry-run tx", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", futureIso(600),
      "--destination-tag", "42",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { DestinationTag?: number } };
    expect(out.tx.DestinationTag).toBe(42);
  });

  it("--source-tag appears in dry-run tx", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", futureIso(600),
      "--source-tag", "99",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { SourceTag?: number } };
    expect(out.tx.SourceTag).toBe(99);
  });

  it("--condition + --cancel-after appears in dry-run tx", () => {
    // xrpl.js requires at least FinishAfter or CancelAfter alongside Condition
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--condition", TEST_CONDITION,
      "--cancel-after", futureIso(600),
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Condition?: string; CancelAfter?: number } };
    expect(out.tx.Condition).toBe(TEST_CONDITION);
    expect(typeof out.tx.CancelAfter).toBe("number");
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
        "escrow", "create",
        "--to", receiver.address,
        "--amount", "1",
        "--finish-after", nearFutureIso(),
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
