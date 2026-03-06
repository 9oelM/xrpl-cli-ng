import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Client, Wallet, xrpToDrops } from "xrpl";
import type { TrustSet, OfferCreate as XrplOfferCreate, Payment as XrplPayment } from "xrpl";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";



let client: Client;
let maker: Wallet;
let issuer: Wallet;
let testMnemonic: string;
let mnemonicAddress: string;
let mnemonicWallet: Wallet;

beforeAll(async () => {
  client = new Client(TESTNET_URL);
  await client.connect();
  maker = await fundFromFaucet(client);
  issuer = await fundFromFaucet(client);

  // Set up USD trust line from maker to issuer
  const trustTx: TrustSet = await client.autofill({
    TransactionType: "TrustSet",
    Account: maker.address,
    LimitAmount: { currency: "USD", issuer: issuer.address, value: "100000" },
  });
  await client.submitAndWait(maker.sign(trustTx).tx_blob);

  // Generate a fresh mnemonic, fund the derived wallet, and set up trust line
  testMnemonic = generateMnemonic(wordlist);
  mnemonicWallet = Wallet.fromMnemonic(testMnemonic, {
    mnemonicEncoding: "bip39",
    derivationPath: "m/44'/144'/0'/0/0",
  });
  mnemonicAddress = mnemonicWallet.address;

  const fundMnemonicTx: XrplPayment = await client.autofill({
    TransactionType: "Payment",
    Account: maker.address,
    Amount: xrpToDrops(25),
    Destination: mnemonicAddress,
  });
  await client.submitAndWait(maker.sign(fundMnemonicTx).tx_blob);

  const mnemonicTrustTx: TrustSet = await client.autofill({
    TransactionType: "TrustSet",
    Account: mnemonicAddress,
    LimitAmount: { currency: "USD", issuer: issuer.address, value: "100000" },
  });
  await client.submitAndWait(mnemonicWallet.sign(mnemonicTrustTx).tx_blob);
}, 180_000);

afterAll(async () => {
  await client.disconnect();
});

describe("offer flags", () => {
  it("--passive flag: offer appears in account_offers", () => {
    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `1/USD/${issuer.address}`,
      "--taker-gets", "10",
      "--passive",
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

  it("--replace flag: replaces original offer and new offer is present", async () => {
    // Pre-create offer via xrpl.js to get a known sequence
    const createTx: XrplOfferCreate = await client.autofill({
      TransactionType: "OfferCreate",
      Account: maker.address,
      TakerPays: { currency: "USD", issuer: issuer.address, value: "3" },
      TakerGets: xrpToDrops(30),
    });
    const createResult = await client.submitAndWait(maker.sign(createTx).tx_blob);
    const origSeq = (createResult.result.tx_json as { Sequence?: number }).Sequence!;

    // Replace that offer with a new one
    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `2/USD/${issuer.address}`,
      "--taker-gets", "20",
      "--replace", String(origSeq),
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    const match = result.stdout.match(/Sequence: (\d+)/);
    expect(match).not.toBeNull();
    const newSeq = parseInt(match![1], 10);

    // Verify original offer is gone and new offer is present
    const offersResult = runCLI([
      "--node", "testnet",
      "account", "offers", "--json", maker.address,
    ]);
    expect(offersResult.status).toBe(0);
    const offers = JSON.parse(offersResult.stdout) as Array<{ seq: number }>;
    expect(offers.find((o) => o.seq === origSeq)).toBeUndefined();
    expect(offers.find((o) => o.seq === newSeq)).toBeDefined();
  });

  it("--expiration flag: offer entry has a positive expiration number", () => {
    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `1/USD/${issuer.address}`,
      "--taker-gets", "10",
      "--expiration", "2030-01-01T00:00:00Z",
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    const match = result.stdout.match(/Sequence: (\d+)/);
    expect(match).not.toBeNull();
    const seq = parseInt(match![1], 10);

    const offersResult = runCLI([
      "--node", "testnet",
      "account", "offers", "--json", maker.address,
    ]);
    expect(offersResult.status).toBe(0);
    const offers = JSON.parse(offersResult.stdout) as Array<{ seq: number; expiration?: number }>;
    const offer = offers.find((o) => o.seq === seq);
    expect(offer).toBeDefined();
    expect(typeof offer!.expiration).toBe("number");
    expect(offer!.expiration).toBeGreaterThan(0);
  });

  it("--immediate-or-cancel flag: exits 0 (offer may be consumed or cancelled)", () => {
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
      "--immediate-or-cancel",
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    // IOC offer may be cancelled immediately; account_offers should not grow beyond countBefore
    const offersResult = runCLI([
      "--node", "testnet",
      "account", "offers", "--json", maker.address,
    ]);
    expect(offersResult.status).toBe(0);
    const countAfter = (JSON.parse(offersResult.stdout) as unknown[]).length;
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  it("--fill-or-kill flag: exits 0 (tecKILLED is non-fatal) and offer is not placed", () => {
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
      "--fill-or-kill",
      "--seed", maker.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);

    // FOK offer that cannot be fully filled is killed — not placed in account_offers
    const offersResult = runCLI([
      "--node", "testnet",
      "account", "offers", "--json", maker.address,
    ]);
    expect(offersResult.status).toBe(0);
    const countAfter = (JSON.parse(offersResult.stdout) as unknown[]).length;
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  it("--mnemonic key material: creates offer successfully", () => {
    const result = runCLI([
      "--node", "testnet",
      "offer", "create",
      "--taker-pays", `1/USD/${issuer.address}`,
      "--taker-gets", "10",
      "--mnemonic", testMnemonic,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Sequence:");
  });

  it("--account + --keystore + --password: creates offer successfully", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "xrpl-test-keystore-"));
    try {
      const importResult = runCLI([
        "wallet", "import",
        maker.seed!,
        "--password", "pw123",
        "--keystore", tmpDir,
      ]);
      expect(importResult.status, `stdout: ${importResult.stdout} stderr: ${importResult.stderr}`).toBe(0);

      const result = runCLI([
        "--node", "testnet",
        "offer", "create",
        "--taker-pays", `1/USD/${issuer.address}`,
        "--taker-gets", "10",
        "--account", maker.address,
        "--keystore", tmpDir,
        "--password", "pw123",
      ]);
      expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("Sequence:");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
