import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import net from "node:net";
import { open, lstat, mkdir, readFile, unlink, realpath, readlink, rename, rm } from "node:fs/promises";
import * as fsConstants from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  LIMITS,
  ROLE_PATTERN,
  SLUG_MAX_BYTES,
  SLUG_PATTERN,
  TIME_ZONE,
  lockFileName,
} from "./constants.mjs";

const NOTE_ROOT_SEGMENTS = ["docs", "agent-state"];

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;

export class NoteError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "NoteError";
    this.code = code;
    this.details = details;
  }
}

export function createDefaultClock() {
  return {
    now: () => new Date(),
    monotonicMs: () => performance.now(),
  };
}

export const defaultClock = createDefaultClock();

function fail(code, message, details) {
  throw new NoteError(code, message, details);
}

export function validateRole(role) {
  if (typeof role !== "string" || !ROLE_PATTERN.test(role)) {
    fail("ROLE_INVALID", "Role must match [a-z][a-z0-9-]{0,31}.");
  }
  return role;
}

export function validateTaskSlug(taskSlug) {
  if (typeof taskSlug !== "string") {
    fail("SLUG_INVALID", "task_slug must be a string.");
  }
  const bytes = Buffer.byteLength(taskSlug, "utf8");
  if (bytes < 1 || bytes > SLUG_MAX_BYTES) {
    fail("SLUG_INVALID", `task_slug must be 1-${SLUG_MAX_BYTES} bytes.`);
  }
  if (!SLUG_PATTERN.test(taskSlug)) {
    fail(
      "SLUG_INVALID",
      "task_slug must be a single lowercase ASCII segment ([a-z0-9] with internal hyphens).",
    );
  }
  return taskSlug;
}

export function validateText(text, maxEntryBytes = LIMITS.maxEntryBytes) {
  if (typeof text !== "string") {
    fail("TEXT_INVALID", "text must be a string.");
  }
  if (text.length === 0) {
    fail("TEXT_EMPTY", "text must not be empty.");
  }
  if (CONTROL_CHARACTERS.test(text)) {
    fail(
      "TEXT_CONTROL",
      "text must be a single printable line; control characters and newlines are rejected.",
    );
  }
  if (Buffer.from(text, "utf8").toString("utf8") !== text) {
    fail("TEXT_ENCODING", "text must be valid UTF-8 without lone surrogates.");
  }
  if (text.includes("\uFFFD")) {
    fail(
      "TEXT_ENCODING",
      "text must not contain the U+FFFD replacement character; invalid UTF-8 is rejected instead of replaced.",
    );
  }
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > maxEntryBytes) {
    fail("TEXT_TOO_LARGE", `text must be at most ${maxEntryBytes} UTF-8 bytes.`, {
      bytes,
      maxEntryBytes,
    });
  }
  return bytes;
}

const formatterCache = new Map();

