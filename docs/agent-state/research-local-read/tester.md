# tester - research-local-read

- Role: tester
- Updated: 2026-11-07 22:09 -03:00 (rodada 8 — probe ACL nativo verificado; classificação de execução retificada)
- Code state: HEAD `c0ee2dc3c7956b92ea8ca006a29749cb4153d19d` + worktree suja. Snapshot
  verificado agora (sha256): `agents/research.md` `08ca3dbe830d818c…` (inalterado),
  `tools/validate_resources.py` `11fc43a99bfdeb57…` (delta do coder), `tests/test_validate_resources.py`
  `0091a956579ebe17…` (byte-idêntico ao pós-edição da rodada 4: teste e asserções intactos),
  `code-map.md` `a191e7851ab7a132…` (inalterado). Preexistente e alheio, intocado:
  `agents/model-setter.md` `71117b41eb3efc87…`; `docs/agent-state/` não rastreado.
  Artefatos de probe **ausentes** (`agents/research-acl-probe.md`, `tests/fixtures/`); a
  evidência runtime vive em `/tmp/opencode/research-acl-negative-probe.ndjson`
  `0214b32fee3427ee…` (6 linhas, 5610 B, volátil).

## Sessão e histórico

- Rodada 3 (19:18): sessão **resetada** pela reaprovação do plano; escrevi a especificação
  pré-implementação `TEST-*` sem tocar produção/testes.
- Rodada 4 (19:30): sessão contínua; validei o baseline do coder e detectei a lacuna de
  `read` sensível com `effect: ask` (6/6), adicionando o teste focado
  `test_research_rejects_asking_for_a_sensitive_read` (teste apenas).
- Rodada 5 (esta): **sessão contínua**, sem reset. Validei o delta `11fc43a9…` de
  `check_research_permissions`: matrix `allow`/`ask`/`deny` por segredo, exceção
  `*.env.example`, controles e reexecução focada. Blocker sensível resolvido.
- Única alteração de teste desta rodada: **nenhuma** (arquivo byte-idêntico, hash acima).
  Teste e asserções da rodada 4 seguem intactos; nenhuma produção tocada por mim.
- Rodada 6 (19:40): **sessão contínua**, sem reset. Criei somente a fixture temporária de
  probe em `tests/fixtures/research-local-read-probe/` (2 arquivos); **não** executei probe,
  não invoquei agentes e não alterei testes/produção/`code-map`.
- Rodada 7 (21:49): **sessão contínua**, sem reset. O developer executou um primeiro probe
  nativo e autorizou a limpeza; removi a fixture sintética da rodada 6 e registrei evidência
  runtime parcial (`glob` + `read` de `code-map.md`).
- Rodada 8 (esta): **sessão contínua**, sem reset. Verifiquei a transcrição sanitizada do probe
  **negativo** de ACL (runtime nativo `opencode run --standalone`), confirmei a ausência dos
  artefatos temporários e o snapshot; retifiquei a classificação do transporte (`subagent` é a
  action nativa do V2, não wrapper externo) e registrei cobertura e limites. Nada de
  produção/testes/`code-map`/arquivo alheio tocado por mim.

## Dispatch objective

Validar independentemente o baseline reaprovado (REQ-LOCAL-RO / AC-LOCAL-RO,
REQ-NO-MUTATION / AC-NO-MUTATION): grants exatos `read`/`glob`/`websearch`/`webfetch` sem
`grep`; `allow`/`ask` proibidos rejeitados com controle `deny`; `permissions:#comment`/tab
fail-closed com comentários válidos aceitos; fallback externo, `code-map` e varredura do valor
antigo; mutações de sensibilidade. Avaliar a lacuna adicional de `read` sensível com `effect: ask`.
Somente leitura e testes; sem suíte completa; sem probe mutável e sem segredo real.

## Traceability e resultado por TEST-*

Comandos base: `python3 -m unittest tests.test_validate_resources -k research` (43 testes) e
runner do módulo com os 56 testes do arquivo exceto `test_repository_is_valid`. Evidência
independente adicional por chamada direta a `check_agent("research", …)`/`permissions`/
`frontmatter` no conteúdo real (script em memória, sem escrita).

