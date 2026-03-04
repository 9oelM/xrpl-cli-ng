import { Command } from "commander";
import { withClient, resolveNodeUrl } from "../utils/client.js";

export const accountCommand = new Command("account").description(
  "Account management commands"
);

accountCommand
  .command("info <address>")
  .description("Get account information")
  .option(
    "-n, --node <url>",
    "XRPL node URL or network name (mainnet|testnet|devnet)",
    "testnet"
  )
  .action(async (address: string, options: { node: string }) => {
    const url = resolveNodeUrl(options.node);
    await withClient(url, async (client) => {
      const response = await client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated",
      });
      const info = response.result.account_data;
      console.log(`Account:  ${info.Account}`);
      console.log(`Balance:  ${Number(info.Balance) / 1_000_000} XRP`);
      console.log(`Sequence: ${info.Sequence}`);
    });
  });
