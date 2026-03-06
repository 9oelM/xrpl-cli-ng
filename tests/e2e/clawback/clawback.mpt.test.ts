import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops, decodeAccountID } from "xrpl";
import type { MPTokenIssuanceCreate, MPTokenAuthorize, Payment as XrplPayment } from "xrpl";
import { MPTokenIssuanceCreateFlags } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;
let holder: Wallet;
let mptIssuanceId: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    issuer = await fundFromFaucet(client);
    holder = Wallet.generate();

    // Fund holder with XRP
    const fundTx: XrplPayment = await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Amount: xrpToDrops(20),
      Destination: holder.address,
    });
    await client.submitAndWait(issuer.sign(fundTx).tx_blob);

    // Create MPT issuance with clawback + transfer enabled
    // tfMPTCanClawback = 0x00000010, tfMPTCanTransfer = 0x00000020
    const createTx: MPTokenIssuanceCreate = await client.autofill({
      TransactionType: "MPTokenIssuanceCreate",
      Account: issuer.address,
      Flags: MPTokenIssuanceCreateFlags.tfMPTCanTransfer | MPTokenIssuanceCreateFlags.tfMPTCanClawback,
      MaximumAmount: "1000000000",
    });
    const createResult = await client.submitAndWait(issuer.sign(createTx).tx_blob);

    const txJson = createResult.result.tx_json as { Sequence: number; Account: string };
    const seqBuf = Buffer.alloc(4);
    seqBuf.writeUInt32BE(txJson.Sequence, 0);
    mptIssuanceId = Buffer.concat([seqBuf, Buffer.from(decodeAccountID(txJson.Account))]).toString("hex").toUpperCase();

    // Holder opts in to MPT
    const authTx: MPTokenAuthorize = await client.autofill({
      TransactionType: "MPTokenAuthorize",
      Account: holder.address,
      MPTokenIssuanceID: mptIssuanceId,
    });
    await client.submitAndWait(holder.sign(authTx).tx_blob);

    // Issuer sends MPT to holder
    const sendTx: XrplPayment = await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Destination: holder.address,
      Amount: { value: "100", mpt_issuance_id: mptIssuanceId },
    });
    await client.submitAndWait(issuer.sign(sendTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 300_000);

describe("clawback MPT", () => {
  it("claws back MPT tokens from holder and gets tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "clawback",
      "--amount", `50/${mptIssuanceId}`,
      "--holder", holder.address,
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json outputs JSON with hash and result", () => {
    const result = runCLI([
      "--node", "testnet",
      "clawback",
      "--amount", `10/${mptIssuanceId}`,
      "--holder", holder.address,
      "--seed", issuer.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toBeDefined();
  });

  it("--dry-run prints tx_blob without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "clawback",
      "--amount", `5/${mptIssuanceId}`,
      "--holder", holder.address,
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; Holder: string } };
    expect(out.tx_blob).toBeDefined();
    expect(out.tx.TransactionType).toBe("Clawback");
    expect(out.tx.Holder).toBe(holder.address);
  });
});
