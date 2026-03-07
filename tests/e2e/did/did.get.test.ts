import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let owner: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    owner = await fundFromFaucet(client);
  } finally {
    await client.disconnect();
  }

  // Create a DID with URI and Data for get tests
  const setupResult = runCLI([
    "--node", "testnet",
    "did", "set",
    "--uri", "https://example.com/did/get-test",
    "--data", "attestation-payload",
    "--seed", owner.seed!,
  ]);
  if (setupResult.status !== 0) {
    throw new Error(`DID setup failed: ${setupResult.stderr}`);
  }
}, 180_000);

describe("did get", () => {
  it("returns decoded URI and raw hex data", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "get",
      owner.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    // URI decoded from hex to UTF-8
    expect(result.stdout).toContain("https://example.com/did/get-test");
    // Data shown as raw hex
    const expectedDataHex = Buffer.from("attestation-payload").toString("hex");
    expect(result.stdout.toLowerCase()).toContain(expectedDataHex.toLowerCase());
  }, 30_000);

  it("--json outputs raw ledger entry JSON", () => {
    const result = runCLI([
      "--node", "testnet",
      "did", "get",
      owner.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { LedgerEntryType?: string; URI?: string; Data?: string };
    expect(out.LedgerEntryType).toBe("DID");
    expect(typeof out.URI).toBe("string");
  }, 30_000);

  it("returns not-found message for address with no DID", () => {
    // Use a fresh wallet that has no DID
    const fresh = Wallet.generate();
    // Fund is not needed — we only need an address that definitely has no DID object.
    // Use a well-known testnet genesis address unlikely to have a DID.
    const result = runCLI([
      "--node", "testnet",
      "did", "get",
      fresh.address,
    ]);
    // Either 0 exit with "No DID found" or 1 with account not found error
    if (result.status === 0) {
      expect(result.stdout).toContain("No DID found");
    } else {
      expect(result.stderr).toMatch(/error/i);
    }
  }, 30_000);

  it("--node option is accepted on did get", () => {
    const result = runCLI([
      "--node", "wss://s.altnet.rippletest.net:51233",
      "did", "get",
      owner.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("https://example.com/did/get-test");
  }, 30_000);
});
