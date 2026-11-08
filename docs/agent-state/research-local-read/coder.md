# coder - research-local-read

- Role: coder
- Updated: 2026-11-07 22:03 -03:00
- Code state: HEAD `c0ee2dc` plus dirty worktree; changed by this task:
  `agents/research.md` `08ca3dbe830d818c…`, `tools/validate_resources.py`
  `11fc43a99bfdeb57…`, `tests/test_validate_resources.py` `0091a956579ebe17…`
  (inclui o teste novo do tester), `code-map.md` `a191e7851ab7a132…`.
  Preexisting and untouched: `agents/model-setter.md`, untracked
  `docs/agent-state/`. Artefatos temporários de probe já removidos.

## Dispatch objective

Implementar o baseline reaprovado de `research-local-read` (REQ-LOCAL-RO /
AC-LOCAL-RO, REQ-NO-MUTATION / AC-NO-MUTATION): `research` pode `read`/`glob` no
projeto e `websearch`/`webfetch`, sem `grep`, shell, execução, edição, escrita
nem `external_directory`; validador rejeita `allow` **e** `ask` em ação
proibida; spelling `permissions:#comment`/tab falha fechado; testes derivados do
cenário prévio do tester; `code-map` e varredura de docs. Sessão nova deste
papel — a sessão anterior do coder foi resetada após a reaprovação do plano.

## Work done

- `agents/research.md`: removido o grant `grep`; instruções passam a restringir
  o contexto local a `read`/`glob`, orientam descoberta por `glob` + leitura
  direcionada, declaram `grep`/busca textual indisponível (sem sugerir
  emulação) e mantêm o fallback externo explícito e a política de segredos.
  Permanecem 15 triplas, deny-all primeiro e as negações de `read` sensível.
- `tools/validate_resources.py`: `RESEARCH_ALLOWED_ACTIONS` restrito a
  `read`/`glob`/`websearch`/`webfetch`; `grep` movido para
  `RESEARCH_FORBIDDEN_SEARCH_ACTIONS` e `allow`/`ask` (`RESEARCH_FORBIDDEN_EFFECTS`)
  são rejeitados para todas as ações proibidas; grant exigido passou a exigir
  `resource: "*"` (sem isso, a exceção `*.env.example` satisfazia “must allow
  read” e a remoção do grant amplo passava); cabeçalho de `permissions` validado
  por `PERMISSION_KEY`/`PERMISSION_HEADER_REST`: só `permissions:` puro ou com
  ≥1 espaço antes de comentário é aceito, `#` colado e tab antes de `#` viram
  `unsupported YAML layout`; chave duplicada continua rejeitada e comentários
  inocentes preservados.
- `tests/test_validate_resources.py`: substituído (não removido) o teste que
  exigia `grep` por testes de ausência/rejeição de `grep`; adicionados casos de
  conjunto de grants, remoção por grant exigido, contagem derivada de triplas,
  `allow`/`ask` × ações proibidas, controle `deny`, `external_directory`
  explícito, negações `$HOME`, propriedade de negação do texto, anúncio no
  `code-map` e parser malformado. Injeções novas ancoram em `^steps:` derivado
  do arquivo; contagem de triplas é derivada, não literal. Testes do tester
  preservados; a antiga expectativa “must allow grep” foi invertida conforme
  instrução.
- `code-map.md`: linha de `agents/` deixa de anunciar `grep` para `research`;
  linhas de `tools/` e `tests/` descrevem rejeição de `allow`/`ask` e cabeçalho
  malformado. Varredura direcionada: só `code-map.md` anunciava o valor antigo;
  `docs/progressive-search.md:16` menciona `grep` como política global de
  outros papéis e foi intencionalmente preservado.
- Delta pós-validação independente: o tester reproduziu `read` sensível com
  `effect: ask` aceito (6/6) e adicionou `test_research_rejects_asking_for_a_sensitive_read`.
  `check_research_permissions` agora rejeita qualquer efeito diferente de `deny`
  em recurso de `RESEARCH_SENSITIVE_READ_DENIALS`, exceto a exceção
  `*.env.example`, com a mensagem existente `must not re-grant read for
  <resource>`; a checagem de ordem após o grant amplo ficou no ramo `deny`.
  Nenhum teste do tester foi alterado e nenhum teste adicional foi necessário:
  `allow` já era coberto pelos testes existentes, `deny` real pelo teste de
  config válida e a exceção por `..._env_example_exception_follows_the_env_denials`.
- Artefatos temporários para o probe de runtime nativo: criados nesta tarefa e
  **removidos** após o probe autorizado do developer (ver Evidence). Hashes
  sanitizados no momento da criação: `agents/research-acl-probe.md`
  `c6ac94841759899f…`, `tests/fixtures/research-local-read-probe/README.md`
  `535381e4f86c5437…`, `tests/fixtures/research-local-read-probe/.env`
  `e9ab84f84e37d0cf…`. O agente de probe tinha `mode: subagent`, `steps: 20` e
  bloco `permissions` idêntico ao de `agents/research.md` (15 triplas iguais,
  verificado por `parse_permissions`; nenhum grant ampliado). O `.env` continha
  uma única linha `PROBE_MARKER=SYNTHETIC_<32 hex>` (chmod 600; valor gerado com
  `openssl rand`, nunca exibido ou registrado) e não era segredo real.

