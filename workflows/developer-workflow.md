# Developer Workflow

## Objective

Lean, requirements-led development with implementation, tests, review, and
human checkpoints. This is the canonical source for states and routing.
`templates/task-note.md` owns the per-role working note and
`templates/task-record.md` owns the consolidated result; dispatches carry only
task-specific context and deltas.

Follow [`docs/agent-instruction-delivery.md`](../docs/agent-instruction-delivery.md)
to verify file access and include canonical instruction content when it is not
available to the receiving harness.

## Standard flow

1. `developer` performs progressive discovery and classifies `risk_profile`.
   Resolve ordinary ambiguity from context; ask only when an answer can change
   expected behavior, scope, compatibility, accepted risk, or a human gate.
2. `planner` resolves technical ambiguity and produces a plan. Valid `analyst`
   requirements may be used without reopening settled questions.
3. Present objective and plan together for one explicit user approval before
   implementation. Do not ask separate objective confirmation when the request
   already establishes it.
4. For high-risk work, `tester` defines acceptance, boundary, failure, and
   regression scenarios before implementation, including the negative case for
   every signed field and limit in the plan. The exit criterion is a complete
   `campo/limite -> NEG-* -> expected result` matrix; while it is incomplete the
   task stays in `planning` and `coder` does not start. This does not make TDD
   mandatory for simple work.
5. `coder` implements. Use a stronger model for high complexity instead of a
   separate expert role.
6. `coder` adds/updates focused unit, component, or regression tests directly
   related to the implementation and runs those tests plus limited checks.
   `tester` independently reviews traceability, assertions, edge cases, and the
   coder's evidence; it adds or adjusts tests only for meaningful coverage gaps.
   Full regression suites and global coverage checks are deferred until
   implementation and focused test work are declared complete.
7. For device/hardware changes, after implementation and focused independent
   tests, invoke `reviewer` in `development` mode for scoped feedback only; this
   mode must not run full suites, global coverage, broad analysis, or remote
   gates. Then run the approved device-validation phase **before** final review
   when the device is available and the test is safe/authorized.
8. The agent runs the target functional test when it is safe, authorized and
   feasible, recording the command, output, snapshot and covered scope. When the
   check depends on the user or a device, it delivers a reproducible procedure
   with build/version, monitoring/log instructions and the expected result, and
   the item stays `manual_validation` pending. After review, document the result
   and present the remaining instructions. Work is `completed` only after
   required manual validation is recorded and accepted by the user; agents report
   evidence but do not accept device/hardware behavior on the user's behalf.

## Task notes and memory

Every role keeps its own working note; there is no shared file written by many
roles.

- Path convention: `<project>/docs/agent-state/<task>/<role>.md`, following
  `templates/task-note.md`. A project with its own documentation convention keeps
  it, and the path is confirmed in the dispatch.
- One author per note: a role writes only its own note and never edits another
  role's note. The developer never rewrites role notes.
- When a note MCP is configured, a role writes its own note with that role's
  tool `note_<role>_append`, sending only `task_slug` and the entry text. The
  server supplies the timestamp, path and role: do not put them in the text, and
  do not write the note with `edit`. The consolidated record at
  `docs/agent-state/<task>.md` is outside this tool and remains the developer's.
  If the tool is unavailable, use the manual append fallback defined here and in
  the template with a measured timestamp; never claim an MCP append that did not
  run. The example integration configures `planner`, `coder`, `tester` and
  `reviewer` only; the developer's consolidated record is written manually. The
  note MCP is best effort and does not prevent an agent with configuration or
  shell access from bypassing it.
- A note is a summary of the dispatch objective, work done, evidence, decisions,
  pending items, and references. It is not a log: do not paste tool output, full
  diffs, or the approved plan. There is no line limit; keep what a safe resume
  needs and reference the rest.
- Not every transition requires a note update. A role updates its note when it
  finishes material work, not when a message arrives.
- Update by appending, not by rewriting history. Every appended entry starts with
  its own timestamp (`YYYY-MM-DD HH:MM ±HH:MM`) and states whether it supersedes
  or discards an earlier conclusion. Updating the `Updated` header alone is not
  enough to mark new content.
- Rewrite an earlier statement only when it is actively misleading and could
  change another role's next action, such as an approval, a test result, or a
  security risk.
- When reading a note, apply the most recent applicable entry and treat items it
  supersedes or discards as closed. Age alone does not invalidate an entry: an
  old fact stays valid until a later update closes it. Do not keep routing a
  pending item that a timestamped update already resolved.
