#!/usr/bin/env node
import { Command } from "commander";
import { accountCommand } from "./commands/index.js";

const program = new Command();

program
  .name("xrpl")
  .description("CLI for interacting with the XRP Ledger")
  .version("0.1.0");

program.addCommand(accountCommand);

program.parse();
