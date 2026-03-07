import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCLI } from "../../helpers/cli.js";
import { Client, Wallet, convertStringToHex } from "xrpl";
import {
  XRPL_WS,
  fundMaster,
  initTicketPool,
  createFunded,
} from "../helpers/fund.js";

// Budget: 42 tickets × 0.2 = 8.4 XRP; 40 wallets × 2 XRP = 80 XRP; total 88.4 ≤ 99 ✓
// 20 tests × 2 wallets (issuer + subject) = 40 wallets
const TICKET_COUNT = 42;
const FUND_AMOUNT = 2;

let client: Client;
let master: Wallet;

beforeAll(async () => {
  client = new Client(XRPL_WS);
  await client.connect();
  master = await fundMaster(client);
  await initTicketPool(client, master, TICKET_COUNT);
}, 120_000);

afterAll(async () => {
  await client.disconnect();
});

// ─── credential create ────────────────────────────────────────────────────────

describe("credential create", () => {
  it("creates a credential with --credential-type string", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("Credential ID:");
  }, 90_000);

  it("creates a credential with --credential-type-hex", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type-hex", "41424344", // "ABCD"
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("Credential ID:");
  }, 90_000);

  it("creates a credential with --uri", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC_URI",
      "--uri", "https://example.com/credential",
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
    expect(result.stdout).toContain("Credential ID:");
  }, 90_000);

  it("creates a credential with --expiration", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC_EXP",
      "--expiration", future,
      "--seed", issuer.seed!,
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("--json outputs hash, result, fee, ledger, credentialId", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC_JSON",
      "--seed", issuer.seed!,
      "--json",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
      credentialId: string;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
    expect(typeof out.credentialId).toBe("string");
    expect(out.credentialId).toMatch(/^[0-9A-Fa-f]{64}$/);
  }, 90_000);

  it("--dry-run outputs JSON with TransactionType CredentialCreate and does not submit", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", "KYC_DRY",
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CredentialCreate");
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);
});

// ─── credential accept ────────────────────────────────────────────────────────

describe("credential accept", () => {
  it("subject accepts a credential issued by the issuer", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_ACCEPT";
    const credTypeHex = convertStringToHex(credType);

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept: ${acceptResult.stderr}`).toBe(0);
    expect(acceptResult.stdout).toContain("tesSUCCESS");

    // Verify on-chain: lsfAccepted flag must be set
    const res = await client.request({
      command: "account_objects",
      account: subject.address,
      type: "credential",
      ledger_index: "validated",
    });
    const cred = (res.result.account_objects as Array<{ CredentialType?: string; Flags?: number }>).find(
      (o) => o.CredentialType === credTypeHex
    );
    expect(cred).toBeDefined();
    expect((cred!.Flags! & 0x00010000) !== 0).toBe(true);
  }, 90_000);

  it("--json outputs hash, result, fee, ledger", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_ACCEPT_JSON";

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
      "--json",
    ]);
    expect(acceptResult.status, `accept: ${acceptResult.stderr}`).toBe(0);
    const out = JSON.parse(acceptResult.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
  }, 90_000);

  it("--dry-run outputs JSON with TransactionType CredentialAccept and does not submit", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", "KYC_DRY",
      "--seed", subject.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CredentialAccept");
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("accepts credential with --credential-type-hex", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_ACCEPT_HEX";
    const credTypeHex = convertStringToHex(credType);

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type-hex", credTypeHex,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept: ${acceptResult.stderr}`).toBe(0);
    expect(acceptResult.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("--no-wait submits without waiting and prints hash", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_ACCEPT_NOWAIT";

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
      "--no-wait",
    ]);
    expect(acceptResult.status, `accept: ${acceptResult.stderr}`).toBe(0);
    expect(acceptResult.stdout).toContain("Transaction:");
  }, 90_000);
});

// ─── credential delete ────────────────────────────────────────────────────────

