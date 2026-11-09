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
    "appending, not by rewriting",
    "timestamp",
    "discards",
    "negative case",
    "preflight",
    "checkpoint",
    "evidence kind",
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
    "## Updates",
    "Timestamp every appended update",
    "supersedes or discards",
    "exit",
    "checkpoint",
)
RECORD_TEMPLATE_PHRASES = (
    "Only the\n`developer` writes it",
    "## Objective and criteria",
    "## Validation",
    "## Residual risks",
    "current state only",
    "evidence kind",
    "deferred",
)
HOME_PATH = re.compile(r"(?<![\w$])/home/[A-Za-z0-9._-]+/")
PERMISSION_BLOCK = re.compile(r"(?m)^permissions:(?: +#.*)?[ \t]*$")
PERMISSION_INLINE = re.compile(r"(?m)^permissions:[ \t]*[^\s#]")
PERMISSION_KEY = re.compile(r"(?m)^permissions:(?P<rest>[^\n]*)$")
PERMISSION_HEADER_REST = re.compile(r"(?: +#.*)?[ \t]*\Z")
PERMISSION_ENTRY = re.compile(
    r"(?m)^  - action: (?P<action>[^\s#][^#\n]*)\n"
    r"    resource: (?P<resource>[^\s#][^#\n]*)\n"
    r"    effect: (?P<effect>allow|deny|ask)\n"
)
PERMISSION_LAYOUT_ERROR = (
    "permissions block uses an unsupported YAML layout; "
    "use one `- action`/`resource`/`effect` triple per entry"
)
RESEARCH_ALLOWED_ACTIONS = ("read", "glob", "websearch", "webfetch")
RESEARCH_FORBIDDEN_ACTIONS = (
    "shell",
    "execute",
    "edit",
    "write",
    "patch",
    "external_directory",
)
RESEARCH_FORBIDDEN_SEARCH_ACTIONS = ("grep",)
RESEARCH_FORBIDDEN_EFFECTS = ("allow", "ask")
RESEARCH_SENSITIVE_READ_DENIALS = (
    ".env",
    ".pem",
    ".key",
    "id_rsa",
    "id_ed25519",
    "auth.json",
)
ROLE_REQUIRED_RULES = {
    "planner": (
        "risk_profile: high",
        "caso negativo",
        "NEG-*",
        "evidence_kind",
    ),
    "tester": (
        "caso negativo",
        "NEG-*",
        "cenarios_prontos",
    ),
}
REVIEWER_REQUIRED_RULES = (
    "review_approved` só é permitido em modo final",
    "review_feedback_ready` só é permitido em modo development",
    "review_incomplete",
    "blockers: []",
    "preflight",
    "evidence_kind",
)


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


def permission_block(header: str) -> list[str] | None:
    """Return the lines of the ``permissions:`` block, if declared as a block list.

    YAML comments are ignored wherever they appear and never change the
    indentation of the sequence, so a full-line comment in any column stays
    inside the block. Only a real top-level key closes it. The key spelling is
    canonical: either ``permissions:`` alone or at least one space before a
    trailing comment.
    """
    match = PERMISSION_BLOCK.search(header)
    if not match:
        return None
    lines: list[str] = []
    for line in header[match.end() :].splitlines()[1:]:
        stripped = line.strip()
        if stripped.startswith("#"):
            lines.append(line)
            continue
        if stripped and not line.startswith((" ", "\t")):
            break
        lines.append(line)
    return lines


def parse_permissions(header: str) -> tuple[list[tuple[str, str, str]], list[str]]:
    """Parse ``action``/``resource``/``effect`` triples without accepting loose YAML.

    Only the canonical block form the repository uses is understood. Any other
    valid YAML spelling (flow style, reordered keys, comments on a value, block
    scalars, extra keys) is reported instead of being silently skipped, so an
    unrecognized layout can never hide an allow rule. A malformed ``permissions:``
    key spelling, such as a comment with no separating space or with a tab,
    fails closed because the file cannot be analyzed reliably.
    """
    keys = list(PERMISSION_KEY.finditer(header))
    if len(keys) > 1:
        return [], [PERMISSION_LAYOUT_ERROR]
    if keys and not PERMISSION_HEADER_REST.match(keys[0].group("rest")):
        return [], [PERMISSION_LAYOUT_ERROR]
    if len(PERMISSION_INLINE.findall(header)) + len(PERMISSION_BLOCK.findall(header)) > 1:
        return [], [PERMISSION_LAYOUT_ERROR]
    if PERMISSION_INLINE.search(header):
        return [], [PERMISSION_LAYOUT_ERROR]
    block = permission_block(header)
    if block is None:
        return [], []
    text = "\n".join(block) + "\n"
    entries: list[tuple[str, str, str]] = []
    residue = text
    for match in PERMISSION_ENTRY.finditer(text):
        entries.append(
            (
                match.group("action").strip().strip('"'),
                match.group("resource").strip().strip('"'),
                match.group("effect"),
            )
        )
        residue = residue.replace(match.group(0), "", 1)
    leftover = "\n".join(
        line
        for line in residue.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    )
    if leftover:
        return entries, [PERMISSION_LAYOUT_ERROR]
    return entries, []


