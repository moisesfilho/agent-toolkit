# tester - reviewer-readiness-without-ci

- Role: tester
- Updated: 2026-11-11 16:44 -03:00
- Code state: HEAD `1a41e0d615505d6cfcb1f97a1c4ad2a6230f2876` + worktree sujo
  (7 arquivos do escopo, incluindo `tests/test_validate_resources.py` alterado
  por este papel; worktree sujo não tem SHA próprio)

## Dispatch objective

Validação independente dos testes e asserções de `REQ-RR-01..05` para a mudança
de prontidão da revisão sem CI verde; inspecionar o diff, rastrear requisito ->
teste, investigar falsas aprovações (CI pendente/infra versus falha de código,
funcional manual pendente, teste local falho, publicação condicional e bloqueio
de produção). Alterar apenas testes, se houver lacuna material. Critério de
saída: relatório independente com cenários ausentes, regressões e conclusão
sobre a cobertura dos testes focados.

## Work done

- Li o plano proposto (`plans/2026-11-reviewer-readiness-without-ci.md`), a nota
  do planner (`REQ/AC/TEST-RR-*`), a nota do coder e o diff de
  `agents/reviewer.md`, `workflows/developer-workflow.md`,
  `tools/validate_resources.py` e `tests/test_validate_resources.py`.
- Confirmei que os testes do coder são não-vácuos para o que cobrem: cada
  invariante de `READINESS_RULES`/`WORKFLOW_READINESS_PHRASES` removida produz o
  erro esperado, e cada frase de `READINESS_FORBIDDEN`/
  `WORKFLOW_READINESS_FORBIDDEN` injetada é rejeitada.
- Verifiquei a sensibilidade do validador contra a regressão real: aplicar
  `check_agent`/`check_workflow` ao conteúdo de `HEAD` (pré-mudança) produz 12 e
  8 erros respectivamente, todos de prontidão; a árvore atual produz 0.
- Encontrei 4 lacunas materiais e acrescentei 5 testes (nenhuma asserção
  existente foi removida ou enfraquecida; produção não tocada):
  1. `test_reviewer_remote_ci_does_not_veto_readiness` (REQ-RR-03): exige
     "complementa a evidência e não substitui teste local", "não vetam a
     prontidão" e "mantém `review_incomplete` até diagnóstico".
  2. `test_workflow_remote_ci_does_not_veto_readiness` (REQ-RR-03): exige
     "never replaces a local test", "does not veto readiness", "keeps the review
     `review_incomplete` until diagnosed" e "different SHA never validates the
     reviewed snapshot".
  3. `test_requirements_link_to_automated_tests_and_coverage` (REQ-RR-01): exige
     o vínculo `REQ-*`/`AC-*` -> testes automatizados e cobertura nos dois
     arquivos normativos.
  4. `test_reviewer_requires_every_fail_closed_rule` (REQ-RR-04): percorre
     `REVIEWER_REQUIRED_RULES` e prova que remover qualquer regra fail-closed
     (inclusive `review_feedback_ready` só em development) é rejeitado; usa
     `re.sub` case-insensitive porque "Preflight" capitalizado no título
     satisfazia o token minúsculo.
  5. `test_reviewer_publication_needs_local_approval_and_avoids_production`
     (REQ-RR-05): exige autorização condicional, proibição de publicar antes do
     `review_approved` local, bloqueio de branches de produção e conferência do
     staged diff no reviewer (antes só o workflow era testado).
- Sensibilidade dos testes novos provada por mutação obrigatória: cada mutação
  abaixo foi aplicada isoladamente nos arquivos normativos e derrubou o teste
  correspondente; arquivos restaurados e conferidos por `sha256sum -c`.
  R1 "e não substitui teste local" removido -> teste 1 falha; R2 vínculo
  `REQ/AC`->testes automatizados removido -> teste 3 falha; R3 "não vetam a
  prontidão" invertido -> teste 1 falha; R4 autorização condicional removida ->
  teste 5 falha; R5 `review_feedback_ready` dev-only relaxado -> teste 4 falha;
  W1 "never replaces a local test" removido -> teste 2 falha; W2 vínculo em
  inglês removido -> teste 3 falha; W3 "does not veto readiness" invertido ->
  teste 2 falha.

## Evidence