| TEST-* | Cenário / teste que encarna | Resultado |
| --- | --- | --- |
| TEST-LOCAL-RO-GRANTS-1 | real config aceita — `test_research_keeps_read_only_local_access` | PASS (`check_agent == []`) |
| TEST-LOCAL-RO-GRANTS-2 | conjunto aprovado — `test_research_allowed_actions_are_the_approved_set` | PASS (`read`,`glob`,`websearch`,`webfetch`) |
| TEST-LOCAL-RO-GRANTS-3 | remoção de cada grant exigido gera `must allow <ação>` — `test_research_requires_every_allowed_grant` | PASS (4/4, `resource: "*"`) |
| TEST-LOCAL-RO-GRANTS-4 | deny-all precede todo grant — `test_research_deny_all_precedes_every_grant`, `..._enforces_deny_all_before_grants` | PASS |
| TEST-LOCAL-RO-GRANTS-5 | adição canônica aceita — `test_research_accepts_a_canonical_permission_addition` | PASS (controle negativo) |
| TEST-LOCAL-RO-GRANTS-6 | contagem de triplas derivada — `test_research_permission_entries_cover_every_declared_triple` | PASS (15 triplas = 15 linhas `- action:`) |
| TEST-NO-GREP-1 | real sem `grep` allow/ask — `test_research_does_not_grant_grep` | PASS |
| TEST-NO-GREP-2 / -3 | `grep` allow/ask rejeitado e sem erro de layout — `test_research_rejects_grep_allow_or_ask` | PASS (`must not allow grep`, `must not ask grep`) |
| TEST-NO-GREP-4 | controle `grep` deny — `test_research_accepts_an_explicit_grep_denial` | PASS (`[]`) |
| TEST-NO-GREP-5 | prosa não vende `grep` como capacidade — `test_research_instructions_do_not_present_grep_as_a_capability` | PASS (2 linhas, ambas com negação) |
| TEST-NO-GREP-6 | `code-map` sem anunciar `grep` — `test_code_map_does_not_announce_grep_for_research` | PASS (linha real: `` `read`/`glob` e `websearch`/`webfetch` ``) |
| TEST-SECRET-READ-1 | fragmentos de `RESEARCH_SENSITIVE_READ_DENIALS` com `read deny` — `test_research_must_deny_sensitive_reads` | PASS (6/6) |
| TEST-SECRET-READ-2 | negações depois do grant amplo — `..._sensitive_denials_override_the_broad_read_grant`, `..._enforces_sensitive_denials_after_the_broad_read_grant` | PASS |
| TEST-SECRET-READ-3 | sem re-concessão `allow` — `..._rejects_regranting_a_sensitive_read`, `..._does_not_regrant_sensitive_reads`, `..._sees_sensitive_regrant_after_an_indented_comment` | PASS |
| TEST-SECRET-READ-4 | `*.env.example` allow após as negações `*.env`/`*.env.*` — `..._env_example_exception_follows_the_env_denials` | PASS |
| TEST-SECRET-READ-5 | `$HOME/.ssh/*` e os dois `auth.json` — `..._sensitive_denials_cover_home_secrets` | PASS |
| **TEST-SECRET-READ-7** (fechada) | `read` sensível com `effect: allow`/`ask` rejeitado; `deny` é o controle — `test_research_rejects_asking_for_a_sensitive_read` | **PASS** (matrix 6 fragmentos × 3 efeitos, ver rodada 5) |
| TEST-FALLBACK-EXTERNAL-1 | 3 âncoras de fallback — `..._instructions_keep_the_unreadable_path_fallback` | PASS |
| TEST-NO-MUTATION-1 | 6 ações × `allow`/`ask` rejeitados, sem erro de layout — `..._rejects_each_forbidden_action`, `..._rejects_external_directory_allow_and_ask`, `..._cannot_allow_shell`, `..._cannot_allow_external_directory` | PASS (12/12) |
| TEST-NO-MUTATION-2 | cenários `allow` antigos preservados (não apagados) | PASS |
| TEST-NO-MUTATION-3 | controle `deny` para as 7 ações (6 + `grep`) — `..._accepts_explicit_denials_for_forbidden_actions` | PASS (`[]`) |
| TEST-NO-MUTATION-4 | real sem `allow`/`ask` em ação proibida — `..._real_config_grants_no_forbidden_action` | PASS |
| TEST-NO-MUTATION-5 | `external_directory` explicitamente `allow`/`ask` | PASS |
| TEST-PARSER-MALFORMED-1 / -3 | `permissions:#comment` e `permissions:\t#comment` — `..._rejects_comment_glued_to_the_permissions_key` | PASS (`unsupported YAML layout`) |
| TEST-PARSER-MALFORMED-2 | spelling malformado escondendo `shell allow` — `..._fails_closed_when_a_malformed_key_hides_rules` | PASS (erro de layout) |
| TEST-PARSER-MALFORMED-4 | bordas aceitas: puro, 1 e 2 espaços antes de `#` — `..._accepts_a_comment_after_a_space` | PASS (3/3 `[]`) |
| TEST-PARSER-MALFORMED-5 | comentários inocentes em coluna 0/entre entradas/antes de `steps:`/na chave | PASS |
| TEST-PARSER-MALFORMED-6 | bypasses anteriores seguem rejeitados (flow, chaves reordenadas, comentário em `effect`, block scalar, lista inline, chave duplicada, continuação) | PASS |

