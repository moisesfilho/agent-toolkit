#!/usr/bin/env python3
"""Validate the shared handoff contract and agent declarations."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMON_FIELDS = (
    "status",
    "origin",
    "next_action",
    "cycle",
    "changed",
    "commands",
    "tests",
    "quality_gate",
    "decisions",
    "risks",
    "blockers",
    "manual_validation",
    "overrides",
)
ROLE_LIMITS = {
    "analyst": 25,
    "planner": 40,
    "coder": 25,
    "coder-expert": 25,
    "tester": 25,
    "reviewer": 40,
}
ROLE_FIELDS = {
    "analyst": ("request_type", "objective", "facts", "assumptions", "scope", "out_of_scope",
                "requirements", "acceptance_criteria", "edge_cases", "validation"),
    "planner": ("objective_confirmed", "objective", "scope", "acceptance_criteria", "risk_profile",
                "requirements", "files", "planned_tests", "checkpoints"),
}
EXPECTED_STATUS = {
    "analyst": ("requirements_ready", "needs_clarification"),
    "planner": ("plan_ready", "needs_clarification"),
    "coder": ("implementation_ready", "implementation_corrected", "blocked"),
    "coder-expert": ("implementation_ready", "implementation_corrected", "blocked"),
    "tester": ("test_specification_ready", "test_ready", "test_refined", "tester_disputed"),
    "reviewer": ("review_approved", "test_refinement_needed", "needs_more_tests",
                 "needs_correction", "review_incomplete"),
}


def frontmatter(content: str) -> str:
    match = re.match(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", content, re.DOTALL)
    if not match:
        raise ValueError("missing or malformed YAML frontmatter")
    return match.group(1)


def field_block(content: str) -> list[str]:
    matches = list(re.finditer(r"```text\s*\n(.*?)\n```", content, re.DOTALL))
    if not matches:
        raise ValueError("missing ```text handoff block")
    return matches[-1].group(1).splitlines()


def check_agent(role: str, content: str) -> list[str]:
    errors: list[str] = []
    try:
        header = frontmatter(content)
        block = field_block(content)
    except ValueError as error:
        return [f"{role}: {error}"]

    steps = re.search(r"(?m)^steps:\s*(\d+)\s*$", header)
    if not steps:
        errors.append(f"{role}: missing numeric steps")
    elif role == "reviewer" and int(steps.group(1)) < 70:
        errors.append("reviewer: steps must be at least 70")

    declared = set(re.findall(r"(?m)^([a-z][a-z0-9_-]*):", "\n".join(block)))
    required = set(COMMON_FIELDS) | set(ROLE_FIELDS.get(role, ()))
    missing = sorted(required - declared)
    if missing:
        errors.append(f"{role}: handoff block missing fields: {', '.join(missing)}")
    if len(block) > ROLE_LIMITS[role]:
        errors.append(f"{role}: example handoff exceeds {ROLE_LIMITS[role]} lines")

    status_line = next((line for line in block if line.startswith("status:")), "")
    for status in EXPECTED_STATUS[role]:
        if status not in status_line:
            errors.append(f"{role}: status enum missing {status}")

    if role == "reviewer":
        required_rules = (
            "review_approved",
            "blockers: []",
            "review_incomplete",
            "nunca aprovação",
        )
        lower = content.lower()
        for rule in required_rules:
            if rule.lower() not in lower:
                errors.append(f"reviewer: missing fail-closed rule {rule!r}")
    return errors


def check_repository(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    template = root / "templates/handoff-contract.md"
    workflow = root / "workflows/developer-workflow.md"
    if not template.is_file():
        errors.append("missing templates/handoff-contract.md")
    else:
        text = template.read_text(encoding="utf-8")
        for field in COMMON_FIELDS:
            if not re.search(rf"(?m)^{re.escape(field)}:", text):
                errors.append(f"handoff template missing field {field}")
        if "Max lines" not in text or "25" not in text or "40" not in text:
            errors.append("handoff template must document 25/40 line limits")
    if not workflow.is_file():
        errors.append("missing workflows/developer-workflow.md")
    else:
        text = workflow.read_text(encoding="utf-8")
        for invariant in ("review_incomplete", "stale", "cycle", "templates/handoff-contract.md",
                          "user authorization"):
            if invariant.lower() not in text.lower():
                errors.append(f"workflow missing invariant: {invariant}")

    if template.is_file():
        text = template.read_text(encoding="utf-8")
        if not re.search(r"(?m)^cycle:\s*<0\.\.7>", text):
            errors.append("handoff template cycle range must be 0..7")
    if workflow.is_file():
        text = workflow.read_text(encoding="utf-8")
        if "from 0 to 7" not in text:
            errors.append("workflow cycle ceiling must be 7")
        if "only `developer` asks the" not in text:
            errors.append("workflow must route user questions through developer")

    for role in ROLE_LIMITS:
        path = root / f"agents/{role}.md"
        if not path.is_file():
            errors.append(f"missing agents/{role}.md")
            continue
        errors.extend(check_agent(role, path.read_text(encoding="utf-8")))
    return errors


def main() -> int:
    errors = check_repository()
    if errors:
        print("Handoff contract validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("PASS: shared handoff contract and agent declarations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
