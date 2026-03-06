import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops, convertStringToHex } from "xrpl";
import type { Payment as XrplPayment } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;
let subject: Wallet;

const CRED_TYPE_ACCEPTED = "KYC_LIST_ACCEPTED";
const CRED_TYPE_PENDING = "KYC_LIST_PENDING";
const CRED_TYPE_ACCEPTED_HEX = convertStringToHex(CRED_TYPE_ACCEPTED);

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    issuer = await fundFromFaucet(client);

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

describe("credential list", () => {
  it("lists an accepted credential with accepted=yes", async () => {
    // Issuer creates credential for subject
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", CRED_TYPE_ACCEPTED,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    // Subject accepts it
    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", CRED_TYPE_ACCEPTED,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept: ${acceptResult.stderr}`).toBe(0);

    // List credentials for subject
    const listResult = runCLI([
      "--node", "testnet",
      "credential", "list",
      subject.address,
    ]);
    expect(listResult.status, `list: ${listResult.stderr}`).toBe(0);
    expect(listResult.stdout).toContain("Accepted:        yes");
    expect(listResult.stdout).toContain(CRED_TYPE_ACCEPTED);
    expect(listResult.stdout).toContain(issuer.address);
    expect(listResult.stdout).toContain(subject.address);
  });

  it("lists a pending credential with accepted=no", async () => {
    // Issuer creates credential for subject (not accepted)
    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", CRED_TYPE_PENDING,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    // List from issuer's perspective (credential is linked to issuer too)
    const listResult = runCLI([
      "--node", "testnet",
      "credential", "list",
      issuer.address,
    ]);
    expect(listResult.status, `list: ${listResult.stderr}`).toBe(0);
    // Find the pending credential
    expect(listResult.stdout).toContain(CRED_TYPE_PENDING);
    expect(listResult.stdout).toContain("Accepted:        no");
  });

  it("--json outputs raw JSON array", async () => {
    const listResult = runCLI([
      "--node", "testnet",
      "credential", "list",
      subject.address,
      "--json",
    ]);
    expect(listResult.status, `list: ${listResult.stderr}`).toBe(0);
    const arr = JSON.parse(listResult.stdout) as Array<{ CredentialType: string; Flags?: number }>;
    expect(Array.isArray(arr)).toBe(true);
    // The accepted credential should be in the array
    const found = arr.find((c) => c.CredentialType === CRED_TYPE_ACCEPTED_HEX);
    expect(found).toBeDefined();
    // lsfAccepted flag set
    expect((found!.Flags! & 0x00010000) !== 0).toBe(true);
  });
});
