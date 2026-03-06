import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet } from "../../helpers/testnet.js";

let account: Wallet;

beforeAll(async () => {
  const client = new Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  try {
    account = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }
}, 120_000);

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

describe("nft offer cancel", () => {
  it("cancels a single offer", () => {
    const nftokenId = mintNFT(account);
    const offerId = createSellOffer(account, nftokenId, "5");

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "cancel",
      "--offer", offerId,
      "--seed", account.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("cancels multiple offers in one tx", () => {
    const nftokenId1 = mintNFT(account);
    const nftokenId2 = mintNFT(account);
    const offerId1 = createSellOffer(account, nftokenId1, "1");
    const offerId2 = createSellOffer(account, nftokenId2, "2");

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "cancel",
      "--offer", offerId1,
      "--offer", offerId2,
      "--seed", account.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  });

  it("--json outputs structured JSON", () => {
    const nftokenId = mintNFT(account);
    const offerId = createSellOffer(account, nftokenId, "3");

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "cancel",
      "--offer", offerId,
      "--seed", account.seed!,
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
    const dummyOfferId = "B".repeat(64);
    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "cancel",
      "--offer", dummyOfferId,
      "--seed", account.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; NFTokenOffers: string[] };
    };
    expect(out.tx.TransactionType).toBe("NFTokenCancelOffer");
    expect(out.tx.NFTokenOffers).toEqual(["B".repeat(64).toUpperCase()]);
    expect(typeof out.tx_blob).toBe("string");
  });

  it("--no-wait submits and outputs hash", () => {
    const nftokenId = mintNFT(account);
    const offerId = createSellOffer(account, nftokenId, "1");

    const result = runCLI([
      "--node", "testnet",
      "nft", "offer", "cancel",
      "--offer", offerId,
      "--seed", account.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  });
});