### Evidência de runtime (rodada 8, fornecida pelo developer; não é teste meu)

| REQ/AC | Evidência runtime | Resultado |
| --- | --- | --- |
| REQ-LOCAL-RO (leitura/descoberta) | `glob` da fixture + `read` do README em sessão nativa | allowed (confirma) |
| AC-LOCAL-RO (segredo negado) | `read` do `.env` sintético | denied `permission.rejected` |
| REQ-LOCAL-RO (`grep` não concedido) | busca textual pelo marcador | unavailable `tool_not_granted` |
| AC-LOCAL-RO (sem `external_directory`) | `read /etc/hostname` | denied `permission.rejected:external_directory` |
| AC-NO-MUTATION (execução) | shell `printf` inerte | unavailable `tool_not_granted` |
| AC-LOCAL-RO (web) | não exercitado | **lacuna declarada** |
| AC-NO-MUTATION (edição/escrita/patch) | não exercitados individualmente | **lacuna declarada** |

Detalhes, limites e ressalvas de atribuição na seção “Probe ACL nativo” (rodada 8). O probe
usou profile temporário de ACL equivalente ao `research`, então confirma a ACL nativa/runner,
não a conduta instrucional completa.

## Lacuna de `read` sensível com efeito não-`deny` — detectada (rodada 4) e fechada (rodada 5)

Reprodução independente na rodada 4: injetar `- action: read` / `resource: "<padrão>"` /
`effect: ask` com `resource` = `*` + cada fragmento de `RESEARCH_SENSITIVE_READ_DENIALS`,
**depois** das negações reais (posição de last-wins): `check_agent("research", …) == []` nos
6/6 (`*.env`, `*.pem`, `*.key`, `*id_rsa`, `*id_ed25519`, `*auth.json`).

Por que violava AC-LOCAL-RO (“segredos acessados via `read` continuam negados”):
`ask` não é negação; é autorização condicionada a aprovação humana, e no V2 a última regra
vence, logo o `ask` posterior anulava o `deny` do segredo. É a mesma justificativa que o
plano/coder aplicaram a ações proibidas e a `grep` ("`ask` equivale a grant"). O gate deixaria
de ser ACL e passaria a depender de o humano negar o prompt.

Classificação na rodada 4: **implementação ausente**; adicionei apenas o teste focado
necessário, que exige erro **semântico** (não de layout) e que **nomeie o recurso** (padrão
`*<fragmento>`), sem fixar a prosa final.

### Delta do coder validado (rodada 5)

`tools/validate_resources.py` `11fc43a9…` rejeita, para qualquer recurso sensível, efeito
diferente de `deny` (mesma mensagem `must not re-grant read for <resource>`), preserva a
exceção `*.env.example` e mantém a checagem de ordem no ramo `deny`. Matrix independente
(6 fragmentos × 3 efeitos, injeção após as negações reais):

| Efeito injetado | Resultado observado | Esperado |
| --- | --- | --- |
| `allow` | `['research: must not re-grant read for <padrão>']` (6/6) | rejeitar |
| `ask` | `['research: must not re-grant read for <padrão>']` (6/6) | rejeitar |
| `deny` | `[]` (6/6) | controle aceito |

Controles adicionais: `*.env.example` com `allow` → `[]` (exceção preservada) e com `ask` →
`[]` (tolerado por desenho: o padrão é o exemplo não sensível, já concedido como `allow`;
registro como fronteira documentada, não como exposição de segredo). `read "docs/**"` com
`ask` → `[]` (a regra sensível não vaza para recurso não sensível). Config real → `[]`.

