import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
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

    // Create a channel so we have something to list
    const createResult = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "5",
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

describe("channel list", () => {
  it("lists channels for an account and shows the created channel", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "list",
      source.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(channelId);
    expect(result.stdout).toContain("Channel ID:");
    expect(result.stdout).toContain("Amount:");
    expect(result.stdout).toContain("Balance:");
    expect(result.stdout).toContain("Destination:");
    expect(result.stdout).toContain("Settle Delay:");
    expect(result.stdout).toContain("Expiration:");
    expect(result.stdout).toContain("Cancel After:");
    expect(result.stdout).toContain("Public Key:");
  }, 30_000);

  it("--json outputs a JSON array containing the channel", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "list",
      source.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const channels = JSON.parse(result.stdout) as Array<{ channel_id: string }>;
    expect(Array.isArray(channels)).toBe(true);
    const found = channels.find((c) => c.channel_id === channelId);
    expect(found).toBeDefined();
  }, 30_000);

  it("--destination filter returns channel when destination matches", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "list",
      source.address,
      "--destination", destination.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const channels = JSON.parse(result.stdout) as Array<{ channel_id: string; destination_account: string }>;
    expect(Array.isArray(channels)).toBe(true);
    expect(channels.every((c) => c.destination_account === destination.address)).toBe(true);
    const found = channels.find((c) => c.channel_id === channelId);
    expect(found).toBeDefined();
  }, 30_000);

  it("--destination filter with non-matching address returns empty list", () => {
    // Generate an address that has no channels from source
    const unrelated = Wallet.generate();
    const result = runCLI([
      "--node", "testnet",
      "channel", "list",
      source.address,
      "--destination", unrelated.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const channels = JSON.parse(result.stdout) as unknown[];
    expect(channels).toHaveLength(0);
  }, 30_000);
});
