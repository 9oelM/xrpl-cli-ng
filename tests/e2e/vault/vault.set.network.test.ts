import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromDevnetFaucet, DEVNET_URL } from "../../helpers/devnet.js";

let client: Client;
let wallet: Wallet;

beforeAll(async () => {
  client = new Client(DEVNET_URL);
  await client.connect();
  wallet = await fundFromDevnetFaucet(client);
}, 180_000);

afterAll(async () => {
  await client.disconnect();
});

/** Helper: create a fresh vault owned by `wallet`, return the VaultID. */
function createVault(): string {
  const result = runCLI([
    "--node", "devnet",
    "vault", "create",
    "--asset", "0",
    "--seed", wallet.seed!,
  ]);
  if (result.status !== 0) {
    throw new Error(`vault create failed: ${result.stderr}`);
  }
  const match = result.stdout.match(/Vault ID: ([0-9A-F]{64})/);
  if (!match) throw new Error(`no vault ID in output: ${result.stdout}`);
  return match[1];
}

describe("vault set (devnet)", () => {
  it("updates --data on an existing vault", () => {
    const vaultId = createVault();
    const result = runCLI([
      "--node", "devnet",
      "vault", "set",
      "--vault-id", vaultId,
      "--data", "DEADBEEF",
      "--seed", wallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Vault ID: ${vaultId}`);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 120_000);

  it("updates --assets-maximum on an existing vault", () => {
    const vaultId = createVault();
    const result = runCLI([
      "--node", "devnet",
      "vault", "set",
      "--vault-id", vaultId,
      "--assets-maximum", "500000000",
      "--seed", wallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Vault ID: ${vaultId}`);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 120_000);

  it("--json outputs {result, vaultId, tx}", () => {
    const vaultId = createVault();
    const result = runCLI([
      "--node", "devnet",
      "vault", "set",
      "--vault-id", vaultId,
      "--data", "CAFEBABE",
      "--seed", wallet.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; vaultId: string; tx: string };
    expect(out.result).toBe("success");
    expect(out.vaultId).toBe(vaultId);
    expect(typeof out.tx).toBe("string");
    expect(out.tx).toHaveLength(64);
  }, 120_000);

  it("--dry-run prints VaultSet tx JSON without submitting", () => {
    const vaultId = createVault();
    const result = runCLI([
      "--node", "devnet",
      "vault", "set",
      "--vault-id", vaultId,
      "--data", "AABB",
      "--seed", wallet.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; VaultID: string; Data: string };
    };
    expect(out.tx.TransactionType).toBe("VaultSet");
    expect(out.tx.VaultID).toBe(vaultId);
    expect(out.tx.Data).toBe("AABB");
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("--no-wait submits without waiting and outputs Transaction hash", () => {
    const vaultId = createVault();
    const result = runCLI([
      "--node", "devnet",
      "vault", "set",
      "--vault-id", vaultId,
      "--assets-maximum", "999999999",
      "--seed", wallet.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/Transaction: [0-9A-Fa-f]{64}/);
  }, 90_000);

  it("--account + --keystore + --password key material updates successfully", () => {
    const vaultId = createVault();
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-vault-set-test-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        wallet.seed!,
        "--password", "pw456",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `import: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "devnet",
        "vault", "set",
        "--vault-id", vaultId,
        "--data", "FF00FF",
        "--account", wallet.address,
        "--keystore", tmpDir,
        "--password", "pw456",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 120_000);
});
