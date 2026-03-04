import { Command } from "commander";
import { newWalletCommand } from "./new.js";

export const walletCommand = new Command("wallet").description(
  "Wallet management commands"
);

walletCommand.addCommand(newWalletCommand);
