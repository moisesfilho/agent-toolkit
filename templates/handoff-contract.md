# Shared Agent Handoff Contract

This is the canonical handoff contract. Include it in a dispatch only when the
receiving agent cannot reliably read this file; otherwise provide the role
requirements and task-specific context without repeating shared fields. Keep
handoffs incremental: cite stable requirement/test IDs and report only new or
changed information. Every key below is required; use `none` for an unavailable
scalar and `[]` for an empty list. Omitted keys, invalid statuses, and output
over the role's line limit are invalid handoffs.

Keep routing fields machine-checkable: `status`, `origin`, `next_action`, and
`cycle` each appear exactly once as a single-line scalar. `next_action` contains
only one allowed role/action value; put explanations, parallel responsibilities,
or routing rationale in `decisions` or `blockers`, never in the routing value.

```text
status: <role-specific enum>
origin: <agent id>
next_action: <role-specific enum>
cycle: <0..7>
changed: []
research_request: none | <question; tried; missing evidence>
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

If a handoff is malformed, the receiver may request one format-only repair. The
repair may change presentation/structure only, not findings, evidence, status,
or conclusions. If it remains invalid, do not route its claims as verified and
do not repeat format repair. The developer records the handoff as
`review_incomplete` when it came from review, then obtains a fresh, bounded
handoff from the responsible role that independently verifies actionable claims
against the current state. Route only the new validated evidence. If that return
is also invalid or cannot verify the claims, keep the work incomplete/blocked
and report the limitation; never infer approval or discard reproducible issues.

## Per-role contract

| Agent | Required status values | Required next_action values | Additional required evidence | Max lines |
| --- | --- | --- | --- | ---: |
| `analyst` | `requirements_ready`, `needs_clarification` | `handoff_to_developer`, `request_clarification` | `request_type`, `objective`, `facts`, `assumptions`, `scope`, `out_of_scope`, `requirements`, `acceptance_criteria`, `edge_cases`, `validation` | 25 |
| `planner` | `objective_ready`, `plan_ready`, `needs_clarification` | `developer` | `objective_confirmed`, `objective`, `scope`, `acceptance_criteria`, `risk_profile`, `requirements`, `files`, `planned_tests`, `checkpoints` | 40 |
| `coder` | `implementation_ready`, `implementation_corrected`, `blocked` | `tester`, `developer` | `changed` paths and affected `REQ-*`; local checks only | 25 |
| `coder-expert` | `implementation_ready`, `implementation_corrected`, `blocked` | `tester`, `developer` | `changed` paths and affected `REQ-*`; local checks only | 25 |
| `tester` | `test_specification_ready`, `test_ready`, `test_refined`, `tester_disputed` | `reviewer`, `coder`, `developer` | `changed` test paths, `TEST-*` mapping, executed test results; `manual_validation` when hardware is relevant | 25 |
| `reviewer` | `review_feedback_ready`, `review_approved`, `test_refinement_needed`, `needs_more_tests`, `needs_correction`, `review_incomplete` | `tester`, `coder`, `developer`, `none` | Development mode: scoped findings/checks, final gates pending; final mode: full-suite results, coverage where applicable, conclusive `quality_gate`; approval only in final mode with empty blockers | 40 |
| `research` | `research_complete`, `research_inconclusive` | `developer` | `research_question`, `findings`, `sources`, `recommendation`; external evidence is not local validation | 25 |

`retrospectiv` uses its dedicated report format; this agent handoff contract
does not replace that report. The primary `developer` keeps the canonical ledger
and does not need to emit a subagent handoff unless it delegates work.

Set `research_request` to `none` unless further evidence is specifically needed.
When blocked or repeating without progress, provide a concise question, what was
tried, and what evidence is missing. Only `developer` dispatches `research` under
OpenCode V2's default one-level subagent nesting; other roles signal the request
to `developer` rather than attempting nested delegation.

## Reviewer approval invariant

`review_feedback_ready` is non-approving feedback from reviewer development
mode; it may record focused checks and pending final gates but cannot close work.

`review_approved` is valid only in reviewer final mode when `blockers: []`, applicable tests pass,
required quality gates are conclusive and tied to the current reviewed state,
and no critical risk remains. If any evidence is incomplete, the reviewer
returns `review_incomplete` (or a correction status), never approval. Manual
validation may remain pending only when it is explicitly a separate user-owned
acceptance gate and the work is not marked `completed`.
