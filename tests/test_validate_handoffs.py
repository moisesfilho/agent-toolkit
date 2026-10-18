import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from validate_handoffs import check_agent, check_repository  # noqa: E402


class HandoffContractTests(unittest.TestCase):
    def test_repository_contract_is_valid(self):
        self.assertEqual(check_repository(ROOT), [])

    def test_missing_required_field_is_rejected(self):
        content = (ROOT / "agents/coder.md").read_text(encoding="utf-8")
        content = content.replace("origin: coder\n", "", 1)
        errors = check_agent("coder", content)
        self.assertTrue(any("missing fields: origin" in error for error in errors))

    def test_research_handoff_requires_sources_and_research_signal(self):
        content = (ROOT / "agents/research.md").read_text(encoding="utf-8")
        content = content.replace("research_request: none\n", "", 1)
        content = content.replace("sources: [title | URL | date | claim]\n", "", 1)
        errors = check_agent("research", content)
        self.assertTrue(any("research_request" in error for error in errors))
        self.assertTrue(any("sources" in error for error in errors))

    def test_handoff_over_role_limit_is_rejected(self):
        content = (ROOT / "agents/coder.md").read_text(encoding="utf-8")
        extra_lines = "".join(f"extra_{index}: value\n" for index in range(15))
        content = content.replace("origin: coder\n", f"origin: coder\n{extra_lines}", 1)
        errors = check_agent("coder", content)
        self.assertTrue(any("exceeds 25 lines" in error for error in errors))

    def test_routing_field_must_be_a_single_allowed_value(self):
        content = (ROOT / "agents/reviewer.md").read_text(encoding="utf-8")
        content = content.replace(
            "next_action: tester | coder | developer | none",
            "next_action: coder (tester handles tests)",
            1,
        )
        errors = check_agent("reviewer", content)
        self.assertTrue(any("next_action must list only" in error for error in errors))

    def test_duplicate_routing_field_is_rejected(self):
        content = (ROOT / "agents/coder.md").read_text(encoding="utf-8")
        content = content.replace("origin: coder\n", "origin: coder\norigin: reviewer\n", 1)
        errors = check_agent("coder", content)
        self.assertTrue(any("origin must appear exactly once" in error for error in errors))

    def test_cycle_must_be_a_single_integer_in_range(self):
        content = (ROOT / "agents/coder.md").read_text(encoding="utf-8")
        content = content.replace("cycle: 0", "cycle: 8", 1)
        errors = check_agent("coder", content)
        self.assertTrue(any("cycle must be a single integer" in error for error in errors))

    def test_reviewer_steps_cannot_drop_below_70(self):
        content = (ROOT / "agents/reviewer.md").read_text(encoding="utf-8")
        content = content.replace("steps: 70", "steps: 50", 1)
        errors = check_agent("reviewer", content)
        self.assertIn("reviewer: steps must be at least 70", errors)

    def test_reviewer_approval_requires_fail_closed_rules(self):
        content = (ROOT / "agents/reviewer.md").read_text(encoding="utf-8")
        content = content.replace(
            "review_approved` só é permitido em modo final",
            "review_approved` pode ser aprovado em qualquer modo",
            1,
        )
        errors = check_agent("reviewer", content)
        self.assertTrue(any("fail-closed rule" in error for error in errors))

    def test_reviewer_feedback_status_is_allowed(self):
        content = (ROOT / "agents/reviewer.md").read_text(encoding="utf-8")
        self.assertIn("review_feedback_ready", content)
        errors = check_agent("reviewer", content)
        self.assertFalse(any("status must list only" in error for error in errors))

    def test_reviewer_development_feedback_cannot_approve(self):
        content = (ROOT / "agents/reviewer.md").read_text(encoding="utf-8")
        self.assertIn("review_feedback_ready` só é permitido em modo development", content)
        self.assertIn("review_approved` só é permitido em modo final", content)

    def test_cycle_ceiling_is_seven(self):
        template = ROOT / "templates/handoff-contract.md"
        original = template.read_text(encoding="utf-8")
        template.write_text(original.replace("cycle: <0..7>", "cycle: <0..3>", 1), encoding="utf-8")
        try:
            errors = check_repository(ROOT)
            self.assertIn("handoff template cycle range must be 0..7", errors)
        finally:
            template.write_text(original, encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
