import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";

// Static dummy values — these tests exit before any network call
const DUMMY_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

describe("oracle set validation (no network)", () => {
  it("missing --document-id exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--price", "BTC/USD:155000:6",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/required option|missing|document-id/i);
  });

  it("missing price data exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("both --price and --price-data exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:155000:6",
      "--price-data", '[{"BaseAsset":"BTC","QuoteAsset":"USD","AssetPrice":155000,"Scale":6}]',
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("invalid --price format exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--price", "INVALIDFORMAT",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--price with non-integer price value exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:notanumber:6",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--price with scale > 10 exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:155000:11",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("more than 10 price pairs exits 1 with error", () => {
    const prices = Array.from({ length: 11 }, (_, i) => `PAIR${i}/USD:${i}:0`);
    const args = ["oracle", "set", "--document-id", "1"];
    for (const p of prices) {
      args.push("--price", p);
    }
    args.push("--seed", DUMMY_SEED);
    const result = runCLI(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("both --provider and --provider-hex exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:155000:6",
      "--provider", "myProvider",
      "--provider-hex", "6d7950726f7669646572",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("both --asset-class and --asset-class-hex exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:155000:6",
      "--asset-class", "currency",
      "--asset-class-hex", "63757272656e6379",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("missing key material exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:155000:6",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1 with error", () => {
    const result = runCLI([
      "oracle", "set",
      "--document-id", "1",
      "--price", "BTC/USD:155000:6",
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});

describe("oracle delete validation (no network)", () => {
  it("missing --document-id exits 1 with error", () => {
    const result = runCLI([
      "oracle", "delete",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/required option|missing|document-id/i);
  });

  it("missing key material exits 1 with error", () => {
    const result = runCLI([
      "oracle", "delete",
      "--document-id", "1",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});
