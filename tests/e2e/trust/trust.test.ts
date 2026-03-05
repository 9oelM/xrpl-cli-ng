import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet, AccountSetAsfFlags } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

const E2E_PATH = `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`;

function runCLI(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: E2E_PATH,
      ...extraEnv,
    },
    timeout: 120_000,
  });
}

let trustor: Wallet;
let issuer: Wallet;
let authIssuer: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    trustor = await fundFromFaucet(client);
    issuer = await fundFromFaucet(client);
    authIssuer = await fundFromFaucet(client);

    // Enable RequireAuth on authIssuer so the --auth test can authorize trust lines
    const setFlagTx = await client.autofill({
      TransactionType: "AccountSet",
      Account: authIssuer.address,
      SetFlag: AccountSetAsfFlags.asfRequireAuth,
    });
    const signed = authIssuer.sign(setFlagTx);
    await client.submitAndWait(signed.tx_blob);
  } finally {
    await client.disconnect();
  }
}, 240_000);

describe("trust set", () => {
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
  });

  it("--dry-run outputs JSON with TransactionType TrustSet and does not submit", async () => {
    const linesBefore = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesBefore.status).toBe(0);
    const beforeData = JSON.parse(linesBefore.stdout) as Array<{ currency: string }>;
    const countBefore = beforeData.length;

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

    // Verify no new trust line was created
    const linesAfter = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesAfter.status).toBe(0);
    const afterData = JSON.parse(linesAfter.stdout) as Array<{ currency: string }>;
    expect(afterData.length).toBe(countBefore);
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

  it("invalid currency exits 1 with descriptive error", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "TOOLONG",
      "--issuer", issuer.address,
      "--limit", "100",
      "--seed", trustor.seed!,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid currency");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "USD",
      "--issuer", issuer.address,
      "--limit", "100",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "USD",
      "--issuer", issuer.address,
      "--limit", "100",
      "--seed", trustor.seed!,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
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

  it("--no-ripple and --clear-no-ripple together exits 1", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "USD",
      "--issuer", issuer.address,
      "--limit", "100",
      "--seed", trustor.seed!,
      "--no-ripple",
      "--clear-no-ripple",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("--freeze and --unfreeze together exits 1", () => {
    const result = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "USD",
      "--issuer", issuer.address,
      "--limit", "100",
      "--seed", trustor.seed!,
      "--freeze",
      "--unfreeze",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("--account + --keystore + --password signs and submits trust set", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-test-keystore-"));
    try {
      // Import the funded trustor seed into a temp keystore
      const importResult = runCLI([
        "wallet", "import",
        trustor.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `stdout: ${importResult.stdout} stderr: ${importResult.stderr}`).toBe(0);

      // Use --account + --keystore + --password to sign a trust set
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
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--clear-no-ripple clears the NoRipple flag on an existing trust line", () => {
    // First set no-ripple on a CNY trust line
    const setResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "CNY",
      "--issuer", issuer.address,
      "--limit", "5000",
      "--no-ripple",
      "--seed", trustor.seed!,
    ]);
    expect(setResult.status, `stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);
    expect(setResult.stdout).toContain("tesSUCCESS");

    // Clear no-ripple on the same trust line
    const clearResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "CNY",
      "--issuer", issuer.address,
      "--limit", "5000",
      "--clear-no-ripple",
      "--seed", trustor.seed!,
    ]);
    expect(clearResult.status, `stdout: ${clearResult.stdout} stderr: ${clearResult.stderr}`).toBe(0);
    expect(clearResult.stdout).toContain("tesSUCCESS");

    // Verify no_ripple is cleared
    const linesResult = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ currency: string; no_ripple?: boolean }>;
    const cnyLine = lines.find((l) => l.currency === "CNY");
    expect(cnyLine).toBeDefined();
    expect(cnyLine?.no_ripple).toBeFalsy();
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

    // Verify quality values on the trust line
    const linesResult = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{
      currency: string;
      quality_in?: number;
      quality_out?: number;
    }>;
    const jpyLine = lines.find((l) => l.currency === "JPY");
    expect(jpyLine).toBeDefined();
    expect(jpyLine?.quality_in).toBe(950000000);
    expect(jpyLine?.quality_out).toBe(950000000);
  });

  it("--freeze freezes a trust line (freeze_peer: true on trustor side)", () => {
    // Trustor establishes FRZ trust line
    const createResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "FRZ",
      "--issuer", issuer.address,
      "--limit", "1000",
      "--seed", trustor.seed!,
    ]);
    expect(createResult.status, `stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);
    expect(createResult.stdout).toContain("tesSUCCESS");

    // Issuer freezes the trustor's FRZ line
    const freezeResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "FRZ",
      "--issuer", trustor.address,
      "--limit", "0",
      "--freeze",
      "--seed", issuer.seed!,
    ]);
    expect(freezeResult.status, `stdout: ${freezeResult.stdout} stderr: ${freezeResult.stderr}`).toBe(0);
    expect(freezeResult.stdout).toContain("tesSUCCESS");

    // Verify freeze_peer: true on trustor's view
    const linesResult = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ currency: string; freeze_peer?: boolean }>;
    const frzLine = lines.find((l) => l.currency === "FRZ");
    expect(frzLine).toBeDefined();
    expect(frzLine?.freeze_peer).toBe(true);
  });

  it("--unfreeze clears the freeze on a trust line", () => {
    // Issuer unfreezes the FRZ line (established and frozen by previous test)
    const unfreezeResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "FRZ",
      "--issuer", trustor.address,
      "--limit", "0",
      "--unfreeze",
      "--seed", issuer.seed!,
    ]);
    expect(unfreezeResult.status, `stdout: ${unfreezeResult.stdout} stderr: ${unfreezeResult.stderr}`).toBe(0);
    expect(unfreezeResult.stdout).toContain("tesSUCCESS");

    // Verify freeze_peer is no longer true
    const linesResult = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ currency: string; freeze_peer?: boolean }>;
    const frzLine = lines.find((l) => l.currency === "FRZ");
    expect(frzLine).toBeDefined();
    expect(frzLine?.freeze_peer).toBeFalsy();
  });

  it("--auth authorizes a trust line (peer_authorized: true on trustor side)", () => {
    // RequireAuth is already enabled on authIssuer from beforeAll.
    // Trustor creates AUT trust line with authIssuer
    const createResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "AUT",
      "--issuer", authIssuer.address,
      "--limit", "100",
      "--seed", trustor.seed!,
    ]);
    expect(createResult.status, `stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);
    expect(createResult.stdout).toContain("tesSUCCESS");

    // authIssuer authorizes the AUT trust line
    const authResult = runCLI([
      "--node", "testnet",
      "trust", "set",
      "--currency", "AUT",
      "--issuer", trustor.address,
      "--limit", "0",
      "--auth",
      "--seed", authIssuer.seed!,
    ]);
    expect(authResult.status, `stdout: ${authResult.stdout} stderr: ${authResult.stderr}`).toBe(0);
    expect(authResult.stdout).toContain("tesSUCCESS");

    // Verify peer_authorized: true on trustor's view
    const linesResult = runCLI([
      "--node", "testnet",
      "account", "trust-lines", "--json", trustor.address,
    ]);
    expect(linesResult.status).toBe(0);
    const lines = JSON.parse(linesResult.stdout) as Array<{ currency: string; peer_authorized?: boolean }>;
    const autLine = lines.find((l) => l.currency === "AUT");
    expect(autLine).toBeDefined();
    expect(autLine?.peer_authorized).toBe(true);
  });
});
