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

describe("nft burn", () => {
  it("mints then burns an NFT successfully", () => {
    // Mint first
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

    // Burn it
    const burnResult = runCLI([
      "--node", "testnet",
      "nft", "burn",
      "--nft", nftokenId,
      "--seed", minter.seed!,
    ]);
    expect(burnResult.status, `burn stdout: ${burnResult.stdout} stderr: ${burnResult.stderr}`).toBe(0);
    expect(burnResult.stdout).toContain("tesSUCCESS");
  });

  it("--json outputs structured JSON", () => {
    // Mint first
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
  });

  it("--dry-run outputs tx_blob and tx without submitting", () => {
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
  });

  it("--no-wait submits and outputs hash", () => {
    // Mint first
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
  });
});
