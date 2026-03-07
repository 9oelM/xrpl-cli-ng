import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromDevnetFaucet, DEVNET_URL } from "../../helpers/devnet.js";

let client: Client;
let owner: Wallet;

beforeAll(async () => {
  client = new Client(DEVNET_URL);
  await client.connect();
  owner = await fundFromDevnetFaucet(client);
}, 180_000);

afterAll(async () => {
  await client.disconnect();
});

/** Create a fresh XRP vault and return its VaultID */
function createVault(seed: string): string {
  const result = runCLI([
    "--node", "devnet",
    "vault", "create",
    "--asset", "0",
    "--seed", seed,
  ]);
  if (result.status !== 0) {
    throw new Error(`vault create failed: ${result.stderr}`);
  }
  const match = result.stdout.match(/Vault ID: ([0-9A-F]{64})/);
  if (!match) throw new Error(`no vault ID in output: ${result.stdout}`);
  return match[1];
}

describe("vault delete (devnet)", () => {
  it("creates a vault then deletes it; outputs 'Deleted vault' and tesSUCCESS, verified gone via ledger_entry", async () => {
    const vaultId = createVault(owner.seed!);

    const result = runCLI([
      "--node", "devnet",
      "vault", "delete",
      "--vault-id", vaultId,
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Deleted vault: ${vaultId}`);
    expect(result.stdout).toContain("tesSUCCESS");

    // Verify vault is gone via ledger_entry RPC (look up by ledger index = VaultID)
    let gone = false;
    try {
      await client.request({
        command: "ledger_entry",
        index: vaultId,
        ledger_index: "validated",
      });
    } catch (e: unknown) {
      // entryNotFound means the vault was successfully deleted
      const errData = (e as { data?: { error?: string } }).data;
      if (errData?.error === "entryNotFound") {
        gone = true;
      } else {
        throw e;
      }
    }
    expect(gone, "vault should be gone from ledger after delete").toBe(true);
  }, 120_000);

  it("--json outputs {result, vaultId, tx}", () => {
    const vaultId = createVault(owner.seed!);

    const result = runCLI([
      "--node", "devnet",
      "vault", "delete",
      "--vault-id", vaultId,
      "--seed", owner.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; vaultId: string; tx: string };
    expect(out.result).toBe("success");
    expect(out.vaultId).toBe(vaultId);
    expect(typeof out.tx).toBe("string");
    expect(out.tx).toHaveLength(64);
  }, 120_000);

  it("--dry-run prints VaultDelete tx JSON without submitting (vault still exists after)", async () => {
    const vaultId = createVault(owner.seed!);

    const result = runCLI([
      "--node", "devnet",
      "vault", "delete",
      "--vault-id", vaultId,
      "--seed", owner.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; VaultID: string };
    };
    expect(out.tx.TransactionType).toBe("VaultDelete");
    expect(out.tx.VaultID).toBe(vaultId);
    expect(typeof out.tx_blob).toBe("string");

    // Vault should still exist since dry-run did not submit
    let stillExists = false;
    try {
      await client.request({
        command: "ledger_entry",
        index: vaultId,
        ledger_index: "validated",
      });
      stillExists = true;
    } catch {
      stillExists = false;
    }
    expect(stillExists, "vault should still exist after dry-run").toBe(true);

    // Clean up: actually delete the vault
    runCLI([
      "--node", "devnet",
      "vault", "delete",
      "--vault-id", vaultId,
      "--seed", owner.seed!,
    ]);
  }, 120_000);

  it("--no-wait submits without waiting and outputs Transaction hash", () => {
    const vaultId = createVault(owner.seed!);

    const result = runCLI([
      "--node", "devnet",
      "vault", "delete",
      "--vault-id", vaultId,
      "--seed", owner.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/Transaction: [0-9A-Fa-f]{64}/);
  }, 90_000);

  it("--account + --keystore + --password key material deletes successfully", () => {
    const vaultId = createVault(owner.seed!);

    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-vault-delete-test-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        owner.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `import: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "devnet",
        "vault", "delete",
        "--vault-id", vaultId,
        "--account", owner.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain(`Deleted vault: ${vaultId}`);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 120_000);
});
