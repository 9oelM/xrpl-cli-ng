import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let sender: Wallet;
let receiver: Wallet;
let checkId: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    sender = await fundFromFaucet(client);
    receiver = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }

  // Create a check so we have something to list
  const result = runCLI([
    "--node", "testnet",
    "check", "create",
    "--to", receiver.address,
    "--send-max", "15",
    "--seed", sender.seed!,
    "--json",
  ]);
  if (result.status !== 0) {
    throw new Error(`check create failed: ${result.stderr}`);
  }
  const out = JSON.parse(result.stdout) as { checkId: string };
  checkId = out.checkId;
}, 180_000);

describe("check list", () => {
  it("lists checks for an account and includes the created check ID", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "list",
      sender.address,
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(checkId);
    expect(result.stdout).toContain("CheckID:");
    expect(result.stdout).toContain("SendMax:");
    expect(result.stdout).toContain("Destination:");
  });

  it("--json outputs a JSON array containing the created check", () => {
    const result = runCLI([
      "--node", "testnet",
      "check", "list",
      sender.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
    const checks = JSON.parse(result.stdout) as Array<{ checkId: string; sendMax: string; destination: string }>;
    expect(Array.isArray(checks)).toBe(true);
    const found = checks.find((c) => c.checkId === checkId);
    expect(found).toBeDefined();
    expect(found!.destination).toBe(receiver.address);
    expect(found!.sendMax).toContain("XRP");
  });
});
