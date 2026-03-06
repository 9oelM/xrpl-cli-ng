import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let wallet: Wallet;
let createdSequences: number[];

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    wallet = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }

  // Create 3 tickets so we have something to list
  const result = runCLI([
    "--node", "testnet",
    "ticket", "create",
    "--count", "3",
    "--seed", wallet.seed!,
    "--json",
  ]);
  if (result.status !== 0) {
    throw new Error(`ticket create failed: ${result.stderr}`);
  }
  const out = JSON.parse(result.stdout) as { sequences: number[] };
  createdSequences = out.sequences;
}, 180_000);

describe("ticket list", () => {
  it("lists tickets for an account with correct format", () => {
    const result = runCLI([
      "--node", "testnet",
      "ticket", "list",
      wallet.address,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Ticket sequence:");
    // All created sequences should appear
    for (const seq of createdSequences) {
      expect(result.stdout).toContain(`Ticket sequence: ${seq}`);
    }
  });

  it("count of listed tickets matches --count used to create", () => {
    const result = runCLI([
      "--node", "testnet",
      "ticket", "list",
      wallet.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const tickets = JSON.parse(result.stdout) as Array<{ sequence: number }>;
    expect(Array.isArray(tickets)).toBe(true);
    // At least the 3 tickets we created should be present
    expect(tickets.length).toBeGreaterThanOrEqual(3);
    for (const seq of createdSequences) {
      expect(tickets.some((t) => t.sequence === seq)).toBe(true);
    }
  });

  it("--json outputs JSON array with sequence field", () => {
    const result = runCLI([
      "--node", "testnet",
      "ticket", "list",
      wallet.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const tickets = JSON.parse(result.stdout) as Array<{ sequence: number }>;
    expect(Array.isArray(tickets)).toBe(true);
    for (const t of tickets) {
      expect(typeof t.sequence).toBe("number");
    }
  });

  it("shows 'No tickets.' for an account with none", () => {
    // Use a fresh wallet that has no tickets (the faucet wallet used here is clean)
    const freshWallet = Wallet.generate();

    // We need to fund it first so the account exists on ledger — but since we
    // only need to check the list output on an account that genuinely has no
    // tickets, we can use --dry-run of ticket create to confirm the address is
    // valid, or simply check a known fresh unfunded address returns an error.
    // Instead, fund a fresh wallet minimally via the CLI faucet command.
    const fundResult = runCLI([
      "--node", "testnet",
      "wallet", "fund",
      freshWallet.address,
    ]);
    // Fund may succeed or fail depending on faucet rate limits; skip if it fails
    if (fundResult.status !== 0) {
      return;
    }

    const result = runCLI([
      "--node", "testnet",
      "ticket", "list",
      freshWallet.address,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout.trim()).toBe("No tickets.");
  });
});
