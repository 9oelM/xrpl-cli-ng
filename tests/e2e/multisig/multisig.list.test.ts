import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let owner: Wallet;
let signer1: Wallet;
let signer2: Wallet;
let signer3: Wallet;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    owner = await fundFromFaucet(client);
    signer1 = Wallet.generate();
    signer2 = Wallet.generate();
    signer3 = Wallet.generate();

    // Set a signer list with specific quorum and weights for all list tests
    const setResult = runCLI([
      "--node", "testnet",
      "multisig", "set",
      "--quorum", "4",
      "--signer", `${signer1.address}:2`,
      "--signer", `${signer2.address}:3`,
      "--signer", `${signer3.address}:1`,
      "--seed", owner.seed!,
    ]);
    if (setResult.status !== 0) {
      throw new Error(`Failed to set signer list: ${setResult.stderr}`);
    }
  } finally {
    await client.disconnect();
  }
}, 180_000);

describe("multisig list core", () => {
  it("shows correct quorum and signers with correct weights", () => {
    const result = runCLI([
      "--node", "testnet",
      "multisig", "list",
      owner.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Quorum: 4");
    expect(result.stdout).toContain(signer1.address);
    expect(result.stdout).toContain(signer2.address);
    expect(result.stdout).toContain(signer3.address);
    expect(result.stdout).toContain("weight: 2");
    expect(result.stdout).toContain("weight: 3");
    expect(result.stdout).toContain("weight: 1");
  });

  it("--json outputs raw JSON array with SignerQuorum and SignerEntries", () => {
    const result = runCLI([
      "--node", "testnet",
      "multisig", "list",
      owner.address,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as Array<{
      LedgerEntryType: string;
      SignerQuorum: number;
      SignerEntries: Array<{ SignerEntry: { Account: string; SignerWeight: number } }>;
    }>;
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(1);
    expect(out[0].LedgerEntryType).toBe("SignerList");
    expect(out[0].SignerQuorum).toBe(4);
    expect(out[0].SignerEntries).toHaveLength(3);
    const accounts = out[0].SignerEntries.map((e) => e.SignerEntry.Account);
    expect(accounts).toContain(signer1.address);
    expect(accounts).toContain(signer2.address);
    expect(accounts).toContain(signer3.address);
  });

  it("shows 'No signer list configured.' for account with no signer list", async () => {
    const client = new Client(TESTNET_URL);
    await client.connect();
    let fresh: Wallet;
    try {
      fresh = await fundFromFaucet(client);
    } finally {
      await client.disconnect();
    }

    const result = runCLI([
      "--node", "testnet",
      "multisig", "list",
      fresh.address,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("No signer list configured.");
  }, 180_000);
});
