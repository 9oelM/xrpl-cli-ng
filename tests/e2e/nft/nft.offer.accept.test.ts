import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet } from "../../helpers/testnet.js";

let seller: Wallet;
let buyer: Wallet;
let broker: Wallet;

beforeAll(async () => {
  const client = new Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  try {
    [seller, buyer, broker] = await Promise.all([
      fundFromFaucet(client),
      fundFromFaucet(client),
      fundFromFaucet(client),
    ]);
  } finally {
    await client.disconnect();
  }
}, 180_000);

/** Helper: mint a transferable NFT and return its NFTokenID */
function mintNFT(wallet: Wallet): string {
  const result = runCLI([
    "--node", "testnet",
    "nft", "mint",
    "--taxon", "0",
    "--transferable",
    "--seed", wallet.seed!,
    "--json",
  ]);
  expect(result.status, `mint stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
  const out = JSON.parse(result.stdout) as { result: string; nftokenId: string };
  expect(out.result).toBe("tesSUCCESS");
  return out.nftokenId;
}

/** Helper: create a sell offer and return the offer ID */
function createSellOffer(wallet: Wallet, nftokenId: string, amountXrp: string): string {
  const result = runCLI([
    "--node", "testnet",
    "nft", "offer", "create",
    "--nft", nftokenId,
    "--amount", amountXrp,
    "--sell",
    "--seed", wallet.seed!,
    "--json",
  ]);
  expect(result.status, `sell offer stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
  const out = JSON.parse(result.stdout) as { result: string; offerId: string };
  expect(out.result).toBe("tesSUCCESS");
  return out.offerId;
}

/** Helper: create a buy offer and return the offer ID */
function createBuyOffer(wallet: Wallet, nftokenId: string, amountXrp: string, ownerAddress: string): string {
  const result = runCLI([
    "--node", "testnet",
    "nft", "offer", "create",
    "--nft", nftokenId,
    "--amount", amountXrp,
    "--owner", ownerAddress,
    "--seed", wallet.seed!,
    "--json",
  ]);
  expect(result.status, `buy offer stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
  const out = JSON.parse(result.stdout) as { result: string; offerId: string };
  expect(out.result).toBe("tesSUCCESS");
  return out.offerId;
}

describe("nft offer accept", () => {
  it("accepts a sell offer (direct) — buyer accepts seller's sell offer", () => {
    const nftokenId = mintNFT(seller);
    const sellOfferId = createSellOffer(seller, nftokenId, "1");

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "accept",
      "--sell-offer", sellOfferId,
      "--seed", buyer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("accepts a buy offer (direct) — seller accepts buyer's buy offer", () => {
    const nftokenId = mintNFT(seller);
    const buyOfferId = createBuyOffer(buyer, nftokenId, "1", seller.address);

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "accept",
      "--buy-offer", buyOfferId,
      "--seed", seller.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("brokered mode — broker accepts both sell and buy offers (no fee)", () => {
    // Use broker as the NFT seller to avoid state contamination from tests 1 and 2.
    // Broker is a fresh account with no prior NFT transactions.
    const nftokenId = mintNFT(broker);
    const sellOfferId = createSellOffer(broker, nftokenId, "1");
    const buyOfferId = createBuyOffer(buyer, nftokenId, "2", broker.address);

    // Accept in brokered mode (no broker fee — broker keeps the price difference)
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "accept",
      "--sell-offer", sellOfferId,
      "--buy-offer", buyOfferId,
      "--seed", seller.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--broker-fee option is accepted and appears in dry-run tx", () => {
    // Verify the --broker-fee option is wired up correctly via dry-run
    const dummySellOfferId = "A".repeat(64);
    const dummyBuyOfferId = "B".repeat(64);
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "accept",
      "--sell-offer", dummySellOfferId,
      "--buy-offer", dummyBuyOfferId,
      "--broker-fee", "1",
      "--seed", seller.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; NFTokenBrokerFee: string };
    };
    expect(out.tx.TransactionType).toBe("NFTokenAcceptOffer");
    expect(out.tx.NFTokenBrokerFee).toBe("1000000"); // 1 XRP = 1000000 drops
  });

  it("--json outputs structured JSON", () => {
    const nftokenId = mintNFT(seller);
    const sellOfferId = createSellOffer(seller, nftokenId, "1");

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "accept",
      "--sell-offer", sellOfferId,
      "--seed", buyer.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { hash: string; result: string; fee: string; ledger: number };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-Fa-f]{64}$/);
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  });

  it("--dry-run outputs tx_blob and tx without submitting", () => {
    const dummyOfferId = "A".repeat(64);
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "accept",
      "--sell-offer", dummyOfferId,
      "--seed", seller.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; NFTokenSellOffer: string };
    };
    expect(out.tx.TransactionType).toBe("NFTokenAcceptOffer");
    expect(out.tx.NFTokenSellOffer).toBe("A".repeat(64).toUpperCase());
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait submits and outputs hash", () => {
    const nftokenId = mintNFT(seller);
    const sellOfferId = createSellOffer(seller, nftokenId, "1");

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "accept",
      "--sell-offer", sellOfferId,
      "--seed", buyer.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });
});