def permissions(header: str) -> list[tuple[str, str, str]]:
    """Read canonical ``action``/``resource``/``effect`` triples from the frontmatter."""
    return parse_permissions(header)[0]


def check_research_permissions(header: str) -> list[str]:
    """``research`` keeps local ``read``/``glob`` and web grants, never search or mutation.

    ``allow`` and ``ask`` are both treated as grants: answering a prompt is not a
    durable invariant, so prohibited actions and textual search must be absent or
    explicitly denied. Sensitive read resources must end as ``deny``; a later
    ``allow`` or ``ask`` would override the denial under last-wins evaluation.
    """
    entries, layout_errors = parse_permissions(header)
    if layout_errors:
        return [f"research: {error}" for error in layout_errors]
    errors: list[str] = []
    deny_all = [index for index, rule in enumerate(entries) if rule == ("*", "*", "deny")]
    if not deny_all:
        errors.append("research: permissions must start from deny-all")
    grants = [index for index, (_, _, effect) in enumerate(entries) if effect == "allow"]
    if deny_all and grants and min(grants) < max(deny_all):
        errors.append("research: deny-all must precede every grant")
    for required in RESEARCH_ALLOWED_ACTIONS:
        if not any(
            action == required and resource == "*" and effect == "allow"
            for action, resource, effect in entries
        ):
            errors.append(f"research: must allow {required}")
    forbidden = RESEARCH_FORBIDDEN_ACTIONS + RESEARCH_FORBIDDEN_SEARCH_ACTIONS
    for action_name in forbidden:
        effects = {
            effect
            for action, _, effect in entries
            if action == action_name and effect in RESEARCH_FORBIDDEN_EFFECTS
        }
        for effect in sorted(effects):
            errors.append(f"research: must not {effect} {action_name}")
    denied_read = [
        resource for action, resource, effect in entries if action == "read" and effect == "deny"
    ]
    for fragment in RESEARCH_SENSITIVE_READ_DENIALS:
        if not any(fragment in resource for resource in denied_read):
            errors.append(f"research: must deny read for {fragment}")
    broad_read = [
        index for index, rule in enumerate(entries) if rule == ("read", "*", "allow")
    ]
    boundary = max(broad_read) if broad_read else None
    for index, (action, resource, effect) in enumerate(entries):
        if action != "read":
            continue
        sensitive = any(fragment in resource for fragment in RESEARCH_SENSITIVE_READ_DENIALS)
        if not sensitive:
            continue
        if effect != "deny":
            if resource != "*.env.example":
                errors.append(f"research: must not re-grant read for {resource}")
            continue
        if boundary is not None and index < boundary:
            errors.append(
                f"research: read denial for {resource} must follow the broad read grant"
            )
    return errors


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

    if role in NOTE_ROLES:
        if "templates/task-note.md" not in content:
            errors.append(f"{role}: must reference templates/task-note.md")
        for rule in ("carimbo de data/hora", "substitui ou descarta"):
            if rule not in content:
                errors.append(
                    f"{role}: note updates must be timestamped and mark supersession"
                )
                break
        if "checkpoint" not in content.lower():
            errors.append(f"{role}: must instruct a checkpoint before exhausting steps")

    for required in ROLE_REQUIRED_RULES.get(role, ()):
        if required.lower() not in content.lower():
            errors.append(f"{role}: missing required rule {required!r}")

    if role == "research":
        errors.extend(check_research_permissions(header))

    if role == "reviewer":
        for rule in REVIEWER_REQUIRED_RULES:
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
