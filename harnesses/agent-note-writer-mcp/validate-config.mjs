import { readFile } from "node:fs/promises";

import { validateNoteServers } from "./src/config-check.mjs";

async function main() {
  const target = process.argv[2];
  if (!target) {
    process.stderr.write("usage: node validate-config.mjs <opencode.json>\n");
    return 2;
  }

  let raw;
  try {
    raw = await readFile(target, "utf8");
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ ok: false, errors: [{ code: "CONFIG_UNREADABLE", message: error.code }] })}\n`,
    );
    return 2;
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ ok: false, errors: [{ code: "CONFIG_INVALID_JSON", message: error.message }] })}\n`,
    );
    return 2;
  }

  const mcpBlock = config && typeof config === "object" && "mcp" in config ? config.mcp : config;
  const mcpServers =
    mcpBlock && typeof mcpBlock === "object" && "servers" in mcpBlock ? mcpBlock.servers : mcpBlock;
  const result = validateNoteServers(mcpServers);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

process.exitCode = await main();
