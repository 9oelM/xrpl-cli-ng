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

describe("wallet public-key", () => {
  it("derives public key from seed matching wallet new output", () => {
    const newResult = runCLI(["wallet", "new", "--json"]);
    expect(newResult.status).toBe(0);
    const wallet = JSON.parse(newResult.stdout) as {
      seed: string;
      publicKey: string;
    };

    const result = runCLI(["wallet", "public-key", "--seed", wallet.seed, "--json"]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { publicKey: string; keyType: string };
    expect(data.publicKey).toBe(wallet.publicKey);
    expect(data.keyType).toBe("ed25519");
  });

  it("derives secp256k1 public key from seed", () => {
    const newResult = runCLI(["wallet", "new", "--key-type", "secp256k1", "--json"]);
    expect(newResult.status).toBe(0);
    const wallet = JSON.parse(newResult.stdout) as {
      seed: string;
      publicKey: string;
      keyType: string;
    };
    expect(wallet.keyType).toBe("secp256k1");

    const result = runCLI(["wallet", "public-key", "--seed", wallet.seed, "--json"]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { publicKey: string; keyType: string };
    expect(data.publicKey).toBe(wallet.publicKey);
    expect(data.keyType).toBe("secp256k1");
  });

  it("derives public key from mnemonic", () => {
    const mnemonicResult = runCLI(["wallet", "new-mnemonic", "--json"]);
    expect(mnemonicResult.status).toBe(0);
    const mnemonicWallet = JSON.parse(mnemonicResult.stdout) as {
      mnemonic: string;
      publicKey: string;
    };

    const result = runCLI([
      "wallet",
      "public-key",
      "--mnemonic",
      mnemonicWallet.mnemonic,
      "--json",
    ]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { publicKey: string };
    expect(data.publicKey).toBe(mnemonicWallet.publicKey);
  });

  it("derives public key from private key", () => {
    const newResult = runCLI(["wallet", "new", "--json"]);
    expect(newResult.status).toBe(0);
    const wallet = JSON.parse(newResult.stdout) as {
      seed: string;
      publicKey: string;
      privateKey: string;
    };

    const result = runCLI(["wallet", "public-key", "--private-key", wallet.privateKey, "--json"]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { publicKey: string };
    expect(data.publicKey).toBe(wallet.publicKey);
  });

  it("alias 'pubkey' works", () => {
    const newResult = runCLI(["wallet", "new", "--json"]);
    expect(newResult.status).toBe(0);
    const { seed } = JSON.parse(newResult.stdout) as { seed: string };

    const result = runCLI(["wallet", "pubkey", "--seed", seed, "--json"]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { publicKey: string };
    expect(data.publicKey).toBeTruthy();
  });

  it("exits 1 with error when no key material is provided", () => {
    const result = runCLI(["wallet", "public-key"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Error/);
  });

  it("exits 1 when multiple key sources are provided", () => {
    const result = runCLI([
      "wallet",
      "public-key",
      "--seed",
      "sSomeInvalidSeed",
      "--mnemonic",
      "word ".repeat(12).trim(),
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Error/);
  });

  it("prints public key in non-json mode", () => {
    const newResult = runCLI(["wallet", "new", "--json"]);
    expect(newResult.status).toBe(0);
    const { seed } = JSON.parse(newResult.stdout) as { seed: string };

    const result = runCLI(["wallet", "public-key", "--seed", seed]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Public Key:/);
    expect(result.stdout).toMatch(/Key Type:/);
  });
});
