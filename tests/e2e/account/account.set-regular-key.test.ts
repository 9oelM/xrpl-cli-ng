import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet } from "../../helpers/testnet.js";

const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";

let accountWallet: Wallet;
let regularKeyWallet: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    // Fund two wallets: one as the account under test, one as the regular key
    [accountWallet, regularKeyWallet] = await Promise.all([
      fundFromFaucet(client),
      fundFromFaucet(client),
    ]);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("account set-regular-key", () => {
  it("sets a regular key and transaction hash is returned", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set-regular-key",
      "--key", regularKeyWallet.address,
      "--seed", accountWallet.seed!,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Transaction submitted:");
    expect(result.stdout).toMatch(/Transaction submitted: [A-F0-9]+/i);
  });

  it("account info shows Regular Key after setting it", async () => {
    // Wait for ledger to include the transaction
    await new Promise<void>((res) => setTimeout(res, 8_000));

    const result = runCLI([
      "--node", "testnet",
      "account", "info", accountWallet.address,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Regular Key:");
    expect(result.stdout).toContain(regularKeyWallet.address);
  });

  it("removes the regular key and transaction hash is returned", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set-regular-key",
      "--remove",
      "--seed", accountWallet.seed!,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Transaction submitted:");
  });

  it("account info does not show Regular Key after removing it", async () => {
    // Wait for ledger to include the transaction
    await new Promise<void>((res) => setTimeout(res, 8_000));

    const result = runCLI([
      "--node", "testnet",
      "account", "info", accountWallet.address,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("Regular Key:");
  });

  it("--json outputs hash, result, tx_blob", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set-regular-key",
      "--key", regularKeyWallet.address,
      "--seed", accountWallet.seed!,
      "--json",
    ]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { hash: string; result: string; tx_blob: string };
    expect(typeof data.hash).toBe("string");
    expect(data.hash.length).toBeGreaterThan(0);
    expect(typeof data.tx_blob).toBe("string");
  });

  it("--no-wait submits without waiting for validation", () => {
    // Remove the regular key with --no-wait (re-set it first via a prior test run cleanup)
    const result = runCLI([
      "--node", "testnet",
      "account", "set-regular-key",
      "--remove",
      "--seed", accountWallet.seed!,
      "--no-wait",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Transaction submitted:");
  });

  it("--dry-run prints SetRegularKey JSON without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set-regular-key",
      "--key", regularKeyWallet.address,
      "--seed", accountWallet.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const tx = JSON.parse(result.stdout) as { TransactionType: string; Account: string; RegularKey: string };
    expect(tx.TransactionType).toBe("SetRegularKey");
    expect(tx.Account).toBe(accountWallet.address);
    expect(tx.RegularKey).toBe(regularKeyWallet.address);
  });
});
