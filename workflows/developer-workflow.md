# Developer Workflow

## Objective

Lean, requirements-led development with implementation, tests, review, and
human checkpoints. This document is the canonical source for states, routing,
limits, and handoff invariants. Agents receive the shared contract from
`templates/handoff-contract.md` on every dispatch, plus only the context needed
for their current step.

Follow [`docs/agent-instruction-delivery.md`](../docs/agent-instruction-delivery.md)
to verify file access and include canonical instruction content when it is not
available to the receiving harness.

## Standard flow

1. `developer` performs progressive discovery, classifies `risk_profile`, and
   confirms the objective with the user.
2. `planner` resolves technical ambiguity and produces a plan. A valid `analyst`
   handoff may supply requirements without reopening settled questions.
3. The user explicitly approves the objective and plan before implementation.
4. For high-risk work, `tester` defines acceptance, boundary, failure, and
   regression scenarios before implementation. This does not make TDD mandatory
   for simple work.
5. `coder` implements. Use `coder-expert` only for high complexity or explicit
   escalation.
6. `tester` adds or updates tests against the approved scenarios.
7. `reviewer` runs the full applicable suite, reviews code/tests, and verifies
   local and remote quality gates.
8. After `review_approved`, document the solution and present manual validation
   instructions. Work is `completed` only after required manual validation is
   recorded; only the user accepts device/hardware behavior.

For bugs, reproduce before planning where possible. High-risk bugs require
`tester` scenarios before the fix; low/medium-risk bugs may be fixed first and
receive a regression test afterward. Regression coverage is required before
approval in either path.

## Roles and separation

- `developer` is the only orchestrator and user interlocutor. It owns the
  canonical state ledger and validates every handoff before routing it.
- `planner` is read-only and defines architecture, risk, files, and test intent.
- `coder`/`coder-expert` change production only; they do not edit tests or run
  the full suite.
- `tester` changes tests only and runs tests created or changed by that step.
- `reviewer` is the only agent that runs the complete suite and issues a review
  decision. It does not edit source or tests.
- `analyst` is an optional primary agent that returns requirements; it does not
  start implementation.

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
the coder edits tests; the tester edits production; a full suite is run by coder
or tester; a bug lacks regression coverage at approval; or a review is approved
with a blocker, failed/missing test, stale gate, or inconclusive required check.

`review_approved` requires all of the following:

- `blockers: []` and no unresolved critical risk;
- every applicable `REQ-*`/`AC-*` linked to implementation and test evidence;
- complete applicable local tests, lint/format/build/coverage checks;
- remote CI conclusively green when configured and available;
- all gate evidence tied to the exact reviewed state (`head` plus timestamp).

If source state changes after a check, that check is `stale` and must be rerun.
For a dirty worktree, identify the reviewed state with the base HEAD plus a
stable diff hash or an equivalent harness-supported snapshot identifier. Never
claim a commit SHA for uncommitted changes.

`review_incomplete` is not approval. Missing output, malformed handoff, a step
limit, timeout, unavailable check, pending CI, or unreadable evidence must remain
incomplete or blocked. The developer may request one format-only correction for
a malformed handoff; do not route its claims as verified until corrected.

## Risk and bugs

Classify `risk_profile` as `low`, `medium`, or `high`. `high` includes contract,
security, data, concurrency, external integration, critical behavior, or
material-impact bugs. Risk controls depth of planning and evidence, never waives
necessary tests.

For bug reproduction, preserve only useful evidence: `reproduction_status`,
steps, expected/observed, commands/results, sanitized logs, environment, and
limitations. Assisted reproduction requires an observation strategy before
asking the user to act.

## Concurrency and correction cycles

Permit parallel read-only discovery/planning only when inputs are stable and
scopes are independent. Serialize all edits and reviews against a shared
worktree; do not start a dependent reviewer or writer while another writer is
still active. Parallel implementation is allowed only for explicitly disjoint
files/modules, with one integrator (`developer`) reconciling the result before
tests/review.

Count each correction loop in `cycle`, from 0 to 3. A return for a production or
test correction, `test_refinement_needed`, `needs_more_tests`, or
`needs_correction` consumes one cycle. A format-only handoff repair does not.
After three cycles without convergence, enter `critical_checkpoint` and ask the
user to choose how to proceed.

Routing:

- `reviewer -> tester -> reviewer` for test defects or missing coverage when
  production behavior is correct;
- `reviewer -> coder -> tester -> reviewer` for production defects/regression
  coverage;
- `tester_disputed` and architectural/scope disputes return to `developer`;
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

## Jev

Use `typesafe-jev_jev_decide` only for unresolved, reversible, low-risk choices:
technical ties already bounded by the plan, blocking questions that do not
change scope, or severity/risk/coverage classification. Never use it to confirm
goals, approve plans, decide business questions, credentials, deployment,
migration, deletion, or other human gates. Group independent questions and
record `jev: question -> answer/confidence -> decision` in `decisions`.

## Handoff contract

The canonical shared fields, per-role requirements, enums, and size limits are
in `templates/handoff-contract.md`. Every task dispatch MUST include the shared
contract or its exact compact block, and the role-specific required fields and
status enums. Do not substitute a prose reminder. Every return includes all
required keys; use `none` for unavailable scalar values and `[]` for empty
collections. An omitted required key makes the handoff invalid.

When dispatching, include the relevant canonical workflow/instruction content
if the receiving agent cannot read it. A path reference is only a navigation
aid. Use the portable fallback in `docs/agent-instruction-delivery.md`; do not
rely on symlinks to bypass permissions or assume they work in every harness.

Use `REQ-*`, `AC-*`, and `TEST-*` rather than repeating known context. Preserve
`REQ/AC -> implementation -> TEST -> result/evidence`; include negative,
boundary, and expected-failure cases for high-risk changes. Keep handoffs within
their role limit; put detailed logs in tool output and cite the command/result.

## Human gates and traceability

1. Explicit user approval of objective and plan before code changes.
2. Human acceptance of required manual/device validation; agents report evidence
   and limitations but do not claim user acceptance.
3. Business, scope, compatibility, irreversible actions, unresolved conceptual
   disagreement, and three non-convergent correction cycles require the user.

Maintain `REQ -> implementation -> TEST -> REVIEW`. For bugs use
`BUG_REPORT -> reproduction evidence -> fix -> TEST_REGRESSION -> REVIEW`.
