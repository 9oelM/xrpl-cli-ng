import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet } from "xrpl";
import { fundFromDevnetFaucet, DEVNET_URL } from "../../helpers/devnet.js";

let creator: Wallet;
let client: Client;

beforeAll(async () => {
  client = new Client(DEVNET_URL);
  await client.connect();
  creator = await fundFromDevnetFaucet(client);
}, 180_000);

afterAll(async () => {
  await client.disconnect();
});

describe("vault create (devnet)", () => {
  it("creates an XRP vault and outputs Vault ID", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "create",
      "--asset", "0",
      "--seed", creator.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/Vault ID: [0-9A-F]{64}/);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("creates a vault with --assets-maximum; appears in dry-run tx", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "create",
      "--asset", "0",
      "--assets-maximum", "1000000000",
      "--seed", creator.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; AssetsMaximum: string } };
    expect(out.tx.TransactionType).toBe("VaultCreate");
    expect(out.tx.AssetsMaximum).toBe("1000000000");
  }, 60_000);

  it("--json outputs {result, vaultId, tx}", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "create",
      "--asset", "0",
      "--seed", creator.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; vaultId: string; tx: string };
    expect(out.result).toBe("success");
    expect(typeof out.vaultId).toBe("string");
    expect(out.vaultId).toHaveLength(64);
    expect(typeof out.tx).toBe("string");
    expect(out.tx).toHaveLength(64);
  }, 90_000);

  it("--dry-run outputs JSON with TransactionType VaultCreate and does not submit", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "create",
      "--asset", "0",
      "--seed", creator.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; Asset: unknown } };
    expect(out.tx.TransactionType).toBe("VaultCreate");
    expect(typeof out.tx_blob).toBe("string");
    expect(out.tx.Asset).toBeDefined();
  }, 60_000);

  it("--no-wait submits without waiting and outputs Transaction hash", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "create",
      "--asset", "0",
      "--seed", creator.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/Transaction: [0-9A-Fa-f]{64}/);
  }, 60_000);

  it("--non-transferable flag appears in dry-run tx flags", () => {
    const result = runCLI([
      "--node", "devnet",
      "vault", "create",
      "--asset", "0",
      "--non-transferable",
      "--seed", creator.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Flags?: number; TransactionType: string } };
    expect(out.tx.TransactionType).toBe("VaultCreate");
    // tfVaultShareNonTransferable = 131072
    expect((out.tx.Flags ?? 0) & 131072).toBe(131072);
  }, 60_000);

  it("--account + --keystore + --password key material creates successfully", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-vault-test-keystore-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        creator.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `import: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "devnet",
        "vault", "create",
        "--asset", "0",
        "--account", creator.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toMatch(/Vault ID: [0-9A-F]{64}/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 90_000);
});
