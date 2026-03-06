import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { AccountRoot, Payment as XrplPayment } from "xrpl";
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

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

let testWallet: Wallet;
let testMnemonic: string;
let mnemonicWalletAddress: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    testWallet = await fundFromFaucet(client);

    // Generate a fresh random mnemonic and fund the derived wallet from testWallet
    testMnemonic = generateMnemonic(wordlist);
    const mnemonicWallet = Wallet.fromMnemonic(testMnemonic, {
      mnemonicEncoding: "bip39",
      derivationPath: "m/44'/144'/0'/0/0",
    });
    mnemonicWalletAddress = mnemonicWallet.address;

    const fundTx = await client.autofill({
      TransactionType: "Payment",
      Account: testWallet.address,
      Amount: xrpToDrops(15),
      Destination: mnemonicWalletAddress,
    } as XrplPayment);
    await client.submitAndWait(testWallet.sign(fundTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("account set flags", () => {
  it("--set-flag defaultRipple sets lsfDefaultRipple bit on-chain", async () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--set-flag", "defaultRipple",
      "--seed", testWallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    await sleep(10_000);

    const infoResult = runCLI(["--node", "testnet", "account", "info", "--json", testWallet.address]);
    expect(infoResult.status, `stdout: ${infoResult.stdout} stderr: ${infoResult.stderr}`).toBe(0);
    const data = JSON.parse(infoResult.stdout) as AccountRoot;
    // lsfDefaultRipple = 0x00800000
    expect(data.Flags! & 0x00800000).not.toBe(0);
  }, 60_000);

  it("--clear-flag defaultRipple clears lsfDefaultRipple bit on-chain", async () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--clear-flag", "defaultRipple",
      "--seed", testWallet.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    await sleep(10_000);

    const infoResult = runCLI(["--node", "testnet", "account", "info", "--json", testWallet.address]);
    expect(infoResult.status, `stdout: ${infoResult.stdout} stderr: ${infoResult.stderr}`).toBe(0);
    const data = JSON.parse(infoResult.stdout) as AccountRoot;
    // lsfDefaultRipple = 0x00800000 — should be cleared
    expect(data.Flags! & 0x00800000).toBe(0);
  }, 60_000);

  it("--mnemonic key material submits AccountSet successfully", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--domain", "mnemonic.example.com",
      "--mnemonic", testMnemonic,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/Transaction submitted:/);
  }, 60_000);

  it("--account + --keystore + --password submits AccountSet successfully", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-test-keystore-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        testWallet.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `stdout: ${importResult.stdout} stderr: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "testnet",
        "account", "set",
        "--domain", "keystore.example.com",
        "--account", testWallet.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toMatch(/Transaction submitted:/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 60_000);
});
