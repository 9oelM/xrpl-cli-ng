import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import type { AccountRoot } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

// lsfAllowTrustLineClawback = 0x80000000
const LSF_ALLOW_TRUST_LINE_CLAWBACK = 0x80000000;

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

describe("account set --allow-clawback", () => {
  it("exits 1 with correct error message when --allow-clawback is used without --confirm", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--allow-clawback",
      "--seed", "snoPBrXtMeMyMHUVTgbuqAfg1SUTb",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "--allow-clawback is irreversible. Once enabled it cannot be disabled. To proceed, add --confirm to your command."
    );
  });

  it("sets lsfAllowTrustLineClawback on-chain when --allow-clawback --confirm are both provided", async () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--allow-clawback",
      "--confirm",
      "--seed", testWallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    // Wait for ledger to validate
    await new Promise((res) => setTimeout(res, 10_000));

    const infoResult = runCLI(["--node", "testnet", "account", "info", "--json", testWallet.address]);
    expect(infoResult.status, `stdout: ${infoResult.stdout} stderr: ${infoResult.stderr}`).toBe(0);
    const data = JSON.parse(infoResult.stdout) as AccountRoot;
    expect(data.Flags! & LSF_ALLOW_TRUST_LINE_CLAWBACK).not.toBe(0);
  }, 60_000);
});
