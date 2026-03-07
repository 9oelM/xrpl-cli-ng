import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops, decodeAccountID } from "xrpl";
import type { MPTokenIssuanceCreate, MPTokenAuthorize, Payment as XrplPayment } from "xrpl";
import { MPTokenIssuanceCreateFlags } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;
let holder: Wallet;
// Each issuance is used by exactly one test (or pair of sequential tests)
let basicIssuanceId: string;       // holder opts in test
let optOutIssuanceId: string;      // holder pre-opts-in in beforeAll; opt-out test uses it
let requireAuthIssuanceId: string; // tfMPTRequireAuth; holder pre-opts-in; issuer authorize + revoke run sequentially
let jsonIssuanceId: string;        // --json opt-in test
let noWaitIssuanceId: string;      // --no-wait opt-in test

/**
 * Create an MPTokenIssuance and return its MPTokenIssuanceID.
 * MPTokenIssuanceID = Sequence (4 bytes big-endian) + AccountID (20 bytes) = 24 bytes / 48 hex chars.
 * (The LedgerIndex in AffectedNodes is a 32-byte ledger key — different from MPTokenIssuanceID.)
 */
async function createIssuance(
  client: Client,
  wallet: Wallet,
  flags?: number
): Promise<string> {
  const tx: MPTokenIssuanceCreate = await client.autofill({
    TransactionType: "MPTokenIssuanceCreate",
    Account: wallet.address,
    ...(flags !== undefined ? { Flags: flags } : {}),
  });
  const result = await client.submitAndWait(wallet.sign(tx).tx_blob);
  const txJson = result.result.tx_json as { Sequence: number; Account: string };
  const seqBuf = Buffer.alloc(4);
  seqBuf.writeUInt32BE(txJson.Sequence, 0);
  return Buffer.concat([seqBuf, Buffer.from(decodeAccountID(txJson.Account))])
    .toString("hex")
    .toUpperCase();
}

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    issuer = await fundFromFaucet(client);

    // Fund holder from issuer (1 XRP base + buffer for owner reserves)
    holder = Wallet.generate();
    const fundTx: XrplPayment = await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Amount: xrpToDrops(10),
      Destination: holder.address,
    });
    await client.submitAndWait(issuer.sign(fundTx).tx_blob);

    // Create 5 issuances (sequentially, uses issuer's account sequence)
    basicIssuanceId = await createIssuance(client, issuer);
    optOutIssuanceId = await createIssuance(client, issuer);
    requireAuthIssuanceId = await createIssuance(
      client,
      issuer,
      MPTokenIssuanceCreateFlags.tfMPTRequireAuth
    );
    jsonIssuanceId = await createIssuance(client, issuer);
    noWaitIssuanceId = await createIssuance(client, issuer);

    // Pre-opt-in holder to optOutIssuanceId so the opt-out test can run immediately
    const optInForOptOut: MPTokenAuthorize = await client.autofill({
      TransactionType: "MPTokenAuthorize",
      Account: holder.address,
      MPTokenIssuanceID: optOutIssuanceId,
    });
    await client.submitAndWait(holder.sign(optInForOptOut).tx_blob);

    // Pre-opt-in holder to requireAuthIssuanceId (required before issuer can authorize on require-auth)
    const optInForRequireAuth: MPTokenAuthorize = await client.autofill({
      TransactionType: "MPTokenAuthorize",
      Account: holder.address,
      MPTokenIssuanceID: requireAuthIssuanceId,
    });
    await client.submitAndWait(holder.sign(optInForRequireAuth).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 300_000);

describe("mptoken authorize", () => {
  it("holder opts in to an issuance via CLI", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "authorize", basicIssuanceId,
      "--seed", holder.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("holder opts out of an issuance via CLI (--unauthorize, balance is zero)", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "authorize", optOutIssuanceId,
      "--unauthorize",
      "--seed", holder.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("issuer authorizes holder on require-auth issuance via CLI (--holder)", () => {
    // Holder already opted in during beforeAll; now issuer grants access
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "authorize", requireAuthIssuanceId,
      "--holder", holder.address,
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("issuer revokes holder authorization on require-auth issuance (--holder --unauthorize)", () => {
    // Issuer authorized holder in previous test; now revoke
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "authorize", requireAuthIssuanceId,
      "--holder", holder.address,
      "--unauthorize",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("--json outputs hash, result, fee, ledger", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "authorize", jsonIssuanceId,
      "--seed", holder.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  }, 90_000);

  it("--dry-run outputs tx_blob and TransactionType MPTokenAuthorize without submitting", () => {
    // dry-run does not submit so we can reuse any issuance ID (even one already opted into)
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "authorize", basicIssuanceId,
      "--seed", holder.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string };
    };
    expect(out.tx.TransactionType).toBe("MPTokenAuthorize");
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("--no-wait submits without waiting and outputs Transaction hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "authorize", noWaitIssuanceId,
      "--seed", holder.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  }, 90_000);
});
