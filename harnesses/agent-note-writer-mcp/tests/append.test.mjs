import assert from "node:assert/strict";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { LIMITS, TIME_ZONE } from "../src/constants.mjs";
import {
  appendNote,
  formatEntry,
  formatTimestamp,
  validateTaskSlug,
  validateText,
} from "../src/note-writer.mjs";
import { clockFromDates, expectNoteError, fixedClock, makeTempRoot, readNote } from "./helpers.mjs";

const FIXED_DATE = "2026-11-09T12:34:56.000Z";

test("appends one timestamped line and creates the task directory", async (t) => {
  const root = await makeTempRoot(t);
  const clock = fixedClock(FIXED_DATE);
  const result = await appendNote({
    role: "alice",
    taskSlug: "task-one",
    text: "first entry",
    root,
    clock,
  });

  const stamp = formatTimestamp(new Date(FIXED_DATE), TIME_ZONE);
  assert.equal(result.ok, true);
  assert.equal(result.path, "docs/agent-state/task-one/alice.md");
  assert.equal(result.created, true);
  assert.equal(await readNote(root, "task-one", "alice"), `${stamp} - first entry\n`);
});

test("keeps previous content and adds exactly one newline (TEXT-08)", async (t) => {
  const root = await makeTempRoot(t);
  const noteDir = path.join(root, "docs", "agent-state", "append-two");
  await mkdir(noteDir, { recursive: true });
  await writeFile(path.join(noteDir, "alice.md"), "previous line\n", "utf8");

  await appendNote({
    role: "alice",
    taskSlug: "append-two",
    text: "second line",
    root,
    clock: fixedClock(FIXED_DATE),
  });

  const content = await readNote(root, "append-two", "alice");
  assert.ok(content.startsWith("previous line\n"));
  assert.equal(content.split("\n").filter((line) => line.length > 0).length, 2);
  assert.ok(content.endsWith("second line\n"));
  assert.equal(content.endsWith("\n\n"), false);
});

test("accepts exactly the entry byte limit and rejects one extra byte (SIZE-01/02)", async (t) => {
  const root = await makeTempRoot(t);
  const exact = "a".repeat(LIMITS.maxEntryBytes);
  const result = await appendNote({
    role: "alice",
    taskSlug: "size-exact",
    text: exact,
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal(result.entryBytes, LIMITS.maxEntryBytes);

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "size-over",
        text: "a".repeat(LIMITS.maxEntryBytes + 1),
        root,
        clock: fixedClock(FIXED_DATE),
      }),
    "TEXT_TOO_LARGE",
  );
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "size-over", "alice.md")));
});

test("counts bytes rather than characters at the multibyte boundary (SIZE-03)", async (t) => {
  const root = await makeTempRoot(t);
  const accepted = `${"a".repeat(LIMITS.maxEntryBytes - 2)}é`;
  const rejected = `${"a".repeat(LIMITS.maxEntryBytes - 1)}ç`;

  const result = await appendNote({
    role: "alice",
    taskSlug: "size-multibyte",
    text: accepted,
    root,
    clock: fixedClock(FIXED_DATE),
  });
  assert.equal(result.entryBytes, LIMITS.maxEntryBytes);

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "size-multibyte",
        text: rejected,
        root,
        clock: fixedClock(FIXED_DATE),
      }),
    "TEXT_TOO_LARGE",
  );
});

test("follows a mutated entry limit on both sides (SIZE-04)", async (t) => {
  const root = await makeTempRoot(t);
  const limits = { ...LIMITS, maxEntryBytes: 64, maxFileBytes: 64 * 1024 };

  await appendNote({
    role: "alice",
    taskSlug: "size-mutated",
    text: "b".repeat(limits.maxEntryBytes),
    root,
    clock: fixedClock(FIXED_DATE),
    limits,
  });
  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "size-mutated",
        text: "b".repeat(limits.maxEntryBytes + 1),
        root,
        clock: fixedClock(FIXED_DATE),
        limits,
      }),
    "TEXT_TOO_LARGE",
  );
});

