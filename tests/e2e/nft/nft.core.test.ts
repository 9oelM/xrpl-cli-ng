import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, convertHexToString } from "xrpl";
import {
  XRPL_WS,
  fundMaster,
  initTicketPool,
  createFunded,
} from "../helpers/fund.js";

// Budget: 22 tickets × 0.2 = 4.4 XRP; 18 wallets × 3 XRP = 54 XRP; total 58.4 ≤ 99 ✓
// 9 mint + 4 burn + 5 modify = 18 wallets, 1 wallet per test
const TICKET_COUNT = 22;
const FUND_AMOUNT = 3;

let client: Client;
let master: Wallet;

beforeAll(async () => {
  client = new Client(XRPL_WS);
  await client.connect();
  master = await fundMaster(client);
  await initTicketPool(client, master, TICKET_COUNT);
}, 120_000);

afterAll(async () => {
  await client.disconnect();
});

// ─── nft mint ────────────────────────────────────────────────────────────────

describe("nft mint", () => {
  it("mints an NFT with --taxon only and prints NFTokenID", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "42",
      "--seed", minter.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toMatch(/NFTokenID:\s+[0-9A-F]{64}/i);
  }, 90_000);

  it("mints an NFT with --uri and verifies it appears in account nfts", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "1",
      "--uri", "https://example.com/nft-metadata.json",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; nftokenId: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.nftokenId).toMatch(/^[0-9A-F]{64}$/i);

    const nftsResult = runCLI([
      "--node", "testnet",
      "account", "nfts",
      "--json",
      minter.address,
    ]);
    expect(nftsResult.status).toBe(0);
    const nfts = JSON.parse(nftsResult.stdout) as Array<{ NFTokenID: string }>;
    expect(nfts.some((n) => n.NFTokenID === out.nftokenId)).toBe(true);
  }, 90_000);

  it("mints an NFT with --transfer-fee and --transferable", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--transferable",
      "--transfer-fee", "1000",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; nftokenId: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.nftokenId).toMatch(/^[0-9A-F]{64}$/i);
  }, 90_000);

  it("--json outputs structured JSON with nftokenId", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; fee: string; ledger: number; nftokenId: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(out.nftokenId).toMatch(/^[0-9A-F]{64}$/i);
  }, 90_000);

  it("--dry-run outputs tx_blob and tx without submitting", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--seed", minter.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; NFTokenTaxon: number } };
    expect(out.tx.TransactionType).toBe("NFTokenMint");
    expect(out.tx.NFTokenTaxon).toBe(0);
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("--burnable flag sets tfBurnable in dry-run tx Flags", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--burnable",
      "--seed", minter.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Flags?: number } };
    expect(out.tx.Flags).toBeDefined();
    // tfBurnable = 0x00000001 = 1
    expect(out.tx.Flags! & 0x00000001).not.toBe(0);
  }, 90_000);

  it("--only-xrp flag sets tfOnlyXRP in dry-run tx Flags", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--only-xrp",
      "--seed", minter.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Flags?: number } };
    expect(out.tx.Flags).toBeDefined();
    // tfOnlyXRP = 0x00000002 = 2
    expect(out.tx.Flags! & 0x00000002).not.toBe(0);
  }, 90_000);

  it("--mutable flag sets tfMutable in dry-run tx Flags", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--mutable",
      "--seed", minter.seed!,
      "--dry-run",
    ]);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { tx: { Flags?: number } };
    expect(out.tx.Flags).toBeDefined();
    // tfMutable = 0x00000010 = 16
    expect(out.tx.Flags! & 0x00000010).not.toBe(0);
  }, 90_000);

  it("--no-wait exits 0 and outputs a 64-char hex hash", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--seed", minter.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 90_000);
});

// ─── nft burn ────────────────────────────────────────────────────────────────

