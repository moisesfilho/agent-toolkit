# Documentation

This directory contains the concepts, conventions, compatibility notes, and
guides shared by the toolkit.

The imported baseline currently covers:

- agent roles and handoff contracts;
- project initialization and reusable session-analysis guidance;
- TypeSafe AI and Jev integration guidance;
- the shared clean code skill for implementation, testing, and review;
- the developer workflow and quality gates;
- the shared incremental handoff contract, fail-closed review invariants, and
  bounded decision checkpoints;
- progressive search and structured decision policies.

See [Delivering Agent Instructions](agent-instruction-delivery.md) for the
portable dispatch procedure, canonical-source rule, and symlink limitations.

`tools/validate_handoffs.py` checks that agent handoff examples and the
developer workflow remain aligned with `templates/handoff-contract.md`. Run it
from the repository root with `python3 tools/validate_handoffs.py`.

All imported material must remain portable. Do not add credentials, private
memory, local machine paths, logs, caches, or generated artifacts.
