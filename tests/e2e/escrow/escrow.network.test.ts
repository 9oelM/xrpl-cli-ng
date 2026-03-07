import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import {
  XRPL_WS,
  fundMaster,
  initTicketPool,
  createFunded,
} from "../helpers/fund.js";

// PREIMAGE-SHA-256 condition for a 32-byte zero preimage
// SHA-256(0x00 * 32) = 66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925
const TEST_CONDITION =
  "A025802066687AADF862BD776C8FC18B8E9F8E20089714856EE233B3902A591D0D5F2925810120";

// Fulfillment: preimage is 32 zero bytes
const TEST_FULFILLMENT =
  "A02280200000000000000000000000000000000000000000000000000000000000000000";

// Ticket count: 2 wallets (sender + receiver funded once)
const TICKET_COUNT = 5;

let client: Client;
let master: Wallet;

// Shared sender / receiver — used across escrow subcommand tests.
// Each finish/cancel test uses a distinct escrow sequence so tests don't
// interfere with each other.
let sender: Wallet;
let receiver: Wallet;

// Escrow sequences pre-created in beforeAll for finish tests
let finishTimeSeq1: number;
let finishCondSeq: number;
let finishJsonSeq: number;
let finishNoWaitSeq: number;
let finishAccountSeq: number;

// Escrow sequences pre-created in beforeAll for cancel tests
let cancelBasicSeq: number;
let cancelJsonSeq: number;
let cancelNoWaitSeq: number;
let cancelAccountSeq: number;

// Escrow sequence for list test
let listEscrowSeq: number;

beforeAll(async () => {
  client = new Client(XRPL_WS);
  await client.connect();
  master = await fundMaster(client);
  await initTicketPool(client, master, TICKET_COUNT);

  // Fund sender with 30 XRP: testnet base_reserve=1 XRP, owner_reserve=0.2 XRP per object.
  // 10 escrows × (2 XRP lock + 0.2 owner reserve) + 5 test-body creates × (1 XRP + 0.2) ≈ 28 XRP.
  // 30 XRP leaves 2 XRP buffer. Receiver needs only base reserve + fees.
  [sender, receiver] = await createFunded(client, master, 2, 30);

  // ------------------------------------------------------------------
  // Pre-create escrows for escrow finish tests
  // FinishAfter = +30s from submission so they're releasable after a 35s wait
  // ------------------------------------------------------------------
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

  finishTimeSeq1 = createTimeEscrow();
  finishJsonSeq = createTimeEscrow();
  finishNoWaitSeq = createTimeEscrow();
  finishAccountSeq = createTimeEscrow();

  // Condition-based escrow (no FinishAfter; CancelAfter far future)
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
  finishCondSeq = (JSON.parse(condResult.stdout) as { sequence: number }).sequence;

  // ------------------------------------------------------------------
  // Pre-create escrows for escrow cancel tests
  // FinishAfter = +60s, CancelAfter = +90s — wait 100s so CancelAfter passes
  // ------------------------------------------------------------------
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

  cancelBasicSeq = createCancelEscrow();
  cancelJsonSeq = createCancelEscrow();
  cancelNoWaitSeq = createCancelEscrow();
  cancelAccountSeq = createCancelEscrow();

  // ------------------------------------------------------------------
  // Pre-create escrow for list test (far-future FinishAfter — never expires)
  // ------------------------------------------------------------------
  const listResult = runCLI([
    "--node", "testnet",
    "escrow", "create",
    "--to", receiver.address,
    "--amount", "1",
    "--finish-after", new Date(Date.now() + 300_000).toISOString(),
    "--seed", sender.seed!,
    "--json",
  ]);
  if (listResult.status !== 0) {
    throw new Error(`Failed to create list escrow: ${listResult.stderr}`);
  }
  const listOut = JSON.parse(listResult.stdout) as { sequence: number; result: string };
  listEscrowSeq = listOut.sequence;

  // Wait for FinishAfter (finish escrows: 30s) and CancelAfter (cancel escrows: 90s)
  // 100s covers both
  await new Promise((r) => setTimeout(r, 100_000));
}, 360_000);

afterAll(async () => {
  await client.disconnect();
});

