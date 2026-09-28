---
name: clean-code
description: Apply pragmatic clean code principles when implementing, testing, reviewing, or refactoring software. Use across languages and frameworks to improve clarity, correctness, maintainability, and change safety without expanding scope.
---

# Clean Code Skill

Use this skill as a quality baseline for production code and automated tests.
Clean code makes its intent, constraints, failure modes, and change boundaries
easy to understand. It is not a demand for a specific style, pattern,
abstraction, or maximum number of lines.

## Core Principles

- Preserve approved behavior and scope before improving internal design.
- Prefer the simplest design that makes current requirements explicit.
- Give names to concepts, not implementation accidents. Names should reveal
  intent, units, state, and important constraints.
- Keep functions and modules focused on one coherent responsibility. Split code
  when a unit has multiple reasons to change, not merely because it is long.
- Keep dependencies visible and data flow easy to follow.
- Prefer deterministic, local transformations over hidden shared state and
  surprising side effects.
- Validate input close to the boundary where invalid data enters the system.
- Handle expected failures deliberately without leaking secrets or internals.
- Remove dead code and obsolete paths unless a concrete contract requires them.
- Avoid duplication of business rules. Do not replace harmless repetition with
  an abstraction whose meaning is less clear than the original.
- Make invalid states difficult to represent when project conventions support it.
- Favor small, reviewable changes. Refactor only when it reduces the risk or
  complexity of the requested change.

## Naming

- Use domain vocabulary already established by the project.
- Distinguish concepts with distinct names; avoid vague names such as `data`,
  `value`, `item`, `handler`, or `manager` when a precise name exists.
- Name booleans as predicates or states, such as `isActive`, `canRetry`, or
  `hasPermission`.
- Include units and boundaries when ambiguity is possible, such as `timeoutMs`,
  `maxAttempts`, or `createdAt`.
- Avoid unexplained abbreviations, misleading names, and names tied to
  temporary implementation details.

## Functions And Modules

- Keep control flow shallow with guard clauses and explicit exceptional paths.
- Keep functions cohesive and limit their inputs. A parameter object is useful
  when it represents a real concept, not when it hides an unstable interface.
- Separate orchestration from business rules, I/O, formatting, and persistence
  when that improves testing or change isolation.
- Keep modules aligned with the project's architecture and package boundaries.
- Do not introduce patterns, layers, interfaces, or generic helpers until they
  solve a demonstrated repetition, coupling, or volatility problem.
- Preserve public contracts and make changes to them explicit in the plan and
  tests.

## Comments And Documentation

- Prefer expressive code over comments that restate the code.
- Use comments to explain why a non-obvious constraint, workaround, ordering,
  algorithm, or security decision exists.
- Remove commented-out code and stale comments.
- Update nearby documentation when behavior, contracts, configuration, or
  operational assumptions change.

## Errors, Security, And Operations

- Validate untrusted input at boundaries and keep authorization checks explicit.
- Do not log credentials, tokens, personal data, or sensitive payloads.
- Preserve error identity and actionable context without exposing internals.
- Make retries, timeouts, idempotency, cancellation, and cleanup explicit when
  an operation can fail or outlive its caller.
- Look for unnecessary I/O, repeated expensive work, unbounded collections, and
  resource leaks in the affected path.
- Keep observability useful and low-noise, with operation, outcome, and
  correlation context but no secrets.

## Tests

- Test observable behavior and contracts before implementation details.
- Give each test one clear reason to fail and use precise assertions.
- Include relevant positive, negative, boundary, authorization, failure, and
  cleanup scenarios.
- Keep tests deterministic, isolated, and independent of execution order.
- Control time, randomness, network, filesystem, processes, and external
  services through explicit seams or reliable fixtures.
- Do not mock away the behavior under test or assert only that a mock was
  called when the outcome is what matters.
- Keep setup representative and clean up resources in every path.
- Never weaken an assertion, remove a valid scenario, or broaden a mock merely
  to make a failing test pass.

## Implementation Checklist

- The change is limited to the approved requirements.
- Names and boundaries communicate intent.
- Main and failure paths are readable.
- Validation, errors, cleanup, and security-sensitive behavior are explicit.
- No unnecessary abstraction, business-rule duplication, dead code, or
  unrelated refactoring was introduced.
- Local type checks, lint, build, or equivalent checks cover changed scope when
  available.

## Test Checklist

- Every requirement and relevant edge case has a concrete scenario.
- Assertions verify outcomes and important invariants precisely.
- Tests are deterministic, isolated, and resource-safe.
- Mocks and fixtures preserve the behavior that the test must exercise.
- Regression tests describe the observed bug and expected behavior.

## Review Checklist

Prioritize findings in this order:

1. Incorrect behavior, missing validation, security exposure, data loss, or
   resource leaks.
2. Broken contracts, failure handling, concurrency, performance, or operational
   risks that can affect users or production reliability.
3. Maintainability problems that make future changes error-prone or obscure
   domain behavior.
4. Style preferences only when they violate an explicit project convention or
   materially reduce clarity.

For each finding, identify the file or symbol, explain the concrete impact, and
distinguish confirmed defects from risks or suggestions. Do not reject code
solely because another valid style would also be possible.

## Language And Harness Neutrality

Apply these principles using the language, framework, architecture, formatter,
linter, and test conventions already present in the target project. Existing
project rules and explicit requirements take precedence over generic examples
in this skill. When conventions conflict, record the trade-off in the handoff
instead of silently rewriting unrelated code.
