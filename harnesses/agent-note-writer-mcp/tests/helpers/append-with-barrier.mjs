import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { appendNote } from "../../src/note-writer.mjs";

const [root, role, taskSlug, text, barrierPath, releasePath] = process.argv.slice(2);

try {
  await appendNote({
    role,
    taskSlug,
    text,
    root,
    hooks: {
      afterStaleCheck: async () => {
        await writeFile(barrierPath, "paused\n", "utf8");
        while (!existsSync(releasePath)) {
          await delay(20);
        }
      },
    },
  });
  process.stdout.write("ok\n");
} catch (error) {
  process.stderr.write(JSON.stringify({ code: error.code, message: error.message }));
  process.exitCode = 1;
}
