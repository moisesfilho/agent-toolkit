# agent-note-writer

- Status: completed
- Date: 2026-11-10
- Risk profile: high
- Approved plan: `docs/agent-state/agent-note-writer/planner.md`

## Objective and criteria

Implement a standalone MCP, separate from Jev, that appends agent-note updates to `docs/agent-state/<task_slug>/<role>.md` using a server-generated `America/Fortaleza` timestamp in `YYYY-MM-DD HH:MM ±HH:MM` format. Approved bounds: 4096-byte input, 1 MiB note, 500 ms lock wait, and 2 s total operation. No resources or prompts. Security guarantee is best-effort against accidental misuse, not isolation from shell/configuration editable by the same UID.

All approved REQ/AC criteria were met. `AC-*` were software/runtime criteria; E2E behavior was measured in a disposable workspace. No mandatory manual/device validation remains.

## Result

Delivered the note-writer MCP, role-specific instructions and config examples, config validation, tests, workflow/template integration, and CI coverage on `develop`. The writer uses a fixed role per server, validates timestamps/anchors, serializes appends, and handles stale-lock recovery within the approved bounds. Developer's consolidated task record remains manual.

## Changes

- Production: `harnesses/agent-note-writer-mcp/` (server, writer, config checker, package and lockfile).
- Tests: `harnesses/agent-note-writer-mcp/tests/` and helpers, including deterministic timestamp, locking/recovery, timeout, security/config, and process regressions.
- Integration/docs: `agents/{planner,coder,tester,reviewer}.md`, `workflows/developer-workflow.md`, `templates/task-note.md`, `docs/contexto-persistente.md`, `harnesses/agent-note-writer-mcp/README.md`, and V2 config examples.
- Validation/CI: `tools/validate_resources.py`, `tests/test_validate_resources.py`, `.gitignore`, `code-map.md`, `.github/workflows/quality.yml` (push to `develop` added while preserving existing triggers).
- Per-role evidence: `docs/agent-state/agent-note-writer/{planner,coder,tester,reviewer}.md`.

## Validation

- Local final review: resource validator PASS; Python `unittest` 83/83; MCP `npm test` 84/84; dependency install, syntax checks and both V2 config examples passed. Reviewer evidence is in `docs/agent-state/agent-note-writer/reviewer.md` and is tied to the reviewed snapshot; the CI-trigger change did not alter reviewed MCP implementation/tests.
- E2E measured by tester: OpenCode v2.2.6 called the real server using a local fake provider and disposable workspace. Verified connection, two ordered appends with server timestamps, role ACL denial, and no path/timestamp redirection from extra fields. No paid/remote model call and no global config change.
- Remote CI: run [42874676839](https://github.com/moisesfilho/agent-toolkit/actions/runs/42874676839), `push`, completed `success` for `97d2fc1a1c69fb121ac61bbdf8769ca02ed24708`; `validate` job and all steps passed.
- Not run: `pytest`, because it is not installed and the project gate uses `unittest`; nonexistent npm `check`/`lint` scripts are not project gates. No device validation applies.
- Manual AC evidence: no required manual AC remains. E2E AC evidence kind: `medido` (tester note, 2026-11-10 14:51 -03:00).

## Decisions

- The MCP is separate from Jev and configured through project-local examples; global OpenCode configuration and Jev were not changed.
- Only planner, coder, tester and reviewer use the note tool. Developer writes the consolidated task record manually.
- Append operations accept `{task_slug,text}`; timestamp, path and role are server-controlled. Entries use a measured manual fallback if the MCP is unavailable.
- User authorized publishing to `develop` and adjusting the workflow if needed to trigger CI; the workflow was updated, then the commit was pushed.

## Residual risks

- Accepted best-effort boundary: a same-UID actor able to alter shell/config can bypass the MCP. Same-UID occupation of the recovery guard can deny recovery (fail-closed); TCP fallback can report false busy for a shared port bucket; intermediate-directory TOCTOU remains best-effort. These are documented and no critical blocker remains.
- The MCP is not enabled in global OpenCode configuration; adopting it in another project requires that project's local configuration.
- Manual validation remaining: none. No hardware behavior is involved.

## References

- Plan and role evidence: `docs/agent-state/agent-note-writer/{planner,coder,tester,reviewer}.md`.
- Commit: `97d2fc1` (`feat(agents): add timestamped note writer MCP`), pushed to `origin/develop`.
- CI: run `42874676839`, success on the commit SHA above.
