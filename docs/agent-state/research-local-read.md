# research-local-read

- Status: completed
- Date: 2026-11-07
- Risk profile: high
- Approved plan: `docs/agent-state/research-local-read/planner.md#Decisions-and-assumptions`

## Objective and criteria

Enable the `research` agent to discover and read scoped local project context while retaining web research, and prevent search previews of secrets and any mutation or broad external-directory access.

- `AC-LOCAL-RO`: satisfied. `read`/`glob` and web tools are available; `grep` is not granted; sensitive reads and external-directory access are denied.
- `AC-NO-MUTATION`: satisfied. Validator rejects grants (including `ask`) for prohibited actions and malformed permission headers fail closed.

## Result

Updated the agent policy, validator, regression tests, and code map. Native OpenCode probes confirmed local `glob`/`read` success and ACL denials/tool unavailability for the scoped negative cases. Final reviewer approved with no blockers.

## Changes

- `agents/research.md`
- `tools/validate_resources.py`
- `tests/test_validate_resources.py`
- `code-map.md`
- Role notes under `docs/agent-state/research-local-read/`

Commit: `516dc76 feat(research): allow scoped local context`.

## Validation

- Focused and full Python tests passed; final full suite: `python3 -m unittest discover -s tests -v` — 62 passed.
- `python3 tools/validate_resources.py`, Python `py_compile`, Markdown links (37 files), and `git diff --check` passed on reviewed commit `7adfa5d242a5a8fec06a907ddb3212d91966a4f5`.
- Native OpenCode V2.2.6 probe: real `research` used `glob` + `read` on `code-map.md` successfully. A disposable agent with equivalent ACL and synthetic fixture confirmed `read` of `.env` denied, `grep` and shell unavailable, and `/etc/hostname` denied as external. No real secret was used; temporary fixture/agent were removed.
- Remote GitHub Actions run `42435333453` completed successfully on the exact reviewed SHA, including `node --check` and all workflow gates. Local `node --check` was unavailable because Node was not installed.
- Final review: `review_approved`, blockers empty.

## Decisions

Removed `grep` rather than allowing text previews that could disclose sensitive content. The approved scope uses sequential `glob` discovery and targeted `read`; web access remains available. Push and commits were explicitly authorized by the user.

## Residual risks

The negative runtime probe used a temporary agent with the same ACL, not the actual `research` system prompt; it verifies native runtime permission enforcement, not full instruction-following behavior. No additional manual validation is pending; the runtime probes were performed with user authorization.

## References

`docs/agent-state/research-local-read/{planner,coder,tester,reviewer}.md`; `agents/research.md`; `tools/validate_resources.py`; `tests/test_validate_resources.py`; `.github/workflows/quality.yml`; commit `516dc76`; final reviewed SHA `7adfa5d242a5a8fec06a907ddb3212d91966a4f5`; CI run `42435333453`.
