import { Command } from "commander";
import { infoCommand } from "./info.js";
import { balanceCommand } from "./balance.js";

export const accountCommand = new Command("account").description(
  "Account management commands"
);

accountCommand.addCommand(infoCommand);
accountCommand.addCommand(balanceCommand);
