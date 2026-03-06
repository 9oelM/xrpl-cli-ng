import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops } from "xrpl";
import { mkdtempSync, rmSync } from "fs";
import { resolve } from "path";
import { tmpdir } from "os";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let owner: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    owner = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("did set", () => {
  it("creates DID with --uri succeeds", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/1",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("creates DID with --data succeeds", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--data", "attestation-data",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("updates existing DID URI", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/updated",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("clears URI field with --clear-uri", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--clear-uri",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--uri '' empty string clears URI (equivalent to --clear-uri)", () => {
    // First set a URI so we have something to clear
    runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/tmp",
      "--seed", owner.seed!,
    ]);
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json outputs hash, result, fee, ledger", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/json",
      "--json",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  });

  it("--dry-run prints tx_blob and tx without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/dry",
      "--dry-run",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; URI?: string };
    };
    expect(out.tx.TransactionType).toBe("DIDSet");
    expect(typeof out.tx_blob).toBe("string");
    // URI should be hex-encoded
    const expectedHex = Buffer.from("https://example.com/did/dry").toString("hex").toUpperCase();
    expect(out.tx.URI?.toUpperCase()).toBe(expectedHex);
  });

  it("--no-wait exits 0 with a hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri", "https://example.com/did/nowait",
      "--no-wait",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--uri-hex sets URI as raw hex without re-encoding", () => {
    const uriHex = Buffer.from("https://example.com/did/hex").toString("hex");
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--uri-hex", uriHex,
      "--dry-run",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { URI?: string } };
    expect(out.tx.URI?.toLowerCase()).toBe(uriHex.toLowerCase());
  });

  it("--data-hex sets Data as raw hex without re-encoding", () => {
    const dataHex = Buffer.from("some-attestation").toString("hex");
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--data-hex", dataHex,
      "--dry-run",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Data?: string } };
    expect(out.tx.Data?.toLowerCase()).toBe(dataHex.toLowerCase());
  });

  it("--did-document sets DIDDocument hex-encoded", () => {
    const doc = '{"@context":"https://www.w3.org/ns/did/v1"}';
    const result = runCLI([
      "--node", "testnet",
      "did", "set",
      "--did-document", doc,
      "--dry-run",
      "--seed", owner.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { DIDDocument?: string } };
    const expectedHex = Buffer.from(doc).toString("hex").toUpperCase();
    expect(out.tx.DIDDocument?.toUpperCase()).toBe(expectedHex);
  });

  it("--account + --keystore + --password key material succeeds", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-test-did-"));
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
        "did", "set",
        "--uri", "https://example.com/did/account",
        "--account", owner.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
