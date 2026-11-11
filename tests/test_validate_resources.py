import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from validate_resources import (  # noqa: E402
    READINESS_ERROR,
    READINESS_FORBIDDEN,
    READINESS_RULES,
    RESEARCH_ALLOWED_ACTIONS,
    RESEARCH_FORBIDDEN_ACTIONS,
    RESEARCH_FORBIDDEN_EFFECTS,
    RESEARCH_FORBIDDEN_SEARCH_ACTIONS,
    RESEARCH_SENSITIVE_READ_DENIALS,
    REVIEWER_REQUIRED_RULES,
    WORKFLOW_READINESS_FORBIDDEN,
    WORKFLOW_READINESS_PHRASES,
    check_agent,
    check_repository,
    check_templates,
    check_text,
    check_workflow,
    frontmatter,
    permissions,
)


def agent(name: str) -> str:
    return (ROOT / f"agents/{name}.md").read_text(encoding="utf-8")


def workflow_text() -> str:
    return (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")


def normalized(content: str) -> str:
    return " ".join(content.split())


def inject_before_steps(content: str, rules: str) -> str:
    """Insert permission rules before the ``steps:`` key derived from the file."""
    return re.sub(r"(?m)^steps: ", lambda _match: rules + "steps: ", content, count=1)


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

    def test_planner_requires_a_negative_case_matrix(self):
        content = re.sub(r"NEG-\*", "ERRO-*", agent("planner"))
        errors = check_agent("planner", content)
        self.assertIn("planner: missing required rule 'NEG-*'", errors)

    def test_planner_requires_evidence_kind_for_manual_criteria(self):
        content = agent("planner").replace("evidence_kind", "tipo de evidência")
        errors = check_agent("planner", content)
        self.assertIn("planner: missing required rule 'evidence_kind'", errors)

    def test_tester_requires_negative_cases_before_implementation(self):
        content = agent("tester").replace("cenarios_prontos", "estado")
        errors = check_agent("tester", content)
        self.assertIn("tester: missing required rule 'cenarios_prontos'", errors)

    def test_note_roles_require_a_step_checkpoint(self):
        for role in ("planner", "coder", "tester", "reviewer"):
            with self.subTest(role=role):
                content = re.sub(r"(?i)checkpoint", "marcador", agent(role))
                errors = check_agent(role, content)
                self.assertIn(
                    f"{role}: must instruct a checkpoint before exhausting steps",
                    errors,
                )

    def test_note_roles_name_their_mcp_tool_and_fallback(self):
        for role in ("planner", "coder", "tester", "reviewer"):
            with self.subTest(role=role):
                content = agent(role)
                self.assertIn(f"note_{role}_append", content)
                self.assertIn("fallback", content.lower())
                mutated = content.replace(f"note_{role}_append", "a note tool", 1)
                errors = check_agent(role, mutated)
                self.assertIn(
                    f"{role}: must name the role note MCP tool note_{role}_append",
                    errors,
                )
                without_fallback = content.replace("fallback", "manual path")
                errors = check_agent(role, without_fallback)
                self.assertTrue(
                    any("manual fallback" in error for error in errors), errors
                )

    def test_workflow_requires_the_note_mcp_and_fallback_rule(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        self.assertIn("note_<role>_append", workflow)
        for phrase in ("note_<role>_append", "fallback"):
            with self.subTest(phrase=phrase):
                stripped = workflow.replace(phrase, "note tool")
                errors = check_workflow(stripped)
                self.assertTrue(any(phrase in error for error in errors), errors)

    def test_note_roles_require_the_edit_and_generated_field_rules(self):
        for role in ("planner", "coder", "tester", "reviewer"):
            content = agent(role)
            for phrase in ("task_slug", "`edit`", "não os inclua no texto"):
                with self.subTest(role=role, phrase=phrase):
                    mutated = content.replace(phrase, "removed", 1)
                    errors = check_agent(role, mutated)
                    self.assertTrue(any(phrase in error for error in errors), errors)

    def test_workflow_requires_the_edit_and_generated_field_rules(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        for phrase in ("write the note with `edit`", "do not put them in the text"):
            with self.subTest(phrase=phrase):
                errors = check_workflow(workflow.replace(phrase, "removed"))
                self.assertTrue(any(phrase in error for error in errors), errors)

    def test_task_note_requires_the_edit_and_generated_field_rules(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "templates").mkdir()
            for name in ("task-note.md", "task-record.md"):
                shutil.copy(ROOT / f"templates/{name}", root / f"templates/{name}")
            target = root / "templates/task-note.md"
            note = target.read_text(encoding="utf-8")
            target.write_text(
                note.replace("write the note with `edit`", "removed").replace(
                    "do not send them in the text", "removed"
                ),
                encoding="utf-8",
            )
            errors = check_templates(root)
            self.assertTrue(any("write the note with `edit`" in error for error in errors), errors)
            self.assertTrue(
                any("do not send them in the text" in error for error in errors), errors
            )

    def test_task_note_requires_the_note_mcp_and_fallback_rule(self):
        note = (ROOT / "templates/task-note.md").read_text(encoding="utf-8")
        self.assertIn("note_<role>_append", note)
        self.assertIn("fallback", note)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "templates").mkdir()
            for name in ("task-note.md", "task-record.md"):
                shutil.copy(ROOT / f"templates/{name}", root / f"templates/{name}")
            target = root / "templates/task-note.md"
            target.write_text(
                target.read_text(encoding="utf-8").replace("note_<role>_append", "note tool", 1),
                encoding="utf-8",
            )
            errors = check_templates(root)
            self.assertTrue(any("note_<role>_append" in error for error in errors), errors)

            target.write_text(
                note.replace("fallback", "manual path"),
                encoding="utf-8",
            )
            errors = check_templates(root)
            self.assertTrue(any("fallback" in error for error in errors), errors)


    def test_reviewer_requires_the_final_gate_preflight(self):
        content = re.sub(r"(?i)preflight", "inspeção", agent("reviewer"))
        errors = check_agent("reviewer", content)
        self.assertIn("reviewer: missing fail-closed rule 'preflight'", errors)

    def test_reviewer_requires_manual_evidence_kind(self):
        content = agent("reviewer").replace("evidence_kind", "tipo de evidência")
        errors = check_agent("reviewer", content)
        self.assertIn("reviewer: missing fail-closed rule 'evidence_kind'", errors)

    def test_reviewer_requires_every_readiness_invariant(self):
        content = agent("reviewer")
        for rule in READINESS_RULES:
            with self.subTest(rule=rule):
                mutated = content.replace(rule, "removido")
                self.assertNotEqual(mutated, content, rule)
                self.assertIn(
                    f"reviewer: missing readiness rule {rule!r}",
                    check_agent("reviewer", mutated),
                )

    def test_reviewer_rejects_remote_ci_as_a_readiness_prerequisite(self):
        content = agent("reviewer")
        for phrase in READINESS_FORBIDDEN:
            with self.subTest(phrase=phrase):
                errors = check_agent("reviewer", content + f"\n{phrase}.\n")
                self.assertTrue(
                    any(READINESS_ERROR in error for error in errors), errors
                )

    def test_reviewer_readiness_names_the_three_sources(self):
        content = normalized(agent("reviewer"))
        for source in ("revisão da implementação", "testes automatizados", "funcionais"):
            with self.subTest(source=source):
                self.assertIn(source, content)
        self.assertNotIn("pré-requisito de ci", content.lower())

    def test_reviewer_approval_may_coexist_with_pending_manual_validation(self):
        content = normalized(agent("reviewer"))
        self.assertIn("pode coexistir com pendência", content)
        self.assertIn("não torna a tarefa `completed`", content)

    def test_reviewer_classifies_remote_ci_states(self):
        content = normalized(agent("reviewer")).lower()
        for state in ("green", "pending", "infraestrutura", "sha", "review_incomplete"):
            with self.subTest(state=state):
                self.assertIn(state, content)
        self.assertIn("ci de `sha` diferente nunca comprova", content)

    def test_workflow_requires_every_readiness_invariant(self):
        content = workflow_text()
        for phrase in WORKFLOW_READINESS_PHRASES:
            with self.subTest(phrase=phrase):
                mutated = content.replace(phrase, "local step")
                self.assertNotEqual(mutated, content, phrase)
                self.assertIn(
                    f"workflow missing readiness invariant: {phrase}",
                    check_workflow(mutated),
                )

    def test_workflow_rejects_remote_ci_green_as_a_readiness_gate(self):
        content = workflow_text()
        for phrase in WORKFLOW_READINESS_FORBIDDEN:
            with self.subTest(phrase=phrase):
                errors = check_workflow(content + f"\n{phrase}.\n")
                self.assertTrue(
                    any(READINESS_ERROR in error for error in errors), errors
                )

    def test_workflow_keeps_pending_functional_validation_unevidenced(self):
        content = normalized(workflow_text())
        self.assertIn("it has no evidence kind", content)
        self.assertIn("never recorded as satisfied", content)
        self.assertIn("never marks the task `completed`", content)
        self.assertIn("reproducible procedure", content)
        self.assertIn("monitoring/log", content)

    def test_workflow_requires_authorized_publication_after_local_approval(self):
        content = normalized(workflow_text())
        self.assertIn("never publish before the local `review_approved`", content)
        self.assertIn("force-push to production branches", content)
        self.assertIn("review the staged diff", content)

    def test_reviewer_remote_ci_does_not_veto_readiness(self):
        content = normalized(agent("reviewer"))
        self.assertIn("complementa a evidência e não substitui teste local", content)
        self.assertIn("não vetam a prontidão", content)
        self.assertIn("mantém `review_incomplete` até diagnóstico", content)

    def test_workflow_remote_ci_does_not_veto_readiness(self):
        content = normalized(workflow_text())
        self.assertIn("never replaces a local test", content)
        self.assertIn("does not veto readiness", content)
        self.assertIn("keeps the review `review_incomplete` until diagnosed", content)
        self.assertIn(
            "different SHA never validates the reviewed snapshot", content
        )

    def test_requirements_link_to_automated_tests_and_coverage(self):
        reviewer = normalized(agent("reviewer"))
        workflow = normalized(workflow_text())
        self.assertIn(
            "`REQ-*`/`AC-*` ligados a testes automatizados e cobertura", reviewer
        )
        self.assertIn(
            "linked to implementation and to automated test and coverage evidence",
            workflow,
        )

    def test_reviewer_requires_every_fail_closed_rule(self):
        content = agent("reviewer")
        for rule in REVIEWER_REQUIRED_RULES:
            with self.subTest(rule=rule):
                mutated = re.sub(rf"(?i){re.escape(rule)}", "removido", content)
                self.assertNotEqual(mutated, content, rule)
                self.assertIn(
                    f"reviewer: missing fail-closed rule {rule!r}",
                    check_agent("reviewer", mutated),
                )

    def test_reviewer_publication_needs_local_approval_and_avoids_production(self):
        content = normalized(agent("reviewer"))
        self.assertIn("condicional à prontidão local", content)
        self.assertIn("nunca publique antes do `review_approved` local", content)
        self.assertIn("branches de produção", content)
        self.assertIn("confira o staged diff", content)

    def test_task_note_requires_gate_exit_codes(self):
        note = (ROOT / "templates/task-note.md").read_text(encoding="utf-8")
        self.assertIn("comando | exit | head | timestamp", note)
        self.assertIn("pending, still running", note)
        self.assertIn("checkpoint", note.lower())

    def test_task_record_requires_manual_evidence_kind(self):
        record = (ROOT / "templates/task-record.md").read_text(encoding="utf-8")
        self.assertIn("evidence kind", record)
        self.assertIn("`deferred` (user decision)", record)

    def test_workflow_requires_the_negative_case_gate(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        stripped = re.sub(r"(?i)negative case", "extra case", workflow)
        errors = check_workflow(stripped)
        self.assertTrue(any("negative case" in error for error in errors))

    def test_workflow_requires_preflight_and_checkpoint(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        for phrase in ("preflight", "checkpoint"):
            with self.subTest(phrase=phrase):
                stripped = re.sub(rf"(?i){phrase}", "step", workflow)
                errors = check_workflow(stripped)
                self.assertTrue(any(phrase in error for error in errors))

    def test_workflow_requires_manual_evidence_kind(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        stripped = workflow.replace("evidence kind", "evidence label")
        errors = check_workflow(stripped)
        self.assertTrue(any("evidence kind" in error for error in errors))

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

    def test_task_note_requires_timestamped_appends(self):
        note = (ROOT / "templates/task-note.md").read_text(encoding="utf-8")
        self.assertIn("## Updates", note)
        self.assertIn("Timestamp every appended update", note)
        self.assertIn("YYYY-MM-DD HH:MM", note)
        self.assertIn("superseded or\n  discarded", note)
        self.assertIn("Age alone does not invalidate", note)

    def test_task_record_excludes_superseded_items(self):
        record = (ROOT / "templates/task-record.md").read_text(encoding="utf-8")
        self.assertIn("current state only", record)

    def test_note_roles_require_timestamped_appends(self):
        for role in ("planner", "coder", "tester", "reviewer"):
            with self.subTest(role=role):
                content = agent(role).replace("carimbo de data/hora", "marcador")
                errors = check_agent(role, content)
                self.assertIn(
                    f"{role}: note updates must be timestamped and mark supersession",
                    errors,
                )

    def test_note_roles_require_supersession_marking(self):
        for role in ("planner", "coder", "tester", "reviewer"):
            with self.subTest(role=role):
                content = agent(role).replace("substitui ou descarta", "atualiza")
                errors = check_agent(role, content)
                self.assertIn(
                    f"{role}: note updates must be timestamped and mark supersession",
                    errors,
                )

    def test_workflow_keeps_its_invariants(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        self.assertEqual(check_workflow(workflow), [])

    def test_workflow_rejects_missing_consolidation_rule(self):
        workflow = (ROOT / "workflows/developer-workflow.md").read_text(encoding="utf-8")
        stripped = re.sub(r"consolidat\w*", "collect", workflow)
        errors = check_workflow(stripped)
        self.assertTrue(any("consolidat" in error for error in errors))

    def test_research_keeps_read_only_local_access(self):
        content = agent("research")
        self.assertEqual(check_agent("research", content), [])
        self.assertIn("no `shell`", content)

    def test_research_cannot_allow_shell(self):
        content = agent("research").replace(
            "steps: 35",
            '  - action: shell\n    resource: "*"\n    effect: allow\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertIn("research: must not allow shell", errors)

    def test_research_cannot_allow_external_directory(self):
        content = agent("research").replace(
            "steps: 35",
            '  - action: external_directory\n    resource: "*"\n    effect: allow\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertIn("research: must not allow external_directory", errors)

    def test_research_does_not_grant_grep(self):
        content = agent("research")
        grep_grant = re.compile(
            r'(?m)^  - action: grep\n    resource: "\*"\n    effect: (?:allow|ask)$'
        )
        self.assertIsNone(grep_grant.search(frontmatter(content)))
        self.assertEqual(check_agent("research", content), [])

    def test_research_rejects_grep_allow_or_ask(self):
        for effect in ("allow", "ask"):
            content = inject_before_steps(
                agent("research"),
                f'  - action: grep\n    resource: "*"\n    effect: {effect}\n',
            )
            with self.subTest(effect=effect):
                errors = check_agent("research", content)
                self.assertIn(f"research: must not {effect} grep", errors)
                self.assertFalse(
                    any("unsupported YAML layout" in error for error in errors), errors
                )

    def test_research_accepts_an_explicit_grep_denial(self):
        content = inject_before_steps(
            agent("research"),
            '  - action: grep\n    resource: "*"\n    effect: deny\n',
        )
        self.assertEqual(check_agent("research", content), [])

    def test_research_allowed_actions_are_the_approved_set(self):
        self.assertEqual(
            set(RESEARCH_ALLOWED_ACTIONS),
            {"read", "glob", "websearch", "webfetch"},
        )

    def test_research_real_config_grants_no_forbidden_action(self):
        entries = self.research_permissions()
        for action in RESEARCH_FORBIDDEN_ACTIONS + RESEARCH_FORBIDDEN_SEARCH_ACTIONS:
            with self.subTest(action=action):
                grants = [
                    effect
                    for entry_action, _, effect in entries
                    if entry_action == action and effect in RESEARCH_FORBIDDEN_EFFECTS
                ]
                self.assertEqual(grants, [])

    def test_research_requires_every_allowed_grant(self):
        content = agent("research")
        self.assertEqual(check_agent("research", content), [])
        for action in RESEARCH_ALLOWED_ACTIONS:
            grant = re.compile(
                rf'(?m)^  - action: {re.escape(action)}\n'
                r'    resource: "\*"\n'
                r"    effect: allow\n"
            )
            with self.subTest(action=action):
                self.assertEqual(len(grant.findall(content)), 1)
                errors = check_agent("research", grant.sub("", content, count=1))
                self.assertIn(f"research: must allow {action}", errors)

    def test_research_permission_entries_cover_every_declared_triple(self):
        header = frontmatter(agent("research"))
        declared = len(re.findall(r"(?m)^  - action: ", header))
        self.assertGreater(declared, 0)
        self.assertEqual(len(permissions(header)), declared)

    def test_research_must_deny_sensitive_reads(self):
        content = agent("research").replace('"*.pem"', '"*certificate*"', 1)
        errors = check_agent("research", content)
        self.assertIn("research: must deny read for .pem", errors)

    def test_research_requires_deny_all_baseline(self):
        content = agent("research").replace("effect: deny", "effect: allow", 1)
        errors = check_agent("research", content)
        self.assertIn("research: permissions must start from deny-all", errors)

    def test_research_rejects_flow_style_permission_entries(self):
        content = agent("research").replace(
            "steps: 35",
            '  - {action: shell, resource: "*", effect: allow}\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertTrue(any("unsupported YAML layout" in error for error in errors), errors)

    def test_research_rejects_reordered_permission_keys(self):
        content = agent("research").replace(
            "steps: 35",
            '  - resource: "*"\n    action: shell\n    effect: allow\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertTrue(any("unsupported YAML layout" in error for error in errors), errors)

    def test_research_rejects_commented_permission_effect(self):
        content = agent("research").replace(
            "steps: 35",
            '  - action: shell\n    resource: "*"\n    effect: allow  # temporary\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertTrue(any("unsupported YAML layout" in error for error in errors), errors)

    def test_research_rejects_block_scalar_permission_effect(self):
        content = agent("research").replace(
            "steps: 35",
            '  - action: shell\n    resource: "*"\n    effect: >-\n      allow\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertTrue(any("unsupported YAML layout" in error for error in errors), errors)

    def test_research_rejects_inline_permissions_list(self):
        content = agent("research").replace(
            "permissions:\n",
            'permissions: [{action: "*", resource: "*", effect: deny}]\n',
            1,
        )
        errors = check_agent("research", content)
        self.assertTrue(any("unsupported YAML layout" in error for error in errors), errors)

    def test_research_rejects_duplicate_permissions_key(self):
        content = agent("research").replace(
            "steps: 35",
            'permissions:\n  - action: shell\n    resource: "*"\n    effect: allow\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertTrue(any("unsupported YAML layout" in error for error in errors), errors)

    def test_research_enforces_deny_all_before_grants(self):
        content = agent("research").replace(
            "steps: 35",
            '  - action: "*"\n    resource: "*"\n    effect: deny\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertIn("research: deny-all must precede every grant", errors)

    def test_research_enforces_sensitive_denials_after_the_broad_read_grant(self):
        content = agent("research").replace(
            '  - action: read\n    resource: "*"\n    effect: allow\n',
            '  - action: read\n    resource: "*.env"\n    effect: deny\n'
            '  - action: read\n    resource: "*"\n    effect: allow\n',
            1,
        )
        errors = check_agent("research", content)
        self.assertTrue(
            any("must follow the broad read grant" in error for error in errors), errors
        )

    def test_research_rejects_regranting_a_sensitive_read(self):
        content = agent("research").replace(
            "steps: 35",
            '  - action: read\n    resource: "*.pem"\n    effect: allow\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertIn("research: must not re-grant read for *.pem", errors)

    def test_research_rejects_asking_for_a_sensitive_read(self):
        for fragment in RESEARCH_SENSITIVE_READ_DENIALS:
            pattern = f"*{fragment}"
            content = inject_before_steps(
                agent("research"),
                f'  - action: read\n    resource: "{pattern}"\n    effect: ask\n',
            )
            with self.subTest(resource=pattern):
                errors = check_agent("research", content)
                semantic = [
                    error for error in errors if "unsupported YAML layout" not in error
                ]
                self.assertTrue(
                    any(pattern in error for error in semantic),
                    errors,
                )

    def test_research_accepts_a_canonical_permission_addition(self):
        content = agent("research").replace(
            "steps: 35",
            '  - action: read\n    resource: "docs/**"\n    effect: allow\nsteps: 35',
            1,
        )
        self.assertEqual(check_agent("research", content), [])

    def test_research_sees_rules_after_column_zero_comments(self):
        for action in ("shell", "execute"):
            content = agent("research").replace(
                "steps: 35",
                '# section\n'
                f'  - action: {action}\n    resource: "*"\n    effect: allow\n'
                "steps: 35",
                1,
            )
            with self.subTest(action=action):
                errors = check_agent("research", content)
                self.assertIn(f"research: must not allow {action}", errors)

    def test_research_sees_sensitive_regrant_after_an_indented_comment(self):
        content = agent("research").replace(
            "steps: 35",
            '  # local notes\n'
            '  - action: read\n    resource: "*.env"\n    effect: allow\n'
            "steps: 35",
            1,
        )
        errors = check_agent("research", content)
        self.assertIn("research: must not re-grant read for *.env", errors)

    def test_research_accepts_innocent_comments_inside_the_block(self):
        content = agent("research").replace(
            "permissions:\n", "permissions:\n# local-only access\n", 1
        )
        content = content.replace("  - action: glob\n", "# search grants\n  - action: glob\n", 1)
        content = content.replace("steps: 35", "# web grants above\nsteps: 35", 1)
        self.assertEqual(check_agent("research", content), [])

    def test_research_accepts_a_comment_after_the_permissions_key(self):
        content = agent("research").replace(
            "permissions:\n", "permissions: # local access\n", 1
        )
        self.assertEqual(check_agent("research", content), [])

    def test_research_sees_rules_after_a_commented_permissions_key(self):
        content = agent("research").replace(
            "permissions:\n", "permissions: # local access\n", 1
        )
        content = content.replace(
            "steps: 35",
            '# section\n  - action: shell\n    resource: "*"\n    effect: allow\nsteps: 35',
            1,
        )
        errors = check_agent("research", content)
        self.assertIn("research: must not allow shell", errors)

    def test_research_rejects_continuation_after_a_comment(self):
        content = agent("research").replace(
            "steps: 35",
            '# section\n  - action: shell\n    resource: "*"\n    effect: >-\n      allow\n'
            "steps: 35",
            1,
        )
        errors = check_agent("research", content)
        self.assertTrue(any("unsupported YAML layout" in error for error in errors), errors)

    def test_research_rejects_comment_glued_to_the_permissions_key(self):
        for spelling in ("permissions:#comment", "permissions:\t#comment"):
            content = agent("research").replace(
                "permissions:\n", f"{spelling}\n", 1
            )
            with self.subTest(spelling=spelling):
                errors = check_agent("research", content)
                self.assertTrue(
                    any("unsupported YAML layout" in error for error in errors), errors
                )

    def test_research_fails_closed_when_a_malformed_key_hides_rules(self):
        content = agent("research").replace(
            "permissions:\n", "permissions:#comment\n", 1
        )
        content = inject_before_steps(
            content,
            '  - action: shell\n    resource: "*"\n    effect: allow\n',
        )
        errors = check_agent("research", content)
        self.assertTrue(any("unsupported YAML layout" in error for error in errors), errors)

    def test_research_accepts_a_comment_after_a_space(self):
        for spelling in ("permissions:", "permissions: # comment", "permissions:  # comment"):
            content = agent("research").replace(
                "permissions:\n", f"{spelling}\n", 1
            )
            with self.subTest(spelling=spelling):
                self.assertEqual(check_agent("research", content), [])

    def research_permissions(self):
        return permissions(frontmatter(agent("research")))

    def test_research_rejects_each_forbidden_action(self):
        for action in RESEARCH_FORBIDDEN_ACTIONS:
            for effect in ("allow", "ask"):
                content = inject_before_steps(
                    agent("research"),
                    f'  - action: {action}\n    resource: "*"\n    effect: {effect}\n',
                )
                with self.subTest(action=action, effect=effect):
                    self.assertIn(
                        f"research: must not {effect} {action}",
                        check_agent("research", content),
                    )

    def test_research_accepts_explicit_denials_for_forbidden_actions(self):
        for action in RESEARCH_FORBIDDEN_ACTIONS + RESEARCH_FORBIDDEN_SEARCH_ACTIONS:
            content = inject_before_steps(
                agent("research"),
                f'  - action: {action}\n    resource: "*"\n    effect: deny\n',
            )
            with self.subTest(action=action):
                self.assertEqual(check_agent("research", content), [])

    def test_research_rejects_external_directory_allow_and_ask(self):
        for effect in ("allow", "ask"):
            content = inject_before_steps(
                agent("research"),
                f'  - action: external_directory\n    resource: "*"\n    effect: {effect}\n',
            )
            with self.subTest(effect=effect):
                self.assertIn(
                    f"research: must not {effect} external_directory",
                    check_agent("research", content),
                )

    def test_research_deny_all_precedes_every_grant(self):
        entries = self.research_permissions()
        deny_all = [
            index
            for index, rule in enumerate(entries)
            if rule == ("*", "*", "deny")
        ]
        self.assertTrue(deny_all, "research: deny-all rule is missing")
        grants = [index for index, rule in enumerate(entries) if rule[2] == "allow"]
        self.assertTrue(grants, "research: no grants found")
        self.assertLess(max(deny_all), min(grants))

    def test_research_sensitive_denials_override_the_broad_read_grant(self):
        entries = self.research_permissions()
        broad = [
            index
            for index, rule in enumerate(entries)
            if rule == ("read", "*", "allow")
        ]
        self.assertTrue(broad, "research: missing broad read grant")
        broad_index = max(broad)
        sensitive_denials = [
            (index, resource)
            for index, (action, resource, effect) in enumerate(entries)
            if action == "read"
            and effect == "deny"
            and any(fragment in resource for fragment in RESEARCH_SENSITIVE_READ_DENIALS)
        ]
        self.assertTrue(sensitive_denials, "research: no sensitive read denials")
        for index, resource in sensitive_denials:
            self.assertGreater(index, broad_index, resource)

    def test_research_does_not_regrant_sensitive_reads(self):
        entries = self.research_permissions()
        regrants = [
            resource
            for action, resource, effect in entries
            if action == "read"
            and effect == "allow"
            and resource != "*.env.example"
            and any(fragment in resource for fragment in RESEARCH_SENSITIVE_READ_DENIALS)
        ]
        self.assertEqual(regrants, [])

    def test_research_env_example_exception_follows_the_env_denials(self):
        entries = self.research_permissions()
        exceptions = [
            index
            for index, rule in enumerate(entries)
            if rule == ("read", "*.env.example", "allow")
        ]
        self.assertTrue(exceptions, "research: missing .env.example exception")
        exception_index = max(exceptions)
        for pattern in ("*.env", "*.env.*"):
            denials = [
                index
                for index, rule in enumerate(entries)
                if rule == ("read", pattern, "deny")
            ]
            self.assertTrue(denials, f"research: missing read denial for {pattern}")
            self.assertGreater(exception_index, max(denials), pattern)

    def test_research_sensitive_denials_cover_home_secrets(self):
        entries = self.research_permissions()
        for resource in (
            "$HOME/.ssh/*",
            "$HOME/.local/share/opencode/auth.json",
            "$HOME/.config/opencode/auth.json",
        ):
            with self.subTest(resource=resource):
                self.assertIn(("read", resource, "deny"), entries)

    def test_research_instructions_do_not_present_grep_as_a_capability(self):
        negation = re.compile(
            r"\b(no|not|never|unavailable|cannot|without)\b", re.IGNORECASE
        )
        mentions = [line for line in agent("research").splitlines() if "grep" in line]
        self.assertTrue(mentions, "research: instructions should say grep is unavailable")
        for line in mentions:
            with self.subTest(line=line):
                self.assertRegex(line, negation)

    def test_research_instructions_keep_the_unreadable_path_fallback(self):
        content = " ".join(agent("research").split())
        self.assertIn("no `external_directory` grant", content)
        self.assertIn("developer must supply that content inline", content)
        self.assertIn("Do not infer content you could not read", content)

    def test_code_map_does_not_announce_grep_for_research(self):
        rows = [
            line
            for line in (ROOT / "code-map.md").read_text(encoding="utf-8").splitlines()
            if line.startswith("| `agents/`")
        ]
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertIn("research", row)
        self.assertNotIn("`read`/`glob`/`grep`", row)
        if "grep" in row:
            self.assertRegex(
                row, r"\b(no|not|never|unavailable|cannot|without|sem)\b"
            )


if __name__ == "__main__":
    unittest.main()
