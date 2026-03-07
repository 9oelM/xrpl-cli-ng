import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromDevnetFaucet, DEVNET_URL } from "../../helpers/devnet.js";

let client: Client;
let depositor: Wallet;
let vaultId: string;

beforeAll(async () => {
  client = new Client(DEVNET_URL);
  await client.connect();
  depositor = await fundFromDevnetFaucet(client);

  // Create one XRP vault to use across all deposit tests
  const result = runCLI([
    "--node", "devnet",
    "vault", "create",
    "--asset", "0",
    "--seed", depositor.seed!,
  ]);
  if (result.status !== 0) {
    throw new Error(`vault create failed: ${result.stderr}`);
  }
  const match = result.stdout.match(/Vault ID: ([0-9A-F]{64})/);
  if (!match) throw new Error(`no vault ID in output: ${result.stdout}`);
  vaultId = match[1];
}, 180_000);

afterAll(async () => {
  await client.disconnect();
});

describe("vault deposit (devnet)", () => {
  it("deposits XRP into a vault and outputs Vault ID", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "deposit",
      "--vault-id", vaultId,
      "--amount", "1",
      "--seed", depositor.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Vault ID: ${vaultId}`);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("--json outputs {result, vaultId, tx}", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "deposit",
      "--vault-id", vaultId,
      "--amount", "1",
      "--seed", depositor.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; vaultId: string; tx: string };
    expect(out.result).toBe("success");
    expect(out.vaultId).toBe(vaultId);
    expect(typeof out.tx).toBe("string");
    expect(out.tx).toHaveLength(64);
  }, 90_000);

  it("--dry-run prints VaultDeposit tx JSON without submitting", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "deposit",
      "--vault-id", vaultId,
      "--amount", "1",
      "--seed", depositor.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; VaultID: string; Amount: string };
    };
    expect(out.tx.TransactionType).toBe("VaultDeposit");
    expect(out.tx.VaultID).toBe(vaultId);
    expect(typeof out.tx_blob).toBe("string");
    expect(out.tx.Amount).toBeDefined();
  }, 60_000);

  it("--no-wait submits without waiting and outputs Transaction hash", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "deposit",
      "--vault-id", vaultId,
      "--amount", "1",
      "--seed", depositor.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/Transaction: [0-9A-Fa-f]{64}/);
  }, 60_000);

  it("--account + --keystore + --password key material deposits successfully", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-vault-deposit-test-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        depositor.seed!,
        "--password", "pw789",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `import: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "devnet",
        "vault", "deposit",
        "--vault-id", vaultId,
        "--amount", "1",
        "--account", depositor.address,
        "--keystore", tmpDir,
        "--password", "pw789",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain(`Vault ID: ${vaultId}`);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 90_000);
});
