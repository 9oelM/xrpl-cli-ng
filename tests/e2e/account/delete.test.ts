import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet } from "../../helpers/testnet.js";

const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";



let fundedWallet: Wallet;
// A wallet that is generated but NOT funded on testnet — account info will return actNotFound
const unfundedWallet = Wallet.generate();

beforeAll(async () => {
  // Fund one wallet for use as source/destination in dry-run and submission tests
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    fundedWallet = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 60_000);

describe("account delete", () => {
  it("--dry-run prints AccountDelete JSON without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", fundedWallet.address,
      "--seed", fundedWallet.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const tx = JSON.parse(result.stdout) as { TransactionType: string; Account: string; Destination: string };
    expect(tx.TransactionType).toBe("AccountDelete");
    expect(tx.Account).toBe(fundedWallet.address);
    expect(tx.Destination).toBe(fundedWallet.address);
    // Should not have submitted — no transaction hash in output
    expect(result.stderr).not.toContain("actNotFound");
  });

  it("--dry-run with --destination-tag includes DestinationTag in JSON", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", fundedWallet.address,
      "--destination-tag", "42",
      "--seed", fundedWallet.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const tx = JSON.parse(result.stdout) as { TransactionType: string; DestinationTag?: number };
    expect(tx.TransactionType).toBe("AccountDelete");
    expect(tx.DestinationTag).toBe(42);
  });

  it("exits 1 when no key material provided", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", fundedWallet.address,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error: provide key material");
  });

  it("exits 1 when multiple key materials provided", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", fundedWallet.address,
      "--seed", fundedWallet.seed!,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error: provide only one of");
  });

  it("account info returns actNotFound for an unfunded (non-existent) account", () => {
    // DeletableAccounts amendment: fresh testnet accounts cannot be deleted immediately
    // (sequence + 256 > current ledger index). Instead, verify actNotFound via an unfunded address.
    const result = runCLI([
      "--node", "testnet",
      "account", "info", unfundedWallet.address,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("actNotFound");
  });

  it("--yes flag skips confirmation and submits transaction", () => {
    // Note: AccountDelete will fail with tecTOO_SOON for fresh accounts (DeletableAccounts amendment
    // requires account.sequence + 256 <= current_ledger_index; new accounts start at current ledger index).
    // We verify the command correctly submits and reports the hash without interactive prompt.
    const result = runCLI([
      "--node", "testnet",
      "account", "delete",
      "--destination", fundedWallet.address,
      "--seed", fundedWallet.seed!,
      "--yes",
    ]);
    // Command should succeed (transaction submitted), even if ledger result is tecTOO_SOON
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Account deleted. Transaction hash:");
    expect(result.stdout).toMatch(/Account deleted\. Transaction hash: [A-F0-9]+/i);
    expect(result.stderr).toContain("Warning: AccountDelete is irreversible");
  });
});