test("rejects non-string, empty, control and invalid UTF-8 text (TEXT-01/04/05/06)", async (t) => {
  const root = await makeTempRoot(t);
  for (const invalid of [42, null, [], {}]) {
    await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: "invalid-text",
          text: invalid,
          root,
          clock: fixedClock(FIXED_DATE),
        }),
      "TEXT_INVALID",
    );
  }
  await expectNoteError(
    () => appendNote({ role: "alice", taskSlug: "invalid-text", text: "", root }),
    "TEXT_EMPTY",
  );
  for (const control of ["line\nbreak", "carriage\rreturn", "nul\u0000byte", "bell\u0007", "\u0085next"]) {
    await expectNoteError(
      () => appendNote({ role: "alice", taskSlug: "invalid-text", text: control, root }),
      "TEXT_CONTROL",
    );
  }
  await expectNoteError(
    () => appendNote({ role: "alice", taskSlug: "invalid-text", text: "lone\uD800surrogate", root }),
    "TEXT_ENCODING",
  );
  await expectNoteError(
    () => appendNote({ role: "alice", taskSlug: "invalid-text", text: "replacement\uFFFDchar", root }),
    "TEXT_ENCODING",
  );
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "invalid-text", "alice.md")));
});

test("accepts 1 and 64 byte slugs and rejects empty or 65 byte slugs (AC-09)", async (t) => {
  const root = await makeTempRoot(t);
  const shortest = "x";
  const longest = "a".repeat(64);

  for (const slug of [shortest, longest]) {
    const result = await appendNote({
      role: "alice",
      taskSlug: slug,
      text: "slug boundary",
      root,
      clock: fixedClock(FIXED_DATE),
    });
    assert.equal(result.taskSlug, slug);
  }

  assert.throws(() => validateTaskSlug(""));
  assert.throws(() => validateTaskSlug("a".repeat(65)));
  assert.throws(() => validateTaskSlug("Task"));
  assert.throws(() => validateTaskSlug("tarefa-ç"));
  assert.throws(() => validateTaskSlug(".."));
  assert.throws(() => validateTaskSlug("."));
  assert.throws(() => validateTaskSlug("../escape"));
  assert.throws(() => validateTaskSlug("..\\escape"));
  assert.throws(() => validateTaskSlug("with space"));
  assert.throws(() => validateTaskSlug("line\nbreak"));
  assert.throws(() => validateTaskSlug("-leading"));
  assert.throws(() => validateTaskSlug("trailing-"));
});

test("accepts exactly the file byte limit and rejects one extra byte (FILE-01/02)", async (t) => {
  const root = await makeTempRoot(t);
  const clock = fixedClock(FIXED_DATE);
  const stamp = formatTimestamp(new Date(FIXED_DATE), TIME_ZONE);
  const text = "file-limit";
  const lineBytes = Buffer.byteLength(formatEntry(stamp, text), "utf8");

  for (const [slug, padding, shouldSucceed] of [
    ["file-exact", LIMITS.maxFileBytes - lineBytes, true],
    ["file-over", LIMITS.maxFileBytes - lineBytes + 1, false],
  ]) {
    const noteDir = path.join(root, "docs", "agent-state", slug);
    await mkdir(noteDir, { recursive: true });
    await writeFile(path.join(noteDir, "alice.md"), "p".repeat(padding), "utf8");

    if (shouldSucceed) {
      const result = await appendNote({ role: "alice", taskSlug: slug, text, root, clock });
      assert.equal(result.fileBytes, LIMITS.maxFileBytes);
      assert.equal((await readFile(path.join(noteDir, "alice.md"))).length, LIMITS.maxFileBytes);
    } else {
      await expectNoteError(
        () => appendNote({ role: "alice", taskSlug: slug, text, root, clock }),
        "FILE_TOO_LARGE",
      );
      assert.equal((await readFile(path.join(noteDir, "alice.md"))).length, padding);
    }
  }
});

