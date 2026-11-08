# planner - model-setter-retired-reference-cleanup

- Role: planner
- Updated: 2026-11-07
- Code state: HEAD `c0ee2dc` (`develop`), com alteração preexistente e não comitada em `agents/model-setter.md`, conforme despacho; não executei comandos nem confirmei o diff/HEAD localmente.

## Dispatch objective

Planejar correção separada de `research-local-read` para `REQ-REF-CLEAN` / `AC-REF-CLEAN`, sem implementar e antes de aprovação humana. Sessão anterior de planner de outra tarefa foi resetada conforme despacho.

## Work done

Plano mínimo e rastreabilidade `REQ-REF-CLEAN` → `TEST-REF-01` (validação integral do recurso), `TEST-REF-02` (testes focados do validador) e `TEST-REF-03` (verificação do contrato de perfis e diff) constam do retorno ao developer. Inspecionados mapa do projeto, mapa de código, recurso, regra e testes dirigidos; não houve edição fora desta nota.

## Evidence

- Leitura direcionada: `agents/model-setter.md:118-121` contém os dez nomes do toolkit, `small_model`, agentes nativos e a menção ao papel retirado; `tools/validate_resources.py:22-25,251-257,263-265,347-382` proíbe a referência literal e verifica o recurso duas vezes; `tests/test_validate_resources.py:33-35,67-73` cobre repositório e referência retirada. Resultados anteriores de dois erros são evidência fornecida no despacho, não reexecutada.
- Não executei comandos, validador nem suíte; HEAD/diff e comportamento do utilitário externo não foram verificados nesta etapa.

## Decisions and assumptions

- Corrigir somente texto dos bullets de perfis, preservando os dez agentes geridos e `small_model`; eliminar menção ao agente retirado e promessa sobre seu estado, sem flexibilizar o validador. Testes de contrato ficam dentro do escopo; atualização pontual do `code-map.md` somente se necessária para manter índice conforme instruções locais.
- Premissa: não houve mudança material de comportamento do utilitário de perfis; confirmar contra a implementação disponível antes de afirmar que agentes fora do toolkit permanecem intactos. A nota não aprova implementação.

## Pending and risks

- Aprovação explícita do usuário para plano antes da implementação; validar o contrato real do utilitário externo ou reformular a frase sem prometer preservação específica. Preservar alteração preexistente, isolar diff e commit do trabalho `research-local-read`.

## References

- Plano: retorno deste despacho ao developer; `agents/model-setter.md`, `tools/validate_resources.py`, `tests/test_validate_resources.py`, `code-map.md`, `templates/task-note.md`.
