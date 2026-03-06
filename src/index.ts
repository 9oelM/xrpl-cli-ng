#!/usr/bin/env node
import { Command } from "commander";
import { accountCommand, walletCommand, paymentCommand, trustCommand, offerCommand, channelCommand, escrowCommand, checkCommand } from "./commands/index.js";

const program = new Command();

program
  .name("xrpl")
  .description("CLI for interacting with the XRP Ledger")
  .version("0.1.0")
  .option(
    "-n, --node <url>",
    "XRPL node URL or network name (mainnet|testnet|devnet)",
    process.env.XRPL_NODE ?? "testnet"
  );

program.addCommand(accountCommand);
program.addCommand(walletCommand);
program.addCommand(paymentCommand);
program.addCommand(trustCommand);
program.addCommand(offerCommand);
program.addCommand(channelCommand);
program.addCommand(escrowCommand);
program.addCommand(checkCommand);

program.parse();
