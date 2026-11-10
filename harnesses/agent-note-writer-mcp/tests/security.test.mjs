import assert from "node:assert/strict";
import { chmod, link, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { appendNote } from "../src/note-writer.mjs";
import { expectNoteError, fixedClock, makeTempRoot, readNote } from "./helpers.mjs";

test("rejects a missing, relative or non-directory workspace root (ROOT-01/03)", async (t) => {
  const root = await makeTempRoot(t);
  const missing = path.join(root, "missing-root");
  await expectNoteError(
    () => appendNote({ role: "alice", taskSlug: "root", text: "x", root: missing }),
    "ROOT_INVALID",
  );
  await expectNoteError(
    () => appendNote({ role: "alice", taskSlug: "root", text: "x", root: "relative/path" }),
    "ROOT_INVALID",
  );

  const filePath = path.join(root, "file-root");
  await writeFile(filePath, "not a directory", "utf8");
  await expectNoteError(
    () => appendNote({ role: "alice", taskSlug: "root", text: "x", root: filePath }),
    "ROOT_INVALID",
  );
});

test("rejects a symlinked workspace root (ROOT-02)", async (t) => {
  const root = await makeTempRoot(t);
  const real = path.join(root, "real");
  await mkdir(real);
  const linked = path.join(root, "linked");
  await symlink(real, linked);

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "root-symlink",
        text: "x",
        root: linked,
        clock: fixedClock(),
      }),
    "ROOT_SYMLINK",
  );
  await assert.rejects(stat(path.join(real, "docs", "agent-state", "root-symlink", "alice.md")));
});

test("fails closed when the workspace is not writable (ROOT-04)", async (t) => {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root: permission bits are not enforced");
    return;
  }
  const root = await makeTempRoot(t);
  await chmod(root, 0o500);
  try {
    const error = await expectNoteError(
      () =>
        appendNote({
          role: "alice",
          taskSlug: "readonly",
          text: "x",
          root,
          clock: fixedClock(),
        }),
      "ROOT_NOT_WRITABLE",
    );
    assert.equal(error.code, "ROOT_NOT_WRITABLE");
  } finally {
    await chmod(root, 0o700);
  }
});

async function prepareDocs(root) {
  const noteDir = path.join(root, "docs", "agent-state", "task-sym");
  await mkdir(noteDir, { recursive: true });
  return noteDir;
}

test("rejects a symlinked docs component (SYM-03)", async (t) => {
  const root = await makeTempRoot(t);
  const outside = await makeTempRoot(t);
  await symlink(path.join(outside, "docs-target"), path.join(root, "docs")).catch(async () => {
    await mkdir(path.join(outside, "docs-target"), { recursive: true });
    await symlink(path.join(outside, "docs-target"), path.join(root, "docs"));
  });

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "task-sym",
        text: "escape",
        root,
        clock: fixedClock(),
      }),
    "PATH_SYMLINK",
  );
  await assert.rejects(stat(path.join(outside, "docs-target", "agent-state")));
});

test("rejects a symlinked agent-state component (SYM-04)", async (t) => {
  const root = await makeTempRoot(t);
  const outside = await makeTempRoot(t);
  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(outside, "agent-state-target"), { recursive: true });
  await symlink(path.join(outside, "agent-state-target"), path.join(root, "docs", "agent-state"));

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "task-sym",
        text: "escape",
        root,
        clock: fixedClock(),
      }),
    "PATH_SYMLINK",
  );
  await assert.rejects(stat(path.join(outside, "agent-state-target", "task-sym")));
});

test("rejects a symlinked task directory (SYM-01)", async (t) => {
  const root = await makeTempRoot(t);
  const outside = await makeTempRoot(t);
  const noteRoot = path.join(root, "docs", "agent-state");
  await mkdir(noteRoot, { recursive: true });
  const outsideTask = path.join(outside, "task");
  await mkdir(outsideTask, { recursive: true });
  await symlink(outsideTask, path.join(noteRoot, "linked-task"));

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "linked-task",
        text: "escape",
        root,
        clock: fixedClock(),
      }),
    "PATH_SYMLINK",
  );
  await assert.rejects(stat(path.join(outsideTask, "alice.md")));
});

test("rejects a symlinked note and leaves the target untouched (SYM-02/07/08)", async (t) => {
  const root = await makeTempRoot(t);
  const outside = await makeTempRoot(t);
  const sentinel = path.join(outside, "sentinel.txt");
  await writeFile(sentinel, "SENTINEL", "utf8");
  const noteDir = await prepareDocs(root);

  await symlink(sentinel, path.join(noteDir, "alice.md"));
  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "task-sym",
        text: "escape",
        root,
        clock: fixedClock(),
      }),
    "NOTE_SYMLINK",
  );
  assert.equal(await readFile(sentinel, "utf8"), "SENTINEL");

  const danglingDir = path.join(root, "docs", "agent-state", "dangling");
  await mkdir(danglingDir, { recursive: true });
  await symlink(path.join(outside, "does-not-exist"), path.join(danglingDir, "alice.md"));
  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "dangling",
        text: "escape",
        root,
        clock: fixedClock(),
      }),
    "NOTE_SYMLINK",
  );
  await assert.rejects(stat(path.join(outside, "does-not-exist")));
});

test("rejects a hard-linked note and leaves the external inode untouched (SYM-06)", async (t) => {
  const root = await makeTempRoot(t);
  const outside = await makeTempRoot(t);
  const sentinel = path.join(outside, "sentinel.txt");
  await writeFile(sentinel, "SENTINEL", "utf8");
  const noteDir = await prepareDocs(root);
  await link(sentinel, path.join(noteDir, "alice.md"));

  await expectNoteError(
    () =>
      appendNote({
        role: "alice",
        taskSlug: "task-sym",
        text: "escape",
        root,
        clock: fixedClock(),
      }),
    "NOTE_HARDLINK",
  );
  assert.equal(await readFile(sentinel, "utf8"), "SENTINEL");
});

test("writes only under the supplied root (AC-08 best effort)", async (t) => {
  const rootA = await makeTempRoot(t);
  const rootB = await makeTempRoot(t);

  await appendNote({
    role: "alice",
    taskSlug: "bind",
    text: "root a",
    root: rootA,
    clock: fixedClock(),
  });

  assert.equal((await readNote(rootA, "bind", "alice")).includes("root a"), true);
  await assert.rejects(stat(path.join(rootB, "docs", "agent-state", "bind", "alice.md")));
});
