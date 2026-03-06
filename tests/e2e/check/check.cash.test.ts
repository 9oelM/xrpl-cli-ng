import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

// A dummy check ID for --dry-run (autofill doesn't validate CheckID existence)
const DUMMY_CHECK_ID = "49647F0D748DC3FE26BDACBC57F251AADEFFF391403EC9BF87C97F67E9977FB0";

let sender: Wallet;
let receiver: Wallet;
let checkIdAmount: string;
let checkIdDeliverMin: string;
let checkIdJson: string;
let checkIdNoWait: string;

function createCheck(senderSeed: string, receiverAddress: string, sendMax = "20"): string {
  const result = runCLI([
    "--node", "testnet",
    "check", "create",
    "--to", receiverAddress,
    "--send-max", sendMax,
    "--seed", senderSeed,
    "--json",
  ]);
  if (result.status !== 0) {
    throw new Error(`check create failed: ${result.stderr}`);
  }
  const out = JSON.parse(result.stdout) as { checkId: string };
  return out.checkId;
}

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    sender = await fundFromFaucet(client);
    receiver = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }

  // Create one check per test that actually submits (consumes the check object)
  checkIdAmount = createCheck(sender.seed!, receiver.address);
  checkIdDeliverMin = createCheck(sender.seed!, receiver.address);
  checkIdJson = createCheck(sender.seed!, receiver.address);
  checkIdNoWait = createCheck(sender.seed!, receiver.address);
}, 180_000);

describe("check cash", () => {
  it("cashes an XRP check with --amount", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cash",
      "--check", checkIdAmount,
      "--amount", "10",
      "--seed", receiver.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("cashes an XRP check with --deliver-min", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cash",
      "--check", checkIdDeliverMin,
      "--deliver-min", "5",
      "--seed", receiver.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json output includes hash and result fields", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cash",
      "--check", checkIdJson,
      "--amount", "10",
      "--seed", receiver.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toHaveLength(64);
  });

  it("--dry-run outputs signed tx with TransactionType CheckCash without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cash",
      "--check", DUMMY_CHECK_ID,
      "--amount", "10",
      "--seed", receiver.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CheckCash");
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait exits 0 and outputs a 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cash",
      "--check", checkIdNoWait,
      "--amount", "10",
      "--seed", receiver.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });
});
