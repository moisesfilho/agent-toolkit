import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from validate_resources import (  # noqa: E402
    check_agent,
    check_repository,
    check_text,
    check_workflow,
)


def agent(name: str) -> str:
    return (ROOT / f"agents/{name}.md").read_text(encoding="utf-8")


class ResourceValidationTests(unittest.TestCase):
    def test_repository_is_valid(self):
        self.assertEqual(check_repository(ROOT), [])

    def test_missing_return_field_is_rejected(self):
        content = re.sub(r"(?m)^proximo:.*\n", "", agent("coder"), count=1)
        errors = check_agent("coder", content)
        self.assertTrue(any("missing fields: proximo" in error for error in errors))

    def test_note_role_must_reference_the_task_note_template(self):
        content = agent("planner").replace("templates/task-note.md", "the note model")
        errors = check_agent("planner", content)
        self.assertTrue(any("must reference templates/task-note.md" in error for error in errors))

    def test_read_only_role_may_skip_the_note(self):
        content = agent("analyst")
        self.assertIn("nota: none", content)
        errors = check_agent("analyst", content)
        self.assertFalse(any("task-note" in error for error in errors))

    def test_reviewer_steps_cannot_drop_below_70(self):
        content = agent("reviewer").replace("steps: 70", "steps: 50", 1)
        errors = check_agent("reviewer", content)
        self.assertIn("reviewer: steps must be at least 70", errors)

    def test_reviewer_approval_requires_fail_closed_rules(self):
        content = agent("reviewer").replace(
            "review_approved` só é permitido em modo final",
            "review_approved` pode ser aprovado em qualquer modo",
            1,
        )
        errors = check_agent("reviewer", content)
        self.assertTrue(any("fail-closed rule" in error for error in errors))

    def test_retired_handoff_contract_reference_is_rejected(self):
        errors = check_text("docs/example.md", "See templates/handoff-contract.md.")
        self.assertTrue(any("retired reference" in error for error in errors))

    def test_retired_role_reference_is_rejected(self):
        errors = check_text("workflows/example.md", "Route to coder-expert when needed.")
        self.assertTrue(any("retired reference" in error for error in errors))

    def test_absolute_home_path_is_rejected(self):
        errors = check_text("agents/example.md", "Read /home/someone/project/file.md.")
        self.assertTrue(any("absolute home path" in error for error in errors))

    def test_dollar_home_permission_pattern_is_allowed(self):
        self.assertEqual(check_text("agents/example.md", 'resource: "$HOME/.ssh/*"'), [])

    def test_return_field_has_no_character_limit(self):
        content = agent("coder").replace(
            "proximo: <papel ou decisao necessaria>",
            "proximo: " + "x" * 2000,
            1,
        )
        errors = check_agent("coder", content)
        self.assertFalse(any("proximo" in error for error in errors))

    def test_task_templates_document_the_memory_lifecycle(self):
        note = (ROOT / "templates/task-note.md").read_text(encoding="utf-8")
        record = (ROOT / "templates/task-record.md").read_text(encoding="utf-8")
        self.assertIn("A role never edits another role's note", note)
        self.assertIn("There is no line limit", note)
        self.assertIn("Only the\n`developer` writes it", record)
        self.assertIn("future reference", record)

    def test_workflow_keeps_its_invariants(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        self.assertEqual(check_workflow(workflow), [])

    def test_workflow_rejects_missing_consolidation_rule(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        stripped = re.sub(r"consolidat\w*", "collect", workflow)
        errors = check_workflow(stripped)
        self.assertTrue(any("consolidat" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
