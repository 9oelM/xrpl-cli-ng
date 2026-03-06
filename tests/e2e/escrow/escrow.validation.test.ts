import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";

// Static dummy values — these tests exit before any network call
const DUMMY_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const DUMMY_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

describe("escrow create validation (no network)", () => {
  it("missing --to exits 1", () => {
    const result = runCLI([
      "escrow", "create",
      "--amount", "10",
      "--finish-after", "2030-01-01T00:00:00Z",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
  });

  it("missing --amount exits 1", () => {
    const result = runCLI([
      "escrow", "create",
      "--to", DUMMY_ADDRESS,
      "--finish-after", "2030-01-01T00:00:00Z",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
  });

  it("missing both --finish-after and --condition exits 1 with error message", () => {
    const result = runCLI([
      "escrow", "create",
      "--to", DUMMY_ADDRESS,
      "--amount", "10",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("invalid ISO date in --finish-after exits 1 with error message", () => {
    const result = runCLI([
      "escrow", "create",
      "--to", DUMMY_ADDRESS,
      "--amount", "10",
      "--finish-after", "not-a-date",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("missing key material exits 1 with error message", () => {
    const result = runCLI([
      "escrow", "create",
      "--to", DUMMY_ADDRESS,
      "--amount", "10",
      "--finish-after", "2030-01-01T00:00:00Z",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});
