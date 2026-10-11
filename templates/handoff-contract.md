# Shared Agent Handoff Contract

This is the canonical handoff contract. Include it in a dispatch only when the
receiving agent cannot reliably read this file; otherwise provide the role
requirements and task-specific context without repeating shared fields. Keep
handoffs incremental: cite stable requirement/test IDs and report only new or
changed information. Every key below is required; use `none` for an unavailable
scalar and `[]` for an empty list. Omitted keys, invalid statuses, and output
over the role's line limit are invalid handoffs.

```text
status: <role-specific enum>
origin: <agent id>
next_action: <role-specific enum>
cycle: <0..3>
changed: []
commands: []
tests: []
quality_gate: []
decisions: []
risks: []
blockers: []
manual_validation: none | pending | completed: <evidence>
overrides: []
```

For every executed command, record the command (or a safe concise equivalent),
exit/result, and the reviewed source state. `quality_gate` entries identify the
check, `head` (commit SHA or stable dirty-worktree snapshot), timestamp, and
result. A changed source state invalidates prior evidence. Never describe a
pending, missing, stale, failed, or unobserved check as passing.

## Per-role contract

| Agent | Required status values | Required next_action values | Additional required evidence | Max lines |
| --- | --- | --- | --- | ---: |
| `analyst` | `requirements_ready`, `needs_clarification` | `handoff_to_developer`, `request_clarification` | `request_type`, `objective`, `facts`, `assumptions`, `scope`, `out_of_scope`, `requirements`, `acceptance_criteria`, `edge_cases`, `validation` | 25 |
| `planner` | `plan_ready`, `needs_clarification` | `developer` | `objective_confirmed`, `objective`, `scope`, `acceptance_criteria`, `risk_profile`, `requirements`, `files`, `planned_tests`, `checkpoints` | 40 |
| `coder` | `implementation_ready`, `implementation_corrected`, `blocked` | `tester`, `developer` | `changed` paths and affected `REQ-*`; local checks only | 25 |
| `coder-expert` | `implementation_ready`, `implementation_corrected`, `blocked` | `tester`, `developer` | `changed` paths and affected `REQ-*`; local checks only | 25 |
| `tester` | `test_specification_ready`, `test_ready`, `test_refined`, `tester_disputed` | `reviewer`, `coder`, `developer` | `changed` test paths, `TEST-*` mapping, executed test results; `manual_validation` when hardware is relevant | 25 |
| `reviewer` | `review_approved`, `test_refinement_needed`, `needs_more_tests`, `needs_correction`, `review_incomplete` | `tester`, `coder`, `developer`, `none` | Full-suite results, findings, coverage where applicable, conclusive `quality_gate`; `review_approved` requires empty blockers | 40 |

`retrospectiv` uses its dedicated report format; this agent handoff contract
does not replace that report. The primary `developer` keeps the canonical ledger
and does not need to emit a subagent handoff unless it delegates work.

## Reviewer approval invariant

`review_approved` is valid only when `blockers: []`, applicable tests pass,
required quality gates are conclusive and tied to the current reviewed state,
and no critical risk remains. If any evidence is incomplete, the reviewer
returns `review_incomplete` (or a correction status), never approval. Manual
validation may remain pending only when it is explicitly a separate user-owned
acceptance gate and the work is not marked `completed`.
