import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { NoteError } from "../src/note-writer.mjs";

export async function makeTempRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-note-writer-"));
  if (t) {
    t.after(async () => {
      await rm(root, { recursive: true, force: true });
    });
  }
  return root;
}

export function fixedClock(iso = "2026-11-09T12:34:56.000Z") {
  return {
    now: () => new Date(iso),
    monotonicMs: () => performance.now(),
  };
}

export function clockFromDates(dates) {
  let index = 0;
  return {
    now: () => {
      const date = dates[Math.min(index, dates.length - 1)];
      index += 1;
      return new Date(date);
    },
    monotonicMs: () => performance.now(),
  };
}

export async function readNote(root, slug, role) {
  return readFile(path.join(root, "docs", "agent-state", slug, `${role}.md`), "utf8");
}

export async function expectNoteError(action, code) {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof NoteError)) {
      throw error;
    }
    if (error.code !== code) {
      throw new Error(`Expected ${code}, received ${error.code}: ${error.message}`);
    }
    return error;
  }
  throw new Error(`Expected ${code}, but the operation succeeded.`);
}

export function parseErrorPayload(result) {
  return JSON.parse(result.content[0].text).error;
}
