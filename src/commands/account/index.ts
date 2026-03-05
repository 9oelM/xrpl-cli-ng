import { Command } from "commander";
import { infoCommand } from "./info.js";
import { balanceCommand } from "./balance.js";
import { transactionsCommand } from "./transactions.js";
import { offersCommand } from "./offers.js";
import { trustLinesCommand } from "./trust-lines.js";
import { channelsCommand } from "./channels.js";
import { nftsCommand } from "./nfts.js";
import { setCommand } from "./set.js";

export const accountCommand = new Command("account").description(
  "Account management commands"
);

accountCommand.addCommand(infoCommand);
accountCommand.addCommand(balanceCommand);
accountCommand.addCommand(transactionsCommand);
accountCommand.addCommand(offersCommand);
accountCommand.addCommand(trustLinesCommand);
accountCommand.addCommand(channelsCommand);
accountCommand.addCommand(nftsCommand);
accountCommand.addCommand(setCommand);
