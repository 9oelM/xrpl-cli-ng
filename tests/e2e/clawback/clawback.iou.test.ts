import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { AccountSet, TrustSet, Payment as XrplPayment } from "xrpl";
import { AccountSetAsfFlags } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let issuer: Wallet;
let holder: Wallet;
const CURRENCY = "CBK";

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

    // Enable clawback on issuer account (asfAllowTrustLineClawback = 16)
    const setTx: AccountSet = await client.autofill({
      TransactionType: "AccountSet",
      Account: issuer.address,
      SetFlag: AccountSetAsfFlags.asfAllowTrustLineClawback,
    });
    await client.submitAndWait(issuer.sign(setTx).tx_blob);

    // Holder creates trust line to issuer
    const trustTx: TrustSet = await client.autofill({
      TransactionType: "TrustSet",
      Account: holder.address,
      LimitAmount: { currency: CURRENCY, issuer: issuer.address, value: "10000" },
    });
    await client.submitAndWait(holder.sign(trustTx).tx_blob);

    // Issuer sends tokens to holder
    const issueTx: XrplPayment = await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Destination: holder.address,
      Amount: { currency: CURRENCY, issuer: issuer.address, value: "100" },
    });
    await client.submitAndWait(issuer.sign(issueTx).tx_blob);
  } finally {
    await client.disconnect();
  }
}, 300_000);

describe("clawback IOU", () => {
  it("claws back IOU tokens from holder and gets tesSUCCESS", () => {
    const result = runCLI([
      "--node", "testnet",
      "clawback",
      "--amount", `50/${CURRENCY}/${holder.address}`,
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json outputs JSON with hash and result", () => {
    const result = runCLI([
      "--node", "testnet",
      "clawback",
      "--amount", `10/${CURRENCY}/${holder.address}`,
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
      "--amount", `5/${CURRENCY}/${holder.address}`,
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx_blob).toBeDefined();
    expect(out.tx.TransactionType).toBe("Clawback");
  });

  it("--no-wait submits without waiting for validation", () => {
    const result = runCLI([
      "--node", "testnet",
      "clawback",
      "--amount", `1/${CURRENCY}/${holder.address}`,
      "--seed", issuer.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/Transaction:/);
  });
});
