import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { lockFileName } from "../src/constants.mjs";
import {
  acquireRecoveryGuard,
  appendNote,
  recoveryGuardOptions,
  releaseRecoveryGuard,
} from "../src/note-writer.mjs";
import { createNoteServer } from "../src/server.mjs";
import { expectNoteError, fixedClock, makeTempRoot, readNote } from "./helpers.mjs";

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPEND_CHILD = path.join(HERE, "helpers", "append-child.mjs");
const DIE_HOLDER = path.join(HERE, "helpers", "hold-lock-then-die.mjs");
const DIE_GUARD = path.join(HERE, "helpers", "hold-guard-then-die.mjs");
const BARRIER_CHILD = path.join(HERE, "helpers", "append-with-barrier.mjs");

const FIXED_DATE = "2026-11-09T12:34:56.000Z";

test("fails closed when the clock regresses behind the last note entry (TIME-02)", async (t) => {
  const root = await makeTempRoot(t);
  await appendNote({
    role: "alice",
    taskSlug: "clock-regression",
    text: "first entry",
    root,
    clock: fixedClock(FIXED_DATE),
  });

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "clock-regression",
        text: "earlier clock",
        root,
        clock: fixedClock("2026-11-09T12:33:00.000Z"),
      }),
    "CLOCK_REGRESSION",
  );

  const content = await readNote(root, "clock-regression", "alice");
  assert.equal(content.trimEnd().split("\n").length, 1);
  assert.ok(content.endsWith(" - first entry\n"));

  await appendNote({
    role: "alice",
    taskSlug: "clock-regression",
    text: "same minute again",
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal((await readNote(root, "clock-regression", "alice")).trimEnd().split("\n").length, 2);
});

test("fails closed when an existing note already records a later timestamp (TIME-02)", async (t) => {
  const root = await makeTempRoot(t);
  const noteDir = path.join(root, "docs", "agent-state", "clock-future");
  await mkdir(noteDir, { recursive: true });
  const notePath = path.join(noteDir, "alice.md");
  const future = "2026-11-09 23:00 -03:00 - hand written future entry\n";
  await writeFile(notePath, future, "utf8");

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "clock-future",
        text: "should fail",
        root,
        clock: fixedClock(FIXED_DATE),
      }),
    "CLOCK_REGRESSION",
  );
  assert.equal(await readFile(notePath, "utf8"), future);
});

test("rejects U+2028 and U+2029 as line separators (F2)", async (t) => {
  const root = await makeTempRoot(t);
  for (const separator of ["\u2028", "\u2029"]) {
    await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: "line-separator",
          text: `first${separator}second`,
          root,
          clock: fixedClock(FIXED_DATE),
        }),
      "TEXT_CONTROL",
    );
  }
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "line-separator", "alice.md")));
});

async function deadPid() {
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], { stdio: "ignore" });
  await once(child, "exit");
  return child.pid;
}

test("does not steal a stale lock while another recovery holds the mutex (L5)", async (t) => {
  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "recovery-mutex");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, lockFileName("alice"));
  const recoveryPath = `${lockPath}.recover`;
  const stalePayload = JSON.stringify({ pid: await deadPid(), startedAt: Date.now() });
  await writeFile(lockPath, stalePayload, "utf8");
  await mkdir(recoveryPath);

  try {
    await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: "recovery-mutex",
          text: "must not write",
          root,
          clock: fixedClock(FIXED_DATE),
        }),
      "LOCK_BUSY",
    );
    assert.equal(await readFile(lockPath, "utf8"), stalePayload);
    await assert.rejects(lstat(path.join(taskDir, "alice.md")));
  } finally {
    await rmdir(recoveryPath).catch(() => {});
  }

  const result = await appendNote({
    role: "alice",
    taskSlug: "recovery-mutex",
    text: "after recovery",
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal(result.ok, true);
  await assert.rejects(lstat(lockPath));
});