| comando | exit | head | timestamp |
| --- | --- | --- | --- |
| `python3 -m unittest tests.test_validate_resources` (antes das minhas edições) | 0 (87 testes, OK) | `1a41e0d` + worktree sujo | 2026-11-11 16:39 -03:00 |
| `python3 -m unittest tests.test_validate_resources` (depois, 92 testes) | 0 (OK) | `1a41e0d` + worktree sujo | 2026-11-11 16:43 -03:00 |
| `python3 tools/validate_resources.py` | 0 (PASS) | `1a41e0d` + worktree sujo | 2026-11-11 16:43 -03:00 |
| `git diff --check` | 0 | `1a41e0d` + worktree sujo | 2026-11-11 16:43 -03:00 |
| mutação R1 (remover "não substitui teste local") + teste 1 | 1 (FAIL esperado) | `1a41e0d` + worktree sujo | 2026-11-11 16:43 -03:00 |
| mutação R2 (remover vínculo `REQ/AC`->testes) + teste 3 | 1 (FAIL esperado) | idem | idem |
| mutação R3 ("não vetam a prontidão" invertido) + teste 1 | 1 (FAIL esperado) | idem | idem |
| mutação R4 (autorização condicional removida) + teste 5 | 1 (FAIL esperado) | idem | idem |
| mutação R5 (`review_feedback_ready` dev-only relaxado) + teste 4 | 1 (FAIL esperado, subTeste da regra) | idem | idem |
| mutação W1/W2/W3 no workflow + testes 2/3 | 1 (FAIL esperado em cada) | idem | idem |
| `sha256sum -c` dos dois arquivos normativos após restauração | 0 (ambos SUCESSO) | idem | 2026-11-11 16:43 -03:00 |
| `check_agent('reviewer', HEAD:agents/reviewer.md)` / `check_workflow(HEAD:workflows/developer-workflow.md)` | 12 / 8 erros de prontidão (regressão real detectada) | `HEAD` | 2026-11-11 16:40 -03:00 |

Não executado por restrição de papel: suíte completa, cobertura global, gates de
CI remoto, preflight de build/lint e teste funcional de produto (o alvo é
conteúdo normativo/validador). Nenhum commit/push.

## Decisions and assumptions

- As lacunas encontradas são de **cobertura de teste** (defeito de teste), não de
  implementação: para todas as propriedades que o coder declarou e testou, o
  validador se comportou como especificado; não encontrei implementação
  incorreta nem ausente no escopo aprovado.
- Asserções novas são sobre propriedades do texto normativo e constantes do
  validador, sem copiar contagens/limiares literais e sem reimplementar a lógica
  sob validação.
- Snapshot de referência: `HEAD 1a41e0d` + worktree sujo; se o conteúdo dos
  arquivos mudar, os resultados acima ficam stale e exigem reexecução.
- `code-map.md` não precisou de ajuste por este papel: a descrição existente do
  arquivo de testes já cobre "cenários de prontidão sem CI verde (invariantes de
  implementação/testes/funcional e frases residuais de gate de CI rejeitadas)".

## Pending and risks

- `pendente` é token obrigatório em `READINESS_RULES`, mas já existia no texto de
  `HEAD` (medido: não é discriminante); o validador é verificação por token e não
  prova semântica. O que distingue a mudança são os demais tokens, as frases
  residuais rejeitadas e os testes de conteúdo acima.
- "A fresh verification does not erase failed gates" é texto pré-existente do
  workflow, sem teste dedicado; a mesma falha (evidência nova mascarar gate
  local falho) está coberta no que este plano acrescentou por "never replaces a
  local test" e "does not veto readiness", não pela primeira frase.
- Sem execução comportamental de produto: a mudança é prosa normativa + lint de
  recursos; limites de cobertura vêm de o validador não interpretar intenção.
- Suíte completa, cobertura, preflight e decisão final continuam com o
  `reviewer`; publicação segue condicionada ao `review_approved` local e à
  autorização da tarefa, fora do escopo deste papel.

## References

- `plans/2026-11-reviewer-readiness-without-ci.md`
- `docs/agent-state/reviewer-readiness-without-ci/planner.md` (`REQ/AC/TEST-RR-*`)
- `docs/agent-state/reviewer-readiness-without-ci/coder.md`
- `agents/reviewer.md`, `workflows/developer-workflow.md`,
  `tools/validate_resources.py`, `tests/test_validate_resources.py`
- `templates/task-note.md`, `workflows/developer-workflow.md` (formato da nota)

## Updates

### 2026-11-11 16:44 -03:00 - validação independente concluída com 5 testes acrescentados

- Fact: 92 testes focados OK, validador PASS, `git diff --check` 0, no snapshot
  `HEAD 1a41e0d` + worktree sujo; 4 lacunas materiais de cobertura fechadas e 8
  mutações de sensibilidade executadas; restauração dos arquivos normativos
  conferida por checksum. Cobertura considerada adequada para `REQ-RR-01..05`;
  próximo passo é o `reviewer`.
- Supersedes or discards: `none`.
