import { Client } from "xrpl";

export const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";
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

/** Connects to an XRPL node, runs `fn`, then disconnects — even on error. */
export async function withClient<T>(
  nodeUrl: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  // 60s per-request timeout: gives submitAndWait enough time to resolve
  // on slow testnet without hitting the 20s xrpl.js default prematurely.
  const client = new Client(nodeUrl, { timeout: 60_000 });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}
