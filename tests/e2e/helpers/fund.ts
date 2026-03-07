import { Client, Wallet, xrpToDrops } from "xrpl";
import type { TicketCreate, Payment } from "xrpl";

export const XRPL_WS = "wss://s.altnet.rippletest.net:51233";

const FAUCET_URL = "https://faucet.altnet.rippletest.net/accounts";
const FAUCET_MAX_RETRIES = 30;
const FAUCET_RETRY_BASE_MS = 5000;

// Module-level ticket pool — safe because JS is single-threaded
let ticketPool: number[] = [];

async function waitForAccount(
  client: Client,
  address: string,
  retries = 15,
  delayMs = 2000
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated",
      });
      return;
    } catch {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw new Error(`Account ${address} did not appear on ledger after ${retries} retries`);
}

/**
 * Fund a fresh master wallet via the testnet faucet.
 * Should be called exactly once per test file in beforeAll.
 */
export async function fundMaster(client: Client): Promise<Wallet> {
  const wallet = Wallet.generate();
  let lastStatus = 0;

  for (let attempt = 0; attempt < FAUCET_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, FAUCET_RETRY_BASE_MS * attempt));
    }
    const response = await fetch(FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: wallet.address }),
    });
    if (response.ok) {
      await waitForAccount(client, wallet.address);
      return wallet;
    }
    lastStatus = response.status;
    if (response.status !== 429 && response.status < 500) break;
  }

  throw new Error(`Faucet request failed after ${FAUCET_MAX_RETRIES} attempts: status ${lastStatus}`);
}

/**
 * Pre-create `count` tickets from the master wallet.
 * Must be called after fundMaster, before createFunded.
 */
export async function initTicketPool(
  client: Client,
  master: Wallet,
  count: number
): Promise<void> {
  ticketPool = [];

  const ticketCreate: TicketCreate = await client.autofill({
    TransactionType: "TicketCreate",
    Account: master.address,
    TicketCount: count,
  });

  const result = await client.submitAndWait(master.sign(ticketCreate).tx_blob);

  const meta = result.result.meta as {
    AffectedNodes: Array<{
      CreatedNode?: {
        LedgerEntryType: string;
        NewFields: { TicketSequence: number };
      };
    }>;
  };

  for (const node of meta.AffectedNodes) {
    if (node.CreatedNode?.LedgerEntryType === "Ticket") {
      ticketPool.push(node.CreatedNode.NewFields.TicketSequence);
    }
  }

  ticketPool.sort((a, b) => a - b);
}

/**
 * Returns the next ticket from the pool (synchronous, safe in single-threaded JS).
 */
export function nextTicket(): number {
  const ticket = ticketPool.shift();
  if (ticket === undefined) {
    throw new Error("Ticket pool exhausted — increase initTicketPool count");
  }
  return ticket;
}

/**
 * Generate `count` fresh wallets and fund each with `amountXrp` XRP from master,
 * using tickets so all payments can be submitted concurrently without sequence conflicts.
 */
export async function createFunded(
  client: Client,
  master: Wallet,
  count: number,
  amountXrp = 10
): Promise<Wallet[]> {
  const wallets = Array.from({ length: count }, () => Wallet.generate());

  // Collect tickets before going async (JS single-threaded, no race)
  const tickets = wallets.map(() => nextTicket());

  const ledgerIndex = await client.getLedgerIndex();

  await Promise.all(
    wallets.map(async (wallet, i) => {
      const payment: Payment = {
        TransactionType: "Payment",
        Account: master.address,
        Amount: xrpToDrops(amountXrp),
        Destination: wallet.address,
        Sequence: 0,
        TicketSequence: tickets[i],
        Fee: "12",
        LastLedgerSequence: ledgerIndex + 20,
      };
      // Use submit (not submitAndWait) to avoid tx-lookup timeouts under concurrent load.
      // Then poll until the account appears on-chain.
      await client.submit(master.sign(payment).tx_blob);
      await waitForAccount(client, wallet.address);
    })
  );

  return wallets;
}

/**
 * Fund a specific known address (e.g. mnemonic-derived wallet) from master using a ticket.
 */
export async function fundAddress(
  client: Client,
  master: Wallet,
  targetAddress: string,
  amountXrp = 10
): Promise<void> {
  const ticket = nextTicket();
  const ledgerIndex = await client.getLedgerIndex();

  const payment: Payment = {
    TransactionType: "Payment",
    Account: master.address,
    Amount: xrpToDrops(amountXrp),
    Destination: targetAddress,
    Sequence: 0,
    TicketSequence: ticket,
    Fee: "12",
    LastLedgerSequence: ledgerIndex + 20,
  };
  await client.submit(master.sign(payment).tx_blob);
  await waitForAccount(client, targetAddress);
}
