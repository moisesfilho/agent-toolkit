import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [root, role, taskSlug] = process.argv.slice(2);
const taskDir = path.join(root, "docs", "agent-state", taskSlug);
await mkdir(taskDir, { recursive: true });
const lockPath = path.join(taskDir, `.note-writer-${role}.lock`);
await writeFile(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), "utf8");
process.stdout.write("locked\n");
process.kill(process.pid, "SIGKILL");
