import { NOTE_ROLES, ROLE_PATTERN, TOOL_NAME, serverNameForRole } from "./constants.mjs";

/**
 * OpenCode normalizes server and tool names before composing the tool id.
 * Keep the normalization explicit so two servers that collapse to the same id
 * are rejected instead of silently shadowing each other.
 */
export function normalizeToolName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
}

export function effectiveToolName(serverName, toolName = TOOL_NAME) {
  return `${normalizeToolName(serverName)}_${normalizeToolName(toolName)}`;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRoleFromCommand(command) {
  if (!Array.isArray(command)) {
    return { role: null, error: "command must be an array of strings" };
  }
  const roles = [];
  for (let index = 0; index < command.length; index += 1) {
    const argument = command[index];
    if (typeof argument !== "string") {
      return { role: null, error: "command entries must be strings" };
    }
    if (argument === "--role") {
      roles.push(command[index + 1]);
      index += 1;
      continue;
    }
    if (argument.startsWith("--role=")) {
      roles.push(argument.slice("--role=".length));
      continue;
    }
    const embedded = /(?:^|\s)--role\s+([a-z][a-z0-9-]{0,31})(?:\s|$)/.exec(argument);
    if (embedded) {
      roles.push(embedded[1]);
    }
  }
  if (roles.length === 0) {
    return { role: null, error: "missing --role <role> in command" };
  }
  if (roles.length > 1) {
    return { role: null, error: "multiple --role arguments in command" };
  }
  return { role: roles[0], error: null };
}

function commandMentionsRole(command) {
  return (
    Array.isArray(command) &&
    command.some(
      (argument) => typeof argument === "string" && /(?:^|\s)--role(?:=|\s|$)/.test(argument),
    )
  );
}

function looksLikeNoteServer(name, entry) {
  return name.startsWith("note_") || commandMentionsRole(entry?.command);
}

/**
 * Validate the `mcp` block of an OpenCode configuration for the note writer.
 * The checker is intentionally about names and spawn shape: per-agent ACLs are
 * enforced by the harness and measured by the tester, not by this script.
 */
export function validateNoteServers(mcpServers) {
  const errors = [];
  const roles = [];
  const servers = [];

  if (!isPlainObject(mcpServers)) {
    return {
      ok: false,
      errors: [{ code: "CONFIG_INVALID", message: "mcp must be an object of server entries." }],
      roles,
      servers,
    };
  }

  const seenRoles = new Map();
  const seenToolNames = new Map();
  let sawNoteServer = false;

  for (const [name, entry] of Object.entries(mcpServers)) {
    if (!looksLikeNoteServer(name, entry)) {
      continue;
    }
    sawNoteServer = true;
    if (!isPlainObject(entry)) {
      errors.push({ code: "CONFIG_INVALID", server: name, message: "server entry must be an object" });
      continue;
    }
    if (entry.type !== "local") {
      errors.push({
        code: "CONFIG_TYPE",
        server: name,
        message: "note servers must use the local stdio transport",
      });
    }
    if ("cwd" in entry) {
      errors.push({
        code: "CONFIG_CWD_FORBIDDEN",
        server: name,
        message: "cwd is forbidden: the note root must come from the session workspace",
      });
    }
    if ("pool" in entry && entry.pool !== false) {
      errors.push({
        code: "CONFIG_POOL_FORBIDDEN",
        server: name,
        message: "pool:true is forbidden for note servers",
      });
    }
    if (entry.codemode !== false) {
      errors.push({
        code: "CONFIG_CODEMODE",
        server: name,
        message:
          "codemode must be false so the native note_<role>_append tool and its per-role ACL are used",
      });
    }

    const { role, error } = readRoleFromCommand(entry.command);
    if (error) {
      errors.push({ code: "CONFIG_ROLE", server: name, message: error });
      continue;
    }
    if (typeof role !== "string" || !ROLE_PATTERN.test(role)) {
      errors.push({
        code: "CONFIG_ROLE",
        server: name,
        message: "role must match [a-z][a-z0-9-]{0,31}",
      });
      continue;
    }
    if (!NOTE_ROLES.includes(role)) {
      errors.push({
        code: "CONFIG_ROLE_NOT_ALLOWED",
        server: name,
        message: `role ${role} is not a note role; allowed: ${NOTE_ROLES.join(", ")}`,
      });
      continue;
    }

    const expectedName = serverNameForRole(role);
    if (name !== expectedName) {
      errors.push({
        code: "CONFIG_NAME",
        server: name,
        message: `server name must be ${expectedName} for role ${role}`,
      });
    }

    const toolName = effectiveToolName(name);
    if (seenRoles.has(role)) {
      errors.push({
        code: "CONFIG_DUPLICATE_ROLE",
        server: name,
        message: `role ${role} is already served by ${seenRoles.get(role)}`,
      });
    } else {
      seenRoles.set(role, name);
    }
    if (seenToolNames.has(toolName)) {
      errors.push({
        code: "CONFIG_DUPLICATE_TOOL",
        server: name,
        message: `tool ${toolName} collides with ${seenToolNames.get(toolName)} after normalization`,
      });
    } else {
      seenToolNames.set(toolName, name);
    }

    roles.push(role);
    servers.push({ name, role, toolName });
  }

  if (!sawNoteServer) {
    errors.push({
      code: "CONFIG_EMPTY",
      message: "no note_* server configured",
    });
  }

  return { ok: errors.length === 0, errors, roles, servers };
}
