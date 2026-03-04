import { Command } from "commander";
import { newWalletCommand } from "./new.js";
import { newMnemonicCommand } from "./new-mnemonic.js";
import { addressCommand } from "./address.js";
import { privateKeyCommand } from "./private-key.js";

export const walletCommand = new Command("wallet").description(
  "Wallet management commands"
);

walletCommand.addCommand(newWalletCommand);
walletCommand.addCommand(newMnemonicCommand);
walletCommand.addCommand(addressCommand);
walletCommand.addCommand(privateKeyCommand);