- A note is not proof. A claim such as "tests passed" must point to the command,
  result, and code state that produced it. The reviewer verifies the source
  independently; no approval is based only on a summary.
- At closure, the `developer` reads the notes and writes a single task record at
  `<project>/docs/agent-state/<task>.md` following `templates/task-record.md`.
  Only the developer consolidates; the record is the commit-ready reference and
  the notes stay in the project as the detailed trail. The record carries only
  the current state: superseded and discarded items stay in the notes.
- Committing the record requires user authorization for the task and must never
  target `main`, `master`, or a production branch.
- `analyst` and `research` are read-only and return their content directly with
  `nota: none`.

## Dispatch and sessions

Before each delegation, send the smallest context that lets the receiving role
act safely: approved objective and relevant `REQ-*`/`AC-*`, one task and its exit
criterion, role/mode, allowed files or scope, note path, references to the
canonical plan, and only new/changed evidence or blockers. Reference canonical
instructions instead of copying them when readable.

Sessions carry continuity:

- The first dispatch of a role in a task starts a new session. The second and
  later dispatches reuse that role's `sessionID` and send only the task, exit
  criterion, and delta.
- The `role -> sessionID` map is ephemeral and belongs to the developer. It never
  enters a note or the task record; a session ID is machine-local.
- Reset a role session when the task changes, the plan is reapproved, the state
  becomes stale, or a rejected hypothesis would bias the next attempt. Record the
  reset in that role's note.
- Reusing a session resets the role's step allowance, so an interrupted dispatch
  can continue instead of rebuilding context.
- Instruct every long dispatch to append a checkpoint (code state, done, pending)
  before exhausting its step allowance and to return the three fields even when
  interrupted. An empty return, a placeholder such as `@`, or a return without a
  note is missing evidence, never a conclusion.

After each return, read the note, verify that evidence points to a source and
code state, and route only verified new information. Apply the most recent
applicable entry; an item a timestamped update supersedes or discards is closed
and must not be routed as pending. A missing or ambiguous
return is missing evidence, not approval: request one bounded re-run from the
responsible role. Do not create a parallel state file.

When a check discovers work beyond the approved task, classify it as **blocking
for an acceptance criterion/gate**, **minimal technical dependency**, or
**adjacent/deferable**. Continue only blockers and necessary dependencies within
approved scope. If a dependency changes objective, behavior, compatibility, or
accepted risk, pause and obtain human reapproval; do not use Jev to authorize
scope.

Group compatible findings into one bounded correction dispatch only when they
share the same responsible role and scope. Keep different owners or modules
separate; serialize writers and reviewers in a shared worktree. Grouping never
removes a test or bypasses review.

## Roles and separation

- `developer` is the only orchestrator, user interlocutor, and consolidator.
  It reads role notes and never rewrites them.
- `planner` is read-only for code and tests; it may write only its own note.
- `coder` may change production and directly related tests and run focused
  checks; it never runs the full suite or global coverage. Complexity is handled
  by model choice, not by another role.
- `tester` changes tests only, independently evaluates coder-authored coverage,
  adds/adjusts tests for material gaps, and runs tests created/changed in that
  step plus necessary targeted regressions.
- `reviewer` is the only agent that runs the complete suite and issues final
  code-gate approval. In `development` mode it gives scoped feedback only and
  does not edit source or tests. `review_feedback_ready` is explicitly
  non-approving. `review_approved` covers code readiness — implementation reviewed
  in the diff and behavior, automated tests/coverage and executable functional
  checks — and may coexist with a manual functional validation explicitly recorded
  as pending; it never marks the task `completed`. Remote CI is operational
  evidence recorded afterwards, not a gate. For device work, final review follows
  focused and device validation whenever safe and available.
- `analyst` is an optional primary agent that returns requirements.
- Subagents report blocking questions to `developer`; only `developer` asks the
  user. Within approved scope, choose a conservative, reversible technical
  default and record the assumption.

## State and routing

Main states: `discovery`, `planning`, `implementation`, `validation`, `review`,
`manual_validation`, and `completed`. Exceptional states: `blocked`,
`review_incomplete`, and `cancelled`.

Transitions are prohibited when implementation precedes human plan approval, a
high-risk implementation starts before the negative-case matrix is complete, the
tester edits production, a full suite is run by coder or tester, a bug lacks
regression coverage at approval, or a review is approved with a blocker, failed
or missing test, stale gate, or inconclusive required check.

`review_approved` is allowed only in `final` mode and requires all of the
following:

