import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { Client, Wallet, AccountSetAsfFlags } from "xrpl";
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

describe("trust set issuer-side flags", () => {
  it("--freeze freezes a trust line (freeze_peer: true on trustor side)", () => {
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
