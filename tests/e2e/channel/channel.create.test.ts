import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let source: Wallet;
let destination: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    source = await fundFromFaucet(client);
    destination = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("channel create", () => {
  it("creates a channel and outputs channel ID", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "10",
      "--settle-delay", "60",
      "--seed", source.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toMatch(/Channel ID:\s+[0-9A-F]{64}/i);
  });

  it("--json outputs channelId in JSON", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "5",
      "--settle-delay", "120",
      "--seed", source.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      hash: string;
      result: string;
      channelId: string;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.channelId).toMatch(/^[0-9A-F]{64}$/i);
  });

  it("--dry-run outputs TransactionType PaymentChannelCreate without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "5",
      "--settle-delay", "60",
      "--seed", source.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; Amount: string; SettleDelay: number };
    };
    expect(out.tx.TransactionType).toBe("PaymentChannelCreate");
    expect(typeof out.tx_blob).toBe("string");
    expect(out.tx.Amount).toBe("5000000");
    expect(out.tx.SettleDelay).toBe(60);
  });

  it("--cancel-after sets CancelAfter epoch in dry-run", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const result = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "5",
      "--settle-delay", "60",
      "--cancel-after", futureDate,
      "--seed", source.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx: { CancelAfter?: number };
    };
    expect(typeof out.tx.CancelAfter).toBe("number");
    expect(out.tx.CancelAfter).toBeGreaterThan(0);
  });

  it("--destination-tag sets DestinationTag in dry-run", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "5",
      "--settle-delay", "60",
      "--destination-tag", "42",
      "--seed", source.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { DestinationTag?: number } };
    expect(out.tx.DestinationTag).toBe(42);
  });

  it("--public-key overrides derived public key in dry-run", () => {
    // Use the source wallet's own public key as the explicit value
    const pubKey = source.publicKey;
    const result = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "5",
      "--settle-delay", "60",
      "--public-key", pubKey,
      "--seed", source.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { PublicKey: string } };
    expect(out.tx.PublicKey).toBe(pubKey);
  });

  it("--no-wait exits 0 and output contains a 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "5",
      "--settle-delay", "60",
      "--seed", source.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });
});
