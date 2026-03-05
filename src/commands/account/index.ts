import { Command } from "commander";
import { infoCommand } from "./info.js";

export const accountCommand = new Command("account").description(
  "Account management commands"
);

accountCommand.addCommand(infoCommand);
