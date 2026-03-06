import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet } from "../../helpers/testnet.js";

let seller: Wallet;
let buyer: Wallet;

beforeAll(async () => {
  const client = new Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  try {
    [seller, buyer] = await Promise.all([
      fundFromFaucet(client),
      fundFromFaucet(client),
    ]);
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("nft offer create", () => {
  it("creates a sell offer and prints OfferID", () => {
    // Mint an NFT first
    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--transferable",
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    expect(mintOut.result).toBe("tesSUCCESS");
    const nftokenId = mintOut.nftokenId;

    // Create sell offer
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "create",
      "--nft", nftokenId,
      "--amount", "10",
      "--sell",
      "--seed", seller.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toMatch(/OfferID:\s+[0-9A-Fa-f]{64}/i);
  });

  it("creates a buy offer and prints OfferID", () => {
    // Mint an NFT with seller account so buyer can make a buy offer
    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--transferable",
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    // Create buy offer from buyer's perspective
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "create",
      "--nft", nftokenId,
      "--amount", "5",
      "--owner", seller.address,
      "--seed", buyer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toMatch(/OfferID:\s+[0-9A-Fa-f]{64}/i);
  });

  it("--expiration sets future expiration and succeeds", () => {
    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--transferable",
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    // Expiration 1 hour from now
    const expiration = new Date(Date.now() + 3600 * 1000).toISOString();

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "create",
      "--nft", nftokenId,
      "--amount", "1",
      "--sell",
      "--expiration", expiration,
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; offerId: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.offerId).toMatch(/^[0-9A-Fa-f]{64}$/i);
  });

  it("--json outputs structured JSON with offerId", () => {
    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--transferable",
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "create",
      "--nft", nftokenId,
      "--amount", "10",
      "--sell",
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; fee: string; ledger: number; offerId: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
    expect(out.offerId).toMatch(/^[0-9A-Fa-f]{64}$/i);
  });

  it("--dry-run outputs tx_blob and tx without submitting", () => {
    const nftokenId = "0".repeat(64);
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "create",
      "--nft", nftokenId,
      "--amount", "10",
      "--sell",
      "--seed", seller.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; NFTokenID: string; Amount: string; Flags: number };
    };
    expect(out.tx.TransactionType).toBe("NFTokenCreateOffer");
    expect(out.tx.NFTokenID).toBe("0".repeat(64).toUpperCase());
    expect(typeof out.tx_blob).toBe("string");
    // tfSellNFToken = 1
    expect(out.tx.Flags & 0x00000001).not.toBe(0);
  });

  it("--no-wait submits and outputs hash", () => {
    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--transferable",
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "create",
      "--nft", nftokenId,
      "--amount", "10",
      "--sell",
      "--seed", seller.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });

  it("--destination restricts the offer acceptor", () => {
    const mintResult = runCLI([
      "--node", "testnet",
      "nft", "mint",
      "--taxon", "0",
      "--transferable",
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(mintResult.status, `mint stdout: ${mintResult.stdout} stderr: ${mintResult.stderr}`).toBe(0);
    const mintOut = JSON.parse(mintResult.stdout) as { result: string; nftokenId: string };
    const nftokenId = mintOut.nftokenId;

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "create",
      "--nft", nftokenId,
      "--amount", "5",
      "--sell",
      "--destination", buyer.address,
      "--seed", seller.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { result: string; offerId: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.offerId).toMatch(/^[0-9A-Fa-f]{64}$/i);
  });
});
