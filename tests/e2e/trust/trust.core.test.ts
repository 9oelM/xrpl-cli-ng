import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Payment as XrplPayment } from "xrpl";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");
const E2E_PATH = `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`;

function runCLI(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: { ...process.env, PATH: E2E_PATH, ...extraEnv },
    timeout: 120_000,
  });
}

let trustor: Wallet;
let issuer: Wallet;
let testMnemonic: string;
let mnemonicWalletAddress: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    trustor = await fundFromFaucet(client);
    issuer = await fundFromFaucet(client);

    // Generate a fresh random mnemonic and fund the derived wallet from trustor
    testMnemonic = generateMnemonic(wordlist);
    const mnemonicWallet = Wallet.fromMnemonic(testMnemonic, {
      mnemonicEncoding: "bip39",
      derivationPath: "m/44'/144'/0'/0/0",
    });
    mnemonicWalletAddress = mnemonicWallet.address;

    const fundTx = await client.autofill({
      TransactionType: "Payment",
      Account: trustor.address,
      Amount: xrpToDrops(15),
      Destination: mnemonicWalletAddress,
    } as XrplPayment);
    await client.submitAndWait(trustor.sign(fundTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("trust set core", () => {
  it("creates a USD trust line and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "USD",
      "--issuer", issuer.address,
      "--limit", "1000",
      "--seed", trustor.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");

    const linesResult = runCLI(["--node", "testnet", "account", "trust-lines", "--json", trustor.address]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ account: string; currency: string }>;
    const usdLine = lines.find((l) => l.currency === "USD" && l.account === issuer.address);
    expect(usdLine).toBeDefined();
  });

  it("alias 's' works", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "s",
      "--currency", "EUR",
      "--issuer", issuer.address,
      "--limit", "500",
      "--seed", trustor.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");

    const linesResult = runCLI(["--node", "testnet", "account", "trust-lines", "--json", trustor.address]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ account: string; currency: string }>;
    const eurLine = lines.find((l) => l.currency === "EUR" && l.account === issuer.address);
    expect(eurLine).toBeDefined();
  });

  it("--dry-run outputs JSON with TransactionType TrustSet and does not submit", () => {
    const linesBefore = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesBefore.status).toBe(0);
    const countBefore = (JSON.parse(linesBefore.stdout) as unknown[]).length;

    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "XYZ",
      "--issuer", issuer.address,
      "--limit", "100",
      "--seed", trustor.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("TrustSet");
    expect(typeof out.tx_blob).toBe("string");

    const linesAfter = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesAfter.status).toBe(0);
    expect((JSON.parse(linesAfter.stdout) as unknown[]).length).toBe(countBefore);
  });

  it("--no-wait exits 0 and stdout contains a 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "GBP",
      "--issuer", issuer.address,
      "--limit", "200",
      "--seed", trustor.seed!,
      "--no-wait",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--json outputs hash, result, fee, ledger", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "CAD",
      "--issuer", issuer.address,
      "--limit", "300",
      "--seed", trustor.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  });

  it("--no-ripple sets no_ripple: true on trust line", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "MXN",
      "--issuer", issuer.address,
      "--limit", "1000",
      "--no-ripple",
      "--seed", trustor.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");

    const linesResult = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ currency: string; no_ripple?: boolean }>;
    const mxnLine = lines.find((l) => l.currency === "MXN");
    expect(mxnLine).toBeDefined();
    expect(mxnLine?.no_ripple).toBe(true);
  });

  it("--account + --keystore + --password signs and submits trust set", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-test-keystore-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        trustor.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `stdout: ${importResult.stdout} stderr: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "testnet",
        "trust", "set",
        "--currency", "CNY",
        "--issuer", issuer.address,
        "--limit", "1000",
        "--account", trustor.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");

      const linesResult = runCLI(["--node", "testnet", "account", "trust-lines", "--json", trustor.address]);
      expect(linesResult.status).toBe(0);
      const lines = JSON.parse(linesResult.stdout) as Array<{ account: string; currency: string }>;
      const cnyLine = lines.find((l) => l.currency === "CNY" && l.account === issuer.address);
      expect(cnyLine).toBeDefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--clear-no-ripple clears the NoRipple flag on an existing trust line", () => {
    const setResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "SGD",
      "--issuer", issuer.address,
      "--limit", "5000",
      "--no-ripple",
      "--seed", trustor.seed!,
    ]);
    expect(setResult.status, `stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);

    const clearResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "SGD",
      "--issuer", issuer.address,
      "--limit", "5000",
      "--clear-no-ripple",
      "--seed", trustor.seed!,
    ]);
    expect(clearResult.status, `stdout: ${clearResult.stdout} stderr: ${clearResult.stderr}`).toBe(0);
    expect(clearResult.stdout).toContain("tesSUCCESS");

    const linesResult = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ currency: string; no_ripple?: boolean }>;
    const line = lines.find((l) => l.currency === "SGD");
    expect(line).toBeDefined();
    expect(line?.no_ripple).toBeFalsy();
  });

  it("--mnemonic key material creates a trust line", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "MNE",
      "--issuer", issuer.address,
      "--limit", "100",
      "--mnemonic", testMnemonic,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");

    const linesResult = runCLI(["--node", "testnet", "account", "trust-lines", "--json", mnemonicWalletAddress]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ account: string; currency: string }>;
    const mneLine = lines.find((l) => l.currency === "MNE" && l.account === issuer.address);
    expect(mneLine).toBeDefined();
  });

  it("--quality-in and --quality-out set quality values on trust line", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "JPY",
      "--issuer", issuer.address,
      "--limit", "10000",
      "--quality-in", "950000000",
      "--quality-out", "950000000",
      "--seed", trustor.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");

    const linesResult = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ currency: string; quality_in?: number; quality_out?: number }>;
    const jpyLine = lines.find((l) => l.currency === "JPY");
    expect(jpyLine).toBeDefined();
    expect(jpyLine?.quality_in).toBe(950000000);
    expect(jpyLine?.quality_out).toBe(950000000);
  });
});
