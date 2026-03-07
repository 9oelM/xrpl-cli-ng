#!/usr/bin/env node
import { Command } from "commander";
import { accountCommand, ammCommand, walletCommand, paymentCommand, trustCommand, offerCommand, channelCommand, escrowCommand, checkCommand, clawbackCommand, credentialCommand, nftCommand, multisigCommand, oracleCommand, ticketCommand, depositPreauthCommand, mptokenCommand, permissionedDomainCommand, vaultCommand, didCommand } from "./commands/index.js";

const VERSION = "0.1.0";

const BANNER = `
____  _______________________.____              _________ .____    .___
\\   \\/  /\\______   \\______   \\    |             \\_   ___ \\|    |   |   |
 \\     /  |       _/|     ___/    |      ______ /    \\  \\/|    |   |   |
 /     \\  |    |   \\|    |   |    |___  /_____/ \\     \\___|    |___|   |
/___/\\  \\ |____|_  /|____|   |_______ \\          \\______  /_______ \\___|
      \\_/        \\/                  \\/                 \\/        \\/
v${VERSION}
`;

const program = new Command();

program
  .name("xrpl")
  .description("CLI for interacting with the XRP Ledger")
  .version(VERSION)
  .addHelpText("beforeAll", BANNER)
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
program.addCommand(mptokenCommand);
program.addCommand(permissionedDomainCommand);
program.addCommand(vaultCommand);
program.addCommand(didCommand);
program.addCommand(ammCommand);

program.parse();
