import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { TrustSet, Payment as XrplPayment } from "xrpl";
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

let flagSender: Wallet;
let flagReceiver: Wallet;
let flagIssuer: Wallet;
let flagHolder: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    flagSender = await fundFromFaucet(client);
    flagReceiver = await fundFromFaucet(client);
    flagIssuer = await fundFromFaucet(client);
    flagHolder = Wallet.generate();

    const fundTx = await client.autofill({
      TransactionType: "Payment",
      Account: flagIssuer.address,
      Amount: xrpToDrops(15),
      Destination: flagHolder.address,
    } as XrplPayment);
    await client.submitAndWait(flagIssuer.sign(fundTx).tx_blob);

    const trustTx: TrustSet = await client.autofill({
      TransactionType: "TrustSet",
      Account: flagHolder.address,
      LimitAmount: { currency: "USD", issuer: flagIssuer.address, value: "10000" },
    });
    await client.submitAndWait(flagHolder.sign(trustTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("path payment flags", () => {
  it("--paths '[]' (empty array) is accepted without error", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", flagReceiver.address,
      "--amount", "0.5",
      "--seed", flagSender.seed!,
      "--paths", "[]",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--partial --json output includes deliveredAmount (IOU partial payment)", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", flagHolder.address,
      "--amount", `1/USD/${flagIssuer.address}`,
      "--send-max", `2/USD/${flagIssuer.address}`,
      "--seed", flagIssuer.seed!,
      "--partial",
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; deliveredAmount: unknown };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.deliveredAmount).toBeDefined();
  });

  it("--partial --deliver-min --send-max IOU payment asserts deliveredAmount >= deliver-min", () => {
    const result = runCLI([
      "--node", "testnet",
      "payment",
      "--to", flagHolder.address,
      "--amount", `2/USD/${flagIssuer.address}`,
      "--send-max", `2/USD/${flagIssuer.address}`,
      "--deliver-min", `1/USD/${flagIssuer.address}`,
      "--partial",
      "--seed", flagIssuer.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      hash: string;
      result: string;
      deliveredAmount: string | { value: string; currency: string; issuer: string };
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.deliveredAmount).toBeDefined();
    // deliveredAmount may be a string (XRP drops) or object (IOU)
    const deliveredValue =
      typeof out.deliveredAmount === "string"
        ? Number(out.deliveredAmount)
        : Number((out.deliveredAmount as { value: string }).value);
    expect(deliveredValue).toBeGreaterThan(0);
    expect(deliveredValue).toBeGreaterThanOrEqual(1); // >= deliver-min of 1 USD
  });
});
