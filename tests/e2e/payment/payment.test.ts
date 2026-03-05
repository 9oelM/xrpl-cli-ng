import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { TrustSet, Payment as XrplPayment, MPTokenIssuanceCreate, MPTokenAuthorize, TransactionMetadata } from "xrpl";
import { decodeAccountID } from "xrpl";
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

  it("--amount with invalid format exits 1 and stderr contains 'invalid amount'", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "notanamount!!",
      "--seed", sender.seed!,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("invalid amount");
  });
});

describe("iou payment", () => {
  let iouIssuer: Wallet;
  let iouReceiver: Wallet;

  beforeAll(async () => {
    const client = new Client(TESTNET_URL);
    await client.connect();
    try {
      // Fund issuer from faucet; receiver gets XRP from issuer
      iouIssuer = await fundFromFaucet(client);
      iouReceiver = Wallet.generate();

      // Fund receiver (needs XRP for reserve)
      const fundTx = await client.autofill({
        TransactionType: "Payment",
        Account: iouIssuer.address,
        Amount: xrpToDrops(15),
        Destination: iouReceiver.address,
      } as XrplPayment);
      const signedFund = iouIssuer.sign(fundTx);
      await client.submitAndWait(signedFund.tx_blob);

      // iouReceiver creates trust line for iouIssuer/USD
      const trustReceiver: TrustSet = await client.autofill({
        TransactionType: "TrustSet",
        Account: iouReceiver.address,
        LimitAmount: { currency: "USD", issuer: iouIssuer.address, value: "10000" },
      });
      const signedTrustReceiver = iouReceiver.sign(trustReceiver);
      await client.submitAndWait(signedTrustReceiver.tx_blob);
    } finally {
      await client.disconnect();
    }
  }, 180_000);

  it("sends IOU payment (direct issuance) and gets tesSUCCESS", () => {
    // Issuer directly sends tokens to receiver — no rippling needed
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", iouReceiver.address,
      "--amount", `10/USD/${iouIssuer.address}`,
      "--seed", iouIssuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });
});

describe("mpt payment", () => {
  let mptIssuer: Wallet;
  let mptReceiver: Wallet;
  let mptIssuanceId: string;

  beforeAll(async () => {
    const client = new Client(TESTNET_URL);
    await client.connect();
    try {
      mptIssuer = await fundFromFaucet(client);
      mptReceiver = Wallet.generate();

      // Fund receiver from issuer
      const fundTx = await client.autofill({
        TransactionType: "Payment",
        Account: mptIssuer.address,
        Amount: xrpToDrops(15),
        Destination: mptReceiver.address,
      } as XrplPayment);
      const signedFund = mptIssuer.sign(fundTx);
      await client.submitAndWait(signedFund.tx_blob);

      // Create MPT issuance (tfMPTCanTransfer so it can move between accounts)
      const createTx: MPTokenIssuanceCreate = await client.autofill({
        TransactionType: "MPTokenIssuanceCreate",
        Account: mptIssuer.address,
        Flags: 32, // tfMPTCanTransfer
        MaximumAmount: "1000000000",
      });
      const signedCreate = mptIssuer.sign(createTx);
      const createResult = await client.submitAndWait(signedCreate.tx_blob);

      // Compute MPTokenIssuanceID = 4-byte sequence (big-endian) + 20-byte account ID
      const txJson = createResult.result.tx_json as { Sequence: number; Account: string };
      const seqBuf = Buffer.alloc(4);
      seqBuf.writeUInt32BE(txJson.Sequence, 0);
      const accountIdBytes = Buffer.from(decodeAccountID(txJson.Account));
      mptIssuanceId = Buffer.concat([seqBuf, accountIdBytes]).toString("hex").toUpperCase();

      // Receiver opts in to the MPT issuance
      const authTx: MPTokenAuthorize = await client.autofill({
        TransactionType: "MPTokenAuthorize",
        Account: mptReceiver.address,
        MPTokenIssuanceID: mptIssuanceId,
      });
      const signedAuth = mptReceiver.sign(authTx);
      await client.submitAndWait(signedAuth.tx_blob);
    } finally {
      await client.disconnect();
    }
  }, 180_000);

  it("sends MPT payment from issuer to receiver and gets tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", mptReceiver.address,
      "--amount", `100/${mptIssuanceId}`,
      "--seed", mptIssuer.seed!,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });
});
