import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Payment as XrplPayment } from "xrpl";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";



function getBalanceDrops(address: string): number {
  const result = runCLI(["--node", "testnet", "account", "info", "--json", address]);
  const data = JSON.parse(result.stdout) as { Balance: string };
  return Number(data.Balance);
}

let sender: Wallet;
let receiver: Wallet;
let testMnemonic: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    sender = await fundFromFaucet(client);
    receiver = await fundFromFaucet(client);

    // Generate a fresh random mnemonic and fund the derived wallet from sender
    testMnemonic = generateMnemonic(wordlist);
    const mnemonicWallet = Wallet.fromMnemonic(testMnemonic, {
      mnemonicEncoding: "bip39",
      derivationPath: "m/44'/144'/0'/0/0",
    });

    const fundTx = await client.autofill({
      TransactionType: "Payment",
      Account: sender.address,
      Amount: xrpToDrops(15),
      Destination: mnemonicWallet.address,
    } as XrplPayment);
    await client.submitAndWait(sender.sign(fundTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("payment core", () => {
  it("sends 1 XRP between testnet accounts and prints tesSUCCESS", () => {
    const senderBefore = getBalanceDrops(sender.address);
    const receiverBefore = getBalanceDrops(receiver.address);

    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "1",
      "--seed", sender.seed!,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");

    const senderAfter = getBalanceDrops(sender.address);
    const receiverAfter = getBalanceDrops(receiver.address);

    // Sender decreased by at least 1 XRP (1_000_000 drops) due to payment + fee
    expect(senderBefore - senderAfter).toBeGreaterThanOrEqual(1_000_000);
    // Receiver increased by exactly 1 XRP
    expect(receiverAfter - receiverBefore).toBe(1_000_000);
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
    const countBefore = (JSON.parse(txsBefore.stdout) as { transactions: unknown[] }).transactions.length;

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
    expect((JSON.parse(txsAfter.stdout) as { transactions: unknown[] }).transactions.length).toBe(countBefore);
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

    const txsResult = runCLI([
      "--node", "testnet",
      "account", "transactions", "--json", "--limit", "5", sender.address,
    ]);
    expect(txsResult.status).toBe(0);
    const txsData = JSON.parse(txsResult.stdout) as { transactions: Array<{ tx_json?: { Memos?: unknown[] } }> };
    const recentTx = txsData.transactions.find((t) => t.tx_json?.Memos && (t.tx_json.Memos as unknown[]).length > 0);
    expect(recentTx).toBeDefined();
  });

  it("--memo-type and --memo-format are included in dry-run tx Memos", () => {
    const memoTypeHex = Buffer.from("text/plain").toString("hex").toUpperCase();
    const memoFormatHex = Buffer.from("text/plain").toString("hex").toUpperCase();

    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "0.1",
      "--seed", sender.seed!,
      "--memo", "hello",
      "--memo-type", memoTypeHex,
      "--memo-format", memoFormatHex,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx: { Memos?: Array<{ Memo: { MemoData?: string; MemoType?: string; MemoFormat?: string } }> };
      tx_blob: string;
    };
    expect(Array.isArray(out.tx.Memos)).toBe(true);
    expect(typeof out.tx.Memos![0].Memo.MemoType).toBe("string");
    expect(out.tx.Memos![0].Memo.MemoType!.length).toBeGreaterThan(0);
    expect(typeof out.tx.Memos![0].Memo.MemoFormat).toBe("string");
    expect(out.tx.Memos![0].Memo.MemoFormat!.length).toBeGreaterThan(0);
  });

  it("--mnemonic key material sends successfully", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "0.5",
      "--mnemonic", testMnemonic,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--account + --keystore + --password key material sends successfully", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-test-keystore-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        sender.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `stdout: ${importResult.stdout} stderr: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "testnet",
        "payment",
        "--to", receiver.address,
        "--amount", "0.5",
        "--account", sender.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--no-ripple-direct sets tfNoRippleDirect bit in dry-run tx Flags", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "0.1",
      "--seed", sender.seed!,
      "--no-ripple-direct",
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { Flags?: number } };
    expect(out.tx.Flags).toBeDefined();
    // tfNoRippleDirect = 0x00010000 = 65536
    expect((out.tx.Flags! & 0x00010000)).not.toBe(0);
  });

  it("--limit-quality sets tfLimitQuality bit in dry-run tx Flags", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", receiver.address,
      "--amount", "0.1",
      "--seed", sender.seed!,
      "--limit-quality",
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { Flags?: number } };
    expect(out.tx.Flags).toBeDefined();
    // tfLimitQuality = 0x00040000 = 262144
    expect((out.tx.Flags! & 0x00040000)).not.toBe(0);
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
