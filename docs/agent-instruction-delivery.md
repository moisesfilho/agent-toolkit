# Delivering Agent Instructions

The canonical development workflow is
[`workflows/developer-workflow.md`](../workflows/developer-workflow.md). Keep
that file as the single normative source; dispatches should carry its relevant
content, not a separately maintained copy.

Before delegating, the developer must determine whether the agent and harness
can read the referenced workflow and other required files. If a read is
unavailable, restricted, or uncertain, the receiving agent must declare that
limitation. The developer then includes the relevant canonical instructions
directly in the dispatch, along with the complete shared contract from
[`templates/handoff-contract.md`](../templates/handoff-contract.md). A file path
may be included as a navigation aid, but is not a substitute for the content.

Harnesses differ in how they expose files and permissions. Do not assume that a
path, tool, or integration available in one harness is available in another.
Symlinks do not grant access beyond filesystem permissions or harness ACLs and
are not portable across all harnesses. When a symlink or referenced file cannot
be followed, use the explicit-content dispatch fallback above; do not create a
divergent normative copy.
