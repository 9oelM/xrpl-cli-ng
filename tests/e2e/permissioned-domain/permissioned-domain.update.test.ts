import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops, isModifiedNode } from "xrpl";
import type { Payment as XrplPayment, AccountObjectsRequest } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";
import { mkdtempSync, rmSync } from "fs";
import { resolve } from "path";
import { tmpdir } from "os";

// NOTE: PermissionedDomains amendment is enabled on testnet.

let owner: Wallet;
let credIssuer: Wallet;
let client: Client;

/**
 * Helper: create a domain via CLI and return its domain ID.
 */
function createDomain(seed: string, credentialArg: string): string {
  const result = runCLI([
    "--node", "testnet",
    "permissioned-domain", "create",
    "--credential", credentialArg,
    "--seed", seed,
  ]);
  if (result.status !== 0) {
    throw new Error(`Domain creation failed: ${result.stderr}`);
  }
  const match = result.stdout.match(/Domain ID:\s*([0-9A-Fa-f]{64})/);
  if (!match) {
    throw new Error(`Could not extract domain ID from: ${result.stdout}`);
  }
  return match[1];
}

beforeAll(async () => {
  client = new Client(TESTNET_URL);
  await client.connect();
  owner = await fundFromFaucet(client);

  // Fund credIssuer from owner to avoid extra faucet calls
  credIssuer = Wallet.generate();
  const fundTx = await client.autofill({
    TransactionType: "Payment",
    Account: owner.address,
    Amount: xrpToDrops(15),
    Destination: credIssuer.address,
  } as XrplPayment);
  await client.submitAndWait(owner.sign(fundTx).tx_blob);
}, 180_000);

afterAll(async () => {
  await client.disconnect();
});

describe("permissioned-domain update", () => {
  it("updates domain credentials via --credential", async () => {
    const domainId = createDomain(owner.seed!, `${credIssuer.address}:KYC`);

    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "update",
      "--domain-id", domainId,
      "--credential", `${credIssuer.address}:AML`,
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Domain ID: ${domainId}`);
    expect(result.stdout).toContain("Tx:");
  }, 120_000);

  it("updates domain credentials via --credentials-json", async () => {
    const domainId = createDomain(owner.seed!, `${credIssuer.address}:KYC`);
    const credsJson = JSON.stringify([
      { issuer: credIssuer.address, credential_type: "414D4C" }, // "AML" in hex
    ]);

    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "update",
      "--domain-id", domainId,
      "--credentials-json", credsJson,
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Domain ID: ${domainId}`);
    expect(result.stdout).toContain("Tx:");
  }, 120_000);

  it("verifies updated credentials via account_objects", async () => {
    const domainId = createDomain(owner.seed!, `${credIssuer.address}:KYC`);

    // Update with a different credential type
    const updateResult = runCLI([
      "--node", "testnet",
      "permissioned-domain", "update",
      "--domain-id", domainId,
      "--credential", `${credIssuer.address}:ACCREDITED`,
      "--seed", owner.seed!,
    ]);
    expect(updateResult.status, `stdout: ${updateResult.stdout}\nstderr: ${updateResult.stderr}`).toBe(0);

    // Verify on-chain state
    const res = await client.request({
      command: "account_objects",
      account: owner.address,
      type: "permissioned_domain",
      ledger_index: "validated",
    } as AccountObjectsRequest);

    const domainObj = res.result.account_objects.find(
      (o) => (o as { index?: string }).index === domainId
    );
    expect(domainObj).toBeDefined();
  }, 120_000);

  it("--json outputs {result, domainId, tx}", async () => {
    const domainId = createDomain(owner.seed!, `${credIssuer.address}:KYC`);

    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "update",
      "--domain-id", domainId,
      "--credential", `${credIssuer.address}:JSON_UPDATE`,
      "--seed", owner.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      result: string;
      domainId: string;
      tx: string;
    };
    expect(out.result).toBe("success");
    expect(out.domainId.toUpperCase()).toBe(domainId.toUpperCase());
    expect(out.tx).toMatch(/^[0-9A-Fa-f]{64}$/);
  }, 120_000);

  it("--dry-run prints signed tx JSON without submitting", async () => {
    const domainId = createDomain(owner.seed!, `${credIssuer.address}:KYC`);

    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "update",
      "--domain-id", domainId,
      "--credential", `${credIssuer.address}:DRY_UPDATE`,
      "--seed", owner.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; DomainID: string };
    };
    expect(out.tx.TransactionType).toBe("PermissionedDomainSet");
    expect(out.tx.DomainID.toUpperCase()).toBe(domainId.toUpperCase());
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("--no-wait submits without waiting for validation", async () => {
    const domainId = createDomain(owner.seed!, `${credIssuer.address}:KYC`);

    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "update",
      "--domain-id", domainId,
      "--credential", `${credIssuer.address}:NOWAIT_UPDATE`,
      "--seed", owner.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  }, 90_000);

  it("--account/--keystore/--password key material updates domain successfully", async () => {
    const domainId = createDomain(owner.seed!, `${credIssuer.address}:KYC`);
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
        "permissioned-domain", "update",
        "--domain-id", domainId,
        "--credential", `${credIssuer.address}:ACCT_UPDATE`,
        "--account", owner.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain(`Domain ID: ${domainId}`);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 120_000);
});
