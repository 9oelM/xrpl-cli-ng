import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops, decodeAccountID } from "xrpl";
import type { MPTokenIssuanceCreate, MPTokenAuthorize, Payment as XrplPayment } from "xrpl";
import { MPTokenIssuanceCreateFlags } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;
let holder: Wallet;
// Pre-created issuance with can-lock flag; holder has opted in via MPTokenAuthorize
let holderIssuanceId: string;
// Issuance created in the first test; reused for global lock/unlock/dry-run/no-wait tests
let globalIssuanceId: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    issuer = await fundFromFaucet(client);

    // Fund holder wallet
    holder = Wallet.generate();
    const fundTx: XrplPayment = await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Amount: xrpToDrops(10),
      Destination: holder.address,
    });
    await client.submitAndWait(issuer.sign(fundTx).tx_blob);

    // Create issuance with can-lock + can-transfer flags for per-holder tests
    const createTx: MPTokenIssuanceCreate = await client.autofill({
      TransactionType: "MPTokenIssuanceCreate",
      Account: issuer.address,
      Flags:
        MPTokenIssuanceCreateFlags.tfMPTCanLock |
        MPTokenIssuanceCreateFlags.tfMPTCanTransfer,
    });
    const createResult = await client.submitAndWait(issuer.sign(createTx).tx_blob);

    const txJson = createResult.result.tx_json as { Sequence: number; Account: string };
    const seqBuf = Buffer.alloc(4);
    seqBuf.writeUInt32BE(txJson.Sequence, 0);
    holderIssuanceId = Buffer.concat([
      seqBuf,
      Buffer.from(decodeAccountID(txJson.Account)),
    ])
      .toString("hex")
      .toUpperCase();

    // Holder opts in to holderIssuance
    const authTx: MPTokenAuthorize = await client.autofill({
      TransactionType: "MPTokenAuthorize",
      Account: holder.address,
      MPTokenIssuanceID: holderIssuanceId,
    });
    await client.submitAndWait(holder.sign(authTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 300_000);

describe("mptoken issuance destroy and set", () => {
  it("creates an issuance with --flags can-lock via CLI", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--flags", "can-lock",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    const idMatch = result.stdout.match(/MPTokenIssuanceID:\s+([0-9A-Fa-f]+)/);
    expect(idMatch, "Expected MPTokenIssuanceID in output").toBeTruthy();
    globalIssuanceId = idMatch![1]!;
  }, 90_000);

  it("locks issuance globally via issuance set --lock", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "set", globalIssuanceId,
      "--lock",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("unlocks issuance globally via issuance set --unlock", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "set", globalIssuanceId,
      "--unlock",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("locks per-holder balance via issuance set --lock --holder", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "set", holderIssuanceId,
      "--lock", "--holder", holder.address,
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("unlocks per-holder balance via issuance set --unlock --holder (--json)", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "set", holderIssuanceId,
      "--unlock", "--holder", holder.address,
      "--seed", issuer.seed!,
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

  it("issuance set --dry-run outputs TransactionType MPTokenIssuanceSet without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "set", globalIssuanceId,
      "--lock",
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; Flags: number };
    };
    expect(out.tx.TransactionType).toBe("MPTokenIssuanceSet");
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("issuance set --no-wait submits without waiting and outputs Transaction hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "set", globalIssuanceId,
      "--lock",
      "--seed", issuer.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  }, 90_000);

  it("destroys an issuance via issuance destroy", () => {
    // Create a fresh issuance to destroy (no outstanding MPT, safe to delete)
    const createResult = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);
    const idMatch = createResult.stdout.match(/MPTokenIssuanceID:\s+([0-9A-Fa-f]+)/);
    expect(idMatch, "Expected MPTokenIssuanceID").toBeTruthy();
    const destroyIssuanceId = idMatch![1]!;

    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "destroy", destroyIssuanceId,
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 120_000);

  it("issuance destroy --json outputs hash, result, fee, ledger", () => {
    const createResult = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);
    const idMatch = createResult.stdout.match(/MPTokenIssuanceID:\s+([0-9A-Fa-f]+)/);
    expect(idMatch, "Expected MPTokenIssuanceID").toBeTruthy();
    const destroyIssuanceId = idMatch![1]!;

    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "destroy", destroyIssuanceId,
      "--seed", issuer.seed!,
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
  }, 120_000);

  it("issuance destroy --dry-run outputs TransactionType MPTokenIssuanceDestroy without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "destroy", globalIssuanceId,
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string };
    };
    expect(out.tx.TransactionType).toBe("MPTokenIssuanceDestroy");
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("issuance destroy --no-wait submits without waiting and outputs Transaction hash", () => {
    const createResult = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "create",
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `stdout: ${createResult.stdout} stderr: ${createResult.stderr}`).toBe(0);
    const idMatch = createResult.stdout.match(/MPTokenIssuanceID:\s+([0-9A-Fa-f]+)/);
    expect(idMatch, "Expected MPTokenIssuanceID").toBeTruthy();
    const destroyIssuanceId = idMatch![1]!;

    const result = runCLI([
      "--node", "testnet",
      "mptoken", "issuance", "destroy", destroyIssuanceId,
      "--seed", issuer.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  }, 120_000);
});
