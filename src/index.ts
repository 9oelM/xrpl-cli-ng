#!/usr/bin/env node
import { Command } from "commander";
<<<<<<< HEAD
<<<<<<< HEAD
import { accountCommand, walletCommand, paymentCommand, trustCommand, offerCommand, channelCommand, escrowCommand, checkCommand, clawbackCommand, credentialCommand, nftCommand, multisigCommand } from "./commands/index.js";
=======
import { accountCommand, walletCommand, paymentCommand, trustCommand, offerCommand, channelCommand, escrowCommand, checkCommand, clawbackCommand, credentialCommand, nftCommand, oracleCommand } from "./commands/index.js";
>>>>>>> ralph/oracle
=======
import { accountCommand, walletCommand, paymentCommand, trustCommand, offerCommand, channelCommand, escrowCommand, checkCommand, clawbackCommand, credentialCommand, nftCommand, ticketCommand } from "./commands/index.js";
>>>>>>> ralph/ticket

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
<<<<<<< HEAD
<<<<<<< HEAD
program.addCommand(multisigCommand);
=======
program.addCommand(oracleCommand);
>>>>>>> ralph/oracle
=======
program.addCommand(ticketCommand);
>>>>>>> ralph/ticket

program.parse();
