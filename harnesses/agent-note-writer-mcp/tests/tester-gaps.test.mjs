/**
 * Tester gap tests for the negative matrix in
 * `docs/agent-state/agent-note-writer/tester.md`.
 *
 * These fill material gaps left by the coder suite without changing production
 * code: wire-level request strictness (no client-side validation), role spoofing
 * through the environment, per-call revalidation of the note target, the file
 * limit measured on multibyte bytes, and a regular file where a directory is
 * required.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { lstat, mkdir, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { LIMITS, TIME_ZONE, lockFileName } from "../src/constants.mjs";
import {
  appendNote,
  acquireRecoveryGuard,
  formatEntry,
  formatTimestamp,
  recoveryGuardOptions,
  releaseLock,
  releaseRecoveryGuard,
} from "../src/note-writer.mjs";
import { expectNoteError, fixedClock, makeTempRoot, readNote } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(HERE, "..", "index.mjs");
const FIXED_DATE = "2026-11-09T12:34:56.000Z";

function startServer({ cwd, role, env = {} }) {
  const child = spawn(process.execPath, [INDEX, "--role", role], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  let buffer = "";
  const pending = new Map();
  let nextId = 1;

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

  function send(method, params) {
    const id = nextId;
    nextId += 1;
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

  async function initialize() {
    const response = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "tester-gaps", version: "0.0.0" },
    });
    assert.equal(response.error, undefined);
    notify("notifications/initialized", {});
    return response.result;
  }

  let closed = false;
  async function close() {
    if (closed) {
      return;
    }
    closed = true;
    child.stdin.end();
    await once(child, "exit");
  }

  function kill() {
    closed = true;
    child.stdin.destroy();
    child.kill("SIGKILL");
    child.unref();
  }

  return { child, send, initialize, close, kill };
}

function errorCode(response) {
  assert.ok(response.result?.isError, `expected an error result, received ${JSON.stringify(response)}`);
  return JSON.parse(response.result.content[0].text).error.code;
}

test("ignores a role supplied through the environment (ROLE-04)", async (t) => {
  const root = await makeTempRoot(t);
  const connection = startServer({
    cwd: root,
    role: "alice",
    env: { NOTE_ROLE: "bob", ROLE: "bob", NOTE_WRITER_ROLE: "bob", MCP_ROLE: "bob" },
  });
  t.after(() => connection.kill());

  const initialized = await connection.initialize();
  assert.equal(initialized.serverInfo.name, "note_alice");

  const response = await connection.send("tools/call", {
    name: "append",
    arguments: { task_slug: "env-role", text: "from alice" },
  });
  await connection.close();

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.ok, true);
  assert.equal(payload.role, "alice");
  assert.equal(payload.path, "docs/agent-state/env-role/alice.md");
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "env-role", "bob.md")));
});

test("rejects request extras and invalid text at the wire level (DEST-01/ROLE-01/TIME-01/TEXT-03/07)", async (t) => {
  const root = await makeTempRoot(t);
  const connection = startServer({ cwd: root, role: "alice" });
  t.after(() => connection.kill());
  await connection.initialize();

  const extras = [
    { path: "../evil.md" },
    { file: "../evil.md" },
    { role: "bob" },
    { timestamp: "2000-01-01 00:00 +00:00" },
  ];
  for (const extra of extras) {
    const response = await connection.send("tools/call", {
      name: "append",
      arguments: { task_slug: "wire-extra", text: "no", ...extra },
    });
    assert.equal(errorCode(response), "INVALID_ARGUMENTS", `extra ${JSON.stringify(extra)}`);
  }

  const wrongType = await connection.send("tools/call", {
    name: "append",
    arguments: { task_slug: "wire-extra", text: 42 },
  });
  assert.equal(errorCode(wrongType), "INVALID_ARGUMENTS");

  const loneSurrogate = await connection.send("tools/call", {
    name: "append",
    arguments: { task_slug: "wire-extra", text: "lone\uD800surrogate" },
  });
  assert.equal(errorCode(loneSurrogate), "TEXT_ENCODING");

  const replacement = await connection.send("tools/call", {
    name: "append",
    arguments: { task_slug: "wire-extra", text: "replacement\uFFFDchar" },
  });
  assert.equal(errorCode(replacement), "TEXT_ENCODING");

  await connection.close();
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "wire-extra", "alice.md")));
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "wire-extra", "bob.md")));
});

test("revalidates the note target on every call (SYM-02/DEST-03)", async (t) => {
  const root = await makeTempRoot(t);
  const outside = await makeTempRoot(t);
  const sentinel = path.join(outside, "sentinel.txt");
  await writeFile(sentinel, "SENTINEL", "utf8");

  await appendNote({
    role: "alice",
    taskSlug: "swap",
    text: "first",
    root,
    clock: fixedClock(FIXED_DATE),
  });

  const notePath = path.join(root, "docs", "agent-state", "swap", "alice.md");
  await rm(notePath);
  await symlink(sentinel, notePath);

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "swap",
        text: "second",
        root,
        clock: fixedClock(FIXED_DATE),
      }),
    "NOTE_SYMLINK",
  );
  assert.equal(await readFile(sentinel, "utf8"), "SENTINEL");
  assert.equal((await lstat(notePath)).isSymbolicLink(), true);
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "swap", ".note-writer-alice.lock")));
});

test("counts the file limit on bytes of multibyte content (FILE-04)", async (t) => {
  const root = await makeTempRoot(t);
  const clock = fixedClock(FIXED_DATE);
  const stamp = formatTimestamp(new Date(FIXED_DATE), TIME_ZONE);
  const text = "multibyte-é";
  const lineBytes = Buffer.byteLength(formatEntry(stamp, text), "utf8");
  const paddingBytes = LIMITS.maxFileBytes - lineBytes;
  const padding =
    "é".repeat(Math.floor(paddingBytes / 2)) + (paddingBytes % 2 === 1 ? "a" : "");
  assert.equal(Buffer.byteLength(padding, "utf8"), paddingBytes);

  for (const [slug, pad, shouldSucceed] of [
    ["file-bytes-exact", padding, true],
    ["file-bytes-over", `${padding}a`, false],
  ]) {
    const noteDir = path.join(root, "docs", "agent-state", slug);
    await mkdir(noteDir, { recursive: true });
    await writeFile(path.join(noteDir, "alice.md"), pad, "utf8");

    if (shouldSucceed) {
      const result = await appendNote({ role: "alice", taskSlug: slug, text, root, clock });
      assert.equal(result.fileBytes, LIMITS.maxFileBytes);
      assert.equal((await readFile(path.join(noteDir, "alice.md"))).length, LIMITS.maxFileBytes);
    } else {
      await expectNoteError(
        () => appendNote({ role: "alice", taskSlug: slug, text, root, clock }),
        "FILE_TOO_LARGE",
      );
      assert.equal((await readFile(path.join(noteDir, "alice.md"))).length, paddingBytes + 1);
    }
  }
});

test("rejects a regular file where a directory component is required (PATH_INVALID)", async (t) => {
  const root = await makeTempRoot(t);
  await writeFile(path.join(root, "docs"), "not a directory", "utf8");

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "docs-file",
        text: "x",
        root,
        clock: fixedClock(FIXED_DATE),
      }),
    "PATH_INVALID",
  );
  assert.equal(await readFile(path.join(root, "docs"), "utf8"), "not a directory");
});

test("fails closed exactly at the total budget boundary (TOTAL-02 exact)", async (t) => {
  const root = await makeTempRoot(t);
  // First read: appendNote start; second: lock start; third: pre-write check
  // lands exactly on the deadline, so the operation must abort, not write.
  const values = [0, 0, LIMITS.totalTimeoutMs];
  let index = 0;
  const clock = {
    now: () => new Date(FIXED_DATE),
    monotonicMs: () => values[Math.min(index++, values.length - 1)],
  };

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "total-exact",
        text: "at the deadline",
        root,
        clock,
      }),
    "TIMEOUT",
  );
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "total-exact", "alice.md")));
});

test("a busy contender never deletes the holder's lock or writes (WAIT-03)", async (t) => {
  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "busy-contender");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, ".note-writer-alice.lock");
  // A live PID (this process) keeps the lock non-stale for the whole wait.
  await writeFile(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), "utf8");

  try {
    await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: "busy-contender",
          text: "must not write",
          root,
          clock: fixedClock(FIXED_DATE),
        }),
      "LOCK_BUSY",
    );
    assert.equal((await lstat(lockPath)).isFile(), true);
    await assert.rejects(lstat(path.join(taskDir, "alice.md")));
  } finally {
    await rm(lockPath, { force: true });
  }
});

async function deadProcessPid() {
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], { stdio: "ignore" });
  await once(child, "exit");
  return child.pid;
}

test("compares a manual last stamp across timezone offsets (TIME-02/F1)", async (t) => {
  const root = await makeTempRoot(t);
  const noteDir = path.join(root, "docs", "agent-state", "manual-offset");
  await mkdir(noteDir, { recursive: true });
  const notePath = path.join(noteDir, "alice.md");
  const clock = fixedClock(FIXED_DATE); // 2026-11-09 09:34 -03:00

  // 07:30 -05:00 is 12:30 UTC = 09:30 -03:00, earlier than the server clock.
  await writeFile(notePath, "2026-11-09 07:30 -05:00 - offset entry\n", "utf8");
  const accepted = await appendNote({ role: "alice", taskSlug: "manual-offset", text: "later local", root, clock });
  assert.equal(accepted.ok, true);
  const acceptedContent = await readFile(notePath, "utf8");

  // 07:40 -05:00 is 12:40 UTC = 09:40 -03:00, later than the server clock.
  const withFuture = `${acceptedContent}2026-11-09 07:40 -05:00 - later offset entry\n`;
  await writeFile(notePath, withFuture, "utf8");
  await expectNoteError(
    () => appendNote({ role: "alice", taskSlug: "manual-offset", text: "regressed", root, clock }),
    "CLOCK_REGRESSION",
  );
  assert.equal(await readFile(notePath, "utf8"), withFuture);
  await assert.rejects(lstat(path.join(noteDir, lockFileName("alice"))));
});

test("ignores unstamped prose and accepts old manual stamps (F1 old notes)", async (t) => {
  const root = await makeTempRoot(t);
  const noteDir = path.join(root, "docs", "agent-state", "manual-old");
  await mkdir(noteDir, { recursive: true });
  const notePath = path.join(noteDir, "alice.md");
  const original =
    "hand-written header without a stamp\n" +
    "2026-11-08 10:00 -03:00 - older entry\n" +
    "prose appended by a human, no stamp\n" +
    "2026-11-08 11:00 -03:00 - newest old entry\n";
  await writeFile(notePath, original, "utf8");

  const result = await appendNote({
    role: "alice",
    taskSlug: "manual-old",
    text: "server entry today",
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal(result.ok, true);
  const content = await readFile(notePath, "utf8");
  assert.ok(content.startsWith(original));
  assert.equal(content.trimEnd().split("\n").length, original.trimEnd().split("\n").length + 1);
});

test("releases only the lock owned by its nonce (L5 owner/release)", async (t) => {
  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "release-nonce");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, lockFileName("alice"));
  await writeFile(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now(), nonce: "other" }), "utf8");

  await releaseLock(lockPath, "mine");
  assert.equal((await lstat(lockPath)).isFile(), true);

  await releaseLock(lockPath, "other");
  await assert.rejects(lstat(lockPath));
});

test("reclaims an unreadable stale lock after the stale age (L5)", async (t) => {
  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "unreadable-lock");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, lockFileName("alice"));
  await writeFile(lockPath, "not a json payload", "utf8");
  const old = new Date(Date.now() - (LIMITS.lockStaleMs + 1000));
  await utimes(lockPath, old, old);

  const result = await appendNote({
    role: "alice",
    taskSlug: "unreadable-lock",
    text: "after unreadable lock",
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal(result.ok, true);
  await assert.rejects(lstat(lockPath));
  const contentWritten = (await readFile(path.join(taskDir, "alice.md"), "utf8")).includes("after unreadable lock");
  assert.equal(contentWritten, true);
});

test("reclaims a recovery mutex whose owner died (L5)", async (t) => {
  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "dead-mutex");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, lockFileName("alice"));
  const recoveryPath = `${lockPath}.recover`;
  const deadPid = await deadProcessPid();
  await writeFile(lockPath, JSON.stringify({ pid: deadPid, startedAt: Date.now() }), "utf8");
  await mkdir(recoveryPath);
  await writeFile(
    path.join(recoveryPath, "owner.json"),
    JSON.stringify({ pid: deadPid, startedAt: Date.now(), nonce: "dead-mutex" }),
    "utf8",
  );

  const result = await appendNote({
    role: "alice",
    taskSlug: "dead-mutex",
    text: "after dead mutex owner",
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal(result.ok, true);
  await assert.rejects(lstat(lockPath));
  await assert.rejects(lstat(recoveryPath));
  assert.equal((await readFile(path.join(taskDir, "alice.md"), "utf8")).includes("after dead mutex owner"), true);
});

test("does not steal the lock while a live recovery owner holds the mutex (L5)", async (t) => {
  const root = await makeTempRoot(t);
  const taskDir = path.join(root, "docs", "agent-state", "live-mutex");
  await mkdir(taskDir, { recursive: true });
  const lockPath = path.join(taskDir, lockFileName("alice"));
  const recoveryPath = `${lockPath}.recover`;
  const stalePayload = JSON.stringify({ pid: await deadProcessPid(), startedAt: Date.now() });
  await writeFile(lockPath, stalePayload, "utf8");
  await mkdir(recoveryPath);
  await writeFile(
    path.join(recoveryPath, "owner.json"),
    JSON.stringify({ pid: process.pid, startedAt: Date.now(), nonce: "live-mutex" }),
    "utf8",
  );

  try {
    await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: "live-mutex",
          text: "must not write",
          root,
          clock: fixedClock(FIXED_DATE),
        }),
      "LOCK_BUSY",
    );
    assert.equal(await readFile(lockPath, "utf8"), stalePayload);
    assert.equal((await lstat(recoveryPath)).isDirectory(), true);
    await assert.rejects(lstat(path.join(taskDir, "alice.md")));
  } finally {
    await rm(recoveryPath, { recursive: true, force: true });
  }
});

test("destroys idle recovery-guard connections on both transports (D1)", async (t) => {
  const root = await makeTempRoot(t);
  const clock = { monotonicMs: () => performance.now() };

  for (const transport of ["abstract", "tcp"]) {
    const recoveryPath = path.join(
      root,
      `guard-${transport}-${process.pid}-${Date.now()}.lock.recover`,
    );
    const guardOptions =
      transport === "tcp" ? recoveryGuardOptions(recoveryPath, "darwin") : undefined;
    const guard = await acquireRecoveryGuard(recoveryPath, performance.now(), {
      waitMs: LIMITS.lockWaitMs,
      deadline: performance.now() + LIMITS.totalTimeoutMs,
      clock,
      ...(guardOptions ? { guardOptions } : {}),
    });

    const connectOptions = guardOptions ?? recoveryGuardOptions(recoveryPath);
    let client;
    try {
      client = net.connect(connectOptions);
      client.on("error", () => {});
      const closedPromise = once(client, "close").then(() => true);
      const connected = await Promise.race([
        once(client, "connect").then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), LIMITS.lockWaitMs)),
      ]);
      assert.equal(connected, true, `${transport}: guard did not accept the client`);

      const closed = await Promise.race([
        closedPromise,
        new Promise((resolve) => setTimeout(() => resolve(false), LIMITS.lockWaitMs)),
      ]);
      assert.equal(closed, true, `${transport}: guard left the idle socket open`);
    } finally {
      client?.destroy();
      await releaseRecoveryGuard(guard);
    }
  }
});
