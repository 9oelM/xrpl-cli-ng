import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import type { AccountRoot } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";



let testWallet: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    testWallet = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("account set fields", () => {
  it("--email-hash sets EmailHash on-chain", async () => {
    // 32 hex chars = 16 bytes (MD5 hash size)
    const emailHash = "AABBCCDDEEFF00112233445566778899";

    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--email-hash", emailHash,
      "--seed", testWallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    // Wait for ledger confirmation (~3-4s on testnet, use 10s for safety)
    await sleep(10_000);

    const infoResult = runCLI(["--node", "testnet", "account", "info", "--json", testWallet.address]);
    expect(infoResult.status, `stdout: ${infoResult.stdout} stderr: ${infoResult.stderr}`).toBe(0);
    const data = JSON.parse(infoResult.stdout) as AccountRoot;
    expect(data.EmailHash?.toUpperCase()).toBe(emailHash.toUpperCase());
  }, 60_000);

  it("--transfer-rate sets TransferRate on-chain", async () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--transfer-rate", "1005000000",
      "--seed", testWallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    await sleep(10_000);

    const infoResult = runCLI(["--node", "testnet", "account", "info", "--json", testWallet.address]);
    expect(infoResult.status, `stdout: ${infoResult.stdout} stderr: ${infoResult.stderr}`).toBe(0);
    const data = JSON.parse(infoResult.stdout) as AccountRoot;
    expect(data.TransferRate).toBe(1005000000);
  }, 60_000);

  it("--tick-size sets TickSize on-chain", async () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--tick-size", "5",
      "--seed", testWallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    await sleep(10_000);

    const infoResult = runCLI(["--node", "testnet", "account", "info", "--json", testWallet.address]);
    expect(infoResult.status, `stdout: ${infoResult.stdout} stderr: ${infoResult.stderr}`).toBe(0);
    const data = JSON.parse(infoResult.stdout) as AccountRoot;
    expect(data.TickSize).toBe(5);
  }, 60_000);
});