test("serializes concurrent recoverers of one dead lock (L5)", async (t) => {
  const root = await makeTempRoot(t);
  const child = spawn(process.execPath, [DIE_HOLDER, root, "alice", "recover-race"], {
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

  const writers = 6;
  await Promise.all(
    Array.from({ length: writers }, (_, index) =>
      execFileAsync(process.execPath, [APPEND_CHILD, root, "alice", "recover-race", `recovered-${index}`], {
        timeout: 15_000,
      }),
    ),
  );

  const lines = (await readNote(root, "recover-race", "alice")).trimEnd().split("\n");
  assert.equal(lines.length, writers);
  const seen = new Set();
  for (const line of lines) {
    const match = / - recovered-(\d+)$/.exec(line);
    assert.ok(match, `unexpected line: ${line}`);
    seen.add(Number(match[1]));
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [...Array(writers).keys()]);

  const taskDir = path.join(root, "docs", "agent-state", "recover-race");
  await assert.rejects(lstat(path.join(taskDir, lockFileName("alice"))));
  await assert.rejects(lstat(path.join(taskDir, `${lockFileName("alice")}.recover`)));
});

test("reports CLOCK_REGRESSION through the MCP tool without writing", async (t) => {
  const root = await makeTempRoot(t);
  let current = new Date(FIXED_DATE);
  const clock = { now: () => new Date(current), monotonicMs: () => performance.now() };
  const server = createNoteServer({ role: "alice", root, clock });
  const client = new Client({ name: "regression-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const first = await client.callTool({
    name: "append",
    arguments: { task_slug: "wire-regression", text: "first" },
  });
  assert.equal(first.isError, undefined);

  current = new Date("2026-11-09T12:33:00.000Z");
  const second = await client.callTool({
    name: "append",
    arguments: { task_slug: "wire-regression", text: "second" },
  });
  assert.equal(second.isError, true);
  assert.equal(JSON.parse(second.content[0].text).error.code, "CLOCK_REGRESSION");
  assert.equal((await readNote(root, "wire-regression", "alice")).trimEnd().split("\n").length, 1);

  const separator = await client.callTool({
    name: "append",
    arguments: { task_slug: "wire-regression", text: "first\u2028second" },
  });
  assert.equal(JSON.parse(separator.content[0].text).error.code, "TEXT_CONTROL");
});

test("fails closed on invalid timestamp-shaped anchors (R1)", async (t) => {
  const root = await makeTempRoot(t);
  const invalidStamps = [
    "2026-99-99 99:99 -03:00",
    "2026-13-01 10:00 -03:00",
    "2026-02-30 10:00 -03:00",
    "2026-11-09 24:00 -03:00",
    "2026-11-09 10:60 -03:00",
    "2026-11-09 10:00 +14:01",
    "2026-11-09 10:00 +99:00",
  ];

  for (const [index, stamp] of invalidStamps.entries()) {
    const slug = `bad-anchor-${index}`;
    const taskDir = path.join(root, "docs", "agent-state", slug);
    await mkdir(taskDir, { recursive: true });
    const notePath = path.join(taskDir, "alice.md");
    const content = `2026-11-09 09:00 -03:00 - valid older entry\n${stamp} - hand written invalid\n`;
    await writeFile(notePath, content, "utf8");

    await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: slug,
          text: "must not append",
          root,
          clock: fixedClock(FIXED_DATE),
        }),
      "NOTE_TIMESTAMP_INVALID",
    );
    assert.equal(await readFile(notePath, "utf8"), content);
    await assert.rejects(lstat(path.join(taskDir, lockFileName("alice"))));
  }

  const bareSlug = "bad-anchor-bare";
  const bareDir = path.join(root, "docs", "agent-state", bareSlug);
  await mkdir(bareDir, { recursive: true });
  const barePath = path.join(bareDir, "alice.md");
  const bareContent = "2026-99-99 99:99 -03:00\n";
  await writeFile(barePath, bareContent, "utf8");
  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: bareSlug,
        text: "must not append either",
        root,
        clock: fixedClock(FIXED_DATE),
      }),
    "NOTE_TIMESTAMP_INVALID",
  );
  assert.equal(await readFile(barePath, "utf8"), bareContent);
});

