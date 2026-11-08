# Task Record

The task record is the consolidated, durable result of one task. Only the
`developer` writes it, at closure, after reading the role notes. It is the
artifact committed as future reference.

Path convention: `<project>/docs/agent-state/<task>.md`. A project with its own
documentation convention keeps it; the path is confirmed in the dispatch.

```md
# <task>

- Status: completed | cancelled
- Date: <date>
- Risk profile: low | medium | high
- Approved plan: <path#section>

## Objective and criteria

The approved objective and the final state of each `AC-*`.

## Result

What was delivered, in one short section.

## Changes

Production, test, and documentation paths affected.

## Validation

Checks executed, results, and the code state they belong to. State clearly what
was not run.

## Decisions

Decisions and assumptions that matter for future work.

## Residual risks

Known limitations, deferred work, and manual validation accepted or pending.

## References

Task notes, plan, tests, commits, and logs.
```

Rules:

- One author (`developer`). Roles never write the record.
- It summarizes; the role notes remain the detailed evidence trail.
- It records the current state only: superseded or discarded items stay in the
  notes and never carry into the record.
- `Status: completed` requires that mandatory manual validation was accepted by
  the user when it applies.
- The record and notes stay in the project as reference for future tasks.
