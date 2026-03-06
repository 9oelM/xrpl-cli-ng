import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";


// Static dummy values — these tests exit before any network call
const DUMMY_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";
const DUMMY_NFT_ID = "0".repeat(64);


describe("nft mint validation (no network)", () => {
  it("missing --taxon exits 1 with error", () => {
    const result = runCLI([
      "nft", "mint",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/required option|missing|taxon/i);
  });

  it("--transfer-fee > 50000 exits 1 with error", () => {
    const result = runCLI([
      "nft", "mint",
      "--taxon", "0",
      "--transferable",
      "--transfer-fee", "50001",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--transfer-fee without --transferable exits 1 with error", () => {
    const result = runCLI([
      "nft", "mint",
      "--taxon", "0",
      "--transfer-fee", "500",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--transfer-fee requires --transferable");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "nft", "mint",
      "--taxon", "0",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "nft", "mint",
      "--taxon", "0",
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});

describe("nft burn validation (no network)", () => {
  it("missing --nft exits 1 with error", () => {
    const result = runCLI([
      "nft", "burn",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/required option|missing|nft/i);
  });

  it("invalid --nft (not 64 hex chars) exits 1 with error", () => {
    const result = runCLI([
      "nft", "burn",
      "--nft", "DEADBEEF",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "nft", "burn",
      "--nft", DUMMY_NFT_ID,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "nft", "burn",
      "--nft", DUMMY_NFT_ID,
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});

describe("nft modify validation (no network)", () => {
  it("missing --nft exits 1 with error", () => {
    const result = runCLI([
      "nft", "modify",
      "--uri", "https://example.com/nft.json",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/required option|missing|nft/i);
  });

  it("neither --uri nor --clear-uri exits 1 with error", () => {
    const result = runCLI([
      "nft", "modify",
      "--nft", DUMMY_NFT_ID,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--uri and --clear-uri together exits 1 with error", () => {
    const result = runCLI([
      "nft", "modify",
      "--nft", DUMMY_NFT_ID,
      "--uri", "https://example.com/nft.json",
      "--clear-uri",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "nft", "modify",
      "--nft", DUMMY_NFT_ID,
      "--uri", "https://example.com/nft.json",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "nft", "modify",
      "--nft", DUMMY_NFT_ID,
      "--uri", "https://example.com/nft.json",
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});
