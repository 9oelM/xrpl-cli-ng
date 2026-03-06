import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let source: Wallet;
let destination: Wallet;
let channelId: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    source = await fundFromFaucet(client);
    destination = await fundFromFaucet(client);

    // Create a channel to fund in tests
    const createResult = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "10",
      "--settle-delay", "60",
      "--seed", source.seed!,
      "--json",
    ]);
    if (createResult.status !== 0) {
      throw new Error(`channel create failed: ${createResult.stderr}`);
    }
    const createOut = JSON.parse(createResult.stdout) as { channelId: string };
    channelId = createOut.channelId;
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("channel fund", () => {
  it("funds an existing channel and verifies updated amount via account_channels", async () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "fund",
      "--channel", channelId,
      "--amount", "5",
      "--seed", source.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");

    // Verify updated amount via account_channels RPC
    const client = new Client(TESTNET_URL);
    await client.connect();
    try {
      const res = await client.request({
        command: "account_channels",
        account: source.address,
        destination_account: destination.address,
      });
      const channel = res.result.channels.find((c) => c.channel_id === channelId);
      expect(channel).toBeDefined();
      // Original 10 XRP + 5 XRP = 15 XRP = 15000000 drops
      expect(Number(channel!.amount)).toBe(Number(xrpToDrops("15")));
    } finally {
      await client.disconnect();
    }
  }, 60_000);

  it("--json outputs result in JSON", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "fund",
      "--channel", channelId,
      "--amount", "1",
      "--seed", source.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-F]{64}$/i);
  }, 60_000);

  it("--dry-run outputs PaymentChannelFund tx without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "fund",
      "--channel", channelId,
      "--amount", "2",
      "--seed", source.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; Amount: string; Channel: string };
    };
    expect(out.tx.TransactionType).toBe("PaymentChannelFund");
    expect(out.tx.Amount).toBe("2000000");
    expect(out.tx.Channel).toBe(channelId.toUpperCase());
    expect(typeof out.tx_blob).toBe("string");
  }, 60_000);

  it("--expiration sets Expiration in dry-run", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const result = runCLI([
      "--node", "testnet",
      "channel", "fund",
      "--channel", channelId,
      "--amount", "1",
      "--expiration", futureDate,
      "--seed", source.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Expiration?: number } };
    expect(typeof out.tx.Expiration).toBe("number");
    expect(out.tx.Expiration).toBeGreaterThan(0);
  }, 60_000);

  it("--no-wait exits 0 and outputs a 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "fund",
      "--channel", channelId,
      "--amount", "1",
      "--seed", source.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 60_000);
});
