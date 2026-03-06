import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let fundedWallet: Wallet;
let destWallet: Wallet;
// A wallet that is generated but NOT funded on testnet — account info will return actNotFound
const unfundedWallet = Wallet.generate();

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    fundedWallet = await fundFromFaucet(client);
    destWallet = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 120_000);

describe("account delete", () => {
  it("--dry-run prints AccountDelete JSON without submitting (no --confirm required)", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", destWallet.address,
      "--seed", fundedWallet.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const tx = JSON.parse(result.stdout) as {
      TransactionType: string;
      Account: string;
      Destination: string;
    };
    expect(tx.TransactionType).toBe("AccountDelete");
    expect(tx.Account).toBe(fundedWallet.address);
    expect(tx.Destination).toBe(destWallet.address);
  });

  it("--dry-run with --destination-tag includes DestinationTag in JSON", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", destWallet.address,
      "--destination-tag", "42",
      "--seed", fundedWallet.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const tx = JSON.parse(result.stdout) as { TransactionType: string; DestinationTag?: number };
    expect(tx.TransactionType).toBe("AccountDelete");
    expect(tx.DestinationTag).toBe(42);
  });

  it("--no-wait with --confirm submits and returns a 64-char hex hash", () => {
    // AccountDelete will likely fail with tecTOO_SOON for fresh accounts
    // (DeletableAccounts: sequence + 256 <= current ledger index).
    // We verify the command correctly submits and returns a hash without waiting for validation.
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", destWallet.address,
      "--seed", fundedWallet.seed!,
      "--confirm",
      "--no-wait",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--json with --confirm and --no-wait outputs JSON with hash field", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", destWallet.address,
      "--seed", destWallet.seed!,
      "--confirm",
      "--no-wait",
      "--json",
    ]);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string };
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
  });

  it("account info returns actNotFound for a non-existent (unfunded) account", () => {
    // Proxy test for "account no longer exists" — DeletableAccounts requires 256 ledgers
    // before an account can actually be deleted from testnet.
    const result = runCLI([
      "--node", "testnet",
      "account", "info", unfundedWallet.address,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("actNotFound");
  });
});
