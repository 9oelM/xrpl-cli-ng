import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundMaster, initTicketPool, createFunded, XRPL_WS } from "../helpers/fund.js";

// Budget: 12 tickets × 0.2 + 10 wallets × 5 XRP = 2.4 + 50 = 52.4 XRP ≤ 99 ✓
// 5 tests × 2 wallets (issuer + lp) = 10 wallets total

let client: Client;
let master: Wallet;

beforeAll(async () => {
  client = new Client(XRPL_WS);
  await client.connect();
  master = await fundMaster(client);
  await initTicketPool(client, master, 12);
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
  await client.submitAndWait(
    lp.sign(await client.autofill({
      TransactionType: "TrustSet",
      Account: lp.address,
      LimitAmount: { currency, issuer: issuer.address, value: "1000000" },
    })).tx_blob
  );
  await client.submitAndWait(
    issuer.sign(await client.autofill({
      TransactionType: "Payment",
      Account: issuer.address,
      Destination: lp.address,
      Amount: { currency, issuer: issuer.address, value: "100000" },
    })).tx_blob
  );
  return `${currency}/${issuer.address}`;
}

describe("amm create", () => {
  it.concurrent(
    "create XRP/IOU pool: prints AMM Account and LP Token",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      const result = runCLI([
        "--node", "testnet",
        "amm", "create",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--amount", "100000",
        "--amount2", "10",
        "--trading-fee", "300",
        "--seed", lp.seed!,
      ]);

      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("AMM Account:");
      expect(result.stdout).toContain("LP Token:");
      expect(result.stdout).toMatch(/AMM Account:\s*r[a-zA-Z0-9]{24,33}/);
    },
    120_000
  );

  it.concurrent(
    "--json output includes hash, result, ammAccount, lpTokenCurrency",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      const result = runCLI([
        "--node", "testnet",
        "amm", "create",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--amount", "100000",
        "--amount2", "10",
        "--trading-fee", "300",
        "--json",
        "--seed", lp.seed!,
      ]);

      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      const out = JSON.parse(result.stdout) as {
        hash: string;
        result: string;
        ammAccount: string;
        lpTokenCurrency: string;
      };
      expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(out.result).toBe("tesSUCCESS");
      expect(out.ammAccount).toMatch(/^r[a-zA-Z0-9]{24,33}$/);
      expect(typeof out.lpTokenCurrency).toBe("string");
      expect(out.lpTokenCurrency.length).toBeGreaterThan(0);
    },
    120_000
  );

  it.concurrent(
    "--dry-run prints AMMCreate tx JSON without submitting",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      const result = runCLI([
        "--node", "testnet",
        "amm", "create",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--amount", "100000",
        "--amount2", "10",
        "--trading-fee", "300",
        "--dry-run",
        "--seed", lp.seed!,
      ]);

      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      const out = JSON.parse(result.stdout) as {
        tx_blob: string;
        tx: { TransactionType: string; TradingFee: number };
      };
      expect(out.tx.TransactionType).toBe("AMMCreate");
      expect(out.tx.TradingFee).toBe(300);
      expect(typeof out.tx_blob).toBe("string");
    },
    120_000
  );

  it.concurrent(
    "--no-wait: exits 0 and output is a 64-char hex hash",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      const result = runCLI([
        "--node", "testnet",
        "amm", "create",
        "--asset", "XRP",
        "--asset2", iouSpec,
        "--amount", "100000",
        "--amount2", "10",
        "--trading-fee", "300",
        "--no-wait",
        "--seed", lp.seed!,
      ]);

      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout.trim()).toMatch(/^[0-9A-Fa-f]{64}$/);
    },
    120_000
  );
});

describe("amm info", () => {
  it.concurrent(
    "shows pool balances after creation",
    async () => {
      const [issuer, lp] = await createFunded(client, master, 2, 5);
      const iouSpec = await setupPool(issuer, lp);

      // First create the pool
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

      // Then query amm info
      const infoResult = runCLI([
        "--node", "testnet",
        "amm", "info",
        "--asset", "XRP",
        "--asset2", iouSpec,
      ]);

      expect(infoResult.status, `stdout: ${infoResult.stdout}\nstderr: ${infoResult.stderr}`).toBe(0);
      expect(infoResult.stdout).toContain("AMM Account:");
      expect(infoResult.stdout).toContain("Asset 1:");
      expect(infoResult.stdout).toContain("Asset 2:");
      expect(infoResult.stdout).toContain("LP Token:");
      expect(infoResult.stdout).toContain("Trading Fee:");
    },
    120_000
  );
});
