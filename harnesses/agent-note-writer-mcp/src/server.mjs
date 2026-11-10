import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { LIMITS, TOOL_NAME, serverNameForRole } from "./constants.mjs";
import { NoteError, appendNote, createDefaultClock } from "./note-writer.mjs";

export const requestSchema = z
  .object({
    task_slug: z.string(),
    text: z.string(),
  })
  .strict();

const VERSION = "0.1.0";

function toolDescriptor(role) {
  return {
    name: TOOL_NAME,
    title: `Append one line to the ${role} note`,
    description:
      `Append one timestamped single-line entry to docs/agent-state/<task_slug>/${role}.md ` +
      `inside the workspace. The role is fixed by this server instance and cannot be changed ` +
      `by the request. Only {task_slug, text} is accepted; there is no path, role or timestamp field. ` +
      `Limits: ${LIMITS.maxEntryBytes} UTF-8 bytes per entry, ${LIMITS.maxFileBytes} bytes per note, ` +
      `${LIMITS.lockWaitMs} ms lock wait, ${LIMITS.totalTimeoutMs} ms per operation.`,
    inputSchema: {
      type: "object",
      properties: {
        task_slug: {
          type: "string",
          minLength: 1,
          maxLength: 64,
          pattern: "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$",
          description: "Task directory name: lowercase ASCII, digits and internal hyphens, 1-64 bytes.",
        },
        text: {
          type: "string",
          minLength: 1,
          description:
            "One printable line, at most the configured entry byte limit. Newlines and control characters are rejected.",
        },
      },
      required: ["task_slug", "text"],
      additionalProperties: false,
    },
  };
}

function errorResult(code, message, details) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }),
      },
    ],
  };
}

/**
 * Build the MCP server for one fixed role. The server exposes exactly one
 * tool and no resources or prompts, so no note content can be read through
 * MCP resources by another role.
 */
export function createNoteServer({
  role,
  root,
  limits = LIMITS,
  clock = createDefaultClock(),
  timeZone,
}) {
  const server = new Server(
    { name: serverNameForRole(role), version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [toolDescriptor(role)],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== TOOL_NAME) {
      return errorResult("UNKNOWN_TOOL", `Unknown tool ${JSON.stringify(request.params.name)}.`);
    }

    const parsed = requestSchema.safeParse(request.params.arguments ?? {});
    if (!parsed.success) {
      return errorResult(
        "INVALID_ARGUMENTS",
        "Only {task_slug, text} string fields are accepted.",
        parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    try {
      const result = await appendNote({
        role,
        taskSlug: parsed.data.task_slug,
        text: parsed.data.text,
        root,
        limits,
        clock,
        ...(timeZone ? { timeZone } : {}),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (error) {
      if (error instanceof NoteError) {
        return errorResult(error.code, error.message, error.details);
      }
      return errorResult(
        "INTERNAL",
        "Unexpected failure while appending the note.",
        { reason: error instanceof Error ? error.name : "unknown" },
      );
    }
  });

  return server;
}
