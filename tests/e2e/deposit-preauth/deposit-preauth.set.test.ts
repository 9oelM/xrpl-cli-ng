import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Payment as XrplPayment, AccountSet as XrplAccountSet } from "xrpl";
import { mkdtempSync, rmSync } from "fs";
import { resolve } from "path";
import { tmpdir } from "os";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

// Two wallets: owner (has DepositAuth enabled), other (will be authorized)
let owner: Wallet;
let other: Wallet;
// Credential issuer for credential-based preauth tests
let credIssuer: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    owner = await fundFromFaucet(client);

    // Enable DepositAuth on owner so preauth has effect
    const accountSetTx = await client.autofill({
      TransactionType: "AccountSet",
      Account: owner.address,
      SetFlag: 9, // asfDepositAuth = 9
    } as XrplAccountSet);
    await client.submitAndWait(owner.sign(accountSetTx).tx_blob);

    // Fund `other` from owner
    other = Wallet.generate();
    const fundOther = await client.autofill({
      TransactionType: "Payment",
      Account: owner.address,
      Amount: xrpToDrops(20),
      Destination: other.address,
    } as XrplPayment);
    await client.submitAndWait(owner.sign(fundOther).tx_blob);

    // Fund credential issuer from owner
    credIssuer = Wallet.generate();
    const fundIssuer = await client.autofill({
      TransactionType: "Payment",
      Account: owner.address,
      Amount: xrpToDrops(20),
      Destination: credIssuer.address,
    } as XrplPayment);
    await client.submitAndWait(owner.sign(fundIssuer).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("deposit-preauth set", () => {
  it("authorize an account succeeds", () => {
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--authorize", other.address,
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("unauthorize an account succeeds", () => {
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--unauthorize", other.address,
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("authorize by credential succeeds", () => {
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--authorize-credential", credIssuer.address,
      "--credential-type", "KYC",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("unauthorize by credential succeeds", () => {
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--unauthorize-credential", credIssuer.address,
      "--credential-type", "KYC",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("authorize with --credential-type-hex succeeds", () => {
    // "KYC2" in hex = 4B594332
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--authorize-credential", credIssuer.address,
      "--credential-type-hex", "4B594332",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json outputs hash, result, fee, ledger", () => {
    // Re-authorize other account (was unauthorize'd above)
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--authorize", other.address,
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

  it("--dry-run outputs JSON with TransactionType DepositPreauth and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--authorize", other.address,
      "--seed", owner.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("DepositPreauth");
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait submits without waiting for validation", () => {
    // Unauthorize again to avoid duplicate preauth entry
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--unauthorize", other.address,
      "--seed", owner.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  });

  it("--account + --keystore + --password key material authorizes successfully", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-test-keystore-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        owner.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `import: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "testnet",
        "deposit-preauth", "set",
        "--authorize", other.address,
        "--account", owner.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
