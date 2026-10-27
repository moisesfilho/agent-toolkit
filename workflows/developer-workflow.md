# Developer Workflow

## Objective

Lean, requirements-led development with implementation, tests, review, and
human checkpoints. This is the canonical source for states and routing;
`templates/handoff-contract.md` owns handoff fields and limits. Dispatch only
references readable instructions and includes task-specific context. Use the
explicit-content fallback when readability is unavailable or uncertain.

Follow [`docs/agent-instruction-delivery.md`](../docs/agent-instruction-delivery.md)
to verify file access and include canonical instruction content when it is not
available to the receiving harness.

## Standard flow

1. `developer` performs progressive discovery and classifies `risk_profile`.
   Resolve ordinary ambiguity from context; ask only when an answer can change
   expected behavior, scope, compatibility, accepted risk, or a human gate.
2. `planner` resolves technical ambiguity and produces a plan. A valid `analyst`
   handoff may supply requirements without reopening settled questions.
3. Present objective and plan together for one explicit user approval before
   implementation. Do not ask separate objective confirmation when the request
   already establishes it.
4. For high-risk work, `tester` defines acceptance, boundary, failure, and
   regression scenarios before implementation. This does not make TDD mandatory
   for simple work.
5. `coder` implements. Use `coder-expert` only for high complexity or explicit
   escalation.
6. `coder` adds/updates focused unit, component, or regression tests directly
   related to the implementation when appropriate and runs those tests plus
   limited checks. `tester` independently reviews traceability, assertions, edge
   cases, and the coder's test evidence; it adds or adjusts tests only for
   meaningful coverage gaps and runs tests created/changed in that step plus
   necessary targeted regressions. Avoid mechanically recreating/rerunning
   equivalent checks. High-risk scenarios defined before implementation remain
   tester-owned validation obligations. Full regression suites and global
   coverage checks are deferred until implementation and focused test work are
   declared complete.
7. If useful, `reviewer` may run in `development` mode during implementation:
   review only affected requirements/files and run focused checks. It returns
   `review_feedback_ready` when no immediate correction is needed; this is not
   approval and does not run full suites, global coverage, or remote gates.
8. Once the developer confirms implementation and test work are complete, invoke
   `reviewer` once in `final` mode to run the full applicable suite, regression,
   coverage, lint/typecheck/build, and local/remote quality gates. Only this mode
   may return `review_approved`.
9. After `review_approved`, document the solution and present manual validation
   instructions. Work is `completed` only after required manual validation is
   recorded; only the user accepts device/hardware behavior.

## Dispatch and scope control

Before each delegation, send the smallest context that lets the receiving role
act safely: approved objective and relevant `REQ-*`/`AC-*`, one task and its exit
criterion, role/mode, allowed files or scope, references to the canonical plan
and ledger, and only new/changed evidence or blockers. Reference canonical
instructions instead of copying them when readable; use the explicit-content
fallback in `docs/agent-instruction-delivery.md` when readability is uncertain.
Do not require a snapshot for planning or read-only discovery. For implementation,
testing, or review of a changing worktree, identify the relevant source state as
base `HEAD` plus a stable diff/snapshot identifier; after commit, record the SHA.

After each return, validate the handoff, update the existing canonical ledger
once, and route only verified new information. Do not create a parallel ledger
or repeat unchanged requirements, logs, or workflow text. Missing evidence stays
`none`/`[]` when unavailable and is a blocker only when it prevents the next
step.

When a check discovers work beyond the approved task, classify it in the ledger
as one of: **blocking for an acceptance criterion/gate**, **minimal technical
dependency**, or **adjacent/deferable**. Continue only blockers and necessary
dependencies within approved scope. Defer unrelated improvements. If a dependency
changes objective, behavior, compatibility, or accepted risk, pause and obtain
human reapproval; do not use Jev to authorize scope.

Group compatible findings into one bounded correction dispatch only when they
share the same responsible role and scope. Keep different owners or modules
separate; serialize writers and reviewers in a shared worktree. Grouping never
resets `cycle`, removes a test, or bypasses review. For a reviewer interrupted
by step limit/timeout, preserve `review_incomplete`; resume from verified pending
checks only if the source snapshot is unchanged. If it changed, invalidate and
rerun affected checks. An absent/truncated summary is missing evidence, not an
implicit pass.

## Research on stalled work

Use `research` when a technical decision lacks evidence, or a cycle repeats
without a new hypothesis, evidence, or measurable progress. Subagents signal this
in `research_request` as `question; tried; missing evidence`; they do not repeat
the same failing path or dispatch nested research. The developer first checks
whether the needed fact is already available in project code/docs, then delegates
one bounded question to `research` and routes its concise findings to the
responsible role (planner for a material approach change). OpenCode V2 defaults
to one subagent nesting level, so the developer owns dispatch. Do not research
the same question again without new evidence. Research informs decisions; it does
not validate local behavior, change scope, count as implementation, or waive plan
approval, tests, review, user decisions, or the cycle ceiling. If research is
unavailable or inconclusive, record the limitation and use the existing blocked,
replan, or human-checkpoint route.

