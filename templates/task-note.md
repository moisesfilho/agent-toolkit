# Task Note

A task note is the working memory of one role for one task. Each role owns and
writes only its own note; no other role edits it. The developer reads the notes
to route work and consolidates them into the task record at the end.

Path convention: `<project>/docs/agent-state/<task>/<role>.md`. A project with
its own documentation convention keeps it; the path is confirmed in the dispatch.
A note is not proof: evidence must point to the command, result, and code state
that produced it.

## Writing The Note

When a role note MCP is configured, write with that role's tool
`note_<role>_append`, sending only `task_slug` and one entry line. The server owns
the timestamp, destination and role, so do not send them in the text, and do not
write the note with `edit`. Use one call per entry. MCP entries use the server's
`<timestamp> - <text>` line format; do not duplicate the timestamp as a heading.

If the tool is unavailable, use the manual append fallback below `## Updates`
with a measured timestamp and the supersession line. Never claim an MCP append
that did not run. The example integration configures `planner`, `coder`,
`tester` and `reviewer` only. The consolidated record at
`docs/agent-state/<task>.md` is outside this tool and belongs to the developer.

```md
# <role> - <task>

- Role: <role>
- Updated: <date/time>
- Code state: <HEAD or stable dirty-worktree snapshot>

## Dispatch objective

What this role was asked to do and the exit criterion.

## Work done

Concise summary of what was executed or decided. Reference files, `REQ-*`,
`AC-*`, and `TEST-*` instead of copying code or logs.

## Evidence

Command, result, and state for each meaningful check. Record each gate as
`comando | exit | head | timestamp` and mark what was not run. A check that is
pending, still running, or without output is not a result.

## Decisions and assumptions

Only decisions that affect the next step, including Jev results when used.

## Pending and risks

What remains, what is blocked, and residual risk. Use `none` when empty.

## References

Paths to the approved plan, changed files, tests, and run logs.

## Updates

Append-only. Each entry starts with its own timestamp and says what it replaces.

### 2026-10-24 18:53 -03:00 - <topic>

- Fact: <new fact and the current state>
- Supersedes or discards: <section or earlier entry it closes>, or `none`.
```

Rules:

- One author per note. A role never edits another role's note.
- Summarize; do not paste full logs, code, or the approved plan.
- There is no line limit. Keep the content that a safe resume needs and drop
  what the referenced files already hold.
- Timestamp every appended update with `YYYY-MM-DD HH:MM ±HH:MM` at the start of
  the entry, so a reader can tell which facts are new. Editing the `Updated`
  header alone does not timestamp the new content.
- Append new facts under `## Updates` instead of rewriting the earlier text.
  Rewrite an earlier statement only when it is actively misleading and could
  change another role's next action, such as an approval, a test result, or a
  security risk.
- When a new fact overrides an earlier conclusion, name it as superseded or
  discarded and state the current fact. This retires a resolved or abandoned
  issue instead of leaving it open for the next reader.
- Read the most recent applicable entry. Age alone does not invalidate an entry:
  an old fact stays valid until a later update supersedes or discards it.
- The consolidated task record carries only the current state; superseded and
  discarded items stay in the note trail and never move to the record.
- Before exhausting its step allowance, a role appends a checkpoint with the
  code state, what is done, and what is pending, so an interrupted run still
  leaves a verifiable state.
- Keep the note until the task is closed; it is part of the project record.
