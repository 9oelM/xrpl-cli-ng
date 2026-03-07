import { Client } from "xrpl";

export const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";
export const TESTNET_FALLBACK_URL = "wss://testnet.xrpl-labs.com/";
export const MAINNET_URL = "wss://xrplcluster.com";
export const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";

export type Network = "mainnet" | "testnet" | "devnet";

const NETWORK_URLS: Record<Network, string> = {
  mainnet: MAINNET_URL,
  testnet: TESTNET_URL,
  devnet: DEVNET_URL,
};

/** Resolves a network alias ("mainnet" | "testnet" | "devnet") or passes through a raw WebSocket URL unchanged. */
export function resolveNodeUrl(nodeOrNetwork: string): string {
  if (nodeOrNetwork in NETWORK_URLS) {
    return NETWORK_URLS[nodeOrNetwork as Network];
  }
  return nodeOrNetwork;
}

async function withClientOnce<T>(nodeUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(nodeUrl);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}

/** Connects to an XRPL node, runs `fn`, then disconnects — even on error.
 *  If the primary testnet node times out, retries once on the fallback node. */
export async function withClient<T>(
  nodeUrl: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  try {
    return await withClientOnce(nodeUrl, fn);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes("Timeout");
    const isFallbackable = nodeUrl === TESTNET_URL || nodeUrl === TESTNET_FALLBACK_URL;
    if (isTimeout && isFallbackable) {
      return await withClientOnce(TESTNET_FALLBACK_URL, fn);
    }
    throw err;
  }
}