For bugs, reproduce before planning where possible. High-risk bugs require
`tester` scenarios before the fix; low/medium-risk bugs may be fixed first and
receive a regression test afterward. Regression coverage is required before
approval in either path.

## Roles and separation

- `developer` is the only orchestrator and user interlocutor. It owns the
  canonical state ledger and validates every handoff before routing it.
- `planner` is read-only and defines architecture, risk, files, and test intent.
- `coder`/`coder-expert` may change production and directly related tests, and run
  focused checks; they never run the full suite or global coverage.
- `tester` changes tests only, independently evaluates coder-authored coverage,
  adds/adjusts tests for material gaps, and runs tests created/changed in that
  step plus necessary targeted regressions. It should not duplicate equivalent
  tests solely to repeat coder's work.
- `reviewer` is the only agent that runs the complete suite and issues final
  approval. In `development` mode it gives scoped feedback only; it does not edit
  source or tests. `review_feedback_ready` is explicitly non-approving.
- `analyst` is an optional primary agent that returns requirements; it does not
  start implementation.
- Subagents report blocking questions to `developer`; only `developer` asks the
  user. Within approved scope, choose a conservative, reversible technical
  default and record the assumption instead of interrupting for routine details.

User instructions may explicitly override a workflow default only when the
action is within the user's authority. Record `overrides` with the instruction,
the affected rule, the chosen behavior, and `source: user`. An override cannot
be represented as a gate passing: report the skipped/pending validation and
leave completion or release acceptance to the user.

## State and routing invariants

Main states: `discovery`, `clarification`, `planning`, `awaiting_approval`,
`test_specification`, `implementation`, `test_creation`, `review`, `correction`,
`manual_validation`, and `completed`.

Exceptional states: `bug_diagnosis`, `bug_reproduction`,
`assisted_reproduction`, `test_refinement`, `tester_disputed`, `blocked`,
`review_incomplete`, `critical_checkpoint`, and `cancelled`.

Transitions are prohibited when implementation precedes human plan approval;
the tester edits production; a full suite is run by coder or tester; a bug lacks
regression coverage at approval; or a review is approved
with a blocker, failed/missing test, stale gate, or inconclusive required check.

`review_approved` is allowed only in `final` mode and requires all of the following:

- `blockers: []` and no unresolved critical risk;
- every applicable `REQ-*`/`AC-*` linked to implementation and test evidence;
- complete applicable local tests, lint/format/build/coverage checks;
- remote CI conclusively green when configured and available;
- all gate evidence tied to the exact reviewed state (`head` plus timestamp).

Development-mode feedback may report focused check results and pending final
gates. Defer full regression runs, global coverage, broad analysis, and remote CI
polling until implementation and test changes are complete, unless concrete high
risk or a needed diagnostic makes an earlier check necessary. Any source/test
change after final validation makes affected evidence stale and requires relevant
final gates to rerun.

If source state changes after a check, that check is `stale` and must be rerun.
For a dirty worktree, identify the reviewed state with the base HEAD plus a
stable diff hash or an equivalent harness-supported snapshot identifier. Never
claim a commit SHA for uncommitted changes.

`review_incomplete` is not approval. Missing output, malformed handoff, a step
limit, timeout, unavailable check, pending CI, or unreadable evidence must remain
incomplete or blocked. The developer may request one format-only correction for
a malformed handoff; do not route its claims as verified until corrected.

If that correction is still malformed, stop format-repair loops. Keep the
original handoff untrusted, record the role's result as `review_incomplete` when
it was a review, and dispatch one fresh, bounded return to the responsible role
to independently reproduce or verify the actionable claims against the current
source state. This is evidence collection, not approval: route only claims in a
validated return, preserve any still-unverified claims as limitations, and keep
the task incomplete if the fresh return is malformed or inconclusive. A fresh
verification does not erase failed gates or bypass the normal correction,
review, cycle, or human-approval rules. For non-review handoffs, use the same
pattern with the originating role; do not ask unrelated roles to infer its
evidence.

## Risk and bugs

Classify `risk_profile` as `low`, `medium`, or `high`. `high` includes contract,
security, data, concurrency, external integration, critical behavior, or
material-impact bugs. Risk controls depth of planning and evidence, never waives
necessary tests.

For bug reproduction, preserve only useful evidence: `reproduction_status`,
steps, expected/observed, commands/results, sanitized logs, environment, and
limitations. Assisted reproduction requires an observation strategy before
asking the user to act.

## Alternatives and correction cycles

If implementation or review finds the approved approach infeasible, blocked, or
materially riskier than planned, stop that path and return to `developer` with
evidence, constraints, and viable alternatives. The developer routes back to the
planner for a bounded replan; do not silently change scope or keep repeating a
failing approach. Compare alternatives on feasibility, risk, quality, cost, and
validation effort. Use Jev for a genuine low-risk semantic tie when its answer
can change the choice; one call may batch independent judgments over the same
minimal state. Ask the user when alternatives change scope, behavior,
compatibility, accepted risk, or require a human checkpoint. Reapproval is
required if the approved objective, acceptance criteria, or material risk changes.

