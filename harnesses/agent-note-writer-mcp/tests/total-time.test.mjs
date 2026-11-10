import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { LIMITS } from "../src/constants.mjs";
import { appendNote } from "../src/note-writer.mjs";
import { expectNoteError, fixedClock, makeTempRoot } from "./helpers.mjs";

function notePath(root, slug, role = "alice") {
  return path.join(root, "docs", "agent-state", slug, `${role}.md`);
}

test("normal operation completes inside the total time budget (TOTAL-01)", async (t) => {
  const root = await makeTempRoot(t);
  const result = await appendNote({
    role: "alice",
    taskSlug: "total-normal",
    text: "fast",
    root,
    clock: fixedClock(),
  });
  assert.equal(result.ok, true);
  assert.ok(result.elapsedMs < LIMITS.totalTimeoutMs);
});

test("a clock that jumps past the deadline before writing fails closed (TOTAL-02)", async (t) => {
  const root = await makeTempRoot(t);
  let calls = 0;
  const jumpingClock = {
    now: () => new Date("2026-11-09T12:34:56.000Z"),
    monotonicMs: () => {
      calls += 1;
      return performance.now() + calls * LIMITS.totalTimeoutMs;
    },
  };

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "total-jump",
        text: "too slow",
        root,
        clock: jumpingClock,
      }),
    "TIMEOUT",
  );
  await assert.rejects(lstat(notePath(root, "total-jump")));
});

test("a deadline breach after the write rolls the entry back (TOTAL-03)", async (t) => {
  const root = await makeTempRoot(t);
  const target = notePath(root, "total-rollback");
  const slowFileClock = {
    now: () => new Date("2026-11-09T12:34:56.000Z"),
    monotonicMs: () =>
      performance.now() +
      (existsSync(target) && statSync(target).size > 0 ? LIMITS.totalTimeoutMs * 4 : 0),
  };

  const error = await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "total-rollback",
        text: "rolled back",
        root,
        clock: slowFileClock,
      }),
    "TIMEOUT",
  );
  assert.match(error.message, /after writing/);

  assert.equal(existsSync(target), true);
  assert.equal((await readFile(target, "utf8")).length, 0);
});
