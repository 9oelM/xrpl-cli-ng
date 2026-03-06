import { Command } from "commander";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Wallet, isoTimeToRippleTime } from "xrpl";
import type { EscrowCreate } from "xrpl";
import { deriveKeypair } from "ripple-keypairs";
import { withClient } from "../utils/client.js";
import { getNodeUrl } from "../utils/node.js";
import { decryptKeystore, getKeystoreDir, resolveAccount, type KeystoreFile } from "../utils/keystore.js";
import { promptPassword } from "../utils/prompt.js";

function walletFromSeed(seed: string): Wallet {
  const { publicKey, privateKey } = deriveKeypair(seed);
  return new Wallet(publicKey, privateKey);
}

async function resolveWallet(options: {
  seed?: string;
  mnemonic?: string;
  account?: string;
  password?: string;
  keystore?: string;
}): Promise<Wallet> {
  if (options.seed) {
    return walletFromSeed(options.seed);
  }

  if (options.mnemonic) {
    return Wallet.fromMnemonic(options.mnemonic, {
      mnemonicEncoding: "bip39",
      derivationPath: "m/44'/144'/0'/0/0",
    });
  }

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
    return Wallet.fromMnemonic(material!, {
      mnemonicEncoding: "bip39",
      derivationPath: "m/44'/144'/0'/0/0",
    });
  }
  return walletFromSeed(material!);
}

interface EscrowCreateOptions {
  to: string;
  amount: string;
  finishAfter?: string;
  cancelAfter?: string;
  condition?: string;
  destinationTag?: string;
  sourceTag?: string;
  seed?: string;
  mnemonic?: string;
  account?: string;
  password?: string;
  keystore?: string;
  wait: boolean;
  json: boolean;
  dryRun: boolean;
}

