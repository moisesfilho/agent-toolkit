import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { makeTempRoot, readNote } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(HERE, "..", "index.mjs");

function startServer({ cwd, role }) {
  const child = spawn(process.execPath, [INDEX, "--role", role], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffer = "";
  const pending = new Map();
  const stderr = [];

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        const message = JSON.parse(line);
        if (message.id !== undefined && pending.has(message.id)) {
          pending.get(message.id)(message);
          pending.delete(message.id);
        }
      }
      newline = buffer.indexOf("\n");
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));

  function request(id, method, params) {
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 5000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      child.stdin.write(`${payload}\n`);
    });
  }

  function notify(method, params) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async function close() {
    child.stdin.end();
    await once(child, "exit");
  }

  return { child, request, notify, close, stderr };
}

async function initialize(connection) {
  const response = await connection.request(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "process-test", version: "0.0.0" },
  });
  assert.equal(response.error, undefined);
  connection.notify("notifications/initialized", {});
  return response.result;
}

test("derives the note root from the session workspace (BIND-01/02)", async (t) => {
  const rootA = await makeTempRoot(t);
  const rootB = await makeTempRoot(t);

  for (const [root, slug] of [
    [rootA, "bind-a"],
    [rootB, "bind-b"],
  ]) {
    const connection = startServer({ cwd: root, role: "alice" });
    const initialized = await initialize(connection);
    assert.equal(initialized.serverInfo.name, "note_alice");
    assert.ok(initialized.capabilities.tools);
    assert.equal(initialized.capabilities.resources, undefined);
    assert.equal(initialized.capabilities.prompts, undefined);

    const response = await connection.request(2, "tools/call", {
      name: "append",
      arguments: { task_slug: slug, text: `written in ${slug}` },
    });
    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.ok, true);
    assert.equal(payload.path, `docs/agent-state/${slug}/alice.md`);
    await connection.close();
  }

  assert.match(await readNote(rootA, "bind-a", "alice"), /written in bind-a/);
  await assert.rejects(readNote(rootB, "bind-a", "alice"));
  assert.match(await readNote(rootB, "bind-b", "alice"), /written in bind-b/);
  await assert.rejects(readNote(rootA, "bind-b", "alice"));
});

test("uses the initial working directory, including a subdirectory (BIND-03)", async (t) => {
  const root = await makeTempRoot(t);
  const subdirectory = path.join(root, "sub");
  await mkdir(subdirectory);

  const connection = startServer({ cwd: subdirectory, role: "bob" });
  await initialize(connection);
  const response = await connection.request(2, "tools/call", {
    name: "append",
    arguments: { task_slug: "bind-sub", text: "from subdirectory" },
  });
  assert.equal(JSON.parse(response.result.content[0].text).ok, true);
  await connection.close();

  assert.match(await readNote(subdirectory, "bind-sub", "bob"), /from subdirectory/);
  await assert.rejects(readNote(root, "bind-sub", "bob"));
});

test("refuses invalid startup arguments without creating a note (ROLE-04)", async (t) => {
  const root = await makeTempRoot(t);
  for (const args of [["--role", "Alice"], ["--role", "alice", "--extra"], []]) {
    const child = spawn(process.execPath, [INDEX, ...args], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const [code] = await once(child, "exit");
    assert.equal(code, 2);
    assert.match(stderr, /ROLE_INVALID/);
  }
  await assert.rejects(readNote(root, "startup", "alice"));
});
