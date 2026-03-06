import { describe, it, expect, beforeAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet } from "xrpl";
import { fundFromFaucet, TESTNET_URL } from "../../helpers/testnet.js";

let source: Wallet;
let destination: Wallet;
/** Channel used for redemption tests */
let claimChannelId: string;
/** Channel used for close test */
let closeChannelId: string;

beforeAll(async () => {
  const client = new Client(TESTNET_URL);
  await client.connect();
  try {
    source = await fundFromFaucet(client);
    destination = await fundFromFaucet(client);

    // Create channel for redemption tests (settle-delay 60s)
    const r1 = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "10",
      "--settle-delay", "60",
      "--seed", source.seed!,
      "--json",
    ]);
    if (r1.status !== 0) throw new Error(`channel create (claim) failed: ${r1.stderr}`);
    claimChannelId = (JSON.parse(r1.stdout) as { channelId: string }).channelId;

    // Create channel for close test (settle-delay 0)
    const r2 = runCLI([
      "--node", "testnet",
      "channel", "create",
      "--to", destination.address,
      "--amount", "5",
      "--settle-delay", "0",
      "--seed", source.seed!,
      "--json",
    ]);
    if (r2.status !== 0) throw new Error(`channel create (close) failed: ${r2.stderr}`);
    closeChannelId = (JSON.parse(r2.stdout) as { channelId: string }).channelId;
  } finally {
    await client.disconnect();
  }
}, 240_000);

describe("channel claim", () => {
  it("destination redeems a signed claim", () => {
    // Source signs a claim for 5 XRP
    const signResult = runCLI([
      "channel", "sign",
      "--channel", claimChannelId,
      "--amount", "5",
      "--seed", source.seed!,
    ]);
    expect(signResult.status, `sign stderr: ${signResult.stderr}`).toBe(0);
    const signature = signResult.stdout.trim();

    // Destination redeems the claim
    const claimResult = runCLI([
      "--node", "testnet",
      "channel", "claim",
      "--channel", claimChannelId,
      "--amount", "5",
      "--balance", "5",
      "--signature", signature,
      "--public-key", source.publicKey,
      "--seed", destination.seed!,
    ]);
    expect(claimResult.status, `stdout: ${claimResult.stdout} stderr: ${claimResult.stderr}`).toBe(0);
    expect(claimResult.stdout).toContain("tesSUCCESS");
  }, 60_000);

  it("--json outputs result in JSON", () => {
    // Sign another claim (cumulative: 6 XRP total)
    const signResult = runCLI([
      "channel", "sign",
      "--channel", claimChannelId,
      "--amount", "6",
      "--seed", source.seed!,
    ]);
    expect(signResult.status).toBe(0);
    const signature = signResult.stdout.trim();

    const claimResult = runCLI([
      "--node", "testnet",
      "channel", "claim",
      "--channel", claimChannelId,
      "--amount", "6",
      "--balance", "6",
      "--signature", signature,
      "--public-key", source.publicKey,
      "--seed", destination.seed!,
      "--json",
    ]);
    expect(claimResult.status, `stdout: ${claimResult.stdout} stderr: ${claimResult.stderr}`).toBe(0);
    const out = JSON.parse(claimResult.stdout) as { hash: string; result: string };
    expect(out.result).toBe("tesSUCCESS");
    expect(out.hash).toMatch(/^[0-9A-F]{64}$/i);
  }, 60_000);

  it("--dry-run outputs PaymentChannelClaim tx without submitting", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "claim",
      "--channel", claimChannelId,
      "--close",
      "--seed", source.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx_blob: string;
      tx: { TransactionType: string; Channel: string; Flags?: number };
    };
    expect(out.tx.TransactionType).toBe("PaymentChannelClaim");
    expect(out.tx.Channel).toBe(claimChannelId.toUpperCase());
    expect(typeof out.tx_blob).toBe("string");
    // --close flag = 0x00020000 = 131072
    expect(out.tx.Flags).toBeDefined();
    expect(Number(out.tx.Flags) & 0x00020000).toBe(0x00020000);
  }, 60_000);

  it("--renew flag is set in dry-run", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "claim",
      "--channel", claimChannelId,
      "--renew",
      "--seed", source.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      tx: { Flags?: number };
    };
    // --renew flag = 0x00010000 = 65536
    expect(out.tx.Flags).toBeDefined();
    expect(Number(out.tx.Flags) & 0x00010000).toBe(0x00010000);
  }, 60_000);

  it("source closes a channel with --close flag", () => {
    const result = runCLI([
      "--node", "testnet",
      "channel", "claim",
      "--channel", closeChannelId,
      "--close",
      "--seed", source.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 60_000);

  it("--no-wait exits 0 and outputs a 64-char hex hash", () => {
    // Use dry-run channel for a simple no-wait check
    const result = runCLI([
      "--node", "testnet",
      "channel", "claim",
      "--channel", claimChannelId,
      "--close",
      "--seed", source.seed!,
      "--no-wait",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/[0-9A-Fa-f]{64}/);
  }, 60_000);
});

describe("channel claim validation (no network)", () => {
  const DUMMY_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";
  const DUMMY_CHANNEL = "A".repeat(64);

  it("missing --channel exits 1 with error", () => {
    const result = runCLI([
      "channel", "claim",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--channel");
  });

  it("missing key material exits 1 with error", () => {
    const result = runCLI([
      "channel", "claim",
      "--channel", DUMMY_CHANNEL,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("multiple key materials exits 1 with error", () => {
    const result = runCLI([
      "channel", "claim",
      "--channel", DUMMY_CHANNEL,
      "--seed", DUMMY_SEED,
      "--mnemonic", "test test test test test test test test test test test junk",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("invalid --channel (not 64 hex chars) exits 1", () => {
    const result = runCLI([
      "channel", "claim",
      "--channel", "notahex",
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
  });

  it("--signature without --public-key exits 1 with error", () => {
    const SIG = "DEADBEEF".repeat(16);
    const result = runCLI([
      "channel", "claim",
      "--channel", DUMMY_CHANNEL,
      "--amount", "5",
      "--balance", "5",
      "--signature", SIG,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--public-key");
  });

  it("--signature without --amount exits 1 with error", () => {
    const SIG = "DEADBEEF".repeat(16);
    const PK = "0330E7FC9D56BB25D6893BA3F317AE5BCF33B3291BD63DB32654A313222F7FD020";
    const result = runCLI([
      "channel", "claim",
      "--channel", DUMMY_CHANNEL,
      "--balance", "5",
      "--signature", SIG,
      "--public-key", PK,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--amount");
  });

  it("--signature without --balance exits 1 with error", () => {
    const SIG = "DEADBEEF".repeat(16);
    const PK = "0330E7FC9D56BB25D6893BA3F317AE5BCF33B3291BD63DB32654A313222F7FD020";
    const result = runCLI([
      "channel", "claim",
      "--channel", DUMMY_CHANNEL,
      "--amount", "5",
      "--signature", SIG,
      "--public-key", PK,
      "--seed", DUMMY_SEED,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--balance");
  });
});
