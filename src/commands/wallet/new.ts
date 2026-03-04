import { Command } from "commander";
import { Wallet } from "xrpl";
import type { ECDSA } from "xrpl";

type KeyType = "ed25519" | "secp256k1";

interface NewWalletOptions {
  keyType: KeyType;
  json: boolean;
}

// Maps user-facing key type to xrpl.js ECDSA enum values (which are plain strings at runtime)
function toAlgorithm(keyType: KeyType): ECDSA {
  const value = keyType === "secp256k1" ? "ecdsa-secp256k1" : "ed25519";
  return value as unknown as ECDSA;
}

export const newWalletCommand = new Command("new")
  .alias("n")
  .description("Generate a new random XRPL wallet")
  .option("--key-type <type>", "Key algorithm: secp256k1 or ed25519", "ed25519")
  .option("--json", "Output as JSON", false)
  .action((options: NewWalletOptions) => {
    const wallet = Wallet.generate(toAlgorithm(options.keyType));

    if (options.json) {
      console.log(
        JSON.stringify({
          address: wallet.address,
          publicKey: wallet.publicKey,
          privateKey: wallet.privateKey,
          seed: wallet.seed,
          keyType: options.keyType,
        })
      );
    } else {
      console.log(`Address:     ${wallet.address}`);
      console.log(`Public Key:  ${wallet.publicKey}`);
      console.log(`Private Key: ${wallet.privateKey}`);
      console.log(`Seed:        ${wallet.seed}`);
    }
  });
