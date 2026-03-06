import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet } from "../../helpers/testnet.js";

let minter: Wallet;

beforeAll(async () => {
  const client = new Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  try {
    minter = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("nft mint", () => {
  it("mints an NFT with --taxon only and prints NFTokenID", () => {
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "42",
      "--seed", minter.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toMatch(/NFTokenID:\s+[0-9A-F]{64}/i);
  });

  it("mints an NFT with --uri and verifies it appears in account nfts", () => {
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

    // Verify it appears in account nfts
    const nftsResult = runCLI([
      "--node", "testnet",
      "account", "nfts",
      "--json",
      minter.address,
    ]);
    expect(nftsResult.status).toBe(0);
    const nfts = JSON.parse(nftsResult.stdout) as Array<{ NFTokenID: string }>;
    expect(nfts.some((n) => n.NFTokenID === out.nftokenId)).toBe(true);
  });

  it("mints an NFT with --transfer-fee and --transferable", () => {
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
  });

  it("--json outputs structured JSON with nftokenId", () => {
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
  });

  it("--dry-run outputs tx_blob and tx without submitting", () => {
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
  });

  it("--burnable flag sets tfBurnable in dry-run tx Flags", () => {
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
  });

  it("--only-xrp flag sets tfOnlyXRP in dry-run tx Flags", () => {
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
  });

  it("--mutable flag sets tfMutable in dry-run tx Flags", () => {
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
  });

  it("--no-wait exits 0 and outputs a 64-char hex hash", () => {
    const result = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--seed", minter.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });
});
