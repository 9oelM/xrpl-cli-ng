import { Command } from "commander";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { Wallet } from "xrpl";
import type { Payment } from "xrpl";
import { deriveKeypair } from "ripple-keypairs";
import { withClient } from "../utils/client.js";
import { getNodeUrl } from "../utils/node.js";
import { decryptKeystore, getKeystoreDir, resolveAccount, type KeystoreFile } from "../utils/keystore.js";
import { parseAmount, toXrplAmount } from "../utils/amount.js";

async function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question("Password: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function walletFromSeed(seed: string): Wallet {
  const { publicKey, privateKey } = deriveKeypair(seed);
  return new Wallet(publicKey, privateKey);
}

interface PaymentOptions {
  to: string;
  amount: string;
  seed?: string;
  mnemonic?: string;
  account?: string;
  password?: string;
  keystore?: string;
  noWait: boolean;
  json: boolean;
  dryRun: boolean;
}

export const paymentCommand = new Command("payment")
  .alias("send")
  .description("Send a Payment transaction on the XRP Ledger")
  .requiredOption("--to <address-or-alias>", "Destination address or alias")
  .requiredOption("--amount <amount>", "Amount to send (e.g. 1.5 for XRP, 10/USD/rIssuer for IOU, 100/<48-hex> for MPT)")
  .option("--seed <seed>", "Family seed for signing")
  .option("--mnemonic <phrase>", "BIP39 mnemonic for signing")
  .option("--account <address-or-alias>", "Account address or alias to load from keystore")
  .option("--password <password>", "Keystore decryption password (insecure, prefer interactive prompt)")
  .option("--keystore <dir>", "Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)")
  .option("--no-wait", "Submit without waiting for validation", false)
  .option("--json", "Output as JSON", false)
  .option("--dry-run", "Print signed tx without submitting", false)
  .action(async (options: PaymentOptions, cmd: Command) => {
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

    // Parse amount
    let xrplAmount: string | { value: string; currency: string; issuer: string } | { value: string; mpt_issuance_id: string };
    try {
      xrplAmount = toXrplAmount(parseAmount(options.amount));
    } catch (e: unknown) {
      process.stderr.write(`Error: ${(e as Error).message}\n`);
      process.exit(1);
    }

    // Resolve destination
    const keystoreDir = getKeystoreDir(options);
    const destination = resolveAccount(options.to, keystoreDir);

    // Build the Payment transaction
    const tx: Payment = {
      TransactionType: "Payment",
      Account: signerWallet!.address,
      Destination: destination,
      Amount: xrplAmount as Payment["Amount"],
    };

    const url = getNodeUrl(cmd);

    await withClient(url, async (client) => {
      const filled = await client.autofill(tx);

      if (options.dryRun) {
        const signed = signerWallet!.sign(filled);
        console.log(JSON.stringify({ tx_blob: signed.tx_blob, tx: filled }));
        return;
      }

      const signed = signerWallet!.sign(filled);

      if (options.noWait) {
        await client.submit(signed.tx_blob);
        if (options.json) {
          console.log(JSON.stringify({ hash: signed.hash }));
        } else {
          console.log(`Transaction: ${signed.hash}`);
        }
        return;
      }

      // submitAndWait
      let response;
      try {
        response = await client.submitAndWait(signed.tx_blob);
      } catch (e: unknown) {
        const err = e as Error;
        if (err.constructor.name === "TimeoutError" || err.message?.includes("LastLedgerSequence")) {
          process.stderr.write("Error: transaction expired (LastLedgerSequence exceeded)\n");
          process.exit(1);
        }
        throw e;
      }

      const txResult = response.result as {
        hash?: string;
        ledger_index?: number;
        meta?: { TransactionResult?: string };
        tx_json?: { Fee?: string };
      };

      const resultCode = txResult.meta?.TransactionResult ?? "unknown";
      const hash = txResult.hash ?? signed.hash;
      const feeDrops = txResult.tx_json?.Fee ?? "0";
      const feeXrp = (Number(feeDrops) / 1_000_000).toFixed(6);
      const ledger = txResult.ledger_index;

      // Exit 1 on tec/tef/tem codes
      if (/^te[cfm]/i.test(resultCode)) {
        process.stderr.write(`Error: transaction failed with ${resultCode}\n`);
        if (options.json) {
          console.log(JSON.stringify({ hash, result: resultCode, fee: feeXrp, ledger }));
        }
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({ hash, result: resultCode, fee: feeXrp, ledger }));
      } else {
        console.log(`Transaction: ${hash}`);
        console.log(`Result:      ${resultCode}`);
        console.log(`Fee:         ${feeXrp} XRP`);
        console.log(`Ledger:      ${ledger}`);
      }
    });
  });
