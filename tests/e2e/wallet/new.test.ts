import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

function runCLI(args: string[]) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`,
    },
  });
}

describe("wallet new", () => {
  it("generates a valid wallet with --json flag", () => {
    const result = runCLI(["wallet", "new", "--json"]);
    expect(result.status).toBe(0);
    const wallet = JSON.parse(result.stdout) as {
      address: string;
      publicKey: string;
      privateKey: string;
      seed: string;
      keyType: string;
    };
    expect(wallet.address).toMatch(/^r/);
    expect(wallet.seed).toMatch(/^s/);
    expect(wallet.publicKey).toBeTruthy();
    expect(wallet.privateKey).toBeTruthy();
  });

  it("defaults to ed25519 key type", () => {
    const result = runCLI(["wallet", "new", "--json"]);
    expect(result.status).toBe(0);
    const wallet = JSON.parse(result.stdout) as { keyType: string };
    expect(wallet.keyType).toBe("ed25519");
  });

  it("uses secp256k1 when --key-type secp256k1 is passed", () => {
    const result = runCLI(["wallet", "new", "--key-type", "secp256k1", "--json"]);
    expect(result.status).toBe(0);
    const wallet = JSON.parse(result.stdout) as {
      address: string;
      keyType: string;
    };
    expect(wallet.keyType).toBe("secp256k1");
    expect(wallet.address).toMatch(/^r/);
  });

  it("prints labelled lines without --json", () => {
    const result = runCLI(["wallet", "new"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^Address:/m);
    expect(result.stdout).toMatch(/^Public Key:/m);
    expect(result.stdout).toMatch(/^Private Key:/m);
    expect(result.stdout).toMatch(/^Seed:/m);
  });

  it("alias 'n' works", () => {
    const result = runCLI(["wallet", "n", "--json"]);
    expect(result.status).toBe(0);
    const wallet = JSON.parse(result.stdout) as { address: string };
    expect(wallet.address).toMatch(/^r/);
  });
});