describe("credential delete", () => {
  it("issuer deletes a credential they created", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_DELETE_ISSUER";
    const credTypeHex = convertStringToHex(credType);

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(deleteResult.status, `delete: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");

    const res = await client.request({
      command: "account_objects",
      account: subject.address,
      type: "credential",
      ledger_index: "validated",
    });
    const cred = (res.result.account_objects as Array<{ CredentialType?: string }>).find(
      (o) => o.CredentialType === credTypeHex
    );
    expect(cred).toBeUndefined();
  }, 90_000);

  it("subject deletes their own accepted credential", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_DELETE_SUBJECT";
    const credTypeHex = convertStringToHex(credType);

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept: ${acceptResult.stderr}`).toBe(0);

    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
    ]);
    expect(deleteResult.status, `delete: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");

    const res = await client.request({
      command: "account_objects",
      account: subject.address,
      type: "credential",
      ledger_index: "validated",
    });
    const cred = (res.result.account_objects as Array<{ CredentialType?: string }>).find(
      (o) => o.CredentialType === credTypeHex
    );
    expect(cred).toBeUndefined();
  }, 90_000);

  it("--json outputs hash, result, fee, ledger, credentialId", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_DELETE_JSON";

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
      "--json",
    ]);
    expect(deleteResult.status, `delete: ${deleteResult.stderr}`).toBe(0);
    const out = JSON.parse(deleteResult.stdout) as {
      hash: string;
      result: string;
      fee: string;
      ledger: number;
      credentialId: string | null;
    };
    expect(out.result).toBe("tesSUCCESS");
    expect(typeof out.hash).toBe("string");
    expect(typeof out.fee).toBe("string");
    expect(typeof out.ledger).toBe("number");
    expect(typeof out.credentialId).toBe("string");
  }, 90_000);

  it("--dry-run outputs JSON with TransactionType CredentialDelete and does not submit", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const result = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type", "KYC_DRY_DELETE",
      "--seed", issuer.seed!,
      "--dry-run",
    ]);
    expect(result.status, `stdout: ${result.stdout} stderr: ${result.stderr}`).toBe(0);
    const out = JSON.parse(result.stdout) as { tx_blob: string; tx: { TransactionType: string } };
    expect(out.tx.TransactionType).toBe("CredentialDelete");
    expect(typeof out.tx_blob).toBe("string");
  }, 90_000);

  it("--credential-type-hex deletes credential using raw hex type", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_DELETE_HEX";
    const credTypeHex = convertStringToHex(credType);

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type-hex", credTypeHex,
      "--seed", issuer.seed!,
    ]);
    expect(deleteResult.status, `delete: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("tesSUCCESS");
  }, 90_000);

  it("--no-wait submits without waiting and prints hash", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_DELETE_NOWAIT";

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const deleteResult = runCLI([
      "--node", "testnet",
      "credential", "delete",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
      "--no-wait",
    ]);
    expect(deleteResult.status, `delete: ${deleteResult.stderr}`).toBe(0);
    expect(deleteResult.stdout).toContain("Transaction:");
  }, 90_000);
});

// ─── credential list ──────────────────────────────────────────────────────────

describe("credential list", () => {
  it("lists an accepted credential with accepted=yes", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_LIST_ACCEPTED";

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept: ${acceptResult.stderr}`).toBe(0);

    const listResult = runCLI([
      "--node", "testnet",
      "credential", "list",
      subject.address,
    ]);
    expect(listResult.status, `list: ${listResult.stderr}`).toBe(0);
    expect(listResult.stdout).toContain("Accepted:        yes");
    expect(listResult.stdout).toContain(credType);
    expect(listResult.stdout).toContain(issuer.address);
    expect(listResult.stdout).toContain(subject.address);
  }, 90_000);

  it("lists a pending credential with accepted=no", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_LIST_PENDING";

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const listResult = runCLI([
      "--node", "testnet",
      "credential", "list",
      issuer.address,
    ]);
    expect(listResult.status, `list: ${listResult.stderr}`).toBe(0);
    expect(listResult.stdout).toContain(credType);
    expect(listResult.stdout).toContain("Accepted:        no");
  }, 90_000);

  it("--json outputs raw JSON array with accepted credential", async () => {
    const [issuer, subject] = await createFunded(client, master, 2, FUND_AMOUNT);
    const credType = "KYC_LIST_JSON";
    const credTypeHex = convertStringToHex(credType);

    const createResult = runCLI([
      "--node", "testnet",
      "credential", "create",
      "--subject", subject.address,
      "--credential-type", credType,
      "--seed", issuer.seed!,
    ]);
    expect(createResult.status, `create: ${createResult.stderr}`).toBe(0);

    const acceptResult = runCLI([
      "--node", "testnet",
      "credential", "accept",
      "--issuer", issuer.address,
      "--credential-type", credType,
      "--seed", subject.seed!,
    ]);
    expect(acceptResult.status, `accept: ${acceptResult.stderr}`).toBe(0);

    const listResult = runCLI([
      "--node", "testnet",
      "credential", "list",
      subject.address,
      "--json",
    ]);
    expect(listResult.status, `list: ${listResult.stderr}`).toBe(0);
    const arr = JSON.parse(listResult.stdout) as Array<{ CredentialType: string; Flags?: number }>;
    expect(Array.isArray(arr)).toBe(true);
    const found = arr.find((c) => c.CredentialType === credTypeHex);
    expect(found).toBeDefined();
    expect((found!.Flags! & 0x00010000) !== 0).toBe(true);
  }, 90_000);
});
