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
    "research_request",
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
    "coder": 60,
    "coder-expert": 60,
    "tester": 50,
    "reviewer": 60,
    "research": 25,
}
ROLE_FIELDS = {
    "analyst": ("request_type", "objective", "facts", "assumptions", "scope", "out_of_scope",
                "requirements", "acceptance_criteria", "edge_cases", "validation"),
    "planner": ("objective_confirmed", "objective", "scope", "acceptance_criteria", "risk_profile",
                "requirements", "files", "planned_tests", "checkpoints"),
    "research": ("research_question", "findings", "sources", "recommendation"),
}
EXPECTED_STATUS = {
    "analyst": ("requirements_ready", "needs_clarification"),
    "planner": ("objective_ready", "plan_ready", "needs_clarification"),
    "coder": ("implementation_ready", "implementation_corrected", "blocked"),
    "coder-expert": ("implementation_ready", "implementation_corrected", "blocked"),
    "tester": ("test_specification_ready", "test_ready", "test_refined", "tester_disputed"),
    "reviewer": ("review_feedback_ready", "review_approved", "test_refinement_needed", "needs_more_tests",
                 "needs_correction", "review_incomplete"),
    "research": ("research_complete", "research_inconclusive"),
}
EXPECTED_ACTION = {
    "analyst": ("handoff_to_developer", "request_clarification"),
    "planner": ("developer",),
    "coder": ("tester", "developer"),
    "coder-expert": ("tester", "developer"),
    "tester": ("reviewer", "coder", "developer"),
    "reviewer": ("tester", "coder", "developer", "none"),
    "research": ("developer",),
}
ROUTING_FIELDS = ("status", "origin", "next_action", "cycle")
WORKFLOW_INVARIANTS = (
    "Dispatch and scope control",
    "update the existing canonical ledger",
    "blocking for an acceptance criterion/gate",
    "reviewer interrupted",
    "exact commit SHA",
)


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

    values: dict[str, list[str]] = {field: [] for field in ROUTING_FIELDS}
    for line in block:
        match = re.match(r"^([a-z][a-z0-9_-]*):\s*(.*)$", line)
        if match and match.group(1) in values:
            values[match.group(1)].append(match.group(2).strip())
    for field, field_values in values.items():
        if len(field_values) != 1:
            errors.append(f"{role}: routing field {field} must appear exactly once")

    if values["origin"] and values["origin"] != [role]:
        errors.append(f"{role}: origin must be the single scalar {role}")
    if values["cycle"] and not re.fullmatch(r"[0-7]", values["cycle"][0]):
        errors.append(f"{role}: cycle must be a single integer from 0 to 7")
    if values["next_action"]:
        actions = tuple(item.strip() for item in values["next_action"][0].split("|"))
        if actions != EXPECTED_ACTION[role]:
            errors.append(f"{role}: next_action must list only its allowed scalar values")

    if values["status"]:
        statuses = tuple(item.strip() for item in values["status"][0].split("|"))
        if statuses != EXPECTED_STATUS[role]:
            errors.append(f"{role}: status must list only its allowed scalar values")

    if role == "reviewer":
        required_rules = (
            "review_approved",
            "blockers: []",
            "review_incomplete",
            "nunca aprovação",
            "review_approved` só é permitido em modo final",
            "review_feedback_ready` só é permitido em modo development",
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
        if "Max lines" not in text or "60" not in text or "50" not in text:
            errors.append("handoff template must document 60/50 line limits")
        if "machine-checkable" not in text or "format-only repair" not in text:
            errors.append("handoff template must define routing and malformed-handoff recovery")
    if not workflow.is_file():
        errors.append("missing workflows/developer-workflow.md")
    else:
        text = workflow.read_text(encoding="utf-8")
        for invariant in ("review_incomplete", "stale", "cycle", "templates/handoff-contract.md",
                          "user authorization", "fresh, bounded", "independently reproduce"):
            if invariant.lower() not in text.lower():
                errors.append(f"workflow missing invariant: {invariant}")
        for invariant in WORKFLOW_INVARIANTS:
            if invariant.lower() not in text.lower():
                errors.append(f"workflow missing dispatch/scope invariant: {invariant}")

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
