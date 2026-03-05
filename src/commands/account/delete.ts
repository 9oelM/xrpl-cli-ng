import { Command } from "commander";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { Wallet } from "xrpl";
import type { AccountDelete } from "xrpl";
import { deriveKeypair } from "ripple-keypairs";
import { withClient } from "../../utils/client.js";
import { getNodeUrl } from "../../utils/node.js";
import { decryptKeystore, getKeystoreDir, resolveAccount, type KeystoreFile } from "../../utils/keystore.js";
import { promptPassword } from "../../utils/prompt.js";

async function promptConfirm(): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Confirm? [y/N] ", (answer) => {
      rl.close();
      resolve(answer === "y" || answer === "Y");
    });
  });
}

function walletFromSeed(seed: string): Wallet {
  const { publicKey, privateKey } = deriveKeypair(seed);
  return new Wallet(publicKey, privateKey);
}

interface DeleteOptions {
  destination: string;
  destinationTag?: string;
  seed?: string;
  mnemonic?: string;
  account?: string;
  password?: string;
  keystore?: string;
  yes: boolean;
  json: boolean;
  dryRun: boolean;
}

export const deleteCommand = new Command("delete")
  .description("Delete an account with an AccountDelete transaction (irreversible)")
  .requiredOption("--destination <address-or-alias>", "Destination address or alias to receive remaining XRP")
  .option("--destination-tag <n>", "Destination tag for the destination account")
  .option("--seed <seed>", "Family seed for signing")
  .option("--mnemonic <phrase>", "BIP39 mnemonic for signing")
  .option("--account <address-or-alias>", "Account address or alias to load from keystore")
  .option("--password <password>", "Keystore decryption password (insecure, prefer interactive prompt)")
  .option("--keystore <dir>", "Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)")
  .option("--yes", "Skip interactive confirmation", false)
  .option("--json", "Output as JSON", false)
  .option("--dry-run", "Print unsigned tx JSON without submitting", false)
  .action(async (options: DeleteOptions, cmd: Command) => {
    // Validate key material
    const keyMaterialCount = [options.seed, options.mnemonic, options.account].filter(Boolean).length;
    if (keyMaterialCount === 0) {
      process.stderr.write("Error: provide key material via --seed, --mnemonic, or --account\n");
      process.exit(1);
    }
    if (keyMaterialCount > 1) {
      process.stderr.write("Error: provide only one of --seed, --mnemonic, or --account\n");
      process.exit(1);
    }

    // Resolve wallet
    let signerWallet: Wallet;

    if (options.seed) {
      signerWallet = walletFromSeed(options.seed);
    } else if (options.mnemonic) {
      signerWallet = Wallet.fromMnemonic(options.mnemonic, {
        mnemonicEncoding: "bip39",
        derivationPath: "m/44'/144'/0'/0/0",
      });
    } else {
      // --account: load from keystore
      const keystoreDir = getKeystoreDir(options);
      const address = resolveAccount(options.account!, keystoreDir);
      const filePath = join(keystoreDir, `${address}.json`);

      if (!existsSync(filePath)) {
        process.stderr.write(`Error: keystore file not found for account ${address}\n`);
        process.exit(1);
      }

      let keystoreData: KeystoreFile;
      try {
        keystoreData = JSON.parse(readFileSync(filePath, "utf-8")) as KeystoreFile;
      } catch {
        process.stderr.write("Error: failed to read or parse keystore file\n");
        process.exit(1);
      }

      let password: string;
      if (options.password !== undefined) {
        process.stderr.write("Warning: passing passwords via flag is insecure\n");
        password = options.password;
      } else {
        password = await promptPassword();
      }

      let material: string;
      try {
        material = decryptKeystore(keystoreData!, password);
      } catch {
        process.stderr.write("Error: wrong password or corrupt keystore\n");
        process.exit(1);
      }

      if (material!.trim().split(/\s+/).length > 1) {
        signerWallet = Wallet.fromMnemonic(material!, {
          mnemonicEncoding: "bip39",
          derivationPath: "m/44'/144'/0'/0/0",
        });
      } else {
        signerWallet = walletFromSeed(material!);
      }
    }

    // Resolve destination
    const keystoreDir = getKeystoreDir(options);
    const destinationAddress = resolveAccount(options.destination, keystoreDir);

    // Build the AccountDelete transaction
    const tx: AccountDelete = {
      TransactionType: "AccountDelete",
      Account: signerWallet!.address,
      Destination: destinationAddress,
    };

    if (options.destinationTag !== undefined) {
      tx.DestinationTag = parseInt(options.destinationTag, 10);
    }

    if (options.dryRun) {
      console.log(JSON.stringify(tx, null, 2));
      return;
    }

    // Print irreversibility warning
    process.stderr.write(
      "Warning: AccountDelete is irreversible. The account will be removed from the ledger.\n"
    );

    // Confirm unless --yes
    if (!options.yes) {
      const confirmed = await promptConfirm();
      if (!confirmed) {
        process.stderr.write("Aborted.\n");
        process.exit(0);
      }
    }

    const url = getNodeUrl(cmd);
    await withClient(url, async (client) => {
      const filled = await client.autofill(tx);
      const signed = signerWallet!.sign(filled);
      await client.submit(signed.tx_blob);

      if (options.json) {
        console.log(
          JSON.stringify({
            hash: signed.hash,
            result: "tesSUCCESS",
            tx_blob: signed.tx_blob,
          })
        );
      } else {
        console.log(`Account deleted. Transaction hash: ${signed.hash}`);
      }
    });
  });