// ---------------------------------------------------------------------------
// escrow create
// ---------------------------------------------------------------------------
describe("escrow create", () => {
  it("creates a time-based escrow with near-future FinishAfter and prints tesSUCCESS + sequence", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", new Date(Date.now() + 15_000).toISOString(),
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toMatch(/Sequence:/);
  }, 30_000);

  it("creates an escrow with --cancel-after and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", new Date(Date.now() + 15_000).toISOString(),
      "--cancel-after", new Date(Date.now() + 300_000).toISOString(),
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 30_000);

  it("--json output includes hash, result, sequence fields", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", new Date(Date.now() + 15_000).toISOString(),
      "--seed", sender.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; sequence: number; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toHaveLength(64);
    expect(typeof out.sequence).toBe("number");
  }, 30_000);

  it("--dry-run outputs JSON with TransactionType EscrowCreate and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "2",
      "--finish-after", new Date(Date.now() + 600_000).toISOString(),
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
      "--finish-after", new Date(Date.now() + 15_000).toISOString(),
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 30_000);

  it("--destination-tag appears in dry-run tx", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--finish-after", new Date(Date.now() + 600_000).toISOString(),
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
      "--finish-after", new Date(Date.now() + 600_000).toISOString(),
      "--source-tag", "99",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { SourceTag?: number } };
    expect(out.tx.SourceTag).toBe(99);
  });

  it("--condition + --cancel-after appears in dry-run tx", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "create",
      "--to", receiver.address,
      "--amount", "1",
      "--condition", TEST_CONDITION,
      "--cancel-after", new Date(Date.now() + 600_000).toISOString(),
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
        "--finish-after", new Date(Date.now() + 15_000).toISOString(),
        "--account", sender.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------
// escrow finish
// ---------------------------------------------------------------------------
describe("escrow finish", () => {
  it("finishes a time-based escrow and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", String(finishTimeSeq1),
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 30_000);

  it("finishes a crypto-condition escrow with --condition and --fulfillment", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", String(finishCondSeq),
      "--condition", TEST_CONDITION,
      "--fulfillment", TEST_FULFILLMENT,
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 30_000);

  it("--json output includes hash, result, fee, ledger", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", String(finishJsonSeq),
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
  }, 30_000);

  it("--no-wait exits 0 and output contains 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "finish",
      "--owner", sender.address,
      "--sequence", String(finishNoWaitSeq),
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 30_000);

  it("--dry-run outputs JSON with TransactionType EscrowFinish and does not submit", () => {
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
        "--sequence", String(finishAccountSeq),
        "--account", sender.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------
// escrow cancel
// ---------------------------------------------------------------------------
describe("escrow cancel", () => {
  it("cancels an expired escrow and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "cancel",
      "--owner", sender.address,
      "--sequence", String(cancelBasicSeq),
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 30_000);

  it("--json output includes hash, result, fee, ledger", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "cancel",
      "--owner", sender.address,
      "--sequence", String(cancelJsonSeq),
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
  }, 30_000);

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
      "--sequence", String(cancelNoWaitSeq),
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 30_000);

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
        "--sequence", String(cancelAccountSeq),
        "--account", sender.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------
// escrow list
// ---------------------------------------------------------------------------
describe("escrow list", () => {
  it("lists pending escrows and shows sequence + amount + destination", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "list",
      sender.address,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Sequence:    ${listEscrowSeq}`);
    expect(result.stdout).toContain("1.000000 XRP");
    expect(result.stdout).toContain(receiver.address);
  }, 30_000);

  it("--json outputs an array with the expected escrow entry", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "list",
      sender.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const arr = JSON.parse(result.stdout) as Array<{
      sequence: number;
      amount: string;
      destination: string;
      finishAfter: string;
      cancelAfter: string;
      condition: string;
    }>;
    expect(Array.isArray(arr)).toBe(true);
    const entry = arr.find((e) => e.sequence === listEscrowSeq);
    expect(entry).toBeDefined();
    expect(entry!.amount).toBe("1.000000");
    expect(entry!.destination).toBe(receiver.address);
    expect(entry!.finishAfter).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry!.cancelAfter).toBe("none");
    expect(entry!.condition).toBe("none");
  }, 30_000);
});
