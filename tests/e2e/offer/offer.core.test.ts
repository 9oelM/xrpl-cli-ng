import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { TrustSet, OfferCreate as XrplOfferCreate } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");
const E2E_PATH = `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`;

function runCLI(args: string[]) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: { ...process.env, PATH: E2E_PATH },
    timeout: 120_000,
  });
}

let client: Client;
let maker: Wallet;
let issuer: Wallet;

beforeAll(async () => {
  client = new Client(TESTNET_URL);
  await client.connect();
  maker = await fundFromFaucet(client);
  issuer = await fundFromFaucet(client);

  // Set up USD trust line from maker to issuer (xrpl.js directly)
  const trustTx: TrustSet = await client.autofill({
    TransactionType: "TrustSet",
    Account: maker.address,
    LimitAmount: { currency: "USD", issuer: issuer.address, value: "100000" },
  });
  await client.submitAndWait(maker.sign(trustTx).tx_blob);
}, 180_000);

afterAll(async () => {
  await client.disconnect();
});

describe("offer core", () => {
  it("offer create XRP→IOU: offer appears in account_offers and order book", async () => {
    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `1/USD/${issuer.address}`,
      "--taker-gets", "10",
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Sequence:");

    const match = result.stdout.match(/Sequence: (\d+)/);
    expect(match).not.toBeNull();
    const seq = parseInt(match![1], 10);

    // Verify via account_offers CLI
    const offersResult = runCLI([
      "--node", "testnet",
      "account", "offers", "--json", maker.address,
    ]);
    expect(offersResult.status).toBe(0);
    const offers = JSON.parse(offersResult.stdout) as Array<{
      seq: number;
      taker_pays: { currency: string; issuer: string; value: string } | string;
      taker_gets: string;
    }>;
    const offer = offers.find((o) => o.seq === seq);
    expect(offer).toBeDefined();
    expect(offer!.taker_pays).toMatchObject({ currency: "USD", issuer: issuer.address, value: "1" });
    expect(offer!.taker_gets).toBe("10000000");

    // Verify via book_offers: our offer has taker_pays=USD, taker_gets=XRP
    const bookResult = await client.request({
      command: "book_offers",
      taker_pays: { currency: "USD", issuer: issuer.address },
      taker_gets: { currency: "XRP" },
    } as Parameters<typeof client.request>[0]);
    const bookOffers = (bookResult.result as { offers: unknown[] }).offers;
    expect(bookOffers.length).toBeGreaterThan(0);
  });

  it("offer cancel: cancels offer and removes from account_offers", async () => {
    // Pre-create offer via xrpl.js directly
    const createTx: XrplOfferCreate = await client.autofill({
      TransactionType: "OfferCreate",
      Account: maker.address,
      TakerPays: { currency: "USD", issuer: issuer.address, value: "2" },
      TakerGets: xrpToDrops(20),
    });
    const createResult = await client.submitAndWait(maker.sign(createTx).tx_blob);
    const seq = (createResult.result.tx_json as { Sequence?: number }).Sequence!;

    // Cancel via CLI
    const result = runCLI([
      "--node", "testnet",
      "offer", "cancel",
      "--sequence", String(seq),
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    // Verify offer is gone
    const offersResult = runCLI([
      "--node", "testnet",
      "account", "offers", "--json", maker.address,
    ]);
    expect(offersResult.status).toBe(0);
    const offers = JSON.parse(offersResult.stdout) as Array<{ seq: number }>;
    expect(offers.find((o) => o.seq === seq)).toBeUndefined();
  });

  it("--json output: hash, result tesSUCCESS, offerSequence > 0", () => {
    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `1/USD/${issuer.address}`,
      "--taker-gets", "10",
      "--json",
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; offerSequence: number };
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(out.result).toBe("tesSUCCESS");
    expect(out.offerSequence).toBeGreaterThan(0);
  });

  it("--dry-run: outputs OfferCreate tx JSON without submitting", () => {
    const countBefore = (
      JSON.parse(
        runCLI(["--node", "testnet", "account", "offers", "--json", maker.address]).stdout
      ) as unknown[]
    ).length;

    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `1/USD/${issuer.address}`,
      "--taker-gets", "10",
      "--dry-run",
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("OfferCreate");
    expect(typeof out.tx_blob).toBe("string");

    const countAfter = (
      JSON.parse(
        runCLI(["--node", "testnet", "account", "offers", "--json", maker.address]).stdout
      ) as unknown[]
    ).length;
    expect(countAfter).toBe(countBefore);
  });

  it("--no-wait: exits 0 and stdout is a 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `1/USD/${issuer.address}`,
      "--taker-gets", "10",
      "--no-wait",
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout.trim()).toMatch(/^[0-9A-Fa-f]{64}$/);
  });

  it("--sell flag: offer create with --sell appears in account_offers", () => {
    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `1/USD/${issuer.address}`,
      "--taker-gets", "10",
      "--sell",
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Sequence:");

    const match = result.stdout.match(/Sequence: (\d+)/);
    expect(match).not.toBeNull();
    const seq = parseInt(match![1], 10);

    const offersResult = runCLI([
      "--node", "testnet",
      "account", "offers", "--json", maker.address,
    ]);
    expect(offersResult.status).toBe(0);
    const offers = JSON.parse(offersResult.stdout) as Array<{ seq: number }>;
    expect(offers.find((o) => o.seq === seq)).toBeDefined();
  });
});