describe("nft burn", () => {
  it("mints then burns an NFT successfully", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);

    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--burnable",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    expect(mintOut.result).toBe("tesSUCCESS");
    const nftokenId = mintOut.nftokenId;
    expect(nftokenId).toMatch(/^[0-9A-F]{64}$/i);

    const burnResult = runCLI([
      "--node", "testnet",
      "nft", "burn",
      "--nft", nftokenId,
      "--seed", minter.seed!,
    ]);
    expect(burnResult.status, `burn stdout: ${burnResult.stdout} stderr: ${burnResult.stderr}`).toBe(0);
    expect(burnResult.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("--json outputs structured JSON", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);

    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    const burnResult = runCLI([
      "--node", "testnet",
      "nft", "burn",
      "--nft", nftokenId,
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(burnResult.status, `stdout: ${burnResult.stdout} stderr: ${burnResult.stderr}`).toBe(0);
    const out = JSON.parse(burnResult.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  }, 90_000);

  it("--dry-run outputs tx_blob and tx without submitting", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const nftokenId = "0".repeat(64);
    const result = runCLI([
      "--node", "testnet",
      "nft", "burn",
      "--nft", nftokenId,
      "--seed", minter.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; NFTokenID: string } };
    expect(out.tx.TransactionType).toBe("NFTokenBurn");
    expect(out.tx.NFTokenID).toBe("0".repeat(64).toUpperCase());
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("--no-wait submits and outputs hash", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);

    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    const result = runCLI([
      "--node", "testnet",
      "nft", "burn",
      "--nft", nftokenId,
      "--seed", minter.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 90_000);
});

// ─── nft modify ──────────────────────────────────────────────────────────────

describe("nft modify", () => {
  it("mints with --mutable, modifies URI, verifies change via account nfts", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);

    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--mutable",
      "--uri", "https://example.com/original.json",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    expect(mintOut.result).toBe("tesSUCCESS");
    const nftokenId = mintOut.nftokenId;
    expect(nftokenId).toMatch(/^[0-9A-F]{64}$/i);

    const newUri = "https://example.com/updated.json";

    const modifyResult = runCLI([
      "--node", "testnet",
      "nft", "modify",
      "--nft", nftokenId,
      "--uri", newUri,
      "--seed", minter.seed!,
    ]);
    expect(modifyResult.status, `modify stdout: ${modifyResult.stdout} stderr: ${modifyResult.stderr}`).toBe(0);
    expect(modifyResult.stdout).toContain("tesSUCCESS");

    const nftsResult = runCLI([
      "--node", "testnet",
      "account", "nfts",
      "--json",
      minter.address,
    ]);
    expect(nftsResult.status).toBe(0);
    const nfts = JSON.parse(nftsResult.stdout) as Array<{ NFTokenID: string; URI?: string }>;
    const token = nfts.find((n) => n.NFTokenID === nftokenId);
    expect(token).toBeDefined();
    expect(convertHexToString(token!.URI!)).toBe(newUri);
  }, 90_000);

  it("--json outputs structured JSON", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);

    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--mutable",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    const result = runCLI([
      "--node", "testnet",
      "nft", "modify",
      "--nft", nftokenId,
      "--uri", "https://example.com/json-test.json",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  }, 90_000);

  it("--dry-run outputs tx_blob and tx without submitting", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);
    const nftokenId = "0".repeat(64);
    const result = runCLI([
      "--node", "testnet",
      "nft", "modify",
      "--nft", nftokenId,
      "--uri", "https://example.com/dry-run.json",
      "--seed", minter.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string; NFTokenID: string; URI?: string } };
    expect(out.tx.TransactionType).toBe("NFTokenModify");
    expect(out.tx.NFTokenID).toBe("0".repeat(64).toUpperCase());
    expect(typeof out.tx.URI).toBe("string");
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("--clear-uri clears the URI of a mutable NFT", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);

    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--mutable",
      "--uri", "https://example.com/to-clear.json",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    const modifyResult = runCLI([
      "--node", "testnet",
      "nft", "modify",
      "--nft", nftokenId,
      "--clear-uri",
      "--seed", minter.seed!,
    ]);
    expect(modifyResult.status, `modify stdout: ${modifyResult.stdout} stderr: ${modifyResult.stderr}`).toBe(0);
    expect(modifyResult.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("--no-wait submits and outputs hash", async () => {
    const [minter] = await createFunded(client, master, 1, FUND_AMOUNT);

    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--mutable",
      "--seed", minter.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    const result = runCLI([
      "--node", "testnet",
      "nft", "modify",
      "--nft", nftokenId,
      "--uri", "https://example.com/nowait.json",
      "--seed", minter.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 90_000);
});
