import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { effectiveToolName, normalizeToolName, validateNoteServers } from "../src/config-check.mjs";
import { serverNameForRole } from "../src/constants.mjs";

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES = path.join(HERE, "..", "examples");
const VALIDATE_CLI = path.join(HERE, "..", "validate-config.mjs");

async function example(name) {
  return JSON.parse(await readFile(path.join(EXAMPLES, name), "utf8"));
}

function localServer(role, extra = {}) {
  return {
    type: "local",
    codemode: false,
    command: ["node", "harnesses/agent-note-writer-mcp/index.mjs", "--role", role],
    enabled: true,
    ...extra,
  };
}

test("accepts distinct role servers and derives unique tool names (AC-07)", () => {
  const result = validateNoteServers({
    note_planner: localServer("planner"),
    note_coder: localServer("coder"),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.roles.sort(), ["coder", "planner"]);
  assert.deepEqual(result.servers.map((server) => server.toolName).sort(), [
    "note_coder_append",
    "note_planner_append",
  ]);
});

test("ignores unrelated MCP servers", () => {
  const result = validateNoteServers({
    note_planner: localServer("planner"),
    typesafe_jev: { type: "local", command: ["node", "somewhere/other.mjs"] },
  });
  assert.equal(result.ok, true);
  assert.equal(result.servers.length, 1);
});

test("rejects a normalized tool-name collision (AC-07)", () => {
  const result = validateNoteServers({
    note_planner: localServer("planner"),
    "note-planner": {
      type: "local",
      codemode: false,
      command: ["node", "harnesses/agent-note-writer-mcp/index.mjs", "--role", "planner"],
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "CONFIG_DUPLICATE_TOOL"));
});

test("detects an aliased server whose composed command carries --role (G2)", () => {
  const alias = {
    type: "local",
    codemode: false,
    command: ["sh", "-c", "exec node cli.mjs --role coder"],
  };
  const aliased = validateNoteServers({ "Note.Coder": alias });
  assert.equal(aliased.ok, false);
  assert.ok(aliased.errors.some((error) => error.code === "CONFIG_NAME"));
  assert.equal(aliased.servers.length, 1);
  assert.equal(aliased.servers[0].toolName, "note_coder_append");

  const exact = validateNoteServers({ note_coder: alias });
  assert.equal(exact.ok, true);
});

test("rejects an alias that collides with the canonical server after normalization (G2)", () => {
  const result = validateNoteServers({
    note_coder: localServer("coder"),
    "Note.Coder": {
      type: "local",
      codemode: false,
      command: ["sh", "-c", "exec node cli.mjs --role coder"],
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "CONFIG_DUPLICATE_ROLE"));
  assert.ok(result.errors.some((error) => error.code === "CONFIG_DUPLICATE_TOOL"));
});

test("requires codemode:false for note servers (G3)", () => {
  for (const codemode of [true, undefined]) {
    const entry = localServer("coder");
    if (codemode === undefined) {
      delete entry.codemode;
    } else {
      entry.codemode = codemode;
    }
    const result = validateNoteServers({ note_coder: entry });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.code === "CONFIG_CODEMODE"));
  }

  const explicit = validateNoteServers({ note_coder: localServer("coder") });
  assert.equal(explicit.ok, true);
});

test("accepts only the four approved note roles (O1)", () => {
  const approved = validateNoteServers({
    note_planner: localServer("planner"),
    note_coder: localServer("coder"),
    note_tester: localServer("tester"),
    note_reviewer: localServer("reviewer"),
  });
  assert.equal(approved.ok, true);
  assert.deepEqual(approved.roles.sort(), ["coder", "planner", "reviewer", "tester"]);

  for (const role of ["developer", "analyst", "alice"]) {
    const rejected = validateNoteServers({ [`note_${role}`]: localServer(role) });
    assert.equal(rejected.ok, false);
    assert.ok(
      rejected.errors.some((error) => error.code === "CONFIG_ROLE_NOT_ALLOWED"),
      `expected role ${role} to be rejected: ${JSON.stringify(rejected.errors)}`,
    );
  }
});

test("rejects duplicate roles, wrong server names and missing roles", () => {
  const duplicateRole = validateNoteServers({
    note_planner: localServer("planner"),
    note_planner_two: {
      type: "local",
      command: ["node", "x.mjs", "--role", "planner"],
    },
  });
  assert.ok(duplicateRole.errors.some((error) => error.code === "CONFIG_DUPLICATE_ROLE"));
  assert.ok(duplicateRole.errors.some((error) => error.code === "CONFIG_NAME"));

  const missingRole = validateNoteServers({
    note_planner: { type: "local", command: ["node", "x.mjs"] },
  });
  assert.ok(missingRole.errors.some((error) => error.code === "CONFIG_ROLE"));

  const invalidRole = validateNoteServers({
    note_planner: { type: "local", command: ["node", "x.mjs", "--role", "Alice"] },
  });
  assert.ok(invalidRole.errors.some((error) => error.code === "CONFIG_ROLE"));
});

test("rejects cwd, pool:true and remote transports in the example config (BIND-04/BIND-06)", () => {
  const withCwd = validateNoteServers({
    note_planner: localServer("planner", { cwd: "/tmp/elsewhere" }),
  });
  assert.ok(withCwd.errors.some((error) => error.code === "CONFIG_CWD_FORBIDDEN"));

  const withPool = validateNoteServers({
    note_planner: localServer("planner", { pool: true }),
  });
  assert.ok(withPool.errors.some((error) => error.code === "CONFIG_POOL_FORBIDDEN"));

  const remote = validateNoteServers({
    note_planner: { type: "remote", url: "https://example.invalid/mcp" },
  });
  assert.ok(remote.errors.some((error) => error.code === "CONFIG_TYPE"));
});

test("reports an empty configuration", () => {
  const result = validateNoteServers({});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "CONFIG_EMPTY"));
});

