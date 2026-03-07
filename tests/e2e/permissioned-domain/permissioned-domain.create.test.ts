import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Payment as XrplPayment } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";
import { mkdtempSync, rmSync } from "fs";
import { resolve } from "path";
import { tmpdir } from "os";

// NOTE: PermissionedDomains amendment is enabled on testnet.

let owner: Wallet;
// A second wallet used as credential issuer
let credIssuer: Wallet;

let client: Client;

beforeAll(async () => {
  client = new Client(TESTNET_URL);
  await client.connect();
  owner = await fundFromFaucet(client);

  // Fund credIssuer from owner (to avoid extra faucet calls)
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

describe("permissioned-domain create", () => {
  it("creates a domain with 1 credential via --credential", () => {
    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "create",
      "--credential", `${credIssuer.address}:KYC`,
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Domain ID:");
    expect(result.stdout).toContain("Tx:");
  }, 90_000);

  it("creates a domain with 3 credentials via --credential", () => {
    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "create",
      "--credential", `${credIssuer.address}:KYC`,
      "--credential", `${credIssuer.address}:AML`,
      "--credential", `${credIssuer.address}:ACCREDITED`,
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Domain ID:");
  }, 90_000);

  it("creates a domain via --credentials-json", () => {
    const credsJson = JSON.stringify([
      { issuer: credIssuer.address, credential_type: "4B5943" }, // "KYC" in hex
    ]);
    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "create",
      "--credentials-json", credsJson,
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Domain ID:");
  }, 90_000);

  it("--json outputs {result, domainId, tx}", () => {
    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "create",
      "--credential", `${credIssuer.address}:JSON_TEST`,
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
    expect(out.domainId).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.tx).toBe("string");
    expect(out.tx).toMatch(/^[0-9A-Fa-f]{64}$/);
  }, 90_000);

  it("--dry-run prints unsigned tx JSON without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "create",
      "--credential", `${credIssuer.address}:KYC_DRY`,
      "--seed", owner.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("PermissionedDomainSet");
    expect(typeof out.tx_blob).toBe("string");
  }, 60_000);

  it("--no-wait submits without waiting for validation", () => {
    const result = runCLI([
      "--node", "testnet",
      "permissioned-domain", "create",
      "--credential", `${credIssuer.address}:KYC_NOWAIT`,
      "--seed", owner.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  }, 60_000);

  it("--account/--keystore/--password key material creates domain successfully", () => {
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
        "permissioned-domain", "create",
        "--credential", `${credIssuer.address}:KYC_ACCT`,
        "--account", owner.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("Domain ID:");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 90_000);
});
