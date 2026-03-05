import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { Client, Wallet } from "xrpl";
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

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    trustor = await fundFromFaucet(client);
    issuer = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

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
});
