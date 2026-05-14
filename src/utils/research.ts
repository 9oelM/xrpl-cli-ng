import { appendFileSync, readFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, FunctionCallingMode, SchemaType } from "@google/generative-ai";
import type { FunctionDeclaration, Schema, Part } from "@google/generative-ai";
import { Wallet } from "xrpl";
import type { Payment, Memo } from "xrpl";
import { withClient } from "./client.js";

// ---------- Public types ----------

export type AIProvider = "anthropic" | "gemini";

export interface ResearchLoopOptions {
  strategyFile: string;
  nodeUrl: string;
  outputFile: string;
  maxIterations: number;
  intervalSeconds: number;
  storeOnChain: boolean;
  seed?: string;
  provider: AIProvider;
  apiKey: string;
  model: string;
  json: boolean;
}

// ---------- Internal types ----------

interface CycleResult {
  text: string;
  stored: boolean;
  storedContent?: string;
}

interface ResearchFinding {
  iteration: number;
  timestamp: string;
  text: string;
  stored: boolean;
  onChainHash?: string;
  error?: string;
}

// ---------- Provider interface (Open/Closed) ----------

interface AIResearchProvider {
  runCycle(strategyText: string, nodeUrl: string, iteration: number): Promise<CycleResult>;
}

// ---------- Canonical XRPL tool definitions ----------

// Defined once; each provider converts to its own schema format.
const TOOL_DEFS = [
  {
    name: "query_account_info",
    description: "Get full on-ledger account information (balance, sequence, flags) for an XRPL address.",
    params: { address: { type: "string", description: "XRPL account address starting with 'r'" } },
    required: ["address"],
  },
  {
    name: "query_account_offers",
    description: "List open DEX offers for an XRPL account.",
    params: { address: { type: "string", description: "XRPL account address" } },
    required: ["address"],
  },
  {
    name: "query_amm_info",
    description:
      "Get AMM liquidity pool info for a pair of assets. Use 'XRP' for the native asset (no issuer needed).",
    params: {
      asset1_currency: { type: "string", description: "Currency code of asset 1 (e.g. 'XRP', 'USD')" },
      asset1_issuer: { type: "string", description: "Issuer address of asset 1 (omit for XRP)" },
      asset2_currency: { type: "string", description: "Currency code of asset 2" },
      asset2_issuer: { type: "string", description: "Issuer address of asset 2 (omit for XRP)" },
    },
    required: ["asset1_currency", "asset2_currency"],
  },
  {
    name: "query_order_book",
    description: "Query the DEX order book (book_offers) for a currency pair.",
    params: {
      base_currency: { type: "string", description: "Base currency code" },
      base_issuer: { type: "string", description: "Base currency issuer (omit for XRP)" },
      quote_currency: { type: "string", description: "Quote currency code" },
      quote_issuer: { type: "string", description: "Quote currency issuer (omit for XRP)" },
    },
    required: ["base_currency", "quote_currency"],
  },
  {
    name: "query_oracle",
    description: "Query an on-chain price oracle by owner address and document ID.",
    params: {
      oracle_address: { type: "string", description: "XRPL address that owns the oracle" },
      oracle_document_id: { type: "number", description: "Oracle document ID (integer)" },
    },
    required: ["oracle_address", "oracle_document_id"],
  },
  {
    name: "get_ledger_stats",
    description: "Get current XRPL network statistics (server_info): ledger index, fees, network state.",
    params: {},
    required: [],
  },
  {
    name: "store_finding",
    description:
      "Signal that the current analysis is a concrete, non-trivial finding worth persisting. " +
      "Only call this when you have a meaningful insight. Pass the finding as 'content'.",
    params: {
      content: { type: "string", description: "The finding text to store" },
    },
    required: ["content"],
  },
] as const;

// ---------- Shared tool dispatcher ----------