test("serializes stale recovery with a kernel guard barrier (R2)", async (t) => {
  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "guard-barrier");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, lockFileName("alice"));
  const recoveryPath = `${lockPath}.recover`;
  const stalePayload = JSON.stringify({ pid: await deadPid(), startedAt: Date.now() });
  await writeFile(lockPath, stalePayload, "utf8");
  await mkdir(recoveryPath);
  await writeFile(
    path.join(recoveryPath, "owner.json"),
    JSON.stringify({ pid: await deadPid(), startedAt: Date.now(), nonce: "stale-owner" }),
    "utf8",
  );

  const clock = { monotonicMs: () => performance.now() };
  const guard = await acquireRecoveryGuard(recoveryPath, performance.now(), {
    waitMs: 500,
    deadline: performance.now() + 2000,
    clock,
  });

  try {
    const run = await execFileAsync(
      process.execPath,
      [APPEND_CHILD, root, "alice", "guard-barrier", "blocked while guarded"],
      { timeout: 15_000 },
    ).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error }),
    );
    assert.equal(run.ok, false, "append must not complete while the guard is held");
    assert.match(run.error.stderr, /LOCK_BUSY/);
    assert.equal(await readFile(lockPath, "utf8"), stalePayload);
    assert.equal((await lstat(recoveryPath)).isDirectory(), true);
    await assert.rejects(lstat(path.join(taskDir, "alice.md")));
  } finally {
    await releaseRecoveryGuard(guard);
  }

  const result = await appendNote({
    role: "alice",
    taskSlug: "guard-barrier",
    text: "after guard release",
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal(result.ok, true);
  assert.match(await readNote(root, "guard-barrier", "alice"), / - after guard release\n$/);
  await assert.rejects(lstat(lockPath));
  await assert.rejects(lstat(recoveryPath));
});

test("releases the recovery guard when its process is killed (R2)", async (t) => {
  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "guard-death");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, lockFileName("alice"));
  const recoveryPath = `${lockPath}.recover`;
  await writeFile(
    lockPath,
    JSON.stringify({ pid: await deadPid(), startedAt: Date.now() }),
    "utf8",
  );
  await mkdir(recoveryPath);
  await writeFile(
    path.join(recoveryPath, "owner.json"),
    JSON.stringify({ pid: await deadPid(), startedAt: Date.now(), nonce: "stale-owner" }),
    "utf8",
  );

  const child = spawn(process.execPath, [DIE_GUARD, recoveryPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("guarded")) {
        resolve();
      }
    });
    child.on("error", reject);
  });
  const [code, signal] = await once(child, "exit");
  assert.equal(code, null);
  assert.equal(signal, "SIGKILL");

  const result = await appendNote({
    role: "alice",
    taskSlug: "guard-death",
    text: "after guard owner death",
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal(result.ok, true);
  assert.match(await readNote(root, "guard-death", "alice"), / - after guard owner death\n$/);
  await assert.rejects(lstat(lockPath));
  await assert.rejects(lstat(recoveryPath));
});