Defeito de **probe** (não da implementação, rodada 5): minha primeira matrix injetou
`effect: "allow"` entre aspas, spelling não canônico, e todos os casos retornaram
`unsupported YAML layout`; corrigi o script para `effect: allow|ask|deny` e a matrix passou.
O validador estava correto ao rejeitar o spelling; o erro era da minha ferramenta de verificação.

## Mutações de sensibilidade executadas

1. **Borda do parser**: regex antigo `^permissions:[ \t]*(?:#.*)?$` casa
   `permissions:#comment` (aceitaria); `PERMISSION_BLOCK` atual não casa o spelling colado e
   casa `permissions: # c`. Um teste que aceitasse ambos falharia TEST-PARSER-MALFORMED-1; um
   que rejeitasse ambos falharia -4. Discriminação provada.
2. **Efeito**: `allow`/`ask` → erro (12/12); `deny` → `[]` (7/7). Rejeitar todo efeito
   falharia o controle; aceitar `ask` falharia -1.
3. **Grep**: `allow`/`ask` → erro; `deny`/ausente → sem erro.
4. **Grant exigido**: presente → `[]`; removido → `must allow <ação>` (4/4).
5. **Leitura sensível (rodada 5)**: `allow`/`ask` → erro nomeando o recurso (6/6 cada);
   `deny` → `[]` (6/6); exceção `*.env.example` → `[]`. Um validador que rejeitasse todo
   efeito falharia os controles `deny`/exceção; um que aceitasse `ask` falharia a matrix.
6. Todas as mutações foram feitas como pares de asserções/subtests sobre a produção real;
   nenhuma edição de produção e nenhuma reimplementação commitada da lógica sob teste.

## Varredura de valor antigo e referências

- `grep` em `agents/research.md`: 2 ocorrências, ambas negativas (“no `grep` search”,
  “`grep` is not available”). Frontmatter: 15 triplas, sem `grep`.
- `code-map.md` linha `agents/`: anuncia `read`/`glob` + `websearch`/`webfetch` e “sem shell,
  escrita ou `external_directory`” — coerente com o real; linhas `tools/`/`tests/` descrevem
  `allow`/`ask` e cabeçalho fail-closed. Links Markdown do CI não reexecutados nesta rodada
  (não alterei docs além da minha nota); o coder reportou OK.
- Varredura no repo: nenhum outro documento anuncia `read`/`glob`/`grep` para `research`.
  `docs/progressive-search.md:16` cita `grep` como política geral de outros papéis —
  corretamente preservado (não é valor de `research`).
- Referências acessíveis nesta rodada: plano (`planner.md`), `coder.md`, `reviewer.md`,
  `workflows/developer-workflow.md`, `docs/agent-instruction-delivery.md`,
  `templates/task-note.md`, `code-map.md` e o índice `project-map.md` (em `~/Projetos`, fora
  do repo). `.opencode/skills/testing/SKILL.md` **não existe** (confirmado); usei
  `skills/clean-code/SKILL.md` §§Tests/Test Checklist como baseline.

## Comandos e resultados (focados, sem suíte completa)

Rodada 5 (snapshot `11fc43a9…` / testes `0091a956…`):

- `python3 -m unittest tests.test_validate_resources -k research` → **43 testes, OK**.
- Runner do módulo excluindo `test_repository_is_valid` → **56 testes, OK**, 0 falhas,
  0 erros (nenhuma falha colateral pelo delta).
- Matrix independente em memória (6 fragmentos × `allow`/`ask`/`deny` + exceção + controles) →
  nenhum `FAIL`; ver tabela acima.
- Reconfirmação dos demais cenários do plano após o delta (mesmo probe, por produção real):
  grants reais e sensibilidade por remoção, `grep` allow/ask vs deny, 6 ações proibidas
  allow/ask + controles deny, parser (colado/tab → layout; puro/1–2 espaços e comentários
  inocentes → `[]`; malformado escondendo regra), âncoras de fallback, `code-map` sem anunciar
  `grep` → todos os `TEST-*` verdes.
- Integridade do meu teste/asserções: `tests/test_validate_resources.py` byte-idêntico ao
  hash pós-edição da rodada 4 (`0091a956…`); nenhum teste removido ou afrouxado.
