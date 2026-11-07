# Documentation

This directory contains the concepts, conventions, compatibility notes, and
guides shared by the toolkit.

The imported baseline currently covers:

- agent roles, per-role task notes, and the consolidated task record;
- project initialization and reusable session-analysis guidance;
- TypeSafe AI and Jev integration guidance;
- the shared clean code skill for implementation, testing, and review;
- the developer workflow and quality gates;
- fail-closed review invariants, session reuse, and bounded decision checkpoints;
- progressive search and structured decision policies.

See [Delivering Agent Instructions](agent-instruction-delivery.md) for the
portable dispatch procedure, canonical-source rule, and symlink limitations.

See [Persistent Agent Context](contexto-persistente.md) for the task-note model,
consolidation, and session reuse.

`tools/validate_resources.py` checks agent roles, the task-note and task-record
models, workflow invariants, and portability. Run it from the repository root
with `python3 tools/validate_resources.py`.

All imported material must remain portable. Do not add credentials, private
memory, local machine paths, logs, caches, or generated artifacts.
