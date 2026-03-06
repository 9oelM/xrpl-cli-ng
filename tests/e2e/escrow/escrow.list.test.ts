import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

function futureIso(secondsAhead: number): string {
  return new Date(Date.now() + secondsAhead * 1000).toISOString();
}

let sender: Wallet;
let receiver: Wallet;
let escrowSequence: number;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    sender = await fundFromFaucet(client);
    receiver = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }

  // Create a time-based escrow that we will list
  const result = runCLI([
    "--node", "testnet",
    "escrow", "create",
    "--to", receiver.address,
    "--amount", "1",
    "--finish-after", futureIso(300),
    "--seed", sender.seed!,
    "--json",
  ]);
  expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
  const out = JSON.parse(result.stdout) as { sequence: number; result: string };
  expect(out.result).toBe("tesSUCCESS");
  escrowSequence = out.sequence;
}, 180_000);

describe("escrow list", () => {
  it("lists pending escrows and shows sequence + amount + destination", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "list",
      sender.address,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`Sequence:    ${escrowSequence}`);
    expect(result.stdout).toContain("1.000000 XRP");
    expect(result.stdout).toContain(receiver.address);
  });

  it("--json outputs an array with the expected escrow entry", () => {
    const result = runCLI([
      "--node", "testnet",
      "escrow", "list",
      sender.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const arr = JSON.parse(result.stdout) as Array<{
      sequence: number;
      amount: string;
      destination: string;
      finishAfter: string;
      cancelAfter: string;
      condition: string;
    }>;
    expect(Array.isArray(arr)).toBe(true);
    const entry = arr.find((e) => e.sequence === escrowSequence);
    expect(entry).toBeDefined();
    expect(entry!.amount).toBe("1.000000");
    expect(entry!.destination).toBe(receiver.address);
    // FinishAfter was set so it should be an ISO string
    expect(entry!.finishAfter).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry!.cancelAfter).toBe("none");
    expect(entry!.condition).toBe("none");
  });

});