- `test_repository_is_valid` continua vermelho por `agents/model-setter.md` (2 erros de
  referência a papel retirado; arquivo sujo alheio, `git show HEAD:` do arquivo avalia `[]`).
  Meu próprio texto anterior também aparecia no scanner (caminho absoluto de home + termo
  retirado); **corrigi apenas a minha nota** para não poluir o gate global. Restam somente as
  notas de terceiros/arquivo alheio, fora do meu escopo de autoria.

Rodada 4 (histórico, snapshot `3acb078f…` / testes `0091a956…`): `-k research` → 43 testes,
6 falhas (só o teste novo, lacuna ainda aberta); runner do módulo → 56 testes, 6 falhas;
`tests.test_agent_instruction_delivery_docs` → 5 OK (arquivo e entradas inalterados desde
então; não reexecutei por não haver mudança de fonte).

Rodada 8 (verificação do probe, sem suíte completa):

- `sha256sum /tmp/opencode/research-acl-negative-probe.ndjson` →
  `0214b32fee3427eee4c6f914845e40f7f0d69463bf31451bc838c4af87bde14f`; 6 linhas, 5610 B;
  conferência linha a linha (2 `tool_use`/`subagent`, 2 `step-finish`).
- `grep -c 'SYNTHETIC_SECRET' <transcript>` → **0**; tokens com forma de UUID → **0**
  (sanitização confirmada); nenhum conteúdo de marcador no relay do subagente.
- `test ! -e agents/research-acl-probe.md` e `test ! -e tests/fixtures` → `artifacts-absent=true`;
  `grep -rln --exclude-dir=.git --exclude-dir=docs research-acl-probe .` → **0** arquivos.
- Hashes dos quatro arquivos finais revalidados: `08ca3dbe…`, `11fc43a9…`, `0091a956…`,
  `a191e785…`; `agents/model-setter.md` `71117b41…` intocado.
- `python3 -m unittest tests.test_validate_resources -k research` → **43 testes, OK** no
  snapshot atual (regressão focada de fechamento; nenhum teste novo desta rodada).
- Classificação do transporte (retificação): `strings -n 6 $HOME/.opencode/bin/opencode |
  grep -c 'functions\.subagent'` → **0**; extração de `{action:"subagent",resource:"*",effect…}`
  e de `…={bash:"shell",task:"subagent",apply_patch:"patch"…}` → `subagent` existe como
  **action nativa** do V2. Logo `"tool":"subagent"` na transcrição é a ferramenta/ação nativa,
  não o wrapper externo. Conclusão resolvida com evidência local + documentação citada no
  despacho; a inferência anterior de “wrapper usado” foi retirada.

## Fixture temporária para o probe manual (criada na rodada 6, removida na rodada 7)

Criada a pedido do reviewer final, **somente** para o probe manual, read-only e sintético do
subagente `research`, e já removida após a autorização do developer. Registro mantido como
histórico de rastreabilidade. Nenhum probe foi executado e nenhum agente foi invocado por mim.

| Caminho (relativo) | sha256 | Tamanho | Papel esperado no probe |
| --- | --- | --- | --- |
| `tests/fixtures/research-local-read-probe/README.md` | `3a90c83ba998bf47…` (completo: `3a90c83ba998bf4742330ad4576e7e567f2c03941063bff762c136aaf14185ad`) | 1288 B | `read` deve **suceder**; descreve a fixture e a limpeza |
| `tests/fixtures/research-local-read-probe/.env` | `98d9431444f7e00a…` (completo: `98d9431444f7e00a1d49167e28647b81d65d502f6d2319c2b6f971c334f86697`) | 54 B | `read` deve ser **negado**; contém marcador sintético, nunca real |

Criação e verificação (comandos reais, sem imprimir o valor do marcador):

- `mkdir -p tests/fixtures/research-local-read-probe`
- `.env`: `printf 'SYNTHETIC_SECRET=%s\n' "$(cat /proc/sys/kernel/random/uuid)" > …/.env`
  — valor derivado de UUID v4 aleatório do kernel, prefixo `SYNTHETIC_SECRET=`; **o valor não
  é copiado nesta nota** (só o sha256 do arquivo, que não permite recuperá-lo).
- Verificação de forma: `grep -qE '^SYNTHETIC_SECRET=[0-9a-f]{8}-…-[0-9a-f]{12}$'` no `.env`
  → exit 0 (`env-shape-ok=true`), 1 linha, 54 B — confirma marcador sintético e ausência de
  conteúdo adicional.