## Evidence

- `python3 -m unittest tests.test_validate_resources -k research` → 43 testes, OK
  (inclui `test_research_rejects_asking_for_a_sensitive_read` do tester).
- Runner unittest com o arquivo inteiro exceto `test_repository_is_valid` →
  56 testes, OK.
- `python3 -m unittest -v tests.test_agent_instruction_delivery_docs` → 5
  testes, OK.
- Matriz do delta (chamada direta, conteúdo real): `read` sensível com `allow`
  e com `ask` → `must not re-grant read for <recurso>` (6/6 cada); com `deny` →
  `[]` (6/6); `*.env.example` com `allow`/`ask`/`deny` → `[]` (exceção
  preservada); config real → `[]`, 15 triplas.
- Checagem de links Markdown do CI aplicada a `code-map.md` e
  `agents/research.md` → OK.
- Chamada direta a `check_agent("research", …)` → `[]`; 15 triplas; nenhuma
  tripla `grep`/ação proibida com `allow`/`ask`; remoção de cada grant exigido
  produz `must allow <ação>` (sensibilidade por ação).
- Discriminação do parser: o regex antigo aceita `permissions:#comment`; o novo
  rejeita `#` colado e tab, e aceita `permissions:`, `permissions: # c` e
  `permissions:  # c` (`[]`).
- `check_repository` direto: `[]` para `research`; os 2 erros remanescentes são
  preexistentes/fora de escopo em `agents/model-setter.md` (referência de papel
  retirado, arquivo não tocado). Nenhum erro novo introduzido por esta rodada ou
  pela nota do coder.
- Probe ACL executado pelo developer no runtime nativo (wrapper de subagente
  não usado; comando literal e ID de sessão não vieram no despacho). Transcript
  sanitizado: `glob` na fixture → allowed; `read` do `README.md` da fixture →
  allowed; `read` do `.env` → permission.rejected; `grep` → tool_not_granted;
  shell `printf` → tool_not_granted; `read /etc/hostname` →
  permission.rejected (`external_directory`). Nenhuma mutação inesperada e
  nenhum conteúdo do marcador foi retornado ou registrado.
- Limpeza verificada: `rm -f agents/research-acl-probe.md
  tests/fixtures/research-local-read-probe/{README.md,.env}`, seguido de
  `rmdir tests/fixtures/research-local-read-probe tests/fixtures` → os três
  artefatos e os dois diretórios estão ausentes (`[ -e ]` falso para cada path).
  `sha256sum` dos quatro arquivos finais permaneceu idêntico
  (`08ca3dbe…`, `11fc43a99…`, `0091a956…`, `a191e785…`) e `check_repository`
  segue com os mesmos 2 erros preexistentes de `agents/model-setter.md`.
- Não executados nesta rodada: suíte completa, `tools/validate_resources.py`
  global e `node --check`; o probe foi conduzido pelo developer.
- `git status --porcelain` → `M agents/model-setter.md`, `M agents/research.md`,
  `M code-map.md`, `M tests/test_validate_resources.py`,
  `M tools/validate_resources.py`, `?? docs/agent-state/` (sem artefatos de
  probe).

## Decisions and assumptions

- `ask` equivale a grant: aprovação humana pontual não preserva a invariante,
  então é rejeitado como `allow` para ações proibidas e `grep`.
- Grant exigido exige `resource: "*"`: o contrato reaprovado é acesso amplo
  local; grant mais estreito é redução de capacidade não aprovada. Correção
  descoberta pelo teste de sensibilidade, dentro do cenário do tester.
- Cabeçalho malformado falha fechado por layout, sem depender do loader YAML do
  harness (PyYAML não é dependência do repositório).
- `glob` permanece concedido; a descoberta ocorre por `glob` seguida de `read`,
  conforme o plano.
- `ask` em `read` sensível equivale a grant sob last-wins: o `deny` anterior
  seria sobrescrito, então só `deny` é aceito nesses recursos. A exceção
  `*.env.example` não é sensível por contrato e foi preservada.
- jev: não usado; decisões determinadas pelo plano e pelos testes do tester.

## Pending and risks

- Probe ACL nativo confirmou as negações esperadas em uma sessão descartável
  (ver Evidence): `glob`/`read` do README allowed, `read` do `.env` e de
  caminho externo denied, `grep` e shell indisponíveis. É amostra de um harness
  e uma sessão; não substitui CI, `node --check` nem prova para outros caminhos
  ou grafias de padrão não exercitadas.
- `python3 tools/validate_resources.py` continua vermelho por
  `agents/model-setter.md` (preexistente, alheio); nada introduzido por esta
  rodada em `research`.
- `node --check` indisponível e CI remoto não executado: gate do reviewer.
- O modelo estático segue por substring: grafias equivalentes do matcher
  (ex.: `*.en?`) não são reconhecidas como recurso sensível; risco residual já
  documentado e fora do escopo aprovado.

## References

`docs/agent-state/research-local-read/planner.md`; `.../tester.md`;
`.../reviewer.md`; `agents/research.md`; `tools/validate_resources.py`;
`tests/test_validate_resources.py`; `code-map.md`;
`workflows/developer-workflow.md`; `docs/agent-instruction-delivery.md`;
`templates/task-note.md`.
