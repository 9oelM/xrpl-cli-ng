import { Command } from "commander";
import { withClient } from "../utils/client.js";
import { getNodeUrl } from "../utils/node.js";

export const accountCommand = new Command("account").description(
  "Account management commands"
);

accountCommand
  .command("info <address>")
  .description("Get account information")
  .action(async (address: string, _options: Record<string, unknown>, cmd: Command) => {
    const url = getNodeUrl(cmd);
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
