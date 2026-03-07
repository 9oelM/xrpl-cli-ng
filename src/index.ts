#!/usr/bin/env node
import { Command } from "commander";
import { accountCommand, walletCommand, paymentCommand, trustCommand, offerCommand, channelCommand, escrowCommand, checkCommand, clawbackCommand, credentialCommand, nftCommand, multisigCommand, oracleCommand, ticketCommand, depositPreauthCommand, ammCommand } from "./commands/index.js";

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
program.addCommand(clawbackCommand);
program.addCommand(credentialCommand);
program.addCommand(nftCommand);
program.addCommand(multisigCommand);
program.addCommand(oracleCommand);
program.addCommand(ticketCommand);
program.addCommand(depositPreauthCommand);
program.addCommand(ammCommand);

program.parse();