Permit parallel read-only discovery/planning only when inputs are stable and
scopes are independent. Serialize all edits and reviews against a shared
worktree; do not start a dependent reviewer or writer while another writer is
still active. Parallel implementation is allowed only for explicitly disjoint
files/modules, with one integrator (`developer`) reconciling the result before
tests/review.

Count each correction or replan loop in `cycle`, from 0 to 7. A return for a
production/test correction, `test_refinement_needed`, `needs_more_tests`,
`needs_correction`, or a new implementation approach after infeasibility/risk
consumes one cycle. A format-only handoff repair does not. After seven cycles
without convergence, enter `critical_checkpoint` and ask the user how to proceed.
Seven is a hard ceiling, not a target: stop earlier for repeated failures, no new
evidence or hypothesis, critical risk, or a blocked human decision.

Routing:

- `reviewer -> tester -> reviewer` for test defects or missing coverage when
  production behavior is correct;
- `reviewer -> coder -> tester -> reviewer` for production defects/regression
  coverage;
- `coder/reviewer -> developer -> planner` when the approach is infeasible or
  materially risky; continue only under the existing approval gate;
- `tester_disputed` and architectural/scope disputes return to `developer`;
- any non-`none` `research_request` returns to `developer` for bounded dispatch;
- failed gates return to the responsible role; no approval while they remain
  failed or stale.

## Quality gate and delivery

The reviewer identifies the stack and checks applicable formatting/syntax,
lint/typecheck, unit/integration/regression tests, build/package, coverage, and
security/quality analysis. Prefer existing project tools; propose new tools with
scope, cost, and justification.

The reviewer may inspect Git and run checks. Commit or push requires explicit
user authorization in the current task, even on a work branch. Never commit,
push, or force-push to production branches. Before authorized version control
operations, inspect branch, status, diff, and stage only intended files. Track
remote checks to a conclusive result when integration permits. Pending, failed,
not-triggered, or unverifiable CI prevents `review_approved`.

Final delivery records diff/state, commands and exit results, local/remote gate
state, manual validation requested/completed/pending, residual risks, and any
user override. Manual device validation must identify the firmware/build state
and the specific behavior tested; generic smoke checks do not prove a feature.
Tie committed CI evidence to the reviewed content and exact commit SHA. A
successful check for a different commit or changed worktree does not validate
the current state. Hardware evidence records build/firmware identity and the
observed feature effect; serial command acceptance alone is not proof of behavior.

## Jev

When an unresolved semantic judgment could change the next action, evaluate
`typesafe-jev_jev_decide` for a bounded, reversible, low-risk choice: a real
technical tie, a viable fallback selection, a non-scope blocking question, or
severity/risk/coverage classification. Skip it for facts determined by code,
docs, commands or tests, trivial choices, and answers that would not change the
action. Keep state minimal, batch independent questions, and record one compact
line in `decisions`. Confidence thresholds and schema are in
`docs/typesafe-jev-policy.md`. Jev never confirms goals, scope, plan approval,
business decisions, credentials, deployment, migration, deletion, or other
human gates; use `question` and await the user where required.

## Handoff contract

The canonical shared fields, per-role requirements, enums, and size limits are
in `templates/handoff-contract.md`. Every return includes all required keys; use
`none` for unavailable scalar values and `[]` for empty collections. Validate
against the template; include its content in a dispatch only when the receiving
harness cannot reliably read it.

When dispatching, include the relevant canonical workflow/instruction content
if the receiving agent cannot read it. A path reference is only a navigation
aid. Use the portable fallback in `docs/agent-instruction-delivery.md`; do not
rely on symlinks to bypass permissions or assume they work in every harness.

Use `REQ-*`, `AC-*`, and `TEST-*` to compact stable traceability, not to omit
context a receiving agent cannot access. Preserve
`REQ/AC -> implementation -> TEST -> result/evidence`; include negative,
boundary, and expected-failure cases for high-risk changes. Keep handoffs within
their role limit (60 lines for coder/coder-expert/reviewer, 50 for tester; other
roles retain their declared limits); include relevant decisions, paths, test
mapping, commands/results, snapshot, blockers, and pending work. Put verbose raw
logs in tool output and cite the specific command/result; do not truncate
decision-critical evidence to satisfy a small handoff budget.

## Human gates and traceability

1. One explicit user approval of objective and plan before code changes; omit a
   separate objective-confirmation round when intent is already clear.
2. Human acceptance of required manual/device validation; agents report evidence
   and limitations but do not claim user acceptance.
3. Business, scope, compatibility, irreversible actions, unresolved conceptual
   disagreement, and up to seven non-convergent correction cycles require the user.

Maintain `REQ -> implementation -> TEST -> REVIEW`. For bugs use
`BUG_REPORT -> reproduction evidence -> fix -> TEST_REGRESSION -> REVIEW`.