const escrowCreateCommand = new Command("create")
  .alias("c")
  .description("Create an escrow on the XRP Ledger")
  .requiredOption("--to <address>", "Destination address for escrowed funds")
  .requiredOption("--amount <xrp>", "Amount to escrow in XRP (e.g. 10 or 1.5)")
  .option("--finish-after <iso>", "Time after which funds can be released (ISO 8601)")
  .option("--cancel-after <iso>", "Expiration time; escrow can be cancelled after this (ISO 8601)")
  .option("--condition <hex>", "PREIMAGE-SHA-256 crypto-condition hex blob")
  .option("--destination-tag <n>", "Destination tag (unsigned 32-bit integer)")
  .option("--source-tag <n>", "Source tag (unsigned 32-bit integer)")
  .option("--seed <seed>", "Family seed for signing")
  .option("--mnemonic <phrase>", "BIP39 mnemonic for signing")
  .option("--account <address-or-alias>", "Account address or alias to load from keystore")
  .option("--password <password>", "Keystore decryption password (insecure, prefer interactive prompt)")
  .option("--keystore <dir>", "Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)")
  .option("--no-wait", "Submit without waiting for validation")
  .option("--json", "Output as JSON", false)
  .option("--dry-run", "Print signed tx without submitting", false)
  .action(async (options: EscrowCreateOptions, cmd: Command) => {
    // Require at least one time constraint or condition
    // (xrpl.js requires FinishAfter or CancelAfter; --condition alone is not a valid escrow)
    if (!options.finishAfter && !options.cancelAfter && !options.condition) {
      process.stderr.write("Error: provide at least --finish-after, --cancel-after, or --condition\n");
      process.exit(1);
    }

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

    // Parse amount (XRP decimal → drops string)
    const xrpFloat = parseFloat(options.amount);
    if (isNaN(xrpFloat) || xrpFloat <= 0) {
      process.stderr.write("Error: --amount must be a positive XRP decimal (e.g. 10 or 1.5)\n");
      process.exit(1);
    }
    const drops = String(Math.floor(xrpFloat * 1_000_000));

    // Parse --finish-after
    let finishAfter: number | undefined;
    if (options.finishAfter !== undefined) {
      try {
        finishAfter = isoTimeToRippleTime(options.finishAfter);
      } catch (e: unknown) {
        process.stderr.write(`Error: --finish-after: ${(e as Error).message}\n`);
        process.exit(1);
      }
    }

    // Parse --cancel-after
    let cancelAfter: number | undefined;
    if (options.cancelAfter !== undefined) {
      try {
        cancelAfter = isoTimeToRippleTime(options.cancelAfter);
      } catch (e: unknown) {
        process.stderr.write(`Error: --cancel-after: ${(e as Error).message}\n`);
        process.exit(1);
      }
    }

    // Parse destination tag
    let destTag: number | undefined;
    if (options.destinationTag !== undefined) {
      const tagNum = Number(options.destinationTag);
      if (!Number.isInteger(tagNum) || tagNum < 0 || tagNum > 4294967295) {
        process.stderr.write("Error: --destination-tag must be an integer between 0 and 4294967295\n");
        process.exit(1);
      }
      destTag = tagNum;
    }

    // Parse source tag
    let srcTag: number | undefined;
    if (options.sourceTag !== undefined) {
      const tagNum = Number(options.sourceTag);
      if (!Number.isInteger(tagNum) || tagNum < 0 || tagNum > 4294967295) {
        process.stderr.write("Error: --source-tag must be an integer between 0 and 4294967295\n");
        process.exit(1);
      }
      srcTag = tagNum;
    }

    const signerWallet = await resolveWallet(options);
    const keystoreDir = getKeystoreDir(options);
    const destination = resolveAccount(options.to, keystoreDir);

    const tx: EscrowCreate = {
      TransactionType: "EscrowCreate",
      Account: signerWallet.address,
      Amount: drops,
      Destination: destination,
      ...(finishAfter !== undefined ? { FinishAfter: finishAfter } : {}),
      ...(cancelAfter !== undefined ? { CancelAfter: cancelAfter } : {}),
      ...(options.condition !== undefined ? { Condition: options.condition } : {}),
      ...(destTag !== undefined ? { DestinationTag: destTag } : {}),
      ...(srcTag !== undefined ? { SourceTag: srcTag } : {}),
    };

    const url = getNodeUrl(cmd);

    await withClient(url, async (client) => {
      const filled = await client.autofill(tx);

      if (options.dryRun) {
        const signed = signerWallet.sign(filled);
        console.log(JSON.stringify({ tx_blob: signed.tx_blob, tx: filled }));
        return;
      }

      const signed = signerWallet.sign(filled);

      if (!options.wait) {
        await client.submit(signed.tx_blob);
        if (options.json) {
          console.log(JSON.stringify({ hash: signed.hash }));
        } else {
          console.log(`Transaction: ${signed.hash}`);
        }
        return;
      }

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
        tx_json?: { Fee?: string; Sequence?: number };
      };

      const resultCode = txResult.meta?.TransactionResult ?? "unknown";
      const hash = txResult.hash ?? signed.hash;
      const feeDrops = txResult.tx_json?.Fee ?? "0";
      const feeXrp = (Number(feeDrops) / 1_000_000).toFixed(6);
      const ledger = txResult.ledger_index;
      const sequence = txResult.tx_json?.Sequence;

      if (/^te[cfm]/i.test(resultCode)) {
        process.stderr.write(`Error: transaction failed with ${resultCode}\n`);
        if (options.json) {
          console.log(JSON.stringify({ hash, result: resultCode, fee: feeXrp, ledger }));
        }
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({ hash, result: resultCode, fee: feeXrp, ledger, sequence }));
      } else {
        console.log(`Transaction: ${hash}`);
        console.log(`Result:      ${resultCode}`);
        console.log(`Fee:         ${feeXrp} XRP`);
        console.log(`Ledger:      ${ledger}`);
        console.log(`Sequence:    ${sequence}`);
      }
    });
  });

export const escrowCommand = new Command("escrow")
  .description("Manage XRPL escrows")
  .addCommand(escrowCreateCommand);
