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

let sender: Wallet;
let receiver: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    sender = await fundFromFaucet(client);
    receiver = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("payment", () => {
  it("sends 1 XRP between testnet accounts and prints tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "1",
      "--seed", sender.seed!,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("alias 'send' works", () => {
    const result = runCLI([
      "--node", "testnet",
      "send",
      "--to", receiver.address,
      "--amount", "0.5",
      "--seed", sender.seed!,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--dry-run outputs JSON with TransactionType Payment and does not submit", () => {
    const txsBefore = runCLI([
      "--node", "testnet",
      "account", "transactions", "--json", "--limit", "5", sender.address,
    ]);
    expect(txsBefore.status).toBe(0);
    const beforeData = JSON.parse(txsBefore.stdout) as { transactions: unknown[] };
    const countBefore = beforeData.transactions.length;

    const dryRunResult = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "0.1",
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(dryRunResult.status).toBe(0);
    const out = JSON.parse(dryRunResult.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("Payment");
    expect(typeof out.tx_blob).toBe("string");

    const txsAfter = runCLI([
      "--node", "testnet",
      "account", "transactions", "--json", "--limit", "5", sender.address,
    ]);
    expect(txsAfter.status).toBe(0);
    const afterData = JSON.parse(txsAfter.stdout) as { transactions: unknown[] };
    expect(afterData.transactions.length).toBe(countBefore);
  });

  it("--no-wait exits 0 and output contains a 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "0.5",
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--destination-tag sets DestinationTag on the submitted tx", async () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "0.5",
      "--seed", sender.seed!,
      "--destination-tag", "12345",
      "--json",
    ]);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; destinationTag: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.destinationTag).toBe(12345);

    // Verify the DestinationTag is on the ledger tx
    const txsResult = runCLI([
      "--node", "testnet",
      "account", "transactions", "--json", "--limit", "5", sender.address,
    ]);
    expect(txsResult.status).toBe(0);
    const txsData = JSON.parse(txsResult.stdout) as { transactions: Array<{ tx_json?: { DestinationTag?: number } }> };
    const recentTx = txsData.transactions.find((t) => t.tx_json?.DestinationTag === 12345);
    expect(recentTx).toBeDefined();
  });

  it("--memo attaches a Memos entry to the tx", async () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "0.5",
      "--seed", sender.seed!,
      "--memo", "hello",
      "--json",
    ]);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; memos: unknown[] };
    expect(out.result).toBe("tesSUCCESS");
    expect(Array.isArray(out.memos)).toBe(true);
    expect(out.memos.length).toBeGreaterThan(0);

    // Verify Memos on the ledger tx
    const txsResult = runCLI([
      "--node", "testnet",
      "account", "transactions", "--json", "--limit", "5", sender.address,
    ]);
    expect(txsResult.status).toBe(0);
    const txsData = JSON.parse(txsResult.stdout) as { transactions: Array<{ tx_json?: { Memos?: unknown[] } }> };
    const recentTx = txsData.transactions.find((t) => t.tx_json?.Memos && (t.tx_json.Memos as unknown[]).length > 0);
    expect(recentTx).toBeDefined();
  });
});
