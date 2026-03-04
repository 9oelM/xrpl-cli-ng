import { Command } from "commander";
import { Wallet } from "xrpl";
import type { ECDSA } from "xrpl";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

type KeyType = "ed25519" | "secp256k1";

const DEFAULT_DERIVATION_PATH = "m/44'/144'/0'/0/0";

interface NewMnemonicOptions {
  derivationPath: string;
  keyType: KeyType;
  json: boolean;
}

function toAlgorithm(keyType: KeyType): ECDSA {
  const value = keyType === "secp256k1" ? "ecdsa-secp256k1" : "ed25519";
  return value as unknown as ECDSA;
}

export const newMnemonicCommand = new Command("new-mnemonic")
  .alias("nm")
  .description("Generate a new BIP39 mnemonic wallet")
  .option(
    "--derivation-path <path>",
    "BIP44 derivation path",
    DEFAULT_DERIVATION_PATH
  )
  .option("--key-type <type>", "Key algorithm: secp256k1 or ed25519", "ed25519")
  .option("--json", "Output as JSON", false)
  .action((options: NewMnemonicOptions) => {
    // 128 bits of entropy = 12 words
    const mnemonic = generateMnemonic(wordlist, 128);
    const wallet = Wallet.fromMnemonic(mnemonic, {
      mnemonicEncoding: "bip39",
      derivationPath: options.derivationPath,
      algorithm: toAlgorithm(options.keyType),
    });

    if (options.json) {
      console.log(
        JSON.stringify({
          mnemonic,
          derivationPath: options.derivationPath,
          address: wallet.address,
          publicKey: wallet.publicKey,
          privateKey: wallet.privateKey,
          keyType: options.keyType,
        })
      );
    } else {
      console.log(`Mnemonic:         ${mnemonic}`);
      console.log(`Derivation Path:  ${options.derivationPath}`);
      console.log(`Address:          ${wallet.address}`);
      console.log(`Public Key:       ${wallet.publicKey}`);
      console.log(`Private Key:      ${wallet.privateKey}`);
    }
  });
