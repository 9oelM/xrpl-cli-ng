import { describe, it, expect } from "vitest";
import { runCLI } from "../../helpers/cli.js";

// Static dummy values — these tests exit before any network call
const DUMMY_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const DUMMY_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

describe("credential create validation (no network)", () => {
  it("missing --subject exits 1 with error", () => {
    const result = runCLI([
      "credential", "create",
      "--credential-type", "KYC",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("required option");
  });

  it("missing credential-type exits 1 with error", () => {
    const result = runCLI([
      "credential", "create",
      "--subject", DUMMY_ADDRESS,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("both --credential-type and --credential-type-hex exits 1", () => {
    const result = runCLI([
      "credential", "create",
      "--subject", DUMMY_ADDRESS,
      "--credential-type", "KYC",
      "--credential-type-hex", "4B5943",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("both --uri and --uri-hex exits 1", () => {
    const result = runCLI([
      "credential", "create",
      "--subject", DUMMY_ADDRESS,
      "--credential-type", "KYC",
      "--uri", "https://example.com",
      "--uri-hex", "68747470733A2F2F6578616D706C652E636F6D",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("missing key material exits 1", () => {
    const result = runCLI([
      "credential", "create",
      "--subject", DUMMY_ADDRESS,
      "--credential-type", "KYC",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });
});