- Resultado de estado: `git status --porcelain` → `?? tests/fixtures/` (untracked), além dos
  arquivos já sujos da tarefa. Os hashes de `agents/research.md`,
  `tools/validate_resources.py`, `tests/test_validate_resources.py`, `code-map.md` e
  `agents/model-setter.md` permanecem idênticos aos da rodada 5 — nenhuma produção/teste
  alterado por esta etapa.
- Não há `tests/__init__.py`; a descoberta do unittest coleta apenas `test*.py`, então a
  fixture não adiciona nem altera teste. `python3 -m unittest tests.test_validate_resources
  -k research` → 43 testes OK (sem perturbação pela nova pasta).
- Comando inválido registrado por transparência: `python3 -m unittest discover -s tests -t .`
  → `ImportError: Start directory is not importable` (o diretório não é pacote). Não executou
  teste algum e não foi repetido; a suíte ampla continua sendo gate do reviewer.

**Natureza temporária**: a fixture não é usada por nenhum teste, não deve ser *staged* nem
commitada (não há regra de `.gitignore` para ela; ela aparece como untracked). Remoção, após
confirmação do developer e conclusão do probe:

```sh
rm -rf tests/fixtures/research-local-read-probe
git status --porcelain   # a pasta não deve mais aparecer
```

Passos do probe (execução manual pelo developer, não por mim — não posso delegar aninhado):
`read README.md` → sucesso; `glob` da pasta → sucesso; `read .env` → negação por permissão;
`grep`/busca textual → indisponível ou negada, sem expor o marcador; `read` de caminho externo
→ negação sem prompt de `external_directory`; `shell`/edição → indisponível. Evidência
esperada: transcrição sanitizada sem o valor do marcador + hashes desta tabela.

### Resultado runtime fornecido pelo developer e limpeza (rodada 7)

- **Sessão/comando**: `opencode run --standalone` (harness nativo aprovado), conduzida pelo
  developer; **não** executada por mim.
- **Resultado reportado**: `glob` e `read` de `code-map.md` funcionaram com sucesso — confirma
  que o agente `research` tem descoberta por `glob` e leitura local por `read` em runtime real.
- **Escopo do que foi provado**: apenas as capacidades positivas (`glob` + `read`). O probe
  **não** exercitou negação de `read` de `.env`, ausência/negação de `grep`, negação de
  shell/edição, nem leitura de caminho externo sem `external_directory`. Portanto **não** uso
  essa evidência como prova dos ACs de negação; esses itens seguem como validação manual
  pendente (risco residual declarado, não bloqueio de código segundo o plano).
- **Limpeza executada** (autorizada pelo developer): `rm -rf
  tests/fixtures/research-local-read-probe` e `rmdir tests/fixtures` (pasta pai criada por mim
  na rodada 6, vazia após a remoção). Verificação: `test ! -e tests/fixtures` →
  `fixture-absent=true`; `ls tests/` mostra só `__pycache__`, `test_agent_instruction_delivery_docs.py`
  e `test_validate_resources.py`; `git status --porcelain` sem `?? tests/fixtures/`.
- **Estado preservado**: hashes de `agents/research.md` `08ca3dbe…`, `tools/validate_resources.py`
  `11fc43a9…`, `tests/test_validate_resources.py` `0091a956…`, `code-map.md` `a191e785…` e
  `agents/model-setter.md` `71117b41…` inalterados em relação à rodada 6.

## Probe ACL nativo — verificação independente da transcrição (rodada 8)

**Origem: developer, não teste meu.** Transcrição sanitizada em
`/tmp/opencode/research-acl-negative-probe.ndjson` (sha256 `0214b32fee3427ee…`, 6 linhas,
5610 B), produzida por sessão nativa do OpenCode v2.2.6 delegando ao agente temporário
`research-acl-probe`. Conferi o arquivo linha a linha.

