import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

// PREIMAGE-SHA-256 condition for a 32-byte zero preimage
// SHA-256(0x00 * 32) = 66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925
const TEST_CONDITION =
  "A025802066687AADF862BD776C8FC18B8E9F8E20089714856EE233B3902A591D0D5F2925810120";

// Fulfillment: preimage is 32 zero bytes
// A0 (tag) 22 (34 bytes) 80 (primitive tag 0) 20 (32 bytes) + 32 zero bytes
const TEST_FULFILLMENT =
  "A02280200000000000000000000000000000000000000000000000000000000000000000";

let sender: Wallet;
let receiver: Wallet;

// Sequences of escrows created in beforeAll
let timeEscrowSequence: number;
let condEscrowSequence: number;
let jsonEscrowSequence: number;
let noWaitEscrowSequence: number;
let accountEscrowSequence: number;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    sender = await fundFromFaucet(client);
    receiver = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }

  // Compute finishAfter fresh at call time so it's always 30s ahead of submission
  function createTimeEscrow(): number {
    const fa = new Date(Date.now() + 30_000).toISOString();
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "2",
      "--finish-after", fa,
      "--seed", sender.seed!,
      "--json",
    ]);
    if (result.status !== 0) {
      throw new Error(`Failed to create time escrow: ${result.stderr}`);
    }
    return (JSON.parse(result.stdout) as { sequence: number }).sequence;
  }

  // Create 4 time-based escrows (one per test that needs its own)
  timeEscrowSequence = createTimeEscrow();
  jsonEscrowSequence = createTimeEscrow();
  noWaitEscrowSequence = createTimeEscrow();
  accountEscrowSequence = createTimeEscrow();

  // Create 1 condition-based escrow (no FinishAfter; CancelAfter far future)
  const condResult = runCLI([
    "--node", "testnet",
    "escrow", "create",
    "--to", receiver.address,
    "--amount", "2",
    "--condition", TEST_CONDITION,
    "--cancel-after", new Date(Date.now() + 600_000).toISOString(),
    "--seed", sender.seed!,
    "--json",
  ]);
  if (condResult.status !== 0) {
    throw new Error(`Failed to create condition escrow: ${condResult.stderr}`);
  }
  condEscrowSequence = (JSON.parse(condResult.stdout) as { sequence: number }).sequence;

  // Wait for FinishAfter to pass on all time-based escrows (35s from last create)
  await new Promise((r) => setTimeout(r, 35_000));
}, 300_000);

describe("escrow finish", () => {
  it("finishes a time-based escrow and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", String(timeEscrowSequence),
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("finishes a crypto-condition escrow with --condition and --fulfillment", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", String(condEscrowSequence),
      "--condition", TEST_CONDITION,
      "--fulfillment", TEST_FULFILLMENT,
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json output includes hash, result, fee, ledger", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", String(jsonEscrowSequence),
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

  it("--no-wait exits 0 and output contains 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", String(noWaitEscrowSequence),
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--dry-run outputs JSON with TransactionType EscrowFinish and does not submit", () => {
    // Use a dummy sequence; dry-run never submits
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", "1",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; OfferSequence: number } };
    expect(out.tx.TransactionType).toBe("EscrowFinish");
    expect(typeof out.tx_blob).toBe("string");
    expect(out.tx.OfferSequence).toBe(1);
  });

  it("--dry-run with --condition and --fulfillment sets fields in tx", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", "1",
      "--condition", TEST_CONDITION,
      "--fulfillment", TEST_FULFILLMENT,
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Condition?: string; Fulfillment?: string } };
    expect(out.tx.Condition).toBe(TEST_CONDITION);
    expect(out.tx.Fulfillment).toBe(TEST_FULFILLMENT);
  });

  it("--account/--keystore/--password key material finishes successfully", () => {
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
        "escrow", "finish",
        "--owner", sender.address,
        "--sequence", String(accountEscrowSequence),
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
