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

    def test_handoff_over_role_limit_is_rejected(self):
        content = (ROOT / "agents/coder.md").read_text(encoding="utf-8")
        extra_lines = "".join(f"extra_{index}: value\n" for index in range(15))
        content = content.replace("origin: coder\n", f"origin: coder\n{extra_lines}", 1)
        errors = check_agent("coder", content)
        self.assertTrue(any("exceeds 25 lines" in error for error in errors))

    def test_reviewer_steps_cannot_drop_below_70(self):
        content = (ROOT / "agents/reviewer.md").read_text(encoding="utf-8")
        content = content.replace("steps: 70", "steps: 50", 1)
        errors = check_agent("reviewer", content)
        self.assertIn("reviewer: steps must be at least 70", errors)

    def test_reviewer_approval_requires_fail_closed_rules(self):
        content = (ROOT / "agents/reviewer.md").read_text(encoding="utf-8")
        content = content.replace("nunca aprovação", "pode aprovar", 1)
        errors = check_agent("reviewer", content)
        self.assertTrue(any("fail-closed rule" in error for error in errors))

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