function formatterFor(timeZone) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function formatTimestamp(date, timeZone = TIME_ZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    fail("CLOCK_INVALID", "Server clock did not return a valid date.");
  }
  let parts;
  try {
    parts = formatterFor(timeZone).formatToParts(date);
  } catch (error) {
    fail("CLOCK_INVALID", `Cannot format timestamp in ${timeZone}.`, {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const offset = normalizeOffset(values.timeZoneName);
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute} ${offset}`;
}

function normalizeOffset(rawOffset) {
  if (typeof rawOffset !== "string") {
    fail("CLOCK_INVALID", "Timestamp offset is unavailable.");
  }
  if (rawOffset === "GMT" || rawOffset === "UTC") {
    return "+00:00";
  }
  const match = /^GMT([+-]\d{2}:\d{2})$/.exec(rawOffset);
  if (!match) {
    fail("CLOCK_INVALID", `Unsupported timestamp offset ${rawOffset}.`);
  }
  return match[1];
}

export function formatEntry(timestamp, text) {
  return `${timestamp} - ${text}\n`;
}

const STAMP_PARTS = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) ([+-])(\d{2}):(\d{2})$/;
const STAMP_SHAPE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/;

function stampToMinutes(stamp) {
  const match = STAMP_PARTS.exec(stamp);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, sign, offsetHour, offsetMinute] = match;
  const offsetHours = Number(offsetHour);
  const offsetMinutes = Number(offsetMinute);
  if (offsetMinutes > 59 || offsetHours > 14 || offsetHours * 60 + offsetMinutes > 14 * 60) {
    return null;
  }
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(Number(hour), Number(minute), 0, 0);
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCHours() !== Number(hour) ||
    date.getUTCMinutes() !== Number(minute)
  ) {
    return null;
  }
  const offset = (offsetHours * 60 + offsetMinutes) * (sign === "-" ? -1 : 1);
  return date.getTime() / 60000 - offset;
}

function lastRecordedStamp(content) {
  const lines = content.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const stamp = line.slice(0, 23);
    if (!STAMP_SHAPE.test(stamp)) {
      continue;
    }
    const minutes = stampToMinutes(stamp);
    if (minutes === null) {
      fail("NOTE_TIMESTAMP_INVALID", "Note contains an invalid timestamp anchor.", { stamp });
    }
    return { stamp, minutes };
  }
  return null;
}

function readMonotonic(clock) {
  const value = clock.monotonicMs();
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("CLOCK_INVALID", "Monotonic clock returned an invalid value.");
  }
  return value;
}

function remainingMs(deadline, clock) {
  return deadline - readMonotonic(clock);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 25))));
}

export async function assertWorkspaceRoot(root) {
  if (typeof root !== "string" || root.length === 0 || !path.isAbsolute(root)) {
    fail("ROOT_INVALID", "Workspace root must be an absolute path.");
  }
  const resolved = path.resolve(root);
  let stats;
  try {
    stats = await lstat(resolved);
  } catch (error) {
    fail("ROOT_INVALID", "Workspace root does not exist.", {
      reason: error.code ?? "unknown",
    });
  }
  if (stats.isSymbolicLink()) {
    fail("ROOT_SYMLINK", "Workspace root must not be a symbolic link.");
  }
  if (!stats.isDirectory()) {
    fail("ROOT_INVALID", "Workspace root must be a directory.");
  }
  return resolved;
}

async function ensureDirectory(basePath, segments) {
  let current = basePath;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stats;
    try {
      stats = await lstat(current);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      try {
        await mkdir(current, { mode: 0o755 });
      } catch (mkdirError) {
        if (mkdirError.code === "EACCES" || mkdirError.code === "EPERM") {
          fail("ROOT_NOT_WRITABLE", `Workspace does not allow creating ${segment}.`, {
            reason: mkdirError.code,
          });
        }
        if (mkdirError.code !== "EEXIST") {
          fail("FS_ERROR", `Cannot create ${segment}.`, {
            reason: mkdirError.code ?? "unknown",
          });
        }
      }
      stats = await lstat(current);
    }
    if (stats.isSymbolicLink()) {
      fail("PATH_SYMLINK", `Refusing to follow symbolic link at ${segment}.`);
    }
    if (!stats.isDirectory()) {
      fail("PATH_INVALID", `${segment} must be a directory.`);
    }
  }
  return current;
}

async function readLockPayload(lockPath) {
  try {
    const payload = JSON.parse(await readFile(lockPath, "utf8"));
    if (payload && Number.isInteger(payload.pid) && payload.pid > 0) {
      return payload;
    }
  } catch {
    return null;
  }
  return null;
}

function lockOwnerAlive(payload) {
  try {
    process.kill(payload.pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

function sameLockPayload(left, right) {
  return (
    Boolean(left) &&
    Boolean(right) &&
    left.pid === right.pid &&
    left.startedAt === right.startedAt &&
    left.nonce === right.nonce
  );
}

async function lockAgeExceeds(lockPath, lockStaleMs) {
  try {
    const stats = await lstat(lockPath);
    return Date.now() - stats.mtimeMs > lockStaleMs;
  } catch {
    return false;
  }
}

async function createLockFile(lockPath, payload) {
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      return false;
    }
    fail("LOCK_ERROR", "Cannot create lock file.", { reason: error.code ?? "unknown" });
  }
  try {
    await handle.writeFile(JSON.stringify(payload));
    await handle.sync();
    return true;
  } catch (error) {
    await handle.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
    fail("LOCK_ERROR", "Cannot initialize lock file.", { reason: error.code ?? "unknown" });
  } finally {
    await handle.close().catch(() => {});
  }
}

async function createCandidateLock(lockPath, payload) {
  const candidate = `${lockPath}.${payload.nonce}.tmp`;
  let handle;
  handle = await open(candidate, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(payload));
    await handle.sync();
    return candidate;
  } catch (error) {
    await handle.close().catch(() => {});
    await unlink(candidate).catch(() => {});
    fail("LOCK_ERROR", "Cannot initialize lock candidate.", { reason: error.code ?? "unknown" });
  } finally {
    await handle.close().catch(() => {});
  }
}

export function recoveryGuardOptions(recoveryPath, platform = process.platform) {
  const digest = createHash("sha256").update(path.resolve(recoveryPath)).digest();
  if (platform === "linux") {
    return { path: `\0agent-note-writer-${digest.toString("hex").slice(0, 40)}` };
  }
  return { host: "127.0.0.1", port: 30000 + (digest.readUInt16BE(0) % 20000) };
}

/**
 * Kernel-backed mutex for the recovery-mutex mutation window. On Linux it uses
 * an abstract Unix socket: bind is atomic and the kernel releases it when the
 * process exits, so no stale guard can exist. On other platforms it falls back
 * to a localhost port derived from the lock path.
 */
export async function acquireRecoveryGuard(
  recoveryPath,
  waitStartedAt,
  { waitMs, deadline, clock, guardOptions = undefined },
) {
  const options = guardOptions ?? recoveryGuardOptions(recoveryPath);
  for (;;) {
    const server = net.createServer();
    server.on("connection", (socket) => socket.destroy());
    server.unref();
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(options);
      });
      return server;
    } catch (error) {
      try {
        server.close();
      } catch {
        // Ignore close errors on a listener that never started.
      }
      if (error.code !== "EADDRINUSE") {
        fail("LOCK_ERROR", "Cannot open the recovery guard.", {
          reason: error.code ?? "unknown",
        });
      }
      const totalRemaining = remainingMs(deadline, clock);
      if (totalRemaining <= 0) {
        fail("TIMEOUT", "Operation exceeded its total time budget while waiting for lock recovery.");
      }
      const waited = readMonotonic(clock) - waitStartedAt;
      if (waited >= waitMs) {
        fail("LOCK_BUSY", "Note lock recovery is in progress.", { waitMs });
      }
      await sleep(Math.min(10, waitMs - waited, totalRemaining));
    }
  }
}

export async function releaseRecoveryGuard(server) {
  if (!server) {
    return;
  }
  try {
    server.close();
  } catch {
    // A listener that already stopped needs no further cleanup.
  }
}

async function withRecoveryMutex(recoveryPath, waitStartedAt, options, action) {
  const { waitMs, lockStaleMs, deadline, clock } = options;
  const ownerPath = path.join(recoveryPath, "owner.json");
  const payload = { pid: process.pid, startedAt: Date.now(), nonce: randomUUID() };
  let guard = null;

  try {
    for (;;) {
      guard = await acquireRecoveryGuard(recoveryPath, waitStartedAt, options);
      let created = false;
      try {
        try {
          await mkdir(recoveryPath, { mode: 0o700 });
          created = true;
        } catch (error) {
          if (error.code !== "EEXIST") {
            fail("LOCK_ERROR", "Cannot create the recovery mutex.", {
              reason: error.code ?? "unknown",
            });
          }
          const owner = await readLockPayload(ownerPath);
          if (owner && !lockOwnerAlive(owner)) {
            await options.hooks?.afterStaleCheck?.({ recoveryPath, owner });
            await rm(recoveryPath, { recursive: true, force: true }).catch(() => {});
            continue;
          }
          if (!owner && (await lockAgeExceeds(recoveryPath, lockStaleMs))) {
            await options.hooks?.afterStaleCheck?.({ recoveryPath, owner: null });
            await rm(recoveryPath, { recursive: true, force: true }).catch(() => {});
            continue;
          }
        }
      } finally {
        if (!created) {
          await releaseRecoveryGuard(guard);
          guard = null;
        }
      }

      if (created) {
        break;
      }
      const totalRemaining = remainingMs(deadline, clock);
      if (totalRemaining <= 0) {
        fail("TIMEOUT", "Operation exceeded its total time budget while waiting for lock recovery.");
      }
      const waited = readMonotonic(clock) - waitStartedAt;
      if (waited >= waitMs) {
        fail("LOCK_BUSY", "Note lock recovery is in progress.", { waitMs });
      }
      await sleep(Math.min(10, waitMs - waited, totalRemaining));
    }

    try {
      const owned = await createLockFile(ownerPath, payload);
      if (!owned) {
        fail("LOCK_ERROR", "Recovery mutex owner file already exists.");
      }
    } catch (error) {
      await rm(recoveryPath, { recursive: true, force: true }).catch(() => {});
      throw error;
    } finally {
      await releaseRecoveryGuard(guard);
      guard = null;
    }

    try {
      return await action();
    } finally {
      const owner = await readLockPayload(ownerPath);
      if (owner && owner.nonce === payload.nonce) {
        await rm(recoveryPath, { recursive: true, force: true }).catch(() => {});
      }
    }
  } finally {
    if (guard) {
      await releaseRecoveryGuard(guard).catch(() => {});
    }
  }
}

async function takeOverStaleLock(lockPath, payload, observed, waitStartedAt, options) {
  const recoveryPath = `${lockPath}.recover`;
  return withRecoveryMutex(recoveryPath, waitStartedAt, options, async () => {
    const current = await readLockPayload(lockPath);
    if (current) {
      if (lockOwnerAlive(current)) {
        return false;
      }
      if (observed && !sameLockPayload(current, observed)) {
        return false;
      }
    } else {
      if (observed) {
        return false;
      }
      if (!(await lockAgeExceeds(lockPath, options.lockStaleMs))) {
        return false;
      }
    }

    const candidate = await createCandidateLock(lockPath, payload);
    try {
      await rename(candidate, lockPath);
    } catch (error) {
      await unlink(candidate).catch(() => {});
      fail("LOCK_ERROR", "Cannot take over the stale lock.", { reason: error.code ?? "unknown" });
    }

    const verified = await readLockPayload(lockPath);
    if (!verified || verified.nonce !== payload.nonce) {
      fail("LOCK_ERROR", "Lock ownership verification failed after takeover.");
    }
    return true;
  });
}

export async function acquireLock(lockPath, { waitMs, lockStaleMs, deadline, clock, hooks }) {
  const startedAt = readMonotonic(clock);
  const payload = { pid: process.pid, startedAt: Date.now(), nonce: randomUUID() };
  for (;;) {
    if (await createLockFile(lockPath, payload)) {
      return payload;
    }

    const current = await readLockPayload(lockPath);
    if (current === null) {
      let exists = true;
      try {
        await lstat(lockPath);
      } catch (error) {
        if (error.code === "ENOENT") {
          exists = false;
        }
      }
      if (!exists) {
        continue;
      }
      if (await lockAgeExceeds(lockPath, lockStaleMs)) {
        const took = await takeOverStaleLock(lockPath, payload, null, startedAt, {
          waitMs,
          lockStaleMs,
          deadline,
          clock,
          hooks,
        });
        if (took) {
          return payload;
        }
      }
    } else if (!lockOwnerAlive(current)) {
      const took = await takeOverStaleLock(lockPath, payload, current, startedAt, {
        waitMs,
        lockStaleMs,
        deadline,
        clock,
        hooks,
      });
      if (took) {
        return payload;
      }
    }

    const totalRemaining = remainingMs(deadline, clock);
    if (totalRemaining <= 0) {
      fail("TIMEOUT", "Operation exceeded its total time budget while waiting for the lock.");
    }
    const waited = readMonotonic(clock) - startedAt;
    if (waited >= waitMs) {
      fail("LOCK_BUSY", "Note is locked by another writer.", { waitMs });
    }
    await sleep(Math.min(10, waitMs - waited, totalRemaining));
  }
}

export async function releaseLock(lockPath, nonce = null) {
  if (nonce) {
    const current = await readLockPayload(lockPath);
    if (!current || current.nonce !== nonce) {
      return;
    }
  }
  await unlink(lockPath).catch(() => {});
}

async function openedPathInsideRoot(handle, rootPath) {
  let procPath;
  try {
    procPath = await readlink(`/proc/self/fd/${handle.fd}`);
  } catch {
    return true;
  }
  let rootReal;
  try {
    rootReal = await realpath(rootPath);
  } catch {
    return true;
  }
  return procPath === rootReal || procPath.startsWith(`${rootReal}${path.sep}`);
}

async function syncDirectory(directoryPath) {
  let handle;
  try {
    handle = await open(directoryPath, fsConstants.constants.O_RDONLY | (fsConstants.constants.O_DIRECTORY ?? 0));
    await handle.sync();
    return true;
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => {});
  }
}

/**
 * Append one timestamped single-line entry to
 * `<root>/docs/agent-state/<taskSlug>/<role>.md`.
 *
 * Returns a result object on success and throws `NoteError` on failure. The
 * role comes from the caller's trusted configuration, never from the request.
 */
export async function appendNote({
  role,
  taskSlug,
  text,
  root,
  limits = LIMITS,
  clock = defaultClock,
  timeZone = TIME_ZONE,
  hooks = undefined,
}) {
  const startedAt = readMonotonic(clock);
  const deadline = startedAt + limits.totalTimeoutMs;

  validateRole(role);
  validateTaskSlug(taskSlug);
  const entryBytes = validateText(text, limits.maxEntryBytes);

  const rootPath = await assertWorkspaceRoot(root);
  const taskDir = await ensureDirectory(rootPath, [...NOTE_ROOT_SEGMENTS, taskSlug]);
  const notePath = path.join(taskDir, `${role}.md`);
  const relativePath = path.posix.join(...NOTE_ROOT_SEGMENTS, taskSlug, `${role}.md`);
  const lockPath = path.join(taskDir, lockFileName(role));

  const lock = await acquireLock(lockPath, {
    waitMs: limits.lockWaitMs,
    lockStaleMs: limits.lockStaleMs,
    deadline,
    clock,
    hooks,
  });

  let handle;
  let created = false;
  let originalSize = 0;
  try {
    if (remainingMs(deadline, clock) <= 0) {
      fail("TIMEOUT", "Operation exceeded its total time budget before writing.");
    }

    const timestamp = formatTimestamp(clock.now(), timeZone);

    let existing = null;
    try {
      existing = await lstat(notePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        fail("FS_ERROR", "Cannot inspect note file.", { reason: error.code ?? "unknown" });
      }
    }
    if (existing?.isSymbolicLink()) {
      fail("NOTE_SYMLINK", "Refusing to write through a symbolic link.");
    }

    try {
      handle = await open(
        notePath,
        fsConstants.constants.O_RDWR |
          fsConstants.constants.O_APPEND |
          fsConstants.constants.O_CREAT |
          (fsConstants.constants.O_NOFOLLOW ?? 0),
        0o644,
      );
    } catch (error) {
      if (error.code === "ELOOP") {
        fail("NOTE_SYMLINK", "Refusing to write through a symbolic link.");
      }
      if (error.code === "EACCES" || error.code === "EPERM") {
        fail("ROOT_NOT_WRITABLE", "Workspace does not allow writing the note.", {
          reason: error.code,
        });
      }
      fail("FS_ERROR", "Cannot open the note file.", { reason: error.code ?? "unknown" });
    }

    if (!(await openedPathInsideRoot(handle, rootPath))) {
      await handle.close();
      handle = undefined;
      fail("PATH_OUTSIDE_ROOT", "Opened note path resolves outside the workspace root.");
    }

    const openedStats = await handle.stat();
    if (!openedStats.isFile()) {
      fail("NOTE_NOT_REGULAR", "Note path is not a regular file.");
    }
    if (openedStats.nlink > 1) {
      fail("NOTE_HARDLINK", "Refusing to append to a hard-linked note file.");
    }
    originalSize = openedStats.size;
    created = originalSize === 0 && existing === null;
    if (originalSize > limits.maxFileBytes) {
      fail("FILE_TOO_LARGE", "Note already exceeds the file size limit.", {
        size: originalSize,
        maxFileBytes: limits.maxFileBytes,
      });
    }

    let content = "";
    if (originalSize > 0) {
      try {
        content = await handle.readFile("utf8");
      } catch (error) {
        fail("FS_ERROR", "Cannot read the note file.", { reason: error.code ?? "unknown" });
      }
    }
    const lastEntry = lastRecordedStamp(content);
    const timestampMinutes = stampToMinutes(timestamp);
    if (timestampMinutes === null) {
      fail("CLOCK_INVALID", "Server timestamp could not be parsed.");
    }
    if (lastEntry && timestampMinutes < lastEntry.minutes) {
      fail(
        "CLOCK_REGRESSION",
        "Server clock would produce a timestamp earlier than the last recorded entry.",
        { timestamp, lastTimestamp: lastEntry.stamp },
      );
    }

    const line = formatEntry(timestamp, text);
    const lineBytes = Buffer.byteLength(line, "utf8");
    if (originalSize + lineBytes > limits.maxFileBytes) {
      fail("FILE_TOO_LARGE", "Appending would exceed the file size limit.", {
        size: originalSize,
        lineBytes,
        maxFileBytes: limits.maxFileBytes,
      });
    }

    if (remainingMs(deadline, clock) <= 0) {
      fail("TIMEOUT", "Operation exceeded its total time budget before writing.");
    }

    const buffer = Buffer.from(line, "utf8");
    let written = 0;
    try {
      while (written < buffer.length) {
        const { bytesWritten } = await handle.write(buffer, written, buffer.length - written, null);
        if (bytesWritten <= 0) {
          throw Object.assign(new Error("No progress while writing."), { code: "EIO" });
        }
        written += bytesWritten;
      }
      await handle.sync();
    } catch (error) {
      await handle.truncate(originalSize).catch(() => {});
      await handle.sync().catch(() => {});
      fail("WRITE_FAILED", "Failed to append the note entry.", {
        reason: error.code ?? "unknown",
      });
    }

    if (remainingMs(deadline, clock) <= 0) {
      await handle.truncate(originalSize).catch(() => {});
      await handle.sync().catch(() => {});
      fail("TIMEOUT", "Operation exceeded its total time budget after writing; entry rolled back.");
    }

    await handle.close();
    handle = undefined;
    const directorySynced = created ? await syncDirectory(taskDir) : true;

    return {
      ok: true,
      role,
      taskSlug,
      path: relativePath,
      timestamp,
      entryBytes,
      lineBytes,
      fileBytes: originalSize + lineBytes,
      created,
      elapsedMs: Math.round(readMonotonic(clock) - startedAt),
      directorySynced,
    };
  } finally {
    await handle?.close().catch(() => {});
    await releaseLock(lockPath, lock.nonce);
  }
}
