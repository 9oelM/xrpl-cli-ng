import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let sender: Wallet;
let receiver: Wallet;

// Sequence numbers for escrows created in beforeAll
let basicCancelSequence: number;
let jsonCancelSequence: number;
let noWaitCancelSequence: number;
let accountCancelSequence: number;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    sender = await fundFromFaucet(client);
    receiver = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }

  // xrpl.js requires FinishAfter (or Condition) even when CancelAfter is set.
  // The XRPL protocol also requires CancelAfter > FinishAfter.
  // Strategy: FinishAfter = +60s, CancelAfter = +90s (relative to each call).
  // After all creates, wait 100s so CancelAfter has elapsed on every escrow.
  function createCancelEscrow(): number {
    const finishAfter = new Date(Date.now() + 60_000).toISOString();
    const cancelAfter = new Date(Date.now() + 90_000).toISOString();
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "2",
      "--finish-after", finishAfter,
      "--cancel-after", cancelAfter,
      "--seed", sender.seed!,
      "--json",
    ]);
    if (result.status !== 0) {
      throw new Error(`Failed to create cancel escrow: ${result.stderr}`);
    }
    return (JSON.parse(result.stdout) as { sequence: number }).sequence;
  }

  basicCancelSequence = createCancelEscrow();
  jsonCancelSequence = createCancelEscrow();
  noWaitCancelSequence = createCancelEscrow();
  accountCancelSequence = createCancelEscrow();

  // Wait for CancelAfter to pass on all escrows (90s from each call + buffer)
  await new Promise((r) => setTimeout(r, 100_000));
}, 300_000);

describe("escrow cancel", () => {
  it("cancels an expired escrow and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "cancel",
      "--owner", sender.address,
      "--sequence", String(basicCancelSequence),
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json output includes hash, result, fee, ledger", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "cancel",
      "--owner", sender.address,
      "--sequence", String(jsonCancelSequence),
      "--seed", sender.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toHaveLength(64);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  });

  it("--dry-run outputs JSON with TransactionType EscrowCancel and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "cancel",
      "--owner", sender.address,
      "--sequence", "1",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; OfferSequence: number } };
    expect(out.tx.TransactionType).toBe("EscrowCancel");
    expect(typeof out.tx_blob).toBe("string");
    expect(out.tx.OfferSequence).toBe(1);
  });

  it("--no-wait exits 0 and output contains 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "cancel",
      "--owner", sender.address,
      "--sequence", String(noWaitCancelSequence),
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--account/--keystore/--password key material cancels successfully", () => {
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
        "escrow", "cancel",
        "--owner", sender.address,
        "--sequence", String(accountCancelSequence),
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
