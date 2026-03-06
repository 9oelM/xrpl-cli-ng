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

describe("nft offer create validation (no network)", () => {
  it("missing --nft exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "create",
      "--amount", "10",
      "--sell",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/required option|missing|nft/i);
  });

  it("missing --amount exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "create",
      "--nft", DUMMY_NFT_ID,
      "--sell",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/required option|missing|amount/i);
  });

  it("buy offer without --owner exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "create",
      "--nft", DUMMY_NFT_ID,
      "--amount", "10",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--owner is required for buy offers");
  });

  it("invalid --amount exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "create",
      "--nft", DUMMY_NFT_ID,
      "--amount", "not-a-number",
      "--sell",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "nft", "offer", "create",
      "--nft", DUMMY_NFT_ID,
      "--amount", "10",
      "--sell",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "nft", "offer", "create",
      "--nft", DUMMY_NFT_ID,
      "--amount", "10",
      "--sell",
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});

describe("nft offer accept validation (no network)", () => {
  it("neither --sell-offer nor --buy-offer exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "accept",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--broker-fee without both offers exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "accept",
      "--sell-offer", DUMMY_NFT_ID,
      "--broker-fee", "1",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--broker-fee requires both --sell-offer and --buy-offer");
  });

  it("invalid --sell-offer (not 64 hex chars) exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "accept",
      "--sell-offer", "DEADBEEF",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "nft", "offer", "accept",
      "--sell-offer", DUMMY_NFT_ID,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "nft", "offer", "accept",
      "--sell-offer", DUMMY_NFT_ID,
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});

describe("nft offer cancel validation (no network)", () => {
  it("no --offer exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "cancel",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("invalid --offer (not 64 hex chars) exits 1 with error", () => {
    const result = runCLI([
      "nft", "offer", "cancel",
      "--offer", "DEADBEEF",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "nft", "offer", "cancel",
      "--offer", DUMMY_NFT_ID,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "nft", "offer", "cancel",
      "--offer", DUMMY_NFT_ID,
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
