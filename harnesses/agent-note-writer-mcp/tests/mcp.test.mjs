import assert from "node:assert/strict";
import { lstat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { LIMITS, TIME_ZONE, TOOL_NAME } from "../src/constants.mjs";
import { formatTimestamp } from "../src/note-writer.mjs";
import { createNoteServer } from "../src/server.mjs";
import { fixedClock, makeTempRoot, parseErrorPayload, readNote } from "./helpers.mjs";

const FIXED_DATE = "2026-11-09T12:34:56.000Z";

async function connect(t, { role = "alice", root, clock = fixedClock(FIXED_DATE), limits } = {}) {
  const server = createNoteServer({ role, root, clock, ...(limits ? { limits } : {}) });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}

test("exposes exactly one append tool with the closed input schema (AC-01)", async (t) => {
  const root = await makeTempRoot(t);
  const client = await connect(t, { root });
  const { tools } = await client.listTools();

  assert.equal(tools.length, 1);
  const [tool] = tools;
  assert.equal(tool.name, TOOL_NAME);
  assert.deepEqual(Object.keys(tool.inputSchema.properties).sort(), ["task_slug", "text"]);
  assert.deepEqual(tool.inputSchema.required.sort(), ["task_slug", "text"]);
  assert.equal(tool.inputSchema.additionalProperties, false);
  for (const forbidden of ["path", "file", "role", "timestamp"]) {
    assert.equal(forbidden in tool.inputSchema.properties, false);
  }
});

test("appends through the tool and returns the relative path", async (t) => {
  const root = await makeTempRoot(t);
  const client = await connect(t, { root });

  const result = await client.callTool({
    name: TOOL_NAME,
    arguments: { task_slug: "mcp-success", text: "through mcp" },
  });
  assert.equal(result.isError, undefined);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.ok, true);
  assert.equal(payload.path, "docs/agent-state/mcp-success/alice.md");

  const stamp = formatTimestamp(new Date(FIXED_DATE), TIME_ZONE);
  assert.equal(await readNote(root, "mcp-success", "alice"), `${stamp} - through mcp\n`);
});

test("rejects path, role and timestamp extras before writing (DEST-01/ROLE-01/TIME-01)", async (t) => {
  const root = await makeTempRoot(t);
  const client = await connect(t, { root });

  for (const extra of [
    { path: "../evil.md" },
    { file: "../evil.md" },
    { role: "bob" },
    { timestamp: "2000-01-01 00:00 +00:00" },
  ]) {
    const result = await client.callTool({
      name: TOOL_NAME,
      arguments: { task_slug: "mcp-extra", text: "no", ...extra },
    });
    assert.equal(result.isError, true);
    assert.equal(parseErrorPayload(result).code, "INVALID_ARGUMENTS");
  }
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "mcp-extra", "alice.md")));
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "mcp-extra", "bob.md")));
});

test("rejects missing or non-string fields and invalid slugs (SLUG-08/09, TEXT-01/02)", async (t) => {
  const root = await makeTempRoot(t);
  const client = await connect(t, { root });

  for (const args of [{}, { task_slug: "only-slug" }, { text: "only-text" }, { task_slug: 42, text: "x" }, { task_slug: "ok", text: 42 }]) {
    const result = await client.callTool({ name: TOOL_NAME, arguments: args });
    assert.equal(result.isError, true);
    assert.equal(parseErrorPayload(result).code, "INVALID_ARGUMENTS");
  }

  for (const slug of ["", "A".repeat(5), "a".repeat(65), "../escape", "with space"]) {
    const result = await client.callTool({
      name: TOOL_NAME,
      arguments: { task_slug: slug, text: "x" },
    });
    assert.equal(result.isError, true);
    assert.equal(parseErrorPayload(result).code, "SLUG_INVALID");
  }
});

test("reports text limit and control failures with server error codes (TEXT-05, SIZE-02)", async (t) => {
  const root = await makeTempRoot(t);
  const client = await connect(t, { root });

  const control = await client.callTool({
    name: TOOL_NAME,
    arguments: { task_slug: "mcp-text", text: "line\nbreak" },
  });
  assert.equal(parseErrorPayload(control).code, "TEXT_CONTROL");

  const tooLarge = await client.callTool({
    name: TOOL_NAME,
    arguments: { task_slug: "mcp-text", text: "a".repeat(LIMITS.maxEntryBytes + 1) },
  });
  assert.equal(parseErrorPayload(tooLarge).code, "TEXT_TOO_LARGE");

  const empty = await client.callTool({
    name: TOOL_NAME,
    arguments: { task_slug: "mcp-text", text: "" },
  });
  assert.equal(parseErrorPayload(empty).code, "TEXT_EMPTY");

  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "mcp-text", "alice.md")));
});

test("the role is fixed by the server instance, not by the request (ROLE-02)", async (t) => {
  const root = await makeTempRoot(t);
  const client = await connect(t, { role: "bob", root });

  const result = await client.callTool({
    name: TOOL_NAME,
    arguments: { task_slug: "role-fixed", text: "bob writes" },
  });
  assert.equal(result.isError, undefined);
  assert.ok((await readNote(root, "role-fixed", "bob")).includes("bob writes"));
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "role-fixed", "alice.md")));
});

test("rejects unknown tool names", async (t) => {
  const root = await makeTempRoot(t);
  const client = await connect(t, { root });
  const result = await client.callTool({
    name: "append_to_any_note",
    arguments: { task_slug: "unknown", text: "x" },
  });
  assert.equal(parseErrorPayload(result).code, "UNKNOWN_TOOL");
});

test("advertises no resources or prompts and exposes no note content (AC-06)", async (t) => {
  const root = await makeTempRoot(t);
  const client = await connect(t, { root });

  const capabilities = client.getServerCapabilities();
  assert.ok(capabilities.tools);
  assert.equal(capabilities.resources, undefined);
  assert.equal(capabilities.prompts, undefined);

  await assert.rejects(client.listResources(), (error) => error.code === -32601);
  await assert.rejects(client.listPrompts(), (error) => error.code === -32601);
  assert.equal(client.getServerVersion().name, "note_alice");
});
