/**
 * Reproduction script for XRPL AMM flows on testnet.
 *
 * NOTE: AMMDelete is intentionally NOT tested here.
 *
 * AMMDelete is only needed when AMMWithdraw(tfWithdrawAll) returns
 * tecINCOMPLETE, which only happens when the AMM account has >512 trust
 * lines (513+ LP token holders simultaneously). With 1–2 LP accounts,
 * AMMWithdraw(tfWithdrawAll) auto-deletes the AMM entirely, so any
 * subsequent AMMDelete would return terNO_AMM. Creating 513+ funded
 * testnet accounts via the faucet is not practical.
 *
 * References:
 *   https://xrpl.org/docs/references/protocol/transactions/types/ammdelete
 *   https://xrpl.org/docs/references/protocol/transactions/transaction-results/ter-codes.md
 *
 * Steps to reproduce:
 *   1. npx tsx scripts/repro-amm-delete-txnnotfound.ts
 */

import { Client, Wallet, xrpToDrops } from "xrpl";

const TESTNET_WS = "wss://s.altnet.rippletest.net:51233";
const FAUCET_URL = "https://faucet.altnet.rippletest.net/accounts";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fund(address: string): Promise<void> {
  console.log(`[faucet] funding ${address} ...`);
  const res = await fetch(FAUCET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination: address }),
  });
  if (!res.ok) throw new Error(`Faucet HTTP ${res.status}`);
  console.log("[faucet] OK");
}

async function waitForAccount(client: Client, address: string) {
  for (let i = 0; i < 20; i++) {
    try {
      await client.request({ command: "account_info", account: address, ledger_index: "validated" });
      return;
    } catch {
      await sleep(3000);
    }
  }
  throw new Error(`Account ${address} never appeared`);
}

async function submitAndLog(client: Client, wallet: Wallet, tx: object, label: string) {
  const filled = await client.autofill(tx as Parameters<typeof client.autofill>[0]);
  // Use validated sequence to avoid stale 'current' ledger on fresh connections.
  const ai = await client.request({ command: "account_info", account: wallet.address, ledger_index: "validated" });
  (filled as { Sequence: number }).Sequence = (ai.result as { account_data: { Sequence: number } }).account_data.Sequence;
  filled.LastLedgerSequence = (filled.LastLedgerSequence ?? 0) + 200;

  const signed = wallet.sign(filled);
  console.log(`\n[${label}] hash  = ${signed.hash}`);
  console.log(`[${label}] seq   = ${filled.Sequence}`);
  console.log(`[${label}] lls   = ${filled.LastLedgerSequence}`);

  // Submit and capture the immediate engine_result.
  const submitResp = await client.request({ command: "submit", tx_blob: signed.tx_blob } as Parameters<typeof client.request>[0]);
  const engineResult = (submitResp.result as { engine_result: string }).engine_result;
  console.log(`[${label}] engine_result = ${engineResult}`);

  if (engineResult.startsWith("tem") || engineResult.startsWith("tef")) {
    throw new Error(`[${label}] transaction rejected: ${engineResult}`);
  }

  console.log(`[${label}] explorer: https://testnet.xrpl.org/transactions/${signed.hash}`);

  // Poll for validation.
  console.log(`[${label}] polling tx command for validation...`);
  const start = Date.now();
  let found = false;
  for (let attempt = 1; attempt <= 60; attempt++) {
    await sleep(3000);
    try {
      const txResp = await client.request({ command: "tx", transaction: signed.hash } as Parameters<typeof client.request>[0]);
      const validated = (txResp.result as { validated?: boolean }).validated;
      const meta = (txResp.result as { meta?: { TransactionResult?: string } }).meta;
      console.log(`[${label}] poll #${attempt} (${Math.round((Date.now() - start) / 1000)}s): validated=${validated} result=${meta?.TransactionResult ?? "?"}`);
      if (validated) {
        console.log(`[${label}] SUCCESS — found in validated ledger after ${Math.round((Date.now() - start) / 1000)}s`);
        found = true;
        break;
      }
    } catch (e: unknown) {
      const msg = (e as { data?: { error?: string }; message?: string }).data?.error ?? (e as { message?: string }).message ?? String(e);
      console.log(`[${label}] poll #${attempt} (${Math.round((Date.now() - start) / 1000)}s): ${msg}`);
      if (msg === "txnNotFound") continue;
      throw e;
    }
  }

  if (!found) {
    throw new Error(`[${label}] tx ${signed.hash} never validated after 180s — check explorer`);
  }
}

async function main() {
  const client = new Client(TESTNET_WS);
  await client.connect();
  console.log("Connected to", TESTNET_WS);

  // Create two wallets: issuer and LP.
  const issuer = Wallet.generate();
  const lp = Wallet.generate();
  console.log("issuer:", issuer.address);
  console.log("lp:    ", lp.address);

  await fund(issuer.address);
  await fund(lp.address);
  await waitForAccount(client, issuer.address);
  await waitForAccount(client, lp.address);
  console.log("Both accounts funded.");

  // Enable DefaultRipple on issuer (required for AMM IOU pools).
  await submitAndLog(client, issuer, {
    TransactionType: "AccountSet",
    Account: issuer.address,
    SetFlag: 8, // asfDefaultRipple
  }, "AccountSet");

  // Set up trust line and IOU balance on lp.
  await submitAndLog(client, lp, {
    TransactionType: "TrustSet",
    Account: lp.address,
    LimitAmount: { currency: "USD", issuer: issuer.address, value: "1000000" },
  }, "TrustSet");

  await submitAndLog(client, issuer, {
    TransactionType: "Payment",
    Account: issuer.address,
    Destination: lp.address,
    Amount: { currency: "USD", issuer: issuer.address, value: "100000" },
  }, "Payment");

  // Create the AMM pool.
  await submitAndLog(client, lp, {
    TransactionType: "AMMCreate",
    Account: lp.address,
    Amount: xrpToDrops(1), // 1 XRP
    Amount2: { currency: "USD", issuer: issuer.address, value: "10" },
    TradingFee: 300,
  }, "AMMCreate");

  // Withdraw all LP tokens (empties and auto-deletes the pool when <512 trust lines).
  await submitAndLog(client, lp, {
    TransactionType: "AMMWithdraw",
    Account: lp.address,
    Asset: { currency: "XRP" },
    Asset2: { currency: "USD", issuer: issuer.address },
    Flags: 0x00020000, // tfWithdrawAll
  }, "AMMWithdraw(tfWithdrawAll)");

  await client.disconnect();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
