import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, convertHexToString } from "xrpl";
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

describe("nft modify", () => {
  it("mints with --mutable, modifies URI, verifies change via account nfts", () => {
    // Mint a mutable NFT with an initial URI
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

    // Modify URI
    const modifyResult = runCLI([
      "--node", "testnet",
      "nft", "modify",
      "--nft", nftokenId,
      "--uri", newUri,
      "--seed", minter.seed!,
    ]);
    expect(modifyResult.status, `modify stdout: ${modifyResult.stdout} stderr: ${modifyResult.stderr}`).toBe(0);
    expect(modifyResult.stdout).toContain("tesSUCCESS");

    // Verify via account nfts
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
    // URI is stored as hex — decode and compare
    expect(convertHexToString(token!.URI!)).toBe(newUri);
  });

  it("--json outputs structured JSON", () => {
    // Mint a mutable NFT
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
  });

  it("--dry-run outputs tx_blob and tx without submitting", () => {
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
  });

  it("--clear-uri clears the URI of a mutable NFT", () => {
    // Mint a mutable NFT with a URI
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

    // Clear URI
    const modifyResult = runCLI([
      "--node", "testnet",
      "nft", "modify",
      "--nft", nftokenId,
      "--clear-uri",
      "--seed", minter.seed!,
    ]);
    expect(modifyResult.status, `modify stdout: ${modifyResult.stdout} stderr: ${modifyResult.stderr}`).toBe(0);
    expect(modifyResult.stdout).toContain("tesSUCCESS");
  });

  it("--no-wait submits and outputs hash", () => {
    // Mint a mutable NFT
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
  });
});
