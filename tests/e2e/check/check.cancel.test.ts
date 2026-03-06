import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

// A dummy check ID for --dry-run (autofill doesn't validate CheckID existence)
const DUMMY_CHECK_ID = "49647F0D748DC3FE26BDACBC57F251AADEFFF391403EC9BF87C97F67E9977FB0";

let sender: Wallet;
let receiver: Wallet;
let checkIdNormal: string;
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

  // Create one check per consuming test
  checkIdNormal = createCheck(sender.seed!, receiver.address);
  checkIdJson = createCheck(sender.seed!, receiver.address);
  checkIdNoWait = createCheck(sender.seed!, receiver.address);
}, 180_000);

describe("check cancel", () => {
  it("sender cancels own check", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cancel",
      "--check", checkIdNormal,
      "--seed", sender.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json output includes hash and result fields", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cancel",
      "--check", checkIdJson,
      "--seed", sender.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toHaveLength(64);
  });

  it("--dry-run outputs signed tx with TransactionType CheckCancel without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cancel",
      "--check", DUMMY_CHECK_ID,
      "--seed", sender.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CheckCancel");
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait exits 0 and outputs a 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "cancel",
      "--check", checkIdNoWait,
      "--seed", sender.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("receiver can cancel a check sent to them", () => {
    // Create a fresh check for this test since we need to cancel it as receiver
    const checkId = createCheck(sender.seed!, receiver.address);
    const result = runCLI([
      "--node", "testnet",
      "check", "cancel",
      "--check", checkId,
      "--seed", receiver.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });
});
