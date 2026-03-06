import { Command } from "commander";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Wallet, NFTokenMintFlags, convertStringToHex, getNFTokenID } from "xrpl";
import type { NFTokenMint, TransactionMetadata } from "xrpl";
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

  // --account path
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

interface NftMintOptions {
  taxon: string;
  uri?: string;
  transferFee?: string;
  burnable: boolean;
  onlyXrp: boolean;
  transferable: boolean;
  mutable: boolean;
  issuer?: string;
  seed?: string;
  mnemonic?: string;
  account?: string;
  password?: string;
  keystore?: string;
  wait: boolean;
  json: boolean;
  dryRun: boolean;
}

const nftMintCommand = new Command("mint")
  .description("Mint an NFT on the XRP Ledger")
  .requiredOption("--taxon <n>", "NFT taxon (UInt32)")
  .option("--uri <string>", "Metadata URI (plain string, converted to hex)")
  .option("--transfer-fee <bps>", "Secondary sale fee in basis points (0-50000); requires --transferable")
  .option("--burnable", "Allow issuer to burn the NFT (tfBurnable)", false)
  .option("--only-xrp", "Restrict sales to XRP only (tfOnlyXRP)", false)
  .option("--transferable", "Allow peer-to-peer transfers (tfTransferable)", false)
  .option("--mutable", "Allow URI modification via nft modify (tfMutable)", false)
  .option("--issuer <address>", "Issuer address (when minting on behalf of another account)")
  .option("--seed <seed>", "Family seed for signing")
  .option("--mnemonic <phrase>", "BIP39 mnemonic for signing")
  .option("--account <address-or-alias>", "Account address or alias to load from keystore")
  .option("--password <password>", "Keystore decryption password (insecure, prefer interactive prompt)")
  .option("--keystore <dir>", "Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)")
  .option("--no-wait", "Submit without waiting for validation")
  .option("--json", "Output as JSON", false)
  .option("--dry-run", "Print signed tx without submitting", false)
  .action(async (options: NftMintOptions, cmd: Command) => {
    // Validate taxon
    const taxon = parseInt(options.taxon, 10);
    if (!Number.isInteger(taxon) || taxon < 0 || taxon > 4294967295) {
      process.stderr.write("Error: --taxon must be an integer between 0 and 4294967295\n");
      process.exit(1);
    }

    // Validate transfer-fee
    if (options.transferFee !== undefined) {
      const fee = parseInt(options.transferFee, 10);
      if (!Number.isInteger(fee) || fee < 0 || fee > 50000) {
        process.stderr.write("Error: --transfer-fee must be between 0 and 50000\n");
        process.exit(1);
      }
      if (!options.transferable) {
        process.stderr.write("Error: --transfer-fee requires --transferable\n");
        process.exit(1);
      }
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

    const signerWallet = await resolveWallet(options);

    // Build flags
    let flags = 0;
    if (options.burnable) flags |= NFTokenMintFlags.tfBurnable;
    if (options.onlyXrp) flags |= NFTokenMintFlags.tfOnlyXRP;
    if (options.transferable) flags |= NFTokenMintFlags.tfTransferable;
    if (options.mutable) flags |= NFTokenMintFlags.tfMutable;

    // Build transaction
    const tx: NFTokenMint = {
      TransactionType: "NFTokenMint",
      Account: signerWallet.address,
      NFTokenTaxon: taxon,
      ...(flags !== 0 ? { Flags: flags } : {}),
      ...(options.uri !== undefined ? { URI: convertStringToHex(options.uri) } : {}),
      ...(options.transferFee !== undefined ? { TransferFee: parseInt(options.transferFee, 10) } : {}),
      ...(options.issuer !== undefined ? { Issuer: options.issuer } : {}),
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
        meta?: {
          TransactionResult?: string;
          nftoken_id?: string;
          AffectedNodes?: Array<{
            CreatedNode?: {
              LedgerEntryType?: string;
              NewFields?: { NFTokens?: Array<{ NFToken?: { NFTokenID?: string } }> };
            };
          }>;
        };
        tx_json?: { Fee?: string };
      };

      const resultCode = txResult.meta?.TransactionResult ?? "unknown";
      const hash = txResult.hash ?? signed.hash;
      const feeDrops = txResult.tx_json?.Fee ?? "0";
      const feeXrp = (Number(feeDrops) / 1_000_000).toFixed(6);
      const ledger = txResult.ledger_index;

      if (/^te[cfm]/i.test(resultCode)) {
        process.stderr.write(`Error: transaction failed with ${resultCode}\n`);
        if (options.json) {
          console.log(JSON.stringify({ hash, result: resultCode, fee: feeXrp, ledger }));
        }
        process.exit(1);
      }

      // Extract NFTokenID
      let nftokenId: string | undefined;
      if (txResult.meta?.nftoken_id) {
        nftokenId = txResult.meta.nftoken_id;
      } else {
        try {
          nftokenId = getNFTokenID(txResult.meta as TransactionMetadata);
        } catch {
          // fallback: scan AffectedNodes
          const affectedNodes = txResult.meta?.AffectedNodes ?? [];
          for (const node of affectedNodes) {
            if (node.CreatedNode?.LedgerEntryType === "NFTokenPage") {
              const tokens = node.CreatedNode?.NewFields?.NFTokens ?? [];
              if (tokens.length > 0) {
                nftokenId = tokens[tokens.length - 1]?.NFToken?.NFTokenID;
              }
            }
          }
        }
      }

      if (options.json) {
        console.log(JSON.stringify({ hash, result: resultCode, fee: feeXrp, ledger, nftokenId }));
      } else {
        console.log(`Transaction: ${hash}`);
        console.log(`Result:      ${resultCode}`);
        console.log(`Fee:         ${feeXrp} XRP`);
        console.log(`Ledger:      ${ledger}`);
        if (nftokenId) {
          console.log(`NFTokenID:   ${nftokenId}`);
        }
      }
    });
  });

export const nftCommand = new Command("nft")
  .description("Manage NFTs on the XRP Ledger")
  .addCommand(nftMintCommand);
