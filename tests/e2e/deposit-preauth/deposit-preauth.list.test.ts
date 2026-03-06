import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops, convertStringToHex } from "xrpl";
import type { Payment as XrplPayment, AccountSet as XrplAccountSet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

// Owner account (DepositAuth enabled), other account (authorized), credential issuer
let owner: Wallet;
let other: Wallet;
let credIssuer: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    owner = await fundFromFaucet(client);

    // Enable DepositAuth on owner
    const accountSetTx = await client.autofill({
      TransactionType: "AccountSet",
      Account: owner.address,
      SetFlag: 9, // asfDepositAuth
    } as XrplAccountSet);
    await client.submitAndWait(owner.sign(accountSetTx).tx_blob);

    // Fund other and credIssuer from owner
    other = Wallet.generate();
    credIssuer = Wallet.generate();

    for (const dest of [other.address, credIssuer.address]) {
      const fundTx = await client.autofill({
        TransactionType: "Payment",
        Account: owner.address,
        Amount: xrpToDrops(20),
        Destination: dest,
      } as XrplPayment);
      await client.submitAndWait(owner.sign(fundTx).tx_blob);
    }
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("deposit-preauth list", () => {
  it("shows 'No deposit preauthorizations.' for account with none", () => {
    // other has no preauths on it
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "list",
      other.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("No deposit preauthorizations.");
  });

  it("shows authorized account after authorize", () => {
    // Authorize other on owner
    const setResult = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--authorize", other.address,
      "--seed", owner.seed!,
    ]);
    expect(setResult.status, `set stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);

    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "list",
      owner.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Account: ${other.address}`);
  });

  it("shows credential preauth after authorize-credential", () => {
    const credTypeHex = convertStringToHex("KYC");

    const setResult = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--authorize-credential", credIssuer.address,
      "--credential-type", "KYC",
      "--seed", owner.seed!,
    ]);
    expect(setResult.status, `set stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);

    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "list",
      owner.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Credential: ${credIssuer.address} / KYC`);
    // Also still shows the account preauth
    expect(result.stdout).toContain(`Account: ${other.address}`);
  });

  it("no longer shows account after unauthorize", () => {
    const unsetResult = runCLI([
      "--node", "testnet",
      "deposit-preauth", "set",
      "--unauthorize", other.address,
      "--seed", owner.seed!,
    ]);
    expect(unsetResult.status, `unset stdout: ${unsetResult.stdout} stderr: ${unsetResult.stderr}`).toBe(0);

    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "list",
      owner.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).not.toContain(`Account: ${other.address}`);
    // Credential preauth still there
    expect(result.stdout).toContain(`Credential: ${credIssuer.address} / KYC`);
  });

  it("--json outputs array of raw objects", () => {
    const result = runCLI([
      "--node", "testnet",
      "deposit-preauth", "list",
      owner.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const entries = JSON.parse(result.stdout) as Array<{
      LedgerEntryType: string;
      AuthorizeCredentials?: Array<{ Credential: { Issuer: string; CredentialType: string } }>;
    }>;
    expect(Array.isArray(entries)).toBe(true);
    // At minimum the credential preauth is present
    const credEntry = entries.find(
      (e) =>
        e.LedgerEntryType === "DepositPreauth" &&
        e.AuthorizeCredentials !== undefined &&
        e.AuthorizeCredentials[0]?.Credential.Issuer === credIssuer.address
    );
    expect(credEntry, "credential preauth entry missing from JSON output").toBeDefined();
  });
});
