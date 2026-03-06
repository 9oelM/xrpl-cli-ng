import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Payment as XrplPayment } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let owner: Wallet;
let signer1: Wallet;
let signer2: Wallet;
let signer3: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    owner = await fundFromFaucet(client);

    // Generate signer wallets (addresses only; no funding needed for signer list)
    signer1 = Wallet.generate();
    signer2 = Wallet.generate();
    signer3 = Wallet.generate();

    // Fund owner with extra XRP to cover reserve for signer list + fees
    // The faucet gives enough, but fund a second time just in case
    // (faucet gives ~1000 XRP on testnet, which is more than enough)
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("multisig set core", () => {
  it("sets a 2-of-3 signer list and verifies via multisig list", () => {
    const setResult = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "2",
      "--signer", `${signer1.address}:1`,
      "--signer", `${signer2.address}:1`,
      "--signer", `${signer3.address}:1`,
      "--seed", owner.seed!,
    ]);
    expect(setResult.status, `stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);
    expect(setResult.stdout).toContain("tesSUCCESS");

    // Verify via multisig list
    const listResult = runCLI([
      "--node", "testnet",
      "multisig", "list",
      owner.address,
    ]);
    expect(listResult.status, `stdout: ${listResult.stdout} stderr: ${listResult.stderr}`).toBe(0);
    expect(listResult.stdout).toContain("Quorum: 2");
    expect(listResult.stdout).toContain(signer1.address);
    expect(listResult.stdout).toContain(signer2.address);
    expect(listResult.stdout).toContain(signer3.address);
    expect(listResult.stdout).toContain("weight: 1");
  });

  it("updates the signer list (replace with 2-of-2)", () => {
    const setResult = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "2",
      "--signer", `${signer1.address}:1`,
      "--signer", `${signer2.address}:1`,
      "--seed", owner.seed!,
    ]);
    expect(setResult.status, `stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);
    expect(setResult.stdout).toContain("tesSUCCESS");

    // Verify updated list
    const listResult = runCLI([
      "--node", "testnet",
      "multisig", "list",
      owner.address,
    ]);
    expect(listResult.status, `stdout: ${listResult.stdout} stderr: ${listResult.stderr}`).toBe(0);
    expect(listResult.stdout).toContain("Quorum: 2");
    expect(listResult.stdout).toContain(signer1.address);
    expect(listResult.stdout).toContain(signer2.address);
    // signer3 should no longer be in the list
    expect(listResult.stdout).not.toContain(signer3.address);
  });

  it("--json outputs hash, result, fee, ledger", () => {
    const result = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "1",
      "--signer", `${signer1.address}:1`,
      "--seed", owner.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  });

  it("--dry-run outputs JSON with TransactionType SignerListSet and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "1",
      "--signer", `${signer1.address}:1`,
      "--seed", owner.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("SignerListSet");
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait submits without waiting for validation", () => {
    const result = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "1",
      "--signer", `${signer2.address}:1`,
      "--seed", owner.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  });
});

describe("multisig list core", () => {
  it("shows 'No signer list configured.' for account with no signer list", async () => {
    // Create a fresh unfunded wallet — but it won't have an account on ledger.
    // Instead fund a new one and don't set a signer list.
    const client = new Client(TESTNET_URL);
    await client.connect();
    let fresh: Wallet;
    try {
      fresh = await fundFromFaucet(client);
    } finally {
      await client.disconnect();
    }

    const result = runCLI([
      "--node", "testnet",
      "multisig", "list",
      fresh.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("No signer list configured.");
  }, 180_000);

  it("--json outputs raw JSON array", () => {
    // First ensure the owner has a signer list (from previous tests)
    const result = runCLI([
      "--node", "testnet",
      "multisig", "list",
      owner.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as unknown[];
    expect(Array.isArray(out)).toBe(true);
  });
});
