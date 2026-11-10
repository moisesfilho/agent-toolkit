import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { LIMITS, lockFileName } from "../src/constants.mjs";
import { appendNote, formatEntry, formatTimestamp } from "../src/note-writer.mjs";
import { expectNoteError, fixedClock, makeTempRoot, readNote } from "./helpers.mjs";

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPEND_CHILD = path.join(HERE, "helpers", "append-child.mjs");
const DIE_HOLDER = path.join(HERE, "helpers", "hold-lock-then-die.mjs");

async function taskDirFor(root, slug) {
  const taskDir = path.join(root, "docs", "agent-state", slug);
  await mkdir(taskDir, { recursive: true });
  return taskDir;
}

async function writeLock(root, slug, role, pid = process.pid) {
  const taskDir = await taskDirFor(root, slug);
  const lockPath = path.join(taskDir, lockFileName(role));
  await writeFile(lockPath, JSON.stringify({ pid, startedAt: Date.now() }), "utf8");
  return lockPath;
}

test("acquires a lock released before the wait limit (WAIT-01)", async (t) => {
  const root = await makeTempRoot(t);
  const lockPath = await writeLock(root, "wait-short", "alice");
  const release = delay(80).then(() => unlink(lockPath).catch(() => {}));

  const result = await appendNote({
    role: "alice",
    taskSlug: "wait-short",
    text: "waited for lock",
    root,
    clock: fixedClock(),
  });
  await release;

  assert.equal(result.ok, true);
  assert.match(await readNote(root, "wait-short", "alice"), /waited for lock\n$/);
  await assert.rejects(stat(lockPath));
});

test("treats the wait boundary deterministically as busy (WAIT-02)", async (t) => {
  const root = await makeTempRoot(t);
  const lockPath = await writeLock(root, "wait-boundary", "alice");
  const timer = setTimeout(() => unlink(lockPath).catch(() => {}), 200);

  try {
    const limits = { ...LIMITS, lockWaitMs: 40 };
    await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: "wait-boundary",
          text: "too late",
          root,
          clock: fixedClock(),
          limits,
        }),
      "LOCK_BUSY",
    );
    await assert.rejects(stat(path.join(root, "docs", "agent-state", "wait-boundary", "alice.md")));
  } finally {
    clearTimeout(timer);
    await unlink(lockPath).catch(() => {});
  }
});

test("returns busy without appending when the lock outlives the wait limit (WAIT-03)", async (t) => {
  const root = await makeTempRoot(t);
  const lockPath = await writeLock(root, "wait-long", "alice");
  const timer = setTimeout(() => unlink(lockPath).catch(() => {}), LIMITS.lockWaitMs + 400);

  try {
    await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: "wait-long",
          text: "never written",
          root,
          clock: fixedClock(),
        }),
      "LOCK_BUSY",
    );
    await assert.rejects(stat(path.join(root, "docs", "agent-state", "wait-long", "alice.md")));
  } finally {
    clearTimeout(timer);
    await unlink(lockPath).catch(() => {});
  }
});

test("recovers a lock left by a killed process without a partial line (WAIT-04/CONC-02)", async (t) => {
  const root = await makeTempRoot(t);
  const child = spawn(process.execPath, [DIE_HOLDER, root, "alice", "orphan"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("locked")) {
        resolve();
      }
    });
    child.on("error", reject);
  });
  const [code, signal] = await once(child, "exit");
  assert.equal(code, null);
  assert.equal(signal, "SIGKILL");

  const lockPath = path.join(root, "docs", "agent-state", "orphan", lockFileName("alice"));
  assert.equal((await stat(lockPath)).isFile(), true);

  const result = await appendNote({
    role: "alice",
    taskSlug: "orphan",
    text: "after orphan",
    root,
    clock: fixedClock(),
  });

  assert.equal(result.ok, true);
  assert.equal(await readNote(root, "orphan", "alice"), `${formatTimestamp(new Date("2026-11-09T12:34:56.000Z"))} - after orphan\n`);
  await assert.rejects(stat(lockPath));
});

test("serializes parallel writers with every line present exactly once (CONC-01)", async (t) => {
  const root = await makeTempRoot(t);
  const writers = 8;
  const runs = Array.from({ length: writers }, (_, index) =>
    execFileAsync(process.execPath, [APPEND_CHILD, root, "alice", "concurrent", `worker-${index}`], {
      timeout: 15_000,
    }),
  );
  const results = await Promise.all(runs);
  assert.equal(results.length, writers);

  const lines = (await readNote(root, "concurrent", "alice")).trimEnd().split("\n");
  assert.equal(lines.length, writers);
  const seen = new Set();
  let previousStamp = "";
  for (const line of lines) {
    const match = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}) - worker-(\d+)$/.exec(line);
    assert.ok(match, `unexpected line: ${line}`);
    assert.ok(match[1] >= previousStamp, "timestamps must not go backwards");
    previousStamp = match[1];
    seen.add(Number(match[2]));
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [...Array(writers).keys()]);
  assert.deepEqual((await readdir(path.join(root, "docs", "agent-state", "concurrent"))).sort(), ["alice.md"]);
});

test("only one concurrent writer wins the last byte slot (CONC-03)", async (t) => {
  const root = await makeTempRoot(t);
  const timestamp = formatTimestamp(new Date("2026-11-09T12:34:56.000Z"));
  const text = "race-000000";
  const lineBytes = Buffer.byteLength(formatEntry(timestamp, text), "utf8");
  const taskDir = await taskDirFor(root, "last-slot");
  const notePath = path.join(taskDir, "alice.md");
  const padding = LIMITS.maxFileBytes - lineBytes;
  await writeFile(notePath, "p".repeat(padding), "utf8");

  const runs = await Promise.allSettled(
    ["race-000000", "race-111111"].map((candidate) =>
      execFileAsync(process.execPath, [APPEND_CHILD, root, "alice", "last-slot", candidate], {
        timeout: 15_000,
      }),
    ),
  );
  const fulfilled = runs.filter((run) => run.status === "fulfilled");
  const rejected = runs.filter((run) => run.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].reason.stderr, /FILE_TOO_LARGE/);

  const content = await readFile(notePath);
  assert.equal(content.length, LIMITS.maxFileBytes);
  assert.match(content.toString("utf8"), / - race-(000000|111111)\n$/);
});

test("retry after a rejected append does not duplicate content (CONC-04 policy)", async (t) => {
  const root = await makeTempRoot(t);
  const limits = { ...LIMITS, maxEntryBytes: 16 };
  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "retry",
        text: "z".repeat(limits.maxEntryBytes + 1),
        root,
        clock: fixedClock(),
        limits,
      }),
    "TEXT_TOO_LARGE",
  );

  await appendNote({
    role: "alice",
    taskSlug: "retry",
    text: "accepted",
    root,
    clock: fixedClock(),
    limits,
  });

  const lines = (await readNote(root, "retry", "alice")).trimEnd().split("\n");
  assert.equal(lines.length, 1);
  assert.match(lines[0], / - accepted$/);
});
