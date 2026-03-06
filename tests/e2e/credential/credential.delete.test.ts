import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops, convertStringToHex } from "xrpl";
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
      Amount: xrpToDrops(20),
      Destination: subject.address,
    } as XrplPayment);
    await client.submitAndWait(issuer.sign(fundTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("credential delete core", () => {
  it("issuer deletes a credential they created", async () => {
    const credType = "KYC_DELETE_ISSUER";
    const credTypeHex = convertStringToHex(credType);

    // Issuer creates credential
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);
    expect(createResult.stdout).toContain("tesSUCCESS");

    // Issuer deletes it
    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(deleteResult.status, `delete stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");

    // Verify credential no longer exists on-chain
    const client = new Client(TESTNET_URL);
    await client.connect();
    try {
      const res = await client.request({
        command: "account_objects",
        account: subject.address,
        type: "credential",
        ledger_index: "validated",
      });
      const cred = (res.result.account_objects as Array<{ CredentialType?: string }>).find(
        (o) => o.CredentialType === credTypeHex
      );
      expect(cred).toBeUndefined();
    } finally {
      await client.disconnect();
    }
  });

  it("subject deletes their own accepted credential", async () => {
    const credType = "KYC_DELETE_SUBJECT";
    const credTypeHex = convertStringToHex(credType);

    // Issuer creates credential
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    // Subject accepts it
    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept stdout: ${acceptResult.stdout} stderr: ${acceptResult.stderr}`).toBe(0);

    // Subject deletes it
    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
    ]);
    expect(deleteResult.status, `delete stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");

    // Verify credential no longer exists on-chain
    const client = new Client(TESTNET_URL);
    await client.connect();
    try {
      const res = await client.request({
        command: "account_objects",
        account: subject.address,
        type: "credential",
        ledger_index: "validated",
      });
      const cred = (res.result.account_objects as Array<{ CredentialType?: string }>).find(
        (o) => o.CredentialType === credTypeHex
      );
      expect(cred).toBeUndefined();
    } finally {
      await client.disconnect();
    }
  });

  it("--json outputs hash, result, fee, ledger, credentialId", async () => {
    const credType = "KYC_DELETE_JSON";

    // Issuer creates credential
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    // Issuer deletes with --json
    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
      "--json",
    ]);
    expect(deleteResult.status, `delete stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    const out = JSON.parse(deleteResult.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
      credentialId: string | null;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
    expect(typeof out.credentialId).toBe("string");
  });

  it("--dry-run outputs JSON with TransactionType CredentialDelete and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type", "KYC_DRY_DELETE",
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CredentialDelete");
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--credential-type-hex deletes credential using raw hex type", async () => {
    const credType = "KYC_DELETE_HEX";
    const credTypeHex = convertStringToHex(credType);

    // Issuer creates credential
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    // Issuer deletes with --credential-type-hex
    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type-hex", credTypeHex,
      "--seed", issuer.seed!,
    ]);
    expect(deleteResult.status, `delete stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");
  });

  it("--no-wait submits without waiting and prints hash", async () => {
    const credType = "KYC_DELETE_NOWAIT";

    // Issuer creates credential
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
      "--no-wait",
    ]);
    expect(deleteResult.status, `stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("Transaction:");
  });
});