test("follows a mutated file limit on both sides (FILE-01/02 mutation)", async (t) => {
  const root = await makeTempRoot(t);
  const clock = fixedClock(FIXED_DATE);
  const stamp = formatTimestamp(new Date(FIXED_DATE), TIME_ZONE);
  const text = "mutated-file";
  const limits = {
    ...LIMITS,
    maxFileBytes: Buffer.byteLength(formatEntry(stamp, text), "utf8"),
  };

  const result = await appendNote({ role: "alice", taskSlug: "file-mutation", text, root, clock, limits });
  assert.equal(result.fileBytes, limits.maxFileBytes);

  await expectNoteError(
    () => appendNote({ role: "alice", taskSlug: "file-mutation", text: "x", root, clock, limits }),
    "FILE_TOO_LARGE",
  );
});

test("rejects an existing note already above the file limit without truncating (FILE-03)", async (t) => {
  const root = await makeTempRoot(t);
  const noteDir = path.join(root, "docs", "agent-state", "file-existing");
  await mkdir(noteDir, { recursive: true });
  const oversized = "q".repeat(LIMITS.maxFileBytes + 1);
  await writeFile(path.join(noteDir, "alice.md"), oversized, "utf8");

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "file-existing",
        text: "small",
        root,
        clock: fixedClock(FIXED_DATE),
      }),
    "FILE_TOO_LARGE",
  );
  assert.equal((await readFile(path.join(noteDir, "alice.md"), "utf8")).length, oversized.length);
});

test("formats the server timestamp in America/Fortaleza without seconds (TIME-04)", async (t) => {
  const root = await makeTempRoot(t);
  const originalTz = process.env.TZ;
  process.env.TZ = "Asia/Tokyo";
  try {
    await appendNote({
      role: "alice",
      taskSlug: "time-format",
      text: "timezone",
      root,
      clock: fixedClock(FIXED_DATE),
    });
  } finally {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  }

  const content = await readNote(root, "time-format", "alice");
  assert.match(content, /^2026-11-09 09:34 -03:00 - timezone\n$/);
  assert.doesNotMatch(content, /:\d{2}:\d{2} -/);
});

test("uses minute resolution, allows repeats and never goes backwards (TIME-03)", async (t) => {
  const root = await makeTempRoot(t);
  const clock = clockFromDates([
    "2026-11-09T12:34:01.000Z",
    "2026-11-09T12:34:59.000Z",
    "2026-11-09T12:35:00.000Z",
  ]);

  for (const text of ["same minute one", "same minute two", "next minute"]) {
    await appendNote({ role: "alice", taskSlug: "time-order", text, root, clock });
  }

  const lines = (await readNote(root, "time-order", "alice")).trimEnd().split("\n");
  const stamps = lines.map((line) => line.slice(0, "YYYY-MM-DD HH:MM ±HH:MM".length));
  assert.deepEqual(stamps, [
    "2026-11-09 09:34 -03:00",
    "2026-11-09 09:34 -03:00",
    "2026-11-09 09:35 -03:00",
  ]);
  for (const stamp of stamps) {
    assert.match(stamp, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/);
  }
});

test("fails closed on an invalid server clock without appending (TIME-02)", async (t) => {
  const root = await makeTempRoot(t);
  const invalidClock = {
    now: () => new Date(Number.NaN),
    monotonicMs: () => 0,
  };

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "clock-invalid",
        text: "no fabricated time",
        root,
        clock: invalidClock,
      }),
    "CLOCK_INVALID",
  );
  await assert.rejects(lstat(path.join(root, "docs", "agent-state", "clock-invalid", "alice.md")));
});

test("validateText reports byte counts against an injected limit", () => {
  assert.equal(validateText("abc", 3), 3);
  assert.throws(() => validateText("abcd", 3), /at most 3/);
});
