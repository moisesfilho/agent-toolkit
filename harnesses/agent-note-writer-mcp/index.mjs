import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { assertWorkspaceRoot, NoteError, validateRole } from "./src/note-writer.mjs";
import { createNoteServer } from "./src/server.mjs";

export function parseRoleArgument(argv) {
  let role = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--role") {
      role = argv[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith("--role=")) {
      role = argument.slice("--role=".length);
      continue;
    }
    throw new NoteError("ROLE_INVALID", `Unknown argument ${JSON.stringify(argument)}.`);
  }
  return role;
}

async function main() {
  const role = parseRoleArgument(process.argv.slice(2));
  if (!role) {
    throw new NoteError("ROLE_INVALID", "Missing --role <role> argument.");
  }
  validateRole(role);

  const root = process.cwd();
  await assertWorkspaceRoot(root);

  const server = createNoteServer({ role, root });
  await server.connect(new StdioServerTransport());
}

try {
  await main();
} catch (error) {
  const code = error instanceof NoteError ? error.code : "STARTUP_FAILED";
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ error: { code, message } })}\n`);
  process.exit(2);
}
