import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundMaster, initTicketPool, createFunded, XRPL_WS } from "../helpers/fund.js";

// Budget: 10 tickets × 0.2 + 8 wallets × 5 XRP = 2 + 40 = 42 XRP ≤ 99 ✓
// 4 tests × 2 wallets (issuer + lp) = 8 wallets total

let client: Client;
let master: Wallet;

beforeAll(async () => {
  client = new Client(XRPL_WS);
  await client.connect();
  master = await fundMaster(client);
  await initTicketPool(client, master, 10);
}, 120_000);

afterAll(async () => {
  await client.disconnect();
});

/**
 * Set up trust line + IOU funding using the shared client.
 * Returns the IOU asset spec string: "CURRENCY/issuer".
 */
async function setupPool(
  issuer: Wallet,
  lp: Wallet,
  currency = "USD"
): Promise<string> {
  // Enable DefaultRipple on issuer so AMM transactions don't fail with terNO_RIPPLE
  const acctSetResult = await client.submitAndWait(
    issuer.sign(await client.autofill({
      TransactionType: "AccountSet",
      Account: issuer.address,
      SetFlag: 8, // asfDefaultRipple
    })).tx_blob
  );
  expect((acctSetResult.result.meta as { TransactionResult: string }).TransactionResult).toBe("tesSUCCESS");

  const trustSetFilled = await client.autofill({
    TransactionType: "TrustSet",
    Account: lp.address,
    LimitAmount: { currency, issuer: issuer.address, value: "1000000" },
  });
  trustSetFilled.LastLedgerSequence = (trustSetFilled.LastLedgerSequence ?? 0) + 80;
  await client.submitAndWait(lp.sign(trustSetFilled).tx_blob);

  const paymentFilled = await client.autofill({
    TransactionType: "Payment",
    Account: issuer.address,
    Destination: lp.address,
    Amount: { currency, issuer: issuer.address, value: "100000" },
  });
  paymentFilled.LastLedgerSequence = (paymentFilled.LastLedgerSequence ?? 0) + 80;
  await client.submitAndWait(issuer.sign(paymentFilled).tx_blob);
  return `${currency}/${issuer.address}`;
}

describe("amm delete", () => {
  it.concurrent(
    "delete pool after withdrawing all LP tokens: exits 0 with tesSUCCESS",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      // Create pool via CLI
      const createResult = runCLI([
        "--node", "testnet",
        "amm", "create",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--amount", "100000",
        "--amount2", "10",
        "--trading-fee", "300",
        "--seed", lp.seed!,
      ]);
      expect(createResult.status, `create stderr: ${createResult.stderr}`).toBe(0);

      // Withdraw all LP tokens via xrpl.js to empty the pool (tfWithdrawAll)
      await client.submitAndWait(
        lp.sign(await client.autofill({
          TransactionType: "AMMWithdraw",
          Account: lp.address,
          Asset: { currency: "XRP" },
          Asset2: { currency: "USD", issuer: issuer.address },
          Flags: 0x00020000, // tfWithdrawAll
        })).tx_blob
      );

      // Delete the now-empty pool via CLI
      const result = runCLI([
        "--node", "testnet",
        "amm", "delete",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--seed", lp.seed!,
      ]);

      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("tesSUCCESS");
    },
    120_000
  );

  it.concurrent(
    "--json output includes hash and result",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      const createResult = runCLI([
        "--node", "testnet",
        "amm", "create",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--amount", "100000",
        "--amount2", "10",
        "--trading-fee", "300",
        "--seed", lp.seed!,
      ]);
      expect(createResult.status, `create stderr: ${createResult.stderr}`).toBe(0);

      // Withdraw all LP tokens to empty the pool
      await client.submitAndWait(
        lp.sign(await client.autofill({
          TransactionType: "AMMWithdraw",
          Account: lp.address,
          Asset: { currency: "XRP" },
          Asset2: { currency: "USD", issuer: issuer.address },
          Flags: 0x00020000, // tfWithdrawAll
        })).tx_blob
      );

      const result = runCLI([
        "--node", "testnet",
        "amm", "delete",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--json",
        "--seed", lp.seed!,
      ]);

      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      const out = JSON.parse(result.stdout) as { hash: string; result: string };
      expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(out.result).toBe("tesSUCCESS");
    },
    120_000
  );

  it.concurrent(
    "--dry-run: prints AMMDelete tx JSON without submitting",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      const createResult = runCLI([
        "--node", "testnet",
        "amm", "create",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--amount", "100000",
        "--amount2", "10",
        "--trading-fee", "300",
        "--seed", lp.seed!,
      ]);
      expect(createResult.status, `create stderr: ${createResult.stderr}`).toBe(0);

      // dry-run doesn't require pool to be empty
      const result = runCLI([
        "--node", "testnet",
        "amm", "delete",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--dry-run",
        "--seed", lp.seed!,
      ]);

      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      const out = JSON.parse(result.stdout) as {
        tx_blob: string;
        tx: { TransactionType: string };
      };
      expect(out.tx.TransactionType).toBe("AMMDelete");
      expect(typeof out.tx_blob).toBe("string");
    },
    120_000
  );

  it.concurrent(
    "--no-wait: exits 0 and output is a 64-char hex hash",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      const createResult = runCLI([
        "--node", "testnet",
        "amm", "create",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--amount", "100000",
        "--amount2", "10",
        "--trading-fee", "300",
        "--seed", lp.seed!,
      ]);
      expect(createResult.status, `create stderr: ${createResult.stderr}`).toBe(0);

      // Withdraw all LP tokens to empty the pool
      await client.submitAndWait(
        lp.sign(await client.autofill({
          TransactionType: "AMMWithdraw",
          Account: lp.address,
          Asset: { currency: "XRP" },
          Asset2: { currency: "USD", issuer: issuer.address },
          Flags: 0x00020000, // tfWithdrawAll
        })).tx_blob
      );

      const result = runCLI([
        "--node", "testnet",
        "amm", "delete",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--no-wait",
        "--seed", lp.seed!,
      ]);

      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout.trim()).toMatch(/^[0-9A-Fa-f]{64}$/);
    },
    120_000
  );
});
