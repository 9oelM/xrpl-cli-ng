import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";

// Static dummy values — these tests exit before any network call
const DUMMY_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const DUMMY_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

describe("channel create validation (no network)", () => {
  it("missing --to exits 1 with error", () => {
    const result = runCLI([
      "channel", "create",
      "--amount", "10",
      "--settle-delay", "60",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--to");
  });

  it("missing --amount exits 1 with error", () => {
    const result = runCLI([
      "channel", "create",
      "--to", DUMMY_ADDRESS,
      "--settle-delay", "60",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--amount");
  });

  it("missing --settle-delay exits 1 with error", () => {
    const result = runCLI([
      "channel", "create",
      "--to", DUMMY_ADDRESS,
      "--amount", "10",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--settle-delay");
  });

  it("invalid --cancel-after ISO date exits 1", () => {
    const result = runCLI([
      "channel", "create",
      "--to", DUMMY_ADDRESS,
      "--amount", "10",
      "--settle-delay", "60",
      "--cancel-after", "not-a-date",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "channel", "create",
      "--to", DUMMY_ADDRESS,
      "--amount", "10",
      "--settle-delay", "60",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material options exits 1", () => {
    const result = runCLI([
      "channel", "create",
      "--to", DUMMY_ADDRESS,
      "--amount", "10",
      "--settle-delay", "60",
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});
