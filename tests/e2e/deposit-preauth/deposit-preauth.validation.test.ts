import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";

// Static dummy values — these tests exit before any network call
const DUMMY_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const DUMMY_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

describe("deposit-preauth set validation (no network)", () => {
  it("missing all main flags exits 1 with error", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple main flags exits 1 with error (--authorize and --unauthorize)", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--authorize", DUMMY_ADDRESS,
      "--unauthorize", DUMMY_ADDRESS,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("multiple main flags exits 1 with error (--authorize and --authorize-credential)", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--authorize", DUMMY_ADDRESS,
      "--authorize-credential", DUMMY_ADDRESS,
      "--credential-type", "KYC",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("--credential-type without credential flag exits 1 with error", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--authorize", DUMMY_ADDRESS,
      "--credential-type", "KYC",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--credential-type-hex without credential flag exits 1 with error", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--unauthorize", DUMMY_ADDRESS,
      "--credential-type-hex", "4B5943",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("both --credential-type and --credential-type-hex exits 1 with error", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--authorize-credential", DUMMY_ADDRESS,
      "--credential-type", "KYC",
      "--credential-type-hex", "4B5943",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("--authorize-credential without --credential-type or --credential-type-hex exits 1", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--authorize-credential", DUMMY_ADDRESS,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--unauthorize-credential without --credential-type exits 1", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--unauthorize-credential", DUMMY_ADDRESS,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--authorize", DUMMY_ADDRESS,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key material sources exits 1", () => {
    const result = runCLI([
      "deposit-preauth", "set",
      "--authorize", DUMMY_ADDRESS,
      "--seed", DUMMY_SEED,
      "--mnemonic", "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});
