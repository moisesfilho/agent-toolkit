import { appendNote } from "../../src/note-writer.mjs";

const [root, role, taskSlug, text] = process.argv.slice(2);

try {
  const result = await appendNote({ role, taskSlug, text, root });
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(JSON.stringify({ code: error.code, message: error.message }));
  process.exitCode = 1;
}