test("applies the documented normalization", () => {
  assert.equal(normalizeToolName("note_alice"), "note_alice");
  assert.equal(normalizeToolName("note-alice"), "note_alice");
  assert.equal(normalizeToolName("Note.Alice"), "note_alice");
  assert.equal(effectiveToolName("note_alice"), "note_alice_append");
  assert.equal(effectiveToolName("note", "alice_append"), "note_alice_append");
  assert.equal(serverNameForRole("tester"), "note_tester");
});

test("project-local example uses V2 mcp.servers, no cwd/pool and per-role ACL (AC-07)", async () => {
  const config = await example("opencode.json");
  assert.ok(config.mcp && config.mcp.servers, "expected mcp.servers");
  const result = validateNoteServers(config.mcp.servers);
  assert.equal(result.ok, true);

  const writerRoles = new Set(["planner", "coder", "tester", "reviewer"]);
  assert.equal(result.roles.includes("developer"), false);
  for (const role of result.roles) {
    assert.equal(writerRoles.has(role), true, `unexpected note role ${role}`);
  }

  const deny = config.permissions.find((entry) => entry.action === "note_*");
  assert.equal(deny.effect, "deny");

  for (const server of result.servers) {
    const entry = config.mcp.servers[server.name];
    assert.equal(entry.type, "local");
    assert.equal(entry.codemode, false);
    assert.equal("cwd" in entry, false);
    assert.equal("pool" in entry, false);
    const agent = config.agents[server.role];
    assert.ok(agent, `missing agent ${server.role}`);
    const allow = agent.permissions.find((permission) => permission.action === server.toolName);
    assert.equal(allow?.effect, "allow", `missing allow for ${server.toolName}`);
  }
});

test("env-path example reuses AGENT_TOOLKIT_DIR without a private absolute path", async () => {
  const config = await example("opencode.env-path.json");
  const result = validateNoteServers(config.mcp.servers);
  assert.equal(result.ok, true);
  assert.equal(result.servers.length, 1);

  const [server] = result.servers;
  const entry = config.mcp.servers[server.name];
  assert.equal(entry.type, "local");
  assert.equal(entry.codemode, false);
  assert.equal(entry.environment.AGENT_TOOLKIT_DIR, "/path/to/agent-toolkit");
  assert.equal(entry.environment.NODE_BIN, "/path/to/node");
  const command = entry.command.join(" ");
  assert.match(command, /\$NODE_BIN/);
  assert.match(command, /\$AGENT_TOOLKIT_DIR\/harnesses\/agent-note-writer-mcp\/index\.mjs/);
  assert.match(command, /--role\s+coder/);
  assert.doesNotMatch(JSON.stringify(config), /\/home\/[^/]+\//);
});

test("validate-config CLI accepts both V2 examples", async () => {
  for (const name of ["opencode.json", "opencode.env-path.json"]) {
    const { stdout } = await execFileAsync(process.execPath, [VALIDATE_CLI, path.join(EXAMPLES, name)]);
    const payload = JSON.parse(stdout);
    assert.equal(payload.ok, true, name);
  }
});