async function dispatchTool(
  nodeUrl: string,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  if (name === "store_finding") {
    return { ok: true };
  }

  return withClient(nodeUrl, async (client) => {
    try {
      switch (name) {
        case "query_account_info":
          return (
            await client.request({
              command: "account_info",
              account: input["address"] as string,
              ledger_index: "validated",
            })
          ).result.account_data;

        case "query_account_offers":
          return (
            (await client.request({
              command: "account_offers",
              account: input["address"] as string,
              ledger_index: "validated",
            })).result as unknown as { offers: unknown[] }
          ).offers;

        case "query_amm_info": {
          const asset1 =
            (input["asset1_currency"] as string) === "XRP"
              ? { currency: "XRP" }
              : { currency: input["asset1_currency"] as string, issuer: input["asset1_issuer"] as string };
          const asset2 =
            (input["asset2_currency"] as string) === "XRP"
              ? { currency: "XRP" }
              : { currency: input["asset2_currency"] as string, issuer: input["asset2_issuer"] as string };
          return (
            await client.request({
              command: "amm_info",
              asset: asset1,
              asset2,
            } as Parameters<typeof client.request>[0])
          ).result;
        }

        case "query_order_book": {
          const taker_pays =
            (input["base_currency"] as string) === "XRP"
              ? { currency: "XRP" }
              : { currency: input["base_currency"] as string, issuer: input["base_issuer"] as string };
          const taker_gets =
            (input["quote_currency"] as string) === "XRP"
              ? { currency: "XRP" }
              : { currency: input["quote_currency"] as string, issuer: input["quote_issuer"] as string };
          return (
            (await client.request({
              command: "book_offers",
              taker_pays,
              taker_gets,
              limit: 20,
            } as Parameters<typeof client.request>[0])).result as unknown as { offers: unknown[] }
          ).offers;
        }

        case "query_oracle":
          return (
            (await client.request({
              command: "ledger_entry",
              oracle: {
                account: input["oracle_address"] as string,
                oracle_document_id: input["oracle_document_id"] as number,
              },
              ledger_index: "validated",
            } as Parameters<typeof client.request>[0])).result as unknown as { node: unknown }
          ).node;

        case "get_ledger_stats":
          return (await client.request({ command: "server_info" })).result.info;

        default:
          return { error: `unknown tool: ${name}` };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
}

// ---------- On-chain storage ----------

async function storeOnChain(nodeUrl: string, seed: string, content: string, iteration: number): Promise<string> {
  const wallet = Wallet.fromSeed(seed);
  const memoData = Buffer.from(
    JSON.stringify({ iteration, content, ts: new Date().toISOString() }),
    "utf8"
  ).toString("hex").toUpperCase();
  const memo: Memo = {
    Memo: {
      MemoData: memoData,
      MemoType: Buffer.from("xrpl-research/finding", "utf8").toString("hex").toUpperCase(),
      MemoFormat: Buffer.from("application/json", "utf8").toString("hex").toUpperCase(),
    },
  };

  return withClient(nodeUrl, async (client) => {
    const tx: Payment = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: wallet.address,
      Amount: "1",
      Memos: [memo],
    };
    const filled = await client.autofill(tx);
    const signed = wallet.sign(filled);
    const result = await client.submitAndWait(signed.tx_blob);
    return (result.result as { hash?: string }).hash ?? signed.hash;
  });
}

// ---------- Helpers ----------

function appendToJsonl(filePath: string, data: unknown): void {
  appendFileSync(filePath, JSON.stringify(data) + "\n", "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Anthropic provider ----------

class AnthropicResearchProvider implements AIResearchProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async runCycle(strategyText: string, nodeUrl: string, iteration: number): Promise<CycleResult> {
    const tools: Anthropic.Tool[] = TOOL_DEFS.map((def) => ({
      name: def.name,
      description: def.description,
      input_schema: {
        type: "object" as const,
        properties: Object.fromEntries(
          Object.entries(def.params).map(([k, v]) => [k, { type: v.type, description: v.description }])
        ),
        required: [...def.required],
      },
    }));

    const systemPrompt =
      `You are an autonomous XRPL on-chain data research agent. ` +
      `This is iteration ${iteration}. ` +
      `Use the available tools to query the XRP Ledger and produce a concise, factual research finding. ` +
      `Call store_finding() only when you have a non-trivial, concrete insight worth recording.`;

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: `${systemPrompt}\n\n---\n\n${strategyText}` },
    ];

    let stored = false;
    let storedContent: string | undefined;
    let finalText = "";

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        tools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          if (block.name === "store_finding") {
            stored = true;
            storedContent = (block.input as { content: string }).content;
          }
          const result = await dispatchTool(nodeUrl, block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // end_turn or max_tokens
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      break;
    }

    return { text: finalText, stored, storedContent };
  }
}

// ---------- Gemini provider ----------

class GeminiResearchProvider implements AIResearchProvider {
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async runCycle(strategyText: string, nodeUrl: string, iteration: number): Promise<CycleResult> {
    const functionDeclarations = TOOL_DEFS.map((def) => {
      const properties: Record<string, { type: SchemaType; description?: string }> = {};
      for (const [k, v] of Object.entries(def.params)) {
        properties[k] = {
          type: v.type === "number" ? SchemaType.NUMBER : SchemaType.STRING,
          description: v.description,
        };
      }
      return {
        name: def.name,
        description: def.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties,
          required: [...def.required],
        },
      };
    }) as unknown as FunctionDeclaration[];

    const systemInstruction =
      `You are an autonomous XRPL on-chain data research agent. ` +
      `This is iteration ${iteration}. ` +
      `Use the available tools to query the XRP Ledger and produce a concise, factual research finding. ` +
      `Call store_finding() only when you have a non-trivial, concrete insight worth recording.`;

    const geminiModel = this.genAI.getGenerativeModel({
      model: this.model,
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
      systemInstruction: { role: "model", parts: [{ text: systemInstruction }] },
    });

    const chat = geminiModel.startChat({});

    let stored = false;
    let storedContent: string | undefined;
    let response = await chat.sendMessage(strategyText);

    while (true) {
      const parts: Part[] = response.response.candidates?.[0]?.content?.parts ?? [];
      const functionCalls = parts.filter((p): p is Part & { functionCall: NonNullable<Part["functionCall"]> } =>
        p.functionCall != null
      );

      if (functionCalls.length === 0) {
        break;
      }

      const functionResponses: Part[] = [];
      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        if (name === "store_finding") {
          stored = true;
          storedContent = (args as { content: string }).content;
        }
        const result = await dispatchTool(nodeUrl, name, args as Record<string, unknown>);
        functionResponses.push({
          functionResponse: { name, response: result as Record<string, unknown> },
        });
      }

      response = await chat.sendMessage(functionResponses);
    }

    const finalParts = response.response.candidates?.[0]?.content?.parts ?? [];
    const finalText = finalParts
      .filter((p): p is Part & { text: string } => typeof p.text === "string")
      .map((p) => p.text)
      .join("\n");

    return { text: finalText, stored, storedContent };
  }
}

