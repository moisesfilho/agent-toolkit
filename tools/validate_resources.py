#!/usr/bin/env python3
"""Validate the agent roles, task-note models, workflow, and portability.

The toolkit no longer uses a shared handoff contract: each role keeps its own
task note and returns a short operational result. This validator checks the
repository invariants that remain mechanizable.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOW_ROLES = ("developer", "planner", "coder", "tester", "reviewer")
NOTE_ROLES = ("planner", "coder", "tester", "reviewer")
OTHER_ROLES = ("analyst", "research", "retrospectiv", "model-setter", "minimal")
RETURN_ROLES = NOTE_ROLES + ("analyst", "research")
RETURN_FIELDS = ("resultado", "nota", "proximo")
REQUIRED_TEMPLATES = ("task-note.md", "task-record.md")
FORBIDDEN_TEXT = (
    "templates/handoff-contract.md",
    "coder-expert",
)
SCANNED_PATHS = (
    "agents",
    "templates",
    "workflows",
    "docs",
    "skills",
    "README.md",
    "README.pt-BR.md",
    "CONTRIBUTING.md",
)
WORKFLOW_PHRASES = (
    "Task notes",
    "one author per note",
    "consolidat",
    "sessionID",
    "review_incomplete",
    "stale",
    "observable progress",
    "numeric ceiling on correction cycles",
    "user authorization",
    "detached worktree",
)
WORKFLOW_SECTIONS = (
    "## Standard flow",
    "## Task notes and memory",
    "## Dispatch and sessions",
    "## Roles and separation",
    "## State and routing",
    "## Quality gate and delivery",
    "## Human gates",
)
NOTE_TEMPLATE_PHRASES = (
    "One author per note",
    "## Work done",
    "## Evidence",
    "## Pending and risks",
)
RECORD_TEMPLATE_PHRASES = (
    "Only the\n`developer` writes it",
    "## Objective and criteria",
    "## Validation",
    "## Residual risks",
)
HOME_PATH = re.compile(r"(?<![\w$])/home/[A-Za-z0-9._-]+/")


def frontmatter(content: str) -> str:
    match = re.match(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", content, re.DOTALL)
    if not match:
        raise ValueError("missing or malformed YAML frontmatter")
    return match.group(1)


def return_block(content: str) -> list[str] | None:
    matches = list(re.finditer(r"```text\s*\n(.*?)\n```", content, re.DOTALL))
    if not matches:
        return None
    return matches[-1].group(1).splitlines()


def check_text(label: str, text: str) -> list[str]:
    """Check portable text for retired references and machine-local paths."""
    errors: list[str] = []
    low = text.lower()
    for forbidden in FORBIDDEN_TEXT:
        if forbidden.lower() in low:
            errors.append(f"{label}: retired reference {forbidden!r}")
    for match in HOME_PATH.finditer(text):
        errors.append(f"{label}: absolute home path {match.group(0)!r}")
    return errors


def check_agent(role: str, content: str) -> list[str]:
    errors: list[str] = check_text(f"agents/{role}.md", content)
    try:
        header = frontmatter(content)
    except ValueError as error:
        return errors + [f"{role}: {error}"]

    if not re.search(r"(?m)^description:\s*\S+", header):
        errors.append(f"{role}: missing description")
    if not re.search(r"(?m)^mode:\s*\S+", header):
        errors.append(f"{role}: missing mode")

    steps = re.search(r"(?m)^steps:\s*(\d+)\s*$", header)
    if not steps:
        errors.append(f"{role}: missing numeric steps")
    elif role == "reviewer" and int(steps.group(1)) < 70:
        errors.append("reviewer: steps must be at least 70")

    block = return_block(content) if role in RETURN_ROLES else None
    if role in RETURN_ROLES and block is None:
        errors.append(f"{role}: missing ```text return block")
    elif block is not None:
        declared = {
            match.group(1)
            for line in block
            if (match := re.match(r"^([a-z][a-z0-9_-]*):", line))
        }
        missing = [field for field in RETURN_FIELDS if field not in declared]
        if missing:
            errors.append(f"{role}: return block missing fields: {', '.join(missing)}")

    if role in NOTE_ROLES and "templates/task-note.md" not in content:
        errors.append(f"{role}: must reference templates/task-note.md")

    if role == "reviewer":
        required_rules = (
            "review_approved` só é permitido em modo final",
            "review_feedback_ready` só é permitido em modo development",
            "review_incomplete",
            "blockers: []",
        )
        for rule in required_rules:
            if rule.lower() not in content.lower():
                errors.append(f"reviewer: missing fail-closed rule {rule!r}")
    return errors


def check_templates(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    note = root / "templates/task-note.md"
    record = root / "templates/task-record.md"
    if not note.is_file():
        errors.append("missing templates/task-note.md")
    else:
        text = note.read_text(encoding="utf-8")
        errors.extend(check_text("templates/task-note.md", text))
        for phrase in NOTE_TEMPLATE_PHRASES:
            if phrase not in text:
                errors.append(f"task-note template missing {phrase!r}")
    if not record.is_file():
        errors.append("missing templates/task-record.md")
    else:
        text = record.read_text(encoding="utf-8")
        errors.extend(check_text("templates/task-record.md", text))
        for phrase in RECORD_TEMPLATE_PHRASES:
            if phrase not in text:
                errors.append(f"task-record template missing {phrase!r}")
    return errors


def check_workflow(text: str) -> list[str]:
    errors = check_text("workflows/developer-workflow.md", text)
    for phrase in WORKFLOW_PHRASES:
        if phrase.lower() not in text.lower():
            errors.append(f"workflow missing invariant: {phrase}")
    for section in WORKFLOW_SECTIONS:
        if section not in text:
            errors.append(f"workflow missing section: {section}")
    return errors


def scan_resources(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    for target in SCANNED_PATHS:
        path = root / target
        if not path.exists():
            errors.append(f"missing {target}")
            continue
        files = [path] if path.is_file() else sorted(path.rglob("*"))
        for file in files:
            if not file.is_file() or ".bak." in file.name:
                continue
            if file.suffix not in {".md", ".mjs", ".js", ".ts", ".py"}:
                continue
            relative = file.relative_to(root).as_posix()
            errors.extend(check_text(relative, file.read_text(encoding="utf-8")))
    return errors


def check_repository(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    for role in FLOW_ROLES + OTHER_ROLES:
        path = root / f"agents/{role}.md"
        if not path.is_file():
            errors.append(f"missing agents/{role}.md")
            continue
        errors.extend(check_agent(role, path.read_text(encoding="utf-8")))

    errors.extend(check_templates(root))

    workflow = root / "workflows/developer-workflow.md"
    if not workflow.is_file():
        errors.append("missing workflows/developer-workflow.md")
    else:
        errors.extend(check_workflow(workflow.read_text(encoding="utf-8")))

    errors.extend(scan_resources(root))
    return errors


def main() -> int:
    errors = check_repository()
    if errors:
        print("Resource validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("PASS: agent roles, task notes, workflow, and portability")
    return 0


if __name__ == "__main__":
    sys.exit(main())
