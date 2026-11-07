# Task Note

A task note is the working memory of one role for one task. Each role owns and
writes only its own note; no other role edits it. The developer reads the notes
to route work and consolidates them into the task record at the end.

Path convention: `<project>/docs/agent-state/<task>/<role>.md`. A project with
its own documentation convention keeps it; the path is confirmed in the dispatch.
A note is not proof: evidence must point to the command, result, and code state
that produced it.

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

Command, result, and state for each meaningful check. Mark what was not run.

## Decisions and assumptions

Only decisions that affect the next step, including Jev results when used.

## Pending and risks

What remains, what is blocked, and residual risk. Use `none` when empty.

## References

Paths to the approved plan, changed files, tests, and run logs.
```

Rules:

- One author per note. A role never edits another role's note.
- Summarize; do not paste full logs, code, or the approved plan.
- There is no line limit. Keep the content that a safe resume needs and drop
  what the referenced files already hold.
- Keep the note until the task is closed; it is part of the project record.
