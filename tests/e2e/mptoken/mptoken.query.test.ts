import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Payment as XrplPayment } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;
let emptyAccount: Wallet;
let issuanceId: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    issuer = await fundFromFaucet(client);

    // Fund an empty wallet (no issuances) so it exists on ledger
    emptyAccount = Wallet.generate();
    const fundTx: XrplPayment = await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Amount: xrpToDrops(5),
      Destination: emptyAccount.address,
    });
    await client.submitAndWait(issuer.sign(fundTx).tx_blob);
  } finally {
    await client.disconnect();
  }

  // Create an issuance with known properties via CLI
  const createResult = runCLI([
    "--node", "testnet",
    "mptoken", "issuance", "create",
    "--metadata", "query-test-token",
    "--max-amount", "999999",
    "--asset-scale", "2",
    "--flags", "can-transfer",
    "--transfer-fee", "100",
    "--seed", issuer.seed!,
  ]);
  if (createResult.status !== 0) {
    throw new Error(`Create failed: ${createResult.stderr}`);
  }
  const idMatch = createResult.stdout.match(/MPTokenIssuanceID:\s+([0-9A-Fa-f]+)/);
  if (!idMatch) {
    throw new Error(`No MPTokenIssuanceID in output: ${createResult.stdout}`);
  }
  issuanceId = idMatch[1]!;
}, 300_000);

describe("mptoken issuance list and get", () => {
  it("list shows the issuance ID for the issuer account", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "list",
      issuer.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(issuanceId);
  }, 60_000);

  it("list --json outputs a JSON array containing the issuance", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "list",
      issuer.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const arr = JSON.parse(result.stdout) as Array<{ Issuer: string; AssetScale?: number }>;
    expect(Array.isArray(arr)).toBe(true);
    // JSON output contains raw ledger entries; find by issuer address and AssetScale
    const found = arr.find((iss) => iss.Issuer === issuer.address && iss.AssetScale === 2);
    expect(found, `Issuance for ${issuer.address} with AssetScale=2 not found in list`).toBeTruthy();
  }, 60_000);

  it("list shows 'No MPT issuances.' for an account with no issuances", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "list",
      emptyAccount.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("No MPT issuances.");
  }, 60_000);

  it("get shows correct properties (Issuer, AssetScale, MaximumAmount, TransferFee, Metadata)", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "get",
      issuanceId,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`MPTokenIssuanceID: ${issuanceId}`);
    expect(result.stdout).toContain(`Issuer:`);
    expect(result.stdout).toContain(issuer.address);
    expect(result.stdout).toContain("AssetScale:");
    expect(result.stdout).toContain("2");
    expect(result.stdout).toContain("MaximumAmount:");
    expect(result.stdout).toContain("999999");
    expect(result.stdout).toContain("TransferFee:");
    expect(result.stdout).toContain("100");
    expect(result.stdout).toContain("Metadata:");
    expect(result.stdout).toContain("query-test-token");
  }, 60_000);

  it("get --json outputs raw JSON with node.Issuer and correct fields", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "get",
      issuanceId,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      node: {
        Issuer: string;
        AssetScale: number;
        MaximumAmount: string;
        TransferFee: number;
      };
    };
    expect(out.node.Issuer).toBe(issuer.address);
    expect(out.node.AssetScale).toBe(2);
    expect(out.node.MaximumAmount).toBe("999999");
    expect(out.node.TransferFee).toBe(100);
  }, 60_000);
});
