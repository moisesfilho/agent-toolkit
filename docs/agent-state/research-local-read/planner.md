# planner - research-local-read

- Role: planner
- Updated: 2026-11-07 (replanejamento após revisão final)
- Code state: base HEAD `c0ee2dc3c7956b92ea8ca006a29749cb4153d19` + snapshot isolado de quatro arquivos da tarefa identificado pelo reviewer em `reviewer.md:5,17`; estado atual da worktree não aferido por este papel (sem comandos).

## Dispatch objective

Replanejar acesso local somente leitura para `research` após revisão final, comparando alternativas que não confundam instrução de privacidade com isolamento por ACL. Baseline mantido: REQ-LOCAL-RO / AC-LOCAL-RO e REQ-NO-MUTATION / AC-NO-MUTATION; não implementar nem aceitar risco em nome do usuário.

## Work done

Reset de hipótese: a combinação aprovada `read`/`glob`/`grep` + negações `read` para segredos não impede previews sensíveis de `grep`. Preservadas evidências de correção dos bypasses anteriores de parser e dos 47 testes Python/validação/links/estrutura que passaram no snapshot do reviewer; não equivalem a prova de isolamento em runtime. Plano recomendado: retirar o grant `grep`, manter deny-all, `read`/`glob` + web, negações `read` e fallback de conteúdo fornecido pelo developer; consultar arquivos encontrados via `read` em vez de busca textual automática. Só após reaprovação humana da redução de capacidade. Correção de `ask` proibido é blocker técnico obrigatório, independentemente dessa escolha; spelling `permissions:#comment` é melhoria adjacente pequena.

## Evidence

`reviewer.md:19-30,38-41` registra 47 testes e validações Python/links/estrutura OK no snapshot isolado, `node --check` indisponível, CI remoto não executado; reprodução `shell: ask` aceito pelo validador; semântica V2 de `grep`/`glob` por padrão de consulta (não caminho) e nenhuma prova runtime. `tester.md:85-109` e `coder.md:20-24` detalham investigação V2; `agents/research.md:4-52,60-69` e `tools/validate_resources.py:70-89,178-216` confirmam grants e lacuna atual. Replanejamento apenas por leitura; não executei checagens nem alterei código/testes/configuração.

## Decisions and assumptions

Recomendação técnica B: `read` + `glob` + web, sem `grep`, preservando deny-all/negações de `read` e sem `external_directory`; `glob` pode expor nomes de arquivos mas não previews de conteúdo. A oferece busca textual, porém aceita divulgação potencial de segredos: requer consentimento explícito de risco e não satisfaz privacidade por ACL. C (grep limitado pelo padrão de busca) não controla caminhos no V2; ferramenta alternativa/sandbox exigiria novo mecanismo, escopo e validação, sem evidência de viabilidade atual. B reduz capacidade frente ao plano aprovado, logo requer reaprovação humana antes de mudar a configuração. Premissa: leitura sequencial de arquivos descobertos é capacidade local suficiente, com menor eficiência; se isso inviabilizar a investigação, voltar ao developer para nova decisão humana, não reabilitar grep silenciosamente. Risco `high` por possível vazamento de dados e política de execução; nenhuma decisão de aceitação delegada ao Jev.

## Pending and risks

Após reaprovação, coder deve ajustar `agents/research.md`, `tools/validate_resources.py`, `tests/test_validate_resources.py` e `code-map.md`; tester/reviewer verificam TEST-LOCAL-DISCOVERY (glob + read comum, web e fallback externo), TEST-SECRET-READ (negações e precedência; fixture sintética), TEST-NO-GREP (ausência/negação de grep, incluindo tentativa de obter preview de fixture sensível), TEST-NO-MUTATION (shell/execute/edit/write/patch/external_directory: allow e ask rejeitados no validador e negados em probe seguro), TEST-PARSER-MALFORMED (`permissions:#comment` rejeitado). Mapa: REQ-LOCAL-RO / AC-LOCAL-RO -> TEST-LOCAL-DISCOVERY, TEST-SECRET-READ, TEST-NO-GREP; REQ-NO-MUTATION / AC-NO-MUTATION -> TEST-NO-MUTATION, TEST-PARSER-MALFORMED. TEST-PARSER-MALFORMED é adjacente; `ask` é blocker do critério de não mutação. Gating: não marcar revisão final concluída sem testes focados e suíte completa no estado final, checagem Node configurada e CI remoto quando aplicável/disponível; sem probe runtime registrar limitação expressa. Sem commit/push autorizado. Checkpoints humanos: reaprovar mudança de capacidade/risco antes da implementação; qualquer aceitação de exposição A, expansão externa ou commit/push é decisão humana distinta.

## References

`agents/research.md`; `agents/analyst.md`; `agents/planner.md`; `tools/validate_resources.py`; `tests/test_validate_resources.py`; `workflows/developer-workflow.md`; `docs/agent-instruction-delivery.md`; `templates/task-note.md`; `code-map.md`.