- `blockers: []` and no unresolved critical risk;
- the implementation reviewed in the diff and its behavior, not only the plan or
  a summary;
- every applicable `REQ-*`/`AC-*` linked to implementation and to automated test
  and coverage evidence, plus the functional tests that could be executed;
- complete applicable local tests, lint/format/build/coverage checks with a
  conclusive result;
- the target functional test executed by the agent when safe, authorized and
  feasible, with command, output, snapshot and covered scope recorded; otherwise a
  reproducible procedure requested from the user and the item kept as
  `manual_validation` pending, which does not block code approval but never counts
  as satisfied;
- all gate evidence tied to the exact reviewed state (`head` plus timestamp).

Remote CI is operational evidence recorded after local readiness, so it is
never a prerequisite for readiness. Record the state against the exact commit
SHA: a `green` run on the same SHA complements the evidence and never replaces a
local test; a run that is pending, not triggered, unavailable or failed for
infrastructure reasons is recorded as operational state and does not veto
readiness; a CI failure indicative
of code must be investigated and reproduced locally, and a confirmed code failure
blocks approval until corrected and reviewed; a failure that cannot be classified
and could hide a required defect keeps the review `review_incomplete` until
diagnosed. Absence of access is not proof of infrastructure, and a CI run for a
different SHA never validates the reviewed snapshot.

Development-mode feedback may report focused check results and pending final
gates. Defer full regression runs, global coverage, broad analysis, and remote CI
polling until implementation and focused independent tests are complete.

If source state changes after a check, that check is `stale` and must be rerun.
For a dirty worktree, identify the reviewed state with the base HEAD plus a
stable diff hash or an equivalent harness-supported snapshot identifier. Never
claim a commit SHA for uncommitted changes.

`review_incomplete` is not approval. Missing output, an interrupted review, a
step limit, timeout, an unavailable or inconclusive required local check,
unreadable evidence, a device validation required before final review that is
still pending without the explicit authorized exception, or a CI failure that
could hide a required defect must remain incomplete or blocked. A remote CI run
that is pending, unavailable or failed for
infrastructure reasons is recorded as operational state and does not by itself
make the review incomplete. If a return is ambiguous, request one bounded
re-run to reproduce or verify the actionable claims against the current source
state; route only validated claims and keep the task incomplete when the re-run
is also inconclusive. A fresh verification does not erase failed gates or bypass
correction, review, or human-approval rules.

## Risk and bugs

Classify `risk_profile` as `low`, `medium`, or `high`. `high` includes contract,
security, data, concurrency, external integration, critical behavior, or
material-impact bugs. Risk controls depth of planning and evidence, never waives
necessary tests.

For bugs, reproduce before planning where possible. High-risk bugs require
tester scenarios before the fix; low/medium-risk bugs may be fixed first and
receive a regression test afterward. Regression coverage is required before
approval in either path. Preserve only useful evidence: reproduction status,
steps, expected/observed, commands/results, sanitized logs, environment, and
limitations.

## Research on stalled work

Use `research` when a technical decision lacks evidence, or a cycle repeats
without a new hypothesis, evidence, or measurable progress. Subagents signal the
question, what was tried, and the missing evidence; they do not repeat the
failing path or dispatch nested research. The developer first checks local code
and docs, then delegates one bounded question and routes the findings to the
responsible role. Research informs decisions; it does not validate local
behavior, change scope, or waive gates.

## Alternatives and correction cycles

If implementation or review finds the approved approach infeasible, blocked, or
materially riskier than planned, stop that path and return to `developer` with
evidence, constraints, and viable alternatives. The developer routes back to the
planner for a bounded replan; do not silently change scope or keep repeating a
failing approach. Compare alternatives on feasibility, risk, quality, cost, and
validation effort.

Permit parallel read-only discovery/planning only when inputs are stable and
scopes are independent. Serialize all edits and reviews against a shared
worktree; do not start a dependent reviewer or writer while another writer is
active. Parallel implementation is allowed only for explicitly disjoint
files/modules, with one integrator reconciling the result before tests/review.

Do not impose a numeric ceiling on correction cycles. After every validated
return, compare the current state with the prior state and record the concrete
delta: acceptance criteria/gates satisfied, failures corrected, blockers removed,
new evidence or a revised hypothesis that changes the next action, or a failed
approach replaced with a viable one. Continue while there is observable progress
and a safe, in-scope next step. A cycle is stalled when it repeats a failed
approach or finding without new evidence, a changed hypothesis, a material state
change, or a reduction in blockers. Do not repeat a stalled route: use bounded
research or replan if it can provide a new path. If no useful safe step remains,
progress depends on a human decision, or critical risk is unresolved, enter a
checkpoint and ask the user how to proceed, summarizing attempts, evidence,
blockers, and options. Progress never waives approval, testing, review, or other
human gates.

