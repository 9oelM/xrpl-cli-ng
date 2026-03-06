import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops, convertStringToHex } from "xrpl";
import type { Payment as XrplPayment } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;
let subject: Wallet;

const CREDENTIAL_TYPE = "KYC_ACCEPT";
const CREDENTIAL_TYPE_HEX = convertStringToHex(CREDENTIAL_TYPE);

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

    // Pre-create a credential for each test that needs one
    // Tests are sequential; they share the same issuer/subject wallets
    // but use distinct credential types to avoid tecDUPLICATE
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("credential accept core", () => {
  it("subject accepts a credential issued by the issuer", async () => {
    // First, issuer creates the credential
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", CREDENTIAL_TYPE,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);
    expect(createResult.stdout).toContain("tesSUCCESS");

    // Then subject accepts it
    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", CREDENTIAL_TYPE,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept stdout: ${acceptResult.stdout} stderr: ${acceptResult.stderr}`).toBe(0);
    expect(acceptResult.stdout).toContain("tesSUCCESS");

    // Verify on-chain: lsfAccepted flag (0x00010000 = 65536) must be set
    const client = new Client(TESTNET_URL);
    await client.connect();
    try {
      const res = await client.request({
        command: "account_objects",
        account: subject.address,
        type: "credential",
        ledger_index: "validated",
      });
      const cred = (res.result.account_objects as Array<{ CredentialType?: string; Flags?: number }>).find(
        (o) => o.CredentialType === CREDENTIAL_TYPE_HEX
      );
      expect(cred).toBeDefined();
      // lsfAccepted = 0x00010000
      expect((cred!.Flags! & 0x00010000) !== 0).toBe(true);
    } finally {
      await client.disconnect();
    }
  });

  it("--json outputs hash, result, fee, ledger", () => {
    const credType = "KYC_ACCEPT_JSON";
    // Issuer creates credential
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    // Subject accepts with --json
    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
      "--json",
    ]);
    expect(acceptResult.status, `accept stdout: ${acceptResult.stdout} stderr: ${acceptResult.stderr}`).toBe(0);
    const out = JSON.parse(acceptResult.stdout) as {
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

  it("--dry-run outputs JSON with TransactionType CredentialAccept and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", "KYC_DRY",
      "--seed", subject.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CredentialAccept");
    expect(typeof out.tx_blob).toBe("string");
  });

  it("accepts credential with --credential-type-hex", () => {
    const credType = "KYC_ACCEPT_HEX";
    const credTypeHex = convertStringToHex(credType);

    // Issuer creates with plain type
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    // Subject accepts with --credential-type-hex
    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type-hex", credTypeHex,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept stdout: ${acceptResult.stdout} stderr: ${acceptResult.stderr}`).toBe(0);
    expect(acceptResult.stdout).toContain("tesSUCCESS");
  });

  it("--no-wait submits without waiting and prints hash", () => {
    const credType = "KYC_ACCEPT_NOWAIT";

    // Issuer creates credential
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);

    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
      "--no-wait",
    ]);
    expect(acceptResult.status, `stdout: ${acceptResult.stdout} stderr: ${acceptResult.stderr}`).toBe(0);
    expect(acceptResult.stdout).toContain("Transaction:");
  });
});
