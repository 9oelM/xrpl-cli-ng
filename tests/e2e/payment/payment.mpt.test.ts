import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { Client, Wallet, xrpToDrops, decodeAccountID } from "xrpl";
import type { MPTokenIssuanceCreate, MPTokenAuthorize, Payment as XrplPayment } from "xrpl";
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

let mptIssuer: Wallet;
let mptReceiver: Wallet;
let mptIssuanceId: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    mptIssuer = await fundFromFaucet(client);
    mptReceiver = Wallet.generate();

    const fundTx = await client.autofill({
      TransactionType: "Payment",
      Account: mptIssuer.address,
      Amount: xrpToDrops(15),
      Destination: mptReceiver.address,
    } as XrplPayment);
    await client.submitAndWait(mptIssuer.sign(fundTx).tx_blob);

    const createTx: MPTokenIssuanceCreate = await client.autofill({
      TransactionType: "MPTokenIssuanceCreate",
      Account: mptIssuer.address,
      Flags: 32, // tfMPTCanTransfer
      MaximumAmount: "1000000000",
    });
    const createResult = await client.submitAndWait(mptIssuer.sign(createTx).tx_blob);

    const txJson = createResult.result.tx_json as { Sequence: number; Account: string };
    const seqBuf = Buffer.alloc(4);
    seqBuf.writeUInt32BE(txJson.Sequence, 0);
    mptIssuanceId = Buffer.concat([seqBuf, Buffer.from(decodeAccountID(txJson.Account))]).toString("hex").toUpperCase();

    const authTx: MPTokenAuthorize = await client.autofill({
      TransactionType: "MPTokenAuthorize",
      Account: mptReceiver.address,
      MPTokenIssuanceID: mptIssuanceId,
    });
    await client.submitAndWait(mptReceiver.sign(authTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("mpt payment", () => {
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
