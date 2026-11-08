# coder - model-setter-retired-reference-cleanup

- Role: coder
- Updated: 2026-11-07
- Code state: HEAD `c0ee2dc` (`develop`), worktree sujo com `agents/model-setter.md`, `agents/research.md`, `code-map.md`, `tests/test_validate_resources.py`, `tools/validate_resources.py` modificados e `docs/agent-state/` não rastreado. Nenhum commit ou push.

## Dispatch objective

Aplicar a reformulação aprovada dos bullets de perfis em `agents/model-setter.md` (`REQ-REF-CLEAN` / `AC-REF-CLEAN`): manter o escopo positivo dos dez agentes do toolkit e `small_model`, sem nomear o papel retirado e sem afirmar estado de agentes fora do escopo. Fora de escopo: utilitário, regra do validador, configuração e os quatro arquivos de `research-local-read`.

## Work done

- A edição já presente no worktree (não comitada, de trabalho anterior) reescrevia os bullets `profiles list`, `profiles show` e `profiles apply`; era ela que introduzia duas ocorrências reprovadas pelo validador, ambas no bullet `profiles apply` (`agents/model-setter.md:120`).
- Removi desse bullet apenas as duas orações ofensoras: a frase sobre agentes nativos fora do toolkit e a menção nominal ao papel removido. Preservei a lista nominal, a ordem e a contagem dos dez agentes do toolkit, o `small_model` e a regra "cada perfil precisa cobrir exatamente esses dez agentes; agentes faltantes ou fora do escopo bloqueiam a aplicação". Nenhum outro bullet, arquivo, utilitário, regra do validador ou configuração foi tocado.
- `code-map.md` não foi alterado: a entrada `agents/` continua descrevendo corretamente `model-setter.md` (separação entre atribuições locais e catálogo global, fallbacks em `plugins[].options`), pois a mudança é textual e não altera estrutura, finalidade ou arquivos.

## Evidence

- Antes: `python3 tools/validate_resources.py` → `Resource validation failed:` com 2 erros de `retired reference` em `agents/model-setter.md`; exit 1. Os dois erros vinham de `check_agent` e `scan_resources` para a mesma linha.
- Depois: `python3 tools/validate_resources.py` → `PASS: agent roles, task notes, workflow, and portability`; exit 0 (`TEST-REF-01`).
- `TEST-REF-02`: `python3 -m unittest tests.test_validate_resources -v` → 57 testes, `OK`. `python3 -m unittest tests.test_agent_instruction_delivery_docs` → 5 testes, `OK`. `pytest` não existe no ambiente (`No module named pytest`); usei `unittest`, que é o runner nativo desses arquivos.
- `TEST-REF-03`: conferência programática sobre `agents/model-setter.md` → lista do bullet `profiles apply` igual, em ordem, a `analyst, coder, developer, minimal, model-setter, planner, research, retrospectiv, reviewer, tester` (10 itens), `small_model` presente, nome do papel retirado ausente do arquivo e ausência de menção ao estado dos agentes nativos fora do toolkit.
- Varredura `grep -rniI` do nome retirado em `agents templates workflows docs skills README.md README.pt-BR.md CONTRIBUTING.md`, excluindo `.bak.` → nenhuma ocorrência (exit 1).
- Primeira versão desta nota citava o nome retirado e, por estar em `docs/` (caminho varrido pelo validador), fez `python3 tools/validate_resources.py` falhar com 1 erro. A nota foi reescrita sem o literal e o validador voltou a `PASS` (exit 0). Isso também confirma que `docs/agent-state/` participa da varredura.
- Não rodei a suíte completa nem cobertura; não validei o comportamento real do utilitário `model-setter` externo, portanto a nota não afirma o que acontece com agentes fora do escopo — a frase foi removida em vez de reformulada.

## Decisions and assumptions

- Escolha conservadora dentro do plano: eliminar a promessa sobre agentes externos em vez de reescrevê-la, já que o contrato do utilitário não foi verificado nesta etapa e a alegação seria não comprovada.
- Mantive `profiles list` com "agentes fora do toolkit não entram nessa comparação" e `profiles show` com "agentes do toolkit": são enunciados sobre a lógica do utilitário já documentada, não sobre o estado de agentes externos, e não contêm o nome retirado.
- Premissa registrada: a alteração preexistente no worktree é anterior a esta tarefa e deve ser preservada/tratada pelo developer na separação de commits.
- Restrição descoberta: notas em `docs/agent-state/` são varridas pelo validador, então não podem reproduzir o nome retirado nem caminhos absolutos de home.

## Pending and risks

- Validação independente (tester/reviewer) nos mesmos comandos, incluindo confirmação de que o diff atribuível a esta tarefa é só a remoção das duas orações no bullet `profiles apply`.
- O worktree permanece com as quatro mudanças de `research-local-read` e com a reescrita preexistente dos bullets; sem commit, a separação depende do developer.
- `code-map.md` já está modificado por outra tarefa; não editei. Se o mapa for reescrito, a entrada de `agents/` precisa continuar compatível.

## References

- Despacho aprovado do developer (mensagem desta tarefa), `REQ-REF-CLEAN`, `AC-REF-CLEAN`, `TEST-REF-01..03`.
- `agents/model-setter.md` (único arquivo alterado nesta tarefa), `tools/validate_resources.py` (`FORBIDDEN_TEXT`, `check_text`, `check_agent`, `scan_resources`), `tests/test_validate_resources.py`.
- `code-map.md` (verificado, não alterado), `templates/task-note.md`, `docs/agent-state/model-setter-retired-reference-cleanup/planner.md`.
