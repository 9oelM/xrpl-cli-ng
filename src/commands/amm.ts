import { Command } from "commander";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Wallet } from "xrpl";
import type { AMMCreate, AMMInfoRequest, AMMInfoResponse, IssuedCurrencyAmount, Currency } from "xrpl";
import { deriveKeypair } from "ripple-keypairs";
import { withClient } from "../utils/client.js";
import { getNodeUrl } from "../utils/node.js";
import {
  decryptKeystore,
  getKeystoreDir,
  resolveAccount,
  type KeystoreFile,
} from "../utils/keystore.js";
import { promptPassword } from "../utils/prompt.js";

// ── Asset spec helpers ──────────────────────────────────────────────────────

interface AssetSpec {
  currency: string;
  issuer?: string;
}

function parseAssetSpec(spec: string): AssetSpec {
  if (spec.toUpperCase() === "XRP") {
    return { currency: "XRP" };
  }
  const slashIdx = spec.indexOf("/");
  if (slashIdx === -1) {
    throw new Error(
      `Invalid asset spec "${spec}" — use "XRP" or "CURRENCY/issuer" (e.g. "USD/rIssuer")`
    );
  }
  const currency = spec.slice(0, slashIdx).toUpperCase();
  const issuer = spec.slice(slashIdx + 1);
  if (!currency || !issuer || !issuer.startsWith("r")) {
    throw new Error(
      `Invalid asset spec "${spec}" — use "XRP" or "CURRENCY/issuer" (e.g. "USD/rIssuer")`
    );
  }
  return { currency, issuer };
}

function assetSpecToXrplCurrency(spec: AssetSpec): Currency {
  if (spec.currency === "XRP") {
    return { currency: "XRP" as const };
  }
  return { currency: spec.currency, issuer: spec.issuer! };
}

/**
 * Build an xrpl Amount from an asset spec and a plain number string.
 * XRP: amount is in drops (integer string).
 * IOU: amount is decimal value string.
 */
function buildAmmAmount(
  spec: AssetSpec,
  amountStr: string
): string | IssuedCurrencyAmount {
  if (spec.currency === "XRP") {
    const drops = Math.round(Number(amountStr));
    if (isNaN(drops) || drops <= 0 || !Number.isFinite(drops)) {
      throw new Error(`Invalid XRP drop amount "${amountStr}" — must be a positive integer (drops)`);
    }
    return drops.toString();
  } else {
    const value = Number(amountStr);
    if (isNaN(value) || value <= 0) {
      throw new Error(`Invalid IOU amount "${amountStr}" — must be a positive number`);
    }
    return { currency: spec.currency, issuer: spec.issuer!, value: amountStr };
  }
}

// ── Wallet resolution ───────────────────────────────────────────────────────

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

// ── amm create ──────────────────────────────────────────────────────────────

interface AmmCreateOptions {
  asset: string;
  asset2: string;
  amount: string;
  amount2: string;
  tradingFee: string;
  seed?: string;
  mnemonic?: string;
  account?: string;
  password?: string;
  keystore?: string;
  wait: boolean;
  json: boolean;
  dryRun: boolean;
}

const ammCreateCommand = new Command("create")
  .description("Create a new AMM liquidity pool")
  .requiredOption("--asset <spec>", 'First asset: "XRP" or "CURRENCY/issuer" (e.g. "USD/rIssuer")')
  .requiredOption("--asset2 <spec>", 'Second asset: "XRP" or "CURRENCY/issuer"')
  .requiredOption("--amount <value>", "Amount of first asset (XRP: drops, IOU: decimal)")
  .requiredOption("--amount2 <value>", "Amount of second asset (XRP: drops, IOU: decimal)")
  .requiredOption("--trading-fee <n>", "Trading fee in units of 1/100000 (0–1000, where 1000 = 1%)")
  .option("--seed <seed>", "Family seed for signing")
  .option("--mnemonic <phrase>", "BIP39 mnemonic for signing")
  .option("--account <address-or-alias>", "Account address or alias from keystore")
  .option("--password <password>", "Keystore decryption password (insecure, prefer interactive prompt)")
  .option("--keystore <dir>", "Keystore directory (default: ~/.xrpl/keystore/)")
  .option("--no-wait", "Submit without waiting for validation")
  .option("--json", "Output as JSON", false)
  .option("--dry-run", "Print signed tx without submitting", false)
  .action(async (options: AmmCreateOptions, cmd: Command) => {
    // Validate trading fee
    const tradingFee = parseInt(options.tradingFee, 10);
    if (isNaN(tradingFee) || tradingFee < 0 || tradingFee > 1000) {
      process.stderr.write("Error: --trading-fee must be an integer between 0 and 1000\n");
      process.exit(1);
    }

    // Parse asset specs
    let assetSpec: AssetSpec;
    let assetSpec2: AssetSpec;
    try {
      assetSpec = parseAssetSpec(options.asset);
    } catch (e: unknown) {
      process.stderr.write(`Error: --asset: ${(e as Error).message}\n`);
      process.exit(1);
    }
    try {
      assetSpec2 = parseAssetSpec(options.asset2);
    } catch (e: unknown) {
      process.stderr.write(`Error: --asset2: ${(e as Error).message}\n`);
      process.exit(1);
    }

    // Validate assets are not the same
    const sameAsset =
      assetSpec!.currency === assetSpec2!.currency &&
      (assetSpec!.issuer ?? "") === (assetSpec2!.issuer ?? "");
    if (sameAsset) {
      process.stderr.write("Error: --asset and --asset2 must be different assets\n");
      process.exit(1);
    }

    // Build amounts
    let xrplAmount: ReturnType<typeof buildAmmAmount>;
    let xrplAmount2: ReturnType<typeof buildAmmAmount>;
    try {
      xrplAmount = buildAmmAmount(assetSpec!, options.amount);
    } catch (e: unknown) {
      process.stderr.write(`Error: --amount: ${(e as Error).message}\n`);
      process.exit(1);
    }
    try {
      xrplAmount2 = buildAmmAmount(assetSpec2!, options.amount2);
    } catch (e: unknown) {
      process.stderr.write(`Error: --amount2: ${(e as Error).message}\n`);
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

    const signerWallet = await resolveWallet(options);
    const url = getNodeUrl(cmd);

    await withClient(url, async (client) => {
      const baseTx: AMMCreate = {
        TransactionType: "AMMCreate",
        Account: signerWallet.address,
        Amount: xrplAmount as AMMCreate["Amount"],
        Amount2: xrplAmount2 as AMMCreate["Amount2"],
        TradingFee: tradingFee,
      };

      const filled = await client.autofill(baseTx);

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
          console.log(signed.hash);
        }
        return;
      }

      const response = await client.submitAndWait(signed.tx_blob);

      const txResult = response.result as {
        hash?: string;
        meta?: { TransactionResult?: string };
      };

      const resultCode = txResult.meta?.TransactionResult ?? "unknown";
      const hash = txResult.hash ?? signed.hash;

      if (/^te[cfm]/i.test(resultCode)) {
        process.stderr.write(`Error: transaction failed with ${resultCode}\n`);
        if (options.json) {
          console.log(JSON.stringify({ hash, result: resultCode }));
        }
        process.exit(1);
      }

      // Query amm_info to get AMM account and LP token currency
      const ammInfoReq: AMMInfoRequest = {
        command: "amm_info",
        asset: assetSpecToXrplCurrency(assetSpec!),
        asset2: assetSpecToXrplCurrency(assetSpec2!),
      };
      const ammInfoResp = (await client.request(ammInfoReq)) as AMMInfoResponse;
      const ammAccount = ammInfoResp.result.amm.account;
      const lpTokenCurrency = ammInfoResp.result.amm.lp_token.currency;

      if (options.json) {
        console.log(
          JSON.stringify({ hash, result: resultCode, ammAccount, lpTokenCurrency })
        );
      } else {
        console.log(`AMM Account: ${ammAccount}`);
        console.log(`LP Token: ${lpTokenCurrency}`);
      }
    });
  });

