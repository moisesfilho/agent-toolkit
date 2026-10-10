import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "docs/agent-instruction-delivery.md"


class AgentInstructionDeliveryDocsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guide = GUIDE.read_text(encoding="utf-8").lower()

    def test_guide_documents_single_canonical_workflow(self):
        self.assertTrue(re.search(r"canonical.{0,40}workflow", self.guide, re.S))
        self.assertTrue(re.search(r"single.{0,30}normative source", self.guide, re.S))
        self.assertIn("workflows/developer-workflow.md", self.guide)

    def test_unreadable_instructions_require_explicit_content_and_shared_contract(self):
        self.assertTrue(re.search(r"cannot read|read.{0,30}unavailable|restricted", self.guide))
        self.assertTrue(re.search(r"includes?.{0,100}directly in the dispatch", self.guide, re.S))
        self.assertIn("templates/handoff-contract.md", self.guide)
        self.assertTrue(re.search(r"not a substitute for the content", self.guide))

    def test_symlink_does_not_bypass_access_permissions(self):
        self.assertIn("symlinks do not grant access", self.guide)
        self.assertTrue(re.search(r"permissions.{0,40}harness acls", self.guide, re.S))

    def test_fallback_preserves_canonical_source_without_divergent_copy(self):
        self.assertTrue(re.search(r"explicit-content dispatch fallback", self.guide))
        self.assertTrue(
            re.search(r"do not create a\s+divergent normative copy", self.guide)
        )

    def test_documentation_entry_points_link_to_guide(self):
        for relative_path in ("README.md", "README.pt-BR.md", "docs/README.md"):
            with self.subTest(readme=relative_path):
                text = (ROOT / relative_path).read_text(encoding="utf-8")
                self.assertRegex(text, r"\]\((?:docs/)?agent-instruction-delivery\.md\)")
                target = "docs/agent-instruction-delivery.md"
                self.assertTrue((ROOT / target).is_file())


if __name__ == "__main__":
    unittest.main()
