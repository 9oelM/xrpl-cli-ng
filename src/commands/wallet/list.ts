import { Command } from "commander";
import { readdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join, resolve, basename } from "path";

function getKeystoreDir(options: { keystore?: string }): string {
  if (options.keystore) {
    return resolve(options.keystore);
  }
  const envDir = process.env["XRPL_KEYSTORE"];
  if (envDir) {
    return resolve(envDir);
  }
  return join(homedir(), ".xrpl", "keystore");
}

interface ListOptions {
  keystore?: string;
  json: boolean;
}

export const listCommand = new Command("list")
  .alias("ls")
  .description("List keystored accounts")
  .option("--keystore <dir>", "Keystore directory (default: ~/.xrpl/keystore/; XRPL_KEYSTORE env var also accepted)")
  .option("--json", "Output as JSON array", false)
  .action((options: ListOptions) => {
    const keystoreDir = getKeystoreDir(options);

    if (!existsSync(keystoreDir)) {
      if (options.json) {
        console.log(JSON.stringify([]));
      } else {
        console.log("(empty)");
      }
      return;
    }

    const files = readdirSync(keystoreDir).filter((f) => f.endsWith(".json"));
    const addresses = files.map((f) => basename(f, ".json"));

    if (options.json) {
      console.log(JSON.stringify(addresses));
    } else if (addresses.length === 0) {
      console.log("(empty)");
    } else {
      addresses.forEach((addr) => console.log(addr));
    }
  });