**Classificação de execução (retificada)**: o probe foi lançado pelo **runtime OpenCode nativo**
com `$HOME/.opencode/bin/opencode run --standalone` — comando efetivo reportado pelo developer
no despacho; a transcrição **não** contém a linha de comando, mas é consistente com ela. A
chamada registrada `"tool":"subagent"` com `state.input.agent = "research-acl-probe"`,
`description = "Run authorized ACL probe"`, `background: false` e saída em sessão filha é a
**ferramenta/ação nativa `subagent` do V2** — `subagent` consta do conjunto de actions de
permissão (`{action:"subagent",resource:"*",effect:…}` no binário v2.2.6,
`…={bash:"shell",task:"subagent",apply_patch:"patch"…}` no mapeamento) e é documentada em
`https://opencode.ai/docs/permissions/` (conforme o despacho; página não reverificada por mim
nesta rodada). **Não** é o wrapper externo `functions.subagent`: `strings` do binário não contém
nenhuma ocorrência de `functions.subagent`. Minha frase anterior ("logo o wrapper de subagente
foi usado") era inferência incorreta e fica **retificada**; a nota do coder ("wrapper de
subagente não usado") é compatível com esta leitura — não havia divergência factual.

**Sessões (evidência na transcrição)**: as 6 linhas têm `sessionID` de envelope
`ses_e4752481cffeeYEsBdw7OV4ZMz`, que é a sessão **pai/execução** que emite o evento
`tool_use`; o ID citado no despacho `ses_e475222b1ffejdqu2B71ZgG7Hb` é a sessão **filha**,
presente em `<subagent sessionID="…">` e em `metadata.metadata.sessionID` do resultado da
ferramenta. Logo o ID do despacho identifica o filho; o pai é o que roda o comando nativo.

| Passo executado no probe | Resultado | Evidência no transcript | REQ/AC coberto |
| --- | --- | --- | --- |
| `glob` da fixture | allowed | passo 1 do relatório do subagente | REQ-LOCAL-RO (descoberta) |
| `read` README da fixture | allowed | passo 2 | REQ-LOCAL-RO (leitura local) |
| `read` do `.env` da fixture | denied | `permission.rejected` | AC-LOCAL-RO (segredo negado) |
| busca textual (`grep`) pelo marcador | unavailable | `tool_not_granted` | REQ-LOCAL-RO (`grep` não concedido) |
| shell (`printf` inerte) | unavailable | `tool_not_granted` | AC-NO-MUTATION (execução) |
| `read /etc/hostname` | denied | `permission.rejected:external_directory` | AC-LOCAL-RO (sem `external_directory`) |

Sanitização verificada por mim no arquivo: `grep -c 'SYNTHETIC_SECRET'` → **0** e nenhum token
com forma de UUID (`grep -oE …uuid… | wc -l` → **0**); nenhum conteúdo de marcador foi retornado
e o relatório declara ausência de mutação inesperada (`step_finish` apenas `tool-calls`/`stop`).

**Cleanup confirmado**: `agents/research-acl-probe.md` ausente, `tests/fixtures/` ausente,
`grep -rl research-acl-probe` no repo (excluindo notas) sem resultado. Restam somente os
transcripts em `/tmp/opencode/` (`research-acl-negative-probe.ndjson` e dois anteriores) como
evidência volátil, fora do repositório. A nota do coder foi conferida: registra o probe, a
limpeza e hashes; ela descreve uma fixture **própria** (`PROBE_MARKER=SYNTHETIC_<32 hex>`,
`chmod 600`, hashes `535381e4…`/`e9ab84f8…`), distinta da minha (`SYNTHETIC_SECRET=<uuid>`,
`3a90c83b…`/`98d94314…`, removida às 21:49). Ambas foram removidas; não há conflito.

**Distinção de evidência**: o probe do developer é evidência de runtime do harness nativo sobre
um profile de ACL equivalente; meus `TEST-*` são validação estática/unitária do validador e do
conteúdo real. Nenhum substitui o outro.

Limites deste probe (declarados, não bloqueantes):

1. Usou um agente **temporário** com bloco `permissions` idêntico ao de `research` (15 triplas,
   segundo o coder via `parse_permissions`), **não** o system prompt/instruções reais. Confirma
   a ACL nativa/runner, não a conduta instrucional (ex.: se `research` reportaria `grep` como
   indisponível em vez de emular busca via `read`).
2. O agente e a fixture temporários foram removidos, então a afirmação “bloco idêntico” não é
   reverificável por mim no estado atual; fica atestada pela nota do coder + transcript.
3. Execução única, sem repetição. Não exercitou `websearch`/`webfetch`, nem `edit`/`write`/`patch`
   individualmente; `grep` foi negado por ausência de ferramenta (`tool_not_granted`), não por
   regra `deny` explícita (equivalente ao deny-all, mas é outra forma de negação).

## Limitações e validação manual pendente

- **Cobertura runtime agora parcialmente confirmada** (rodada 8): o probe ACL nativo provou
  `glob`/`read` permitidos, `read` de `.env` negado, `grep`/shell não concedidos e leitura
  externa negada por `external_directory`. Continua **sem prova**: `websearch`/`webfetch`,
  `edit`/`write`/`patch` individualmente e a conduta instrucional do `research` real (o probe
  usou profile temporário com ACL equivalente). Ver limites detalhados na seção da rodada 8.
- Sem segredo real em nenhum momento; as duas fixtures sensíveis foram **sintéticas**,
  temporárias e estão removidas (a minha na rodada 7, a do coder no cleanup do probe).
- `node` indisponível → `node --check` não executável; CI remoto sem resultado: gate do reviewer.
- Modelo de ACL é estático: re-concessão ainda é detectada por substring; grafias equivalentes
  do matcher (`*.en?`, `"**"`) não seriam flagradas (risco residual já documentado, fora do
  escopo aprovado).

## Decisions and assumptions

- `ask` em segredo é grant, não negação (last-wins), logo viola AC-LOCAL-RO — mesma regra já
  aplicada pelo coder a ações proibidas e `grep`; coerência de contrato, não expansão de escopo.
- Teste novo é parâmetro de aceitação do AC existente; não cria requisito novo nem altera
  capacidade do agente (a configuração real já usa `deny`).
- Testes textuais (`code-map`, instruções, fallback) são contratos de documentação; não os
  apresento como prova comportamental.
- Evidência runtime de `glob`+`read` **não** é extrapolada para os ACs de negação (`.env`,
  `grep`, shell/edição, caminho externo); a rodada 8 cobre parte deles por probe do developer,
  com os limites declarados, e ainda não cobre `websearch`/`webfetch`, `edit`/`write`/`patch`
  nem a conduta instrucional do `research` real.
- Não usei Jev: decisões determinadas pelo plano, pelo código e por execuções.

## Pending and risks

1. **Nenhum blocker de AC remanescente no escopo do tester.** AC-LOCAL-RO tem evidência
   estática (TEST-*) e, após a rodada 8, evidência de runtime para `read`/`glob` permitidos,
   segredo `.env` negado, `grep` não concedido e caminho externo negado; AC-NO-MUTATION tem
   `shell` negado em runtime e validador rejeitando `allow`/`ask`. O blocker anterior
   (`ask` em `read` sensível) segue fechado no delta `11fc43a9…`.
2. **Cobertura runtime incompleta (declarada)**: probe do developer usou profile temporário de
   ACL idêntica, execução única, e não exercitou `websearch`/`webfetch`, `edit`/`write`/`patch`
   individualmente, nem a conduta instrucional do system prompt real de `research`; o arquivo do
   agente temporário foi removido, então a equivalência do bloco não é reverificável por mim.
   Não é blocker de código; é limitação a registrar na entrega.
3. Gate amplo: `test_repository_is_valid` e `tools/validate_resources.py` seguem vermelhos por
   `agents/model-setter.md` (preexistente, alheio) e por notas não rastreadas de terceiros.
   Reviewer deve julgar isso no estado final; nada introduzido por `research`.
4. `node --check` indisponível e CI remoto não executado.
5. Fronteira documentada: `*.env.example` aceita `allow`/`ask` por desenho (padrão não
   sensível, já concedido); não confere exposição de segredo.
6. Risco residual do modelo estático (substring/matcher) permanece como documentado.
7. **Artefatos de probe removidos**: minha fixture (rodada 7) e o agente/fixture temporários do
   probe do coder (rodada 8) estão ausentes; `git status` sem `?? tests/fixtures/` e sem
   `agents/research-acl-probe.md`. Só restam transcripts em `/tmp/opencode/` (evidência volátil,
   fora do repo).

## References

`docs/agent-state/research-local-read/planner.md`; `.../coder.md`; `.../reviewer.md`;
`agents/research.md`; `tools/validate_resources.py`; `tests/test_validate_resources.py`;
`tests/test_agent_instruction_delivery_docs.py`; `code-map.md`; `project-map.md` (índice em
`~/Projetos`); `workflows/developer-workflow.md`; `docs/agent-instruction-delivery.md`;
`templates/task-note.md`; `skills/clean-code/SKILL.md`;
`tests/fixtures/research-local-read-probe/` (fixture temporária, criada na rodada 6 e removida
na rodada 7).
