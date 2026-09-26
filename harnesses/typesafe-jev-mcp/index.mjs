import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const server = new McpServer({
  name: "typesafe-jev",
  version: "2.0.0",
});

const instructionsSchema = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const questionSchema = z.record(
  z.string(),
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("choice"),
      instructions: instructionsSchema,
      criteria: z.record(z.string(), z.unknown()).optional(),
    }),
    z.object({
      type: z.literal("score"),
      instructions: instructionsSchema,
      criteria: z.array(z.unknown()).optional(),
    }),
    z.object({
      type: z.literal("noul"),
      instructions: instructionsSchema,
      criteria: z.record(z.string(), z.unknown()).optional(),
    }),
  ]),
);

const inputSchema = {
  state: z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  questions: questionSchema,
};
const inputValidator = z.object(inputSchema);

const PROVIDERS = [
  {
    name: "opencode-zen",
    url: "https://opencode.ai/zen/v1/systemone",
    model: "jev-1.13-free",
    keyEnv: "OPENCODE_API_KEY",
  },
  {
    name: "typesafe",
    url: "https://api.typesafe.ai/v1/systemone",
    model: "jev-latest",
    keyEnv: "TYPESAFE_API_KEY",
  },
];

async function callProvider(provider, state, questions, signal) {
  const apiKey = process.env[provider.keyEnv];
  if (!apiKey) {
    return { ok: false, reason: `${provider.keyEnv} is not configured.` };
  }

  let response;
  try {
    response = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: provider.model, state, questions }),
      signal,
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }

  const body = await response.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = { raw: body };
  }

  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status}: ${JSON.stringify(payload)}` };
  }

  if (!payload || typeof payload !== "object" || !("answers" in payload)) {
    return { ok: false, reason: `Invalid payload: ${JSON.stringify(payload)}` };
  }

  return { ok: true, payload };
}

server.registerTool(
  "jev_decide",
  {
    description:
      "Evaluate structured, low-risk decisions with TypeSafe Jev (OpenCode Zen jev-1.13-free primary, TypeSafe API fallback). Do not use for user approvals, scope, requirements, deployments, migrations, deletions, or other irreversible actions.",
    inputSchema,
  },
  async (arguments_) => {
    const parsed = inputValidator.safeParse(arguments_);
    if (!parsed.success) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Invalid Jev request.",
              issues: parsed.error.issues,
            }),
          },
        ],
      };
    }

    const { state, questions } = parsed.data;
    const failures = [];

    for (const provider of PROVIDERS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      let result;
      try {
        result = await callProvider(provider, state, questions, controller.signal);
      } finally {
        clearTimeout(timer);
      }

      if (result.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ provider: provider.name, model: provider.model, ...result.payload }),
            },
          ],
          structuredContent: { provider: provider.name, model: provider.model, ...result.payload },
        };
      }

      failures.push({ provider: provider.name, reason: result.reason });
    }

    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: "All Jev providers failed.", failures }) }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
