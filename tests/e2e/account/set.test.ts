import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync, exec } from "child_process";
import { promisify } from "util";
import { resolve } from "path";
import { Client, Wallet } from "xrpl";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");
const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";
const execAsync = promisify(exec);

const E2E_PATH = `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`;

function runCLI(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: E2E_PATH,
      ...extraEnv,
    },
    timeout: 60_000,
  });
}

let testWallet: Wallet;

beforeAll(async () => {
  // Fund a fresh wallet
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    const funded = await client.fundWallet();
    testWallet = funded.wallet;
  } finally {
    await client.disconnect();
  }

  // Set domain via CLI asynchronously (avoids blocking the event loop)
  await execAsync(
    `"${TSX}" "${CLI}" --node testnet account set --seed "${testWallet.seed!}" --domain example.com`,
    {
      timeout: 30_000,
      env: { ...process.env, PATH: E2E_PATH },
    }
  );

  // Wait for the transaction to be included in a validated ledger (~3-4s on testnet)
  await new Promise<void>((res) => setTimeout(res, 8_000));
}, 180_000);

describe("account set", () => {
  it("sets domain on account and outputs transaction hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--seed", testWallet.seed!,
      "--domain", "second.example.com",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Transaction submitted:");
    expect(result.stdout).toMatch(/Transaction submitted: [A-F0-9]+/i);
  });

  it("account info shows domain after account set", () => {
    const infoResult = runCLI([
      "--node", "testnet",
      "account", "info", testWallet.address,
    ]);
    expect(infoResult.status).toBe(0);
    expect(infoResult.stdout).toContain("Domain:");
    expect(infoResult.stdout).toContain("example.com");
  });

  it("--dry-run prints AccountSet JSON without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--seed", testWallet.seed!,
      "--domain", "dryrun.example.com",
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const tx = JSON.parse(result.stdout) as { TransactionType: string; Account: string; Domain: string };
    expect(tx.TransactionType).toBe("AccountSet");
    expect(tx.Account).toBe(testWallet.address);
    expect(tx.Domain).toBe(
      Buffer.from("dryrun.example.com", "utf8").toString("hex").toUpperCase()
    );
  });

  it("--json outputs hash, result, tx_blob", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--seed", testWallet.seed!,
      "--set-flag", "requireDestTag",
      "--json",
    ]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { hash: string; result: string; tx_blob: string };
    expect(typeof data.hash).toBe("string");
    expect(data.hash.length).toBeGreaterThan(0);
    expect(typeof data.tx_blob).toBe("string");
  });

  it("exits 1 when no key material provided", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--domain", "example.com",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error: provide key material");
  });

  it("exits 1 when no setting fields provided", () => {
    const result = runCLI([
      "--node", "testnet",
      "account", "set",
      "--seed", testWallet.seed!,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error: provide at least one setting");
  });
});