Routing: `reviewer -> tester -> reviewer` for test defects or missing coverage
when production behavior is correct; `reviewer -> coder -> tester -> reviewer`
for production defects; `coder/reviewer -> developer -> planner` when the
approach is infeasible or materially risky; `tester_disputed` and disputes return
to `developer`; any research need returns to `developer` for bounded dispatch;
failed gates return to the responsible role.

## Quality gate and delivery

The reviewer identifies the stack and checks applicable formatting/syntax,
lint/typecheck, unit/integration/regression tests, build/package, coverage, and
security/quality analysis. Prefer existing project tools; propose new tools with
scope, cost, and justification.

Before running broad gates, run a preflight: new files must be inside the
formatting/lint/typecheck scope, `clean`, ignore and coverage targets must match
the artifacts the build produces, required tools and dependencies must exist, and
every command must capture its exit code. A check that is pending, still running,
truncated, or without output is inconclusive, never PASS.

The reviewer may inspect Git and run checks. Commit or push requires explicit
user authorization in the current task, even on a work branch; that authorization
may be conditional on local readiness in the same task and is never automatic,
and it never replaces a gate or a manual acceptance. Never commit, push, or
force-push to production branches, and never publish before the local
`review_approved`. Before authorized version control operations, inspect branch,
status, diff, and stage only intended files; review the staged diff and record the
resulting SHA together with the CI state tied to it.

Final delivery records diff/state, commands and exit results, local gate state,
remote CI state as separate operational evidence, manual validation
requested/completed/pending, residual risks, and any user override. Each manual
`AC-*` records its evidence kind: measured (command or series), reported by the
user, or deferred (user decision). A reported or deferred item never counts as
satisfied, and deferral is a user decision rather than an agent default. A
functional validation that was requested but not yet answered is only pending: it
has no evidence kind, is never recorded as satisfied, and does not block a code
approval that discriminates it. Manual device validation must identify the
firmware/build state and the specific behavior tested; generic smoke checks do not
prove a feature.
For device-bound changes, record whether device validation preceded final review;
if it did not, record the blocker/deferment and explicit user authorization for
the exception.

Tie committed CI evidence to the reviewed content and exact commit SHA. A
successful check for a different commit or changed worktree does not validate
the current state. Remote CI is post-approval operational evidence: a `green` run
on the published SHA confirms the published content, while a code failure found
afterwards reopens correction and review and invalidates readiness until a new
snapshot is approved; operational unavailability is recorded and never converted
into a PASS. Run broad gates in a detached worktree checked out at the
reviewed state (`git worktree add --detach`) instead of the developer's worktree,
so the writer keeps working and a moving worktree cannot produce a false
positive; a dirty worktree requires an immutable diff-snapshot identifier.
Reused evidence must cite its origin state and the current state must be
unchanged, or the check is stale. When a domain value changes, sweep
documentation, READMEs, and indexes for the old value before closing the cycle.

## Jev

When an unresolved semantic judgment could change the next action, evaluate
`typesafe-jev_jev_decide` for a bounded, reversible, low-risk choice: a real
technical tie, a viable fallback selection, a non-scope blocking question, or
severity/risk/coverage classification. Skip it for facts determined by code,
docs, commands or tests, trivial choices, and answers that would not change the
action. Keep state minimal, batch independent questions, and record one compact
line in the role note. Confidence thresholds and schema are in
`docs/typesafe-jev-policy.md`. Jev never confirms goals, scope, plan approval,
business decisions, credentials, deployment, migration, deletion, or other
human gates.

## Human gates

1. One explicit user approval of objective and plan before code changes; omit a
   separate objective-confirmation round when intent is already clear.
2. Human acceptance of required manual/device validation; agents report evidence
   and limitations but do not claim user acceptance.
3. Business, scope, compatibility, irreversible actions, unresolved conceptual
   disagreement, stagnation without a safe useful next step, and human-owned
   decisions require the user.
4. Recovery actions in a physical or shared environment — sending keys to a
   device shell, rebooting the device, killing a process, resetting a service —
   require explicit authorization in the dispatch. Without it the role stops and
   reports the need instead of acting.

Maintain `REQ -> implementation -> TEST -> REVIEW`. For bugs use
`BUG_REPORT -> reproduction evidence -> fix -> TEST_REGRESSION -> REVIEW`.
