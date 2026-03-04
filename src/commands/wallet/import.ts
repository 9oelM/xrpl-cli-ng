import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { homedir } from "os";
import { join, resolve } from "path";
import { deriveAddress, deriveKeypair } from "ripple-keypairs";
import { Wallet } from "xrpl";
import type { ECDSA } from "xrpl";
import { ed25519 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";
import { encryptKeystore } from "../../utils/keystore.js";

type KeyType = "ed25519" | "secp256k1";

const DEFAULT_DERIVATION_PATH = "m/44'/144'/0'/0/0";

function toAlgorithm(keyType: KeyType): ECDSA {
  return (keyType === "secp256k1" ? "ecdsa-secp256k1" : "ed25519") as unknown as ECDSA;
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex").toUpperCase();
}

function hexToBytes(hex: string): Uint8Array {
  return Buffer.from(hex, "hex");
}

function getKeystoreDir(options: { keystore?: string }): string {
  if (options.keystore) {
    return resolve(options.keystore);
  }
  const envDir = process.env["XRPL_KEYSTORE"];
  if (envDir) {
    return resolve(envDir);
  }
  return join(homedir(), ".xrpl", "keystore");
}

function detectKeyMaterialType(input: string): "seed" | "mnemonic" | "privateKey" {
  if (input.trim().split(/\s+/).length > 1) {
    return "mnemonic";
  }
  if (/^s[a-zA-Z0-9]{20,}$/.test(input)) {
    return "seed";
  }
  return "privateKey";
}

function deriveFromSeed(seed: string): { address: string; seedToEncrypt: string; keyType: KeyType } {
  const keypair = deriveKeypair(seed);
  const address = deriveAddress(keypair.publicKey);
  const keyType: KeyType = keypair.privateKey.toUpperCase().startsWith("ED") ? "ed25519" : "secp256k1";
  return { address, seedToEncrypt: seed, keyType };
}

function deriveFromMnemonic(
  mnemonic: string,
  keyType: KeyType,
  derivationPath?: string
): { address: string; seedToEncrypt: string; keyType: KeyType } {
  const wallet = Wallet.fromMnemonic(mnemonic, {
    mnemonicEncoding: "bip39",
    derivationPath: derivationPath ?? DEFAULT_DERIVATION_PATH,
    algorithm: toAlgorithm(keyType),
  });
  return { address: wallet.address, seedToEncrypt: mnemonic, keyType };
}

function deriveFromPrivateKey(
  privateKeyHex: string,
  keyTypeOption?: KeyType
): { address: string; seedToEncrypt: string; keyType: KeyType } {
  let publicKey: string;
  let keyType: KeyType;

  if (privateKeyHex.startsWith("ED") || privateKeyHex.startsWith("ed")) {
    const rawPrivKey = hexToBytes(privateKeyHex.slice(2));
    publicKey = "ED" + bytesToHex(ed25519.getPublicKey(rawPrivKey));
    keyType = "ed25519";
  } else if (privateKeyHex.startsWith("00")) {
    const rawPrivKey = hexToBytes(privateKeyHex.slice(2));
    publicKey = bytesToHex(secp256k1.getPublicKey(rawPrivKey, true));
    keyType = "secp256k1";
  } else if (keyTypeOption === "ed25519") {
    const rawPrivKey = hexToBytes(privateKeyHex);
    publicKey = "ED" + bytesToHex(ed25519.getPublicKey(rawPrivKey));
    keyType = "ed25519";
  } else if (keyTypeOption === "secp256k1") {
    const rawPrivKey = hexToBytes(privateKeyHex);
    publicKey = bytesToHex(secp256k1.getPublicKey(rawPrivKey, true));
    keyType = "secp256k1";
  } else {
    process.stderr.write(
      "Error: --key-type is required when importing a raw hex private key without a recognized prefix\n"
    );
    process.exit(1);
  }

  const address = deriveAddress(publicKey);
  return { address, seedToEncrypt: privateKeyHex, keyType };
}

async function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question("Password: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

interface ImportOptions {
  keyType?: KeyType;
  password?: string;
  keystore?: string;
  force: boolean;
}

export const importCommand = new Command("import")
  .alias("i")
  .description("Import key material into encrypted keystore")
  .argument("<key-material>", "Seed, mnemonic, or private key to import (use '-' to read from stdin)")
  .option("--key-type <type>", "Key algorithm: secp256k1 or ed25519 (required for unprefixed hex private keys)")
  .option("--password <password>", "Encryption password (insecure, prefer interactive prompt)")
  .option(
    "--keystore <dir>",
    "Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)"
  )
  .option("--force", "Overwrite existing keystore entry", false)
  .action(async (keyMaterial: string, options: ImportOptions) => {
    let input = keyMaterial;
    if (keyMaterial === "-") {
      input = readFileSync("/dev/stdin", "utf-8").trim();
    }

    let password: string;
    if (options.password !== undefined) {
      process.stderr.write("Warning: passing passwords via flag is insecure\n");
      password = options.password;
    } else {
      password = await promptPassword();
    }

    const keyMaterialType = detectKeyMaterialType(input);

    let address: string;
    let seedToEncrypt: string;
    let keyType: KeyType;

    if (keyMaterialType === "seed") {
      const result = deriveFromSeed(input);
      address = result.address;
      seedToEncrypt = result.seedToEncrypt;
      keyType = result.keyType;
    } else if (keyMaterialType === "mnemonic") {
      const result = deriveFromMnemonic(input, options.keyType ?? "ed25519");
      address = result.address;
      seedToEncrypt = result.seedToEncrypt;
      keyType = result.keyType;
    } else {
      const result = deriveFromPrivateKey(input, options.keyType);
      address = result.address;
      seedToEncrypt = result.seedToEncrypt;
      keyType = result.keyType;
    }

    const keystoreDir = getKeystoreDir(options);
    mkdirSync(keystoreDir, { recursive: true });

    const filePath = join(keystoreDir, `${address}.json`);

    if (existsSync(filePath) && !options.force) {
      process.stderr.write(
        `Error: keystore for ${address} already exists. Use --force to overwrite.\n`
      );
      process.exit(1);
    }

    const keystoreData = encryptKeystore(seedToEncrypt, password, keyType, address);
    writeFileSync(filePath, JSON.stringify(keystoreData, null, 2), "utf-8");

    console.log(`Imported account ${address} to ${filePath}`);
  });
