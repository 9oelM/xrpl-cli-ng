import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let owner: Wallet;
let signer1: Wallet;
let signer2: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    owner = await fundFromFaucet(client);
    signer1 = Wallet.generate();
    signer2 = Wallet.generate();
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("multisig delete core", () => {
  it("sets then deletes a signer list; multisig list shows no signer list after deletion", () => {
    // First set a signer list
    const setResult = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "1",
      "--signer", `${signer1.address}:1`,
      "--signer", `${signer2.address}:1`,
      "--seed", owner.seed!,
    ]);
    expect(setResult.status, `stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);
    expect(setResult.stdout).toContain("tesSUCCESS");

    // Now delete it
    const deleteResult = runCLI([
      "--node", "testnet",
      "multisig", "delete",
      "--seed", owner.seed!,
    ]);
    expect(deleteResult.status, `stdout: ${deleteResult.stdout} stderr: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");

    // Verify list shows no signer list
    const listResult = runCLI([
      "--node", "testnet",
      "multisig", "list",
      owner.address,
    ]);
    expect(listResult.status, `stdout: ${listResult.stdout} stderr: ${listResult.stderr}`).toBe(0);
    expect(listResult.stdout).toContain("No signer list configured.");
  });

  it("--json outputs hash, result, fee, ledger", () => {
    // Set a signer list first so there's something to delete
    const setResult = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "1",
      "--signer", `${signer1.address}:1`,
      "--seed", owner.seed!,
    ]);
    expect(setResult.status, `stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);

    const result = runCLI([
      "--node", "testnet",
      "multisig", "delete",
      "--seed", owner.seed!,
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
  });

  it("--dry-run outputs signed tx JSON with TransactionType SignerListSet and does not submit", () => {
    const result = runCLI([
      "--node", "testnet",
      "multisig", "delete",
      "--seed", owner.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; SignerQuorum: number } };
    expect(out.tx.TransactionType).toBe("SignerListSet");
    expect(out.tx.SignerQuorum).toBe(0);
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait submits without waiting for validation", () => {
    // Set a signer list first
    const setResult = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "1",
      "--signer", `${signer1.address}:1`,
      "--seed", owner.seed!,
    ]);
    expect(setResult.status, `stdout: ${setResult.stdout} stderr: ${setResult.stderr}`).toBe(0);

    const result = runCLI([
      "--node", "testnet",
      "multisig", "delete",
      "--seed", owner.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Transaction:");
  });
});
