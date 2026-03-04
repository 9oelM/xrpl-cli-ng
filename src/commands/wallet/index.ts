import { Command } from "commander";
import { newWalletCommand } from "./new.js";
import { newMnemonicCommand } from "./new-mnemonic.js";
import { addressCommand } from "./address.js";
import { privateKeyCommand } from "./private-key.js";
import { publicKeyCommand } from "./public-key.js";
import { importCommand } from "./import.js";
import { listCommand } from "./list.js";
import { removeCommand } from "./remove.js";

export const walletCommand = new Command("wallet").description(
  "Wallet management commands"
);

walletCommand.addCommand(newWalletCommand);
walletCommand.addCommand(newMnemonicCommand);
walletCommand.addCommand(addressCommand);
walletCommand.addCommand(privateKeyCommand);
walletCommand.addCommand(publicKeyCommand);
walletCommand.addCommand(importCommand);
walletCommand.addCommand(listCommand);
walletCommand.addCommand(removeCommand);
