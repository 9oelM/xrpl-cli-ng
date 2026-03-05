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

let iouIssuer: Wallet;
let iouReceiver: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    iouIssuer = await fundFromFaucet(client);
    iouReceiver = Wallet.generate();

    const fundTx = await client.autofill({
      TransactionType: "Payment",
      Account: iouIssuer.address,
      Amount: xrpToDrops(15),
      Destination: iouReceiver.address,
    } as XrplPayment);
    await client.submitAndWait(iouIssuer.sign(fundTx).tx_blob);

    const trustTx: TrustSet = await client.autofill({
      TransactionType: "TrustSet",
      Account: iouReceiver.address,
      LimitAmount: { currency: "USD", issuer: iouIssuer.address, value: "10000" },
    });
    await client.submitAndWait(iouReceiver.sign(trustTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("iou payment", () => {
  it("sends IOU payment (direct issuance) and gets tesSUCCESS", () => {
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