// ---------- Provider factory ----------

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-opus-4-6",
  gemini: "gemini-2.0-flash",
};

function createProvider(options: ResearchLoopOptions): AIResearchProvider {
  const model = options.model || DEFAULT_MODELS[options.provider];
  if (options.provider === "gemini") {
    return new GeminiResearchProvider(options.apiKey, model);
  }
  return new AnthropicResearchProvider(options.apiKey, model);
}

// ---------- Main export ----------

export async function runResearchLoop(options: ResearchLoopOptions): Promise<void> {
  const provider = createProvider(options);
  const strategyText = readFileSync(options.strategyFile, "utf8");

  for (let i = 1; i <= options.maxIterations; i++) {
    if (options.json) {
      process.stderr.write(`[research] cycle ${i}/${options.maxIterations} starting\n`);
    } else {
      console.log(`\n--- Cycle ${i}/${options.maxIterations} ---`);
    }

    let finding: ResearchFinding;

    try {
      const cycleResult = await provider.runCycle(strategyText, options.nodeUrl, i);
      finding = {
        iteration: i,
        timestamp: new Date().toISOString(),
        text: cycleResult.text,
        stored: cycleResult.stored,
      };

      if (options.storeOnChain && cycleResult.stored && options.seed && cycleResult.storedContent) {
        try {
          finding.onChainHash = await storeOnChain(options.nodeUrl, options.seed, cycleResult.storedContent, i);
        } catch (err) {
          process.stderr.write(
            `Warning: on-chain storage failed for cycle ${i}: ${err instanceof Error ? err.message : String(err)}\n`
          );
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: cycle ${i} failed: ${errMsg}\n`);
      finding = {
        iteration: i,
        timestamp: new Date().toISOString(),
        text: "",
        stored: false,
        error: errMsg,
      };
    }

    appendToJsonl(options.outputFile, finding);

    if (options.json) {
      console.log(JSON.stringify(finding));
    } else {
      if (finding.error) {
        console.log(`[failed] ${finding.error}`);
      } else {
        console.log(finding.text);
        if (finding.stored) {
          console.log(`[stored]${finding.onChainHash ? ` tx: ${finding.onChainHash}` : ""}`);
        }
      }
    }

    if (i < options.maxIterations) {
      await sleep(options.intervalSeconds * 1000);
    }
  }

  if (!options.json) {
    console.log(`\nResearch complete. Results saved to ${options.outputFile}`);
  }
}