test("blocks a contender between stale check and mutex removal (R2 barrier)", async (t) => {  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "barrier-window");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, lockFileName("alice"));
  const recoveryPath = `${lockPath}.recover`;
  const stalePayload = JSON.stringify({ pid: await deadPid(), startedAt: Date.now() });
  await writeFile(lockPath, stalePayload, "utf8");
  await mkdir(recoveryPath);
  await writeFile(
    path.join(recoveryPath, "owner.json"),
    JSON.stringify({ pid: await deadPid(), startedAt: Date.now(), nonce: "stale-owner" }),
    "utf8",
  );

  const barrierPath = path.join(root, "barrier.paused");
  const releasePath = path.join(root, "barrier.release");
  const owner = spawn(
    process.execPath,
    [BARRIER_CHILD, root, "alice", "barrier-window", "owner entry", barrierPath, releasePath],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("barrier was not reached")), 5000);
    owner.stdout.on("data", () => {});
    owner.on("error", reject);
    const poll = setInterval(() => {
      if (existsSync(barrierPath)) {
        clearInterval(poll);
        clearTimeout(timer);
        resolve();
      }
    }, 10);
    owner.on("exit", () => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(new Error("owner exited before the barrier"));
    });
  });

  const contender = await execFileAsync(
    process.execPath,
    [APPEND_CHILD, root, "alice", "barrier-window", "contender entry"],
    { timeout: 15_000 },
  ).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error }),
  );
  assert.equal(contender.ok, false);
  assert.match(contender.error.stderr, /LOCK_BUSY/);
  assert.equal(await readFile(lockPath, "utf8"), stalePayload);
  assert.equal((await lstat(recoveryPath)).isDirectory(), true);

  const idle = net.connect(recoveryGuardOptions(recoveryPath));
  idle.on("error", () => {});
  await new Promise((resolve) => setTimeout(resolve, 50));

  const releaseStarted = performance.now();
  await writeFile(releasePath, "go\n", "utf8");
  await once(owner, "exit");
  const releaseElapsed = performance.now() - releaseStarted;
  idle.destroy();
  assert.ok(releaseElapsed < 1000, `guard release took ${releaseElapsed}ms`);
  assert.equal(await readFile(lockPath, "utf8").catch(() => null), null);
  const lines = (await readNote(root, "barrier-window", "alice")).trimEnd().split("\n");
  assert.equal(lines.length, 1);
  assert.match(lines[0], / - owner entry$/);
  await assert.rejects(lstat(recoveryPath));
});

async function connectIdle(options) {
  const client = net.connect(options);
  client.on("error", () => {});
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 200);
    client.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    client.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return client;
}

test("releases the recovery guard without waiting for an idle client (D1)", async (t) => {
  const root = await makeTempRoot(t);
  const recoveryPath = path.join(root, "idle.lock.recover");
  const clock = { monotonicMs: () => performance.now() };
  const guard = await acquireRecoveryGuard(recoveryPath, performance.now(), {
    waitMs: 500,
    deadline: performance.now() + 2000,
    clock,
  });
  const client = await connectIdle(recoveryGuardOptions(recoveryPath));

  const started = performance.now();
  const released = await Promise.race([
    releaseRecoveryGuard(guard).then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 1000)),
  ]);
  const elapsed = performance.now() - started;
  assert.equal(released, true, "release must not wait for an idle client");
  assert.ok(elapsed < 500, `release took ${elapsed}ms`);

  const guardAgain = await acquireRecoveryGuard(recoveryPath, performance.now(), {
    waitMs: 500,
    deadline: performance.now() + 2000,
    clock,
  });
  await releaseRecoveryGuard(guardAgain);
  client.destroy();
});

test("releases a TCP fallback guard without waiting for an idle client (D1)", async (t) => {
  const root = await makeTempRoot(t);
  const recoveryPath = path.join(root, `tcp-${process.pid}-${Date.now()}.lock.recover`);
  const options = recoveryGuardOptions(recoveryPath, "darwin");
  assert.equal(options.host, "127.0.0.1");
  const clock = { monotonicMs: () => performance.now() };
  const guard = await acquireRecoveryGuard(recoveryPath, performance.now(), {
    waitMs: 500,
    deadline: performance.now() + 2000,
    clock,
    guardOptions: options,
  });
  const client = await connectIdle(options);

  const started = performance.now();
  const released = await Promise.race([
    releaseRecoveryGuard(guard).then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 1000)),
  ]);
  const elapsed = performance.now() - started;
  assert.equal(released, true);
  assert.ok(elapsed < 500, `TCP fallback release took ${elapsed}ms`);

  const guardAgain = await acquireRecoveryGuard(recoveryPath, performance.now(), {
    waitMs: 500,
    deadline: performance.now() + 2000,
    clock,
    guardOptions: options,
  });
  await releaseRecoveryGuard(guardAgain);
  client.destroy();
});
