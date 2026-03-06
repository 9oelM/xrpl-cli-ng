import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Payment as XrplPayment } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;
let subject: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    issuer = await fundFromFaucet(client);

    // Fund subject from issuer to avoid hitting faucet twice
    subject = Wallet.generate();
    const fundTx = await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Amount: xrpToDrops(15),
      Destination: subject.address,
    } as XrplPayment);
    await client.submitAndWait(issuer.sign(fundTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("credential create core", () => {
  it("creates a credential with --credential-type string", () => {
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("Credential ID:");
  });

  it("creates a credential with --credential-type-hex", () => {
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type-hex", "41424344", // "ABCD"
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("Credential ID:");
  });

  it("creates a credential with --uri", () => {
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC_URI",
      "--uri", "https://example.com/credential",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("Credential ID:");
  });

  it("creates a credential with --expiration", () => {
    // Set expiration to 1 year from now
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC_EXP",
      "--expiration", future,
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json outputs hash, result, fee, ledger, credentialId", () => {
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC_JSON",
      "--seed", issuer.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
      credentialId: string;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
    expect(typeof out.credentialId).toBe("string");
    expect(out.credentialId).toMatch(/^[0-9A-Fa-f]{64}$/);
  });

  it("--dry-run outputs JSON with TransactionType CredentialCreate and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC_DRY",
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CredentialCreate");
    expect(typeof out.tx_blob).toBe("string");
  });
});