// ── amm info ────────────────────────────────────────────────────────────────

interface AmmInfoOptions {
  asset: string;
  asset2: string;
  json: boolean;
}

const ammInfoCommand = new Command("info")
  .description("Query AMM pool state via amm_info RPC")
  .requiredOption("--asset <spec>", 'First asset: "XRP" or "CURRENCY/issuer"')
  .requiredOption("--asset2 <spec>", 'Second asset: "XRP" or "CURRENCY/issuer"')
  .option("--json", "Output raw amm_info result as JSON", false)
  .action(async (options: AmmInfoOptions, cmd: Command) => {
    let assetSpec: AssetSpec;
    let assetSpec2: AssetSpec;
    try {
      assetSpec = parseAssetSpec(options.asset);
    } catch (e: unknown) {
      process.stderr.write(`Error: --asset: ${(e as Error).message}\n`);
      process.exit(1);
    }
    try {
      assetSpec2 = parseAssetSpec(options.asset2);
    } catch (e: unknown) {
      process.stderr.write(`Error: --asset2: ${(e as Error).message}\n`);
      process.exit(1);
    }

    const url = getNodeUrl(cmd);

    await withClient(url, async (client) => {
      const ammInfoReq: AMMInfoRequest = {
        command: "amm_info",
        asset: assetSpecToXrplCurrency(assetSpec!),
        asset2: assetSpecToXrplCurrency(assetSpec2!),
      };

      let ammInfoResp: AMMInfoResponse;
      try {
        ammInfoResp = (await client.request(ammInfoReq)) as AMMInfoResponse;
      } catch (e: unknown) {
        process.stderr.write(`Error: AMM not found — ${(e as Error).message}\n`);
        process.exit(1);
      }

      const amm = ammInfoResp!.result.amm;

      if (options.json) {
        console.log(JSON.stringify(amm));
        return;
      }

      // Human-readable output
      const formatAmount = (a: string | IssuedCurrencyAmount): string => {
        if (typeof a === "string") {
          return `${Number(a) / 1_000_000} XRP (${a} drops)`;
        }
        return `${a.value} ${a.currency} (issued by ${a.issuer})`;
      };

      console.log(`AMM Account:    ${amm.account}`);
      console.log(`Asset 1:        ${formatAmount(amm.amount)}`);
      console.log(`Asset 2:        ${formatAmount(amm.amount2)}`);
      console.log(`LP Token:       ${amm.lp_token.value} ${amm.lp_token.currency} (issued by ${amm.lp_token.issuer})`);
      console.log(`Trading Fee:    ${amm.trading_fee} (${amm.trading_fee / 1000}%)`);
      if (amm.auction_slot) {
        console.log(`Auction Slot:   held by ${amm.auction_slot.account} (expires ${amm.auction_slot.expiration})`);
      }
      if (amm.vote_slots && amm.vote_slots.length > 0) {
        console.log(`Vote Slots:     ${amm.vote_slots.length} vote(s)`);
      }
    });
  });

// ── export ───────────────────────────────────────────────────────────────────

export const ammCommand = new Command("amm")
  .description("Manage AMM liquidity pools on the XRP Ledger")
  .addCommand(ammCreateCommand)
  .addCommand(ammInfoCommand);
