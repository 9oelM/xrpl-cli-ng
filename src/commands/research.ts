import { Command } from "commander";
import { existsSync } from "fs";
import { resolveNodeUrl } from "../utils/client.js";
import { runResearchLoop, type AIProvider } from "../utils/research.js";

const VALID_PROVIDERS: AIProvider[] = ["anthropic", "gemini"];
const API_KEY_ENV: Record<AIProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};

interface ResearchRunOptions {
  provider: string;
  network: string;
  output: string;
  maxIterations: string;
  interval: string;
  storeOnChain: boolean;
  seed?: string;
  apiKey?: string;
  model?: string;
  json: boolean;
}

const researchRunCommand = new Command("run")
  .description("Run an AutoResearch loop against the XRPL ledger")
  .argument("<strategy-file>", "Path to strategy Markdown file")
  .option("--provider <name>", "AI provider: anthropic | gemini", "anthropic")
  .option("--network <net>", "Network or wss:// URL (testnet|mainnet|devnet)", "testnet")
  .option("--output <file>", "Results file path (JSONL)", "results.jsonl")
  .option("--max-iterations <n>", "Maximum research cycles", "10")
  .option("--interval <seconds>", "Seconds between cycles", "60")
  .option("--store-on-chain", "Store findings as on-chain Memos", false)
  .option("--seed <seed>", "Signing seed (required with --store-on-chain)")
  .option("--api-key <key>", "AI API key (default: ANTHROPIC_API_KEY or GEMINI_API_KEY env var)")
  .option("--model <model>", "Model to use (default: claude-opus-4-6 for anthropic, gemini-2.0-flash for gemini)")
  .option("--json", "Output machine-readable JSON per finding", false)
  .action(async (strategyFile: string, options: ResearchRunOptions) => {
    if (!existsSync(strategyFile)) {
      process.stderr.write(`Error: strategy file not found: ${strategyFile}\n`);
      process.exit(1);
    }

    const provider = options.provider as AIProvider;
    if (!VALID_PROVIDERS.includes(provider)) {
      process.stderr.write(`Error: --provider must be one of: ${VALID_PROVIDERS.join(", ")}\n`);
      process.exit(1);
    }

    const apiKey = options.apiKey ?? process.env[API_KEY_ENV[provider]];
    if (!apiKey) {
      process.stderr.write(
        `Error: provide API key via --api-key or ${API_KEY_ENV[provider]} env var\n`
      );
      process.exit(1);
    }

    if (options.storeOnChain && !options.seed) {
      process.stderr.write("Error: --store-on-chain requires --seed\n");
      process.exit(1);
    }

    const maxIterations = parseInt(options.maxIterations, 10);
    if (!Number.isInteger(maxIterations) || maxIterations < 1) {
      process.stderr.write("Error: --max-iterations must be a positive integer\n");
      process.exit(1);
    }

    const intervalSeconds = parseInt(options.interval, 10);
    if (!Number.isInteger(intervalSeconds) || intervalSeconds < 0) {
      process.stderr.write("Error: --interval must be a non-negative integer\n");
      process.exit(1);
    }

    await runResearchLoop({
      strategyFile,
      nodeUrl: resolveNodeUrl(options.network),
      outputFile: options.output,
      maxIterations,
      intervalSeconds,
      storeOnChain: options.storeOnChain,
      seed: options.seed,
      provider,
      apiKey,
      model: options.model ?? "",
      json: options.json,
    });
  });

export const researchCommand = new Command("research")
  .description("Autonomous XRPL on-chain data research using Claude or Gemini AI")
  .addCommand(researchRunCommand);
