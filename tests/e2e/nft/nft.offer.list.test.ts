import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet } from "../../helpers/testnet.js";

let seller: Wallet;
let buyer: Wallet;
let nftokenId: string;
let sellOfferId: string;
let buyOfferId: string;

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

  // Mint a transferable NFT
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
  nftokenId = mintOut.nftokenId;

  // Create a sell offer
  const sellResult = runCLI([
    "--node", "testnet",
    "nft", "offer", "create",
    "--nft", nftokenId,
    "--amount", "10",
    "--sell",
    "--seed", seller.seed!,
    "--json",
  ]);
  expect(sellResult.status, `sell offer stdout: ${sellResult.stdout} stderr: ${sellResult.stderr}`).toBe(0);
  const sellOut = JSON.parse(sellResult.stdout) as { result: string; offerId: string };
  expect(sellOut.result).toBe("tesSUCCESS");
  sellOfferId = sellOut.offerId;

  // Create a buy offer
  const buyResult = runCLI([
    "--node", "testnet",
    "nft", "offer", "create",
    "--nft", nftokenId,
    "--amount", "5",
    "--owner", seller.address,
    "--seed", buyer.seed!,
    "--json",
  ]);
  expect(buyResult.status, `buy offer stdout: ${buyResult.stdout} stderr: ${buyResult.stderr}`).toBe(0);
  const buyOut = JSON.parse(buyResult.stdout) as { result: string; offerId: string };
  expect(buyOut.result).toBe("tesSUCCESS");
  buyOfferId = buyOut.offerId;
}, 180_000);

describe("nft offer list", () => {
  it("lists both sell and buy offers in human-readable output", () => {
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "list",
      nftokenId,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Sell Offers");
    expect(result.stdout).toContain("Buy Offers");
    expect(result.stdout).toContain(sellOfferId);
    expect(result.stdout).toContain(buyOfferId);
    // Amount, Owner, Expiration, Destination labels
    expect(result.stdout).toContain("Amount:");
    expect(result.stdout).toContain("Owner:");
    expect(result.stdout).toContain("Expiration:");
    expect(result.stdout).toContain("Destination:");
  });

  it("--json outputs { sellOffers, buyOffers } with correct offer IDs", () => {
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "list",
      nftokenId,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      sellOffers: Array<{ nft_offer_index: string; amount: string; owner: string }>;
      buyOffers: Array<{ nft_offer_index: string; amount: string; owner: string }>;
    };
    expect(Array.isArray(out.sellOffers)).toBe(true);
    expect(Array.isArray(out.buyOffers)).toBe(true);

    const foundSell = out.sellOffers.find((o) => o.nft_offer_index === sellOfferId);
    expect(foundSell, `sell offer ${sellOfferId} not in sellOffers`).toBeDefined();

    const foundBuy = out.buyOffers.find((o) => o.nft_offer_index === buyOfferId);
    expect(foundBuy, `buy offer ${buyOfferId} not in buyOffers`).toBeDefined();
  });

  it("exits with error for invalid NFTokenID", () => {
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "list",
      "notvalid",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});
