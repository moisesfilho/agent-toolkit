# coder - agent-note-writer

- Role: coder
- Updated: 2026-11-10 15:22 -03:00
- Code state: `agent-toolkit` HEAD `eb0186a` com worktree sujo: `.github/workflows/quality.yml`, `.gitignore` e `code-map.md` modificados; `harnesses/agent-note-writer-mcp/` e `docs/agent-state/agent-note-writer/` não rastreados. Nenhum commit.

## Dispatch objective

Implementar o servidor MCP stdio de append de notas em `harnesses/agent-note-writer-mcp/`, separado do harness Jev, com testes focados, manifesto/lock próprios, docs de uso/configuração de exemplo e atualização de `code-map.md`/inventário. Sem tocar `typesafe-jev-opencode`, config global do OpenCode ou Node do sistema; sem declarar aprovação.

## Work done

- Servidor: `harnesses/agent-note-writer-mcp/index.mjs` (entrada stdio, `--role` obrigatório, raiz = `process.cwd()` com validação de startup) e `src/server.mjs` (MCP `Server` de baixo nível, capability apenas `tools`, uma tool `append`, schema fechado `{task_slug,text}` com `additionalProperties:false`, sem resources/prompts).
- Núcleo: `src/note-writer.mjs` — validação de papel/slug/texto, timestamp `America/Fortaleza` no formato `YYYY-MM-DD HH:MM ±HH:MM`, destino `docs/agent-state/<task_slug>/<role>.md`, criação confinada de diretórios, checagem de symlink por componente, `O_NOFOLLOW`, verificação de `nlink`, verificação por `/proc/self/fd` (quando disponível), lock exclusivo com recuperação de dono morto, orçamento total com rollback do append em timeout, fsync de arquivo e diretório de criação.
- Limites em `src/constants.mjs`: 4096 B/entrada, 1 MiB/nota, espera de lock 500 ms, orçamento total 2000 ms, stale de lock 30 s; testes importam as constantes em vez de repetir literais.
- Config: `validate-config.mjs` + `src/config-check.mjs` validam `note_<role>`, `--role`, ausência de `cwd`, ausência de `pool:true`, transporte local, papéis duplicados e colisão de nome normalizado (`note` + `alice_append` vs `note_alice` + `append`).
- Docs/exemplo: `README.md` com contrato, garantias, não garantias (ESC1/ESC2 e bypass por shell não mitigados), instalação, chamada, códigos de erro e detalhes de comportamento; `examples/opencode.json` com servidores por papel, ACL top-level `note_* deny` e allow pontual, sem `cwd` e sem `pool:true`.
- Dependências locais pinadas: `@modelcontextprotocol/sdk` 1.32.2 e `zod` 4.6.7, `package-lock.json` próprio; `node_modules` local adicionado ao `.gitignore`.
- Inventário: `code-map.md` ganhou a linha do novo harness; `.github/workflows/quality.yml` ganhou `setup-node`, `node --check` dos módulos, `npm ci`, `npm test` e `validate-config`; linha correspondente no resumo do job.
- Testes focados (51): `tests/append.test.mjs`, `tests/security.test.mjs`, `tests/locking.test.mjs`, `tests/total-time.test.mjs`, `tests/mcp.test.mjs`, `tests/config.test.mjs`, `tests/process.test.mjs`, com helpers de fixture e processos filhos em `tests/helpers/`.

## Evidence

- `date '+%Y-%m-%d %H:%M %:z'` | 2026-11-09 21:48 -03:00 | HEAD `eb0186a` | worktree conforme Code state.
- `npm test --prefix harnesses/agent-note-writer-mcp` | exit 0 | `ℹ tests 51`, `ℹ pass 51`, `ℹ fail 0` | 2026-11-09 21:48 -03:00; log em `/tmp/opencode/anw-test2.log`.
- `npm ci --prefix harnesses/agent-note-writer-mcp` | exit 0 | lock em sincronia com o manifesto; `found 0 vulnerabilities` | 2026-11-09 21:48 -03:00.
- `npm audit --omit=dev --prefix harnesses/agent-note-writer-mcp` | exit 0 | 0 vulnerabilidades | 2026-11-09 21:47 -03:00.
- `node --check` de `index.mjs`, `validate-config.mjs` e `src/*.mjs` | exit 0 | sem saída | 2026-11-09 21:48 -03:00.
- `node harnesses/agent-note-writer-mcp/validate-config.mjs harnesses/agent-note-writer-mcp/examples/opencode.json` | exit 0 | `"ok": true`, papéis developer/planner/coder/tester/reviewer | 2026-11-09 21:48 -03:00.
- Varredura de links dos Markdown novos (`README.md` e `code-map.md`) | exit 0 | nenhum alvo ausente | 2026-11-09 21:48 -03:00.
- `python3 tools/validate_resources.py` | exit 1 | falha **pré-existente e de outro papel**: caminhos absolutos de home em `docs/agent-state/agent-note-writer/planner.md` (2) e `tester.md` (1) | 2026-11-09 21:48 -03:00. Não editei notas de outros papéis.
- Testes do harness ACL (E1–E11/P1/P2b, ESC1/ESC2) não foram reexecutados: são evidência do tester, não substituídos por estes testes.

## Decisions and assumptions

- Papel fixo apenas por `--role` no spawn; request não tem canal para papel, path ou timestamp, e campos extras são rejeitados por schema estrito.
- Append de uma linha por chamada: `text` com controles, newline ou U+FFFD é rejeitado; envie uma entrada por chamada. U+FFFD é rejeitado para não aceitar substituição silenciosa de UTF-8 inválido decodificado na camada de transporte.
- Slug conservador `[a-z0-9]` com hífens internos (1–64 bytes), sem espaço/Unicode/`.`/`..`. O caso `SLUG-10` (espaço) do tester fica como decisão pendente; o default conservador é compatível com o plano e está documentado.
- Raiz é o `cwd` do launcher, não identidade autenticada; não existe allowlist de base no contrato. `NEG-ROOT-03` (path fora de base) não se aplica a esta arquitetura; confinamento é relativo ao root fornecido.
- Timeout após escrita faz rollback por truncate antes de retornar erro; o fsync é explícito. Escrita parcial por falha de I/O também faz rollback e retorna `WRITE_FAILED`.
- O lock de dono morto é recuperado por liveness de PID; reutilização de PID pode atrasar a recuperação e nesse caso falha fechada por timeout.
- `validate-config.mjs` aceita JSON estrito (não JSONC); docs instruem exportar/remover comentários. A checagem de ACL é do harness, não do script.

## Pending and risks

- Validação independente pendente: tester deve rodar a matriz real em fixtures descartáveis (limites, concorrência, timeout, timestamp, resources, nomes, symlink/hardlink) e reviewer o preflight/gates amplos no mesmo snapshot.
- Risco residual aceito, não mitigado: edição de config/`cwd` por agente e bypass por shell no mesmo UID (ESC1/ESC2 medidos no harness). O README declara isso explicitamente.
- TOCTOU de componentes intermediários não é eliminado sem `openat`/dirfd; a verificação final por `/proc/self/fd` é Linux-específica e best-effort.
- Bloqueio de CI para quem consolidar as notas: `tools/validate_resources.py` e a varredura de links do workflow falham por conteúdo das notas `planner.md`/`tester.md` (caminho absoluto de home e padrão de regex interpretado como link). Fora do escopo do coder; developer deve encaminhar aos autores antes de commitar as notas. O README novo não tem caminhos absolutos nem links quebrados.
- Dependências locais exigem `npm ci` no diretório do harness; CI e validação local usam Node 24 (manifesto declara `>=20`), via NVM no ambiente local. Sem instalação global.

## References

- Plano/contrato: `docs/agent-state/agent-note-writer/planner.md` (entradas 21:02 e 21:31) e `docs/agent-state/agent-note-writer/tester.md` (baseline best-effort 21:06).
- Workflow: `workflows/developer-workflow.md`; template: `templates/task-note.md`.
- Implementação: `harnesses/agent-note-writer-mcp/`; docs `README.md`; exemplo `examples/opencode.json`.
- Inventário: `code-map.md`, `.gitignore`, `.github/workflows/quality.yml`.
- Logs de validação: `/tmp/opencode/anw-test2.log`, `/tmp/opencode/anw-ci2.log`, `/tmp/opencode/anw-audit.log`, `/tmp/opencode/anw-validator.log`.

## Updates

### 2026-11-09 21:48 -03:00 - checkpoint de conclusão da implementação

- Fact: servidor, testes focados (51 passando), config de exemplo, docs e inventário implementados; `npm ci`, `node --check`, `validate-config` e auditoria local com exit 0. Nenhum commit. Validação independente e gates amplos continuam pendentes; aprovação não declarada.
- Supersedes or discards: none.

### 2026-11-09 21:49 -03:00 - ajuste final de inventário e revalidação

- Fact: `.github/workflows/quality.yml` fixado em Node 24, o mesmo runtime da validação local (manifesto declara `>=20`); `npm test` reexecutado em 2026-11-09 21:49 -03:00 com exit 0 e 51 testes; nenhum `node_modules` aparece no status do Git.
- Supersedes or discards: substitui a menção anterior a CI em Node 22, já corrigida na seção Pending and risks.

### 2026-11-09 22:09 -03:00 - correções do retorno independente do tester (F1, F2, L5)

- Fact: F1 corrigido em produção. `appendNote` lê, sob o lock, o último carimbo já registrado na nota (varredura reversa por linhas no formato do servidor; linhas sem carimbo são ignoradas) e compara o instante do novo carimbo com ele; se o relógio produzir instante anterior, falha fechado com `CLOCK_REGRESSION` antes de qualquer escrita, sem fabricar horário. Notas existentes continuam compatíveis e a checagem não depende de estado em memória. Regressões em `tests/coder-regressions.test.mjs`: primeiro append às 12:34, clock em 12:33 rejeitado com arquivo intacto; nota com carimbo manual futuro rejeitada; mesmo minuto aceito; caminho wire-level via MCP retorna `CLOCK_REGRESSION`.
- Fact: F2 corrigido rejeitando U+2028/U+2029 como controle (`TEXT_CONTROL`), mantendo a promessa de uma linha imprimível; README e tabela de erros atualizados. Teste de núcleo e wire adicionados.
- Fact: L5 corrigido. Recuperação de lock stale agora usa mutex de recuperação (diretório com `owner.json` de pid+nonce) e substitui o lock por `rename` atômico de um candidato, revalidando o payload observado sob o mutex e verificando o nonce após o takeover. Dono vivo nunca é removido; `releaseLock` só remove o lock cujo nonce ainda é o próprio. Mutex com dono vivo não é reclamado; mutex sem dono só é reclamado após `lockStaleMs`. `lockWaitMs` 500 ms e orçamento total 2 s não foram alterados. Regressões: mutex de recuperação ocupado impede roubo e preserva o lock (`LOCK_BUSY`, zero escrita); 6 processos concorrentes recuperam um lock deixado por processo morto e produzem 6 linhas únicas, sem `.recover` residual. Risco residual documentado no README: lock ilegível só é reclamado após a idade stale (escritor parado além de 30 s entre criar o lock e gravar o payload fica fora do orçamento de 2 s); TOCTOU de componentes intermediários permanece best-effort. ESC1/ESC2 e bypass por shell continuam risco aceito, não mitigados.
- Fact: `tests/tester-gaps.test.mjs` não foi alterado; as regressões novas ficaram em arquivo do coder. `code-map.md` e `README.md` atualizados para o novo comportamento.
- Evidence: `npm test --prefix harnesses/agent-note-writer-mcp` | exit 0 | `ℹ tests 64`, `ℹ pass 64`, `ℹ fail 0` | 2026-11-09 22:09 -03:00, log `/tmp/opencode/anw-test-r2.log`. `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs` e `tests/*.test.mjs` | exit 0 | sem saída | 22:09. `node harnesses/agent-note-writer-mcp/validate-config.mjs harnesses/agent-note-writer-mcp/examples/opencode.json` | exit 0 | `"ok": true` | 22:09. HEAD `eb0186a`, worktree sujo sem commit.
- Supersedes or discards: substitui as contagens de 51 testes e os pendentes anteriores sobre F2 e L5; não altera os requisitos nem o risco aceito ESC1/ESC2. A validação independente do tester e o reviewer final continuam pendentes, incluindo reexecução dos cenários F1/F2/L5.

### 2026-11-09 22:10 -03:00 - revalidação após ajuste defensivo do mutex

- Fact: adicionada verificação do retorno ao criar `owner.json` do mutex de recuperação (se o arquivo já existir, falha `LOCK_ERROR` em vez de prosseguir sem posse). `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs` e `tests/*.test.mjs` | exit 0 | sem saída | 22:10. `npm test --prefix harnesses/agent-note-writer-mcp` | exit 0 | `ℹ tests 64`, `ℹ pass 64`, `ℹ fail 0` | 22:10, log `/tmp/opencode/anw-test-r3.log`. HEAD `eb0186a`, worktree sujo sem commit.
- Supersedes or discards: substitui o carimbo de validação de 22:09 como último estado verificado; o resultado e os riscos permanecem os mesmos.

### 2026-11-09 22:28 -03:00 - integração documental por papel e exemplos V2

- Fact: instruções canônicas atualizadas. `workflows/developer-workflow.md`, `templates/task-note.md` e as seções de nota de `agents/planner.md`, `agents/coder.md`, `agents/tester.md` e `agents/reviewer.md` agora instruem: quando o MCP de notas estiver configurado, escrever a nota com a tool do papel `note_<role>_append` enviando apenas `task_slug` e o texto da entrada; o servidor gera carimbo, caminho e papel, então não incluí-los no texto e não escrever a nota por `edit`; uma chamada por entrada; fallback manual com carimbo aferido quando a tool não estiver disponível, sem alegar append MCP; o registro consolidado `docs/agent-state/<task>.md` fica fora da tool e pertence ao developer. O texto mantém explicitamente que o MCP é best-effort e não impede bypass por configuração ou shell. `developer.md` e o modelo de registro não foram alterados.
- Fact: `docs/contexto-persistente.md` ganhou a mesma regra em resumo. `harnesses/agent-note-writer-mcp/README.md` agora documenta ativação project-local em V2 (`mcp.servers`, `permissions` em array, `agents` por papel, `codemode:false`, sem `cwd`/`pool:true`), recarga de config e o exemplo reutilizável `examples/opencode.env-path.json` com `AGENT_TOOLKIT_DIR` e `NODE_BIN`, explicitamente um comando de launcher e não permissão de shell do agente. `examples/opencode.json` foi corrigido do shape V1 para o shape V2 medido no harness. Nenhuma config ativa na raiz foi criada; config global e repo Jev intocados; grants de agente no frontmatter permanecem inalterados e a ativação real continua dependendo da config do projeto.
- Fact: `validate-config.mjs` passa a aceitar o bloco V2 `mcp.servers` e `--role` embutido em comando de shell do exemplo; `tools/validate_resources.py` exige a referência `note_<role>_append` e o fallback em cada papel de nota, no workflow e no template. Testes novos: 3 em `tests/test_validate_resources.py` (papéis, workflow e template com mutação) e 3 em `harnesses/agent-note-writer-mcp/tests/config.test.mjs` (shape V2 do exemplo, variante por variável de ambiente e CLI nos dois exemplos). `code-map.md` e o gate CI foram atualizados para o segundo exemplo.
- Evidence: `python3 -m unittest discover -s tests -p 'test_validate_resources.py'` | exit 0 | 75 testes, OK | 2026-11-09 22:28 -03:00. `python3 tools/validate_resources.py` | exit 0 | `PASS: agent roles, task notes, workflow, and portability` | 22:28. `npm test --prefix harnesses/agent-note-writer-mcp` | exit 0 | `ℹ tests 73`, `ℹ pass 73`, `ℹ fail 0` | 22:28, log `/tmp/opencode/anw-test-docs3.log`. `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs` e `tests/*.test.mjs` | exit 0 | sem saída | 22:28. Varredura de links dos Markdown alterados | exit 0 | nenhum alvo ausente | 22:28. HEAD `eb0186a`, worktree sujo sem commit.
- Supersedes or discards: não substitui os resultados F1/F2/L5 de 22:09–22:10; adiciona a integração documental e não altera o backend nem os riscos aceitos. Pendente: tester independente revisar doc/testes e depois reviewer final; ativação de ACL no frontmatter dos agentes, se o harness não resolver as grants pela config do projeto, segue como passo separado.

### 2026-11-09 22:29 -03:00 - revalidação final da integração documental

- Fact: após o ajuste de redação do README sobre grants assumirem as definições de agente existentes, reexecutei `python3 tools/validate_resources.py` | exit 0 | `PASS: agent roles, task notes, workflow, and portability`; `npm test --prefix harnesses/agent-note-writer-mcp` | exit 0 | `ℹ tests 73`, `ℹ pass 73`, `ℹ fail 0`; varredura de links dos Markdown alterados | exit 0. HEAD `eb0186a`, sem commit.
- Supersedes or discards: substitui 22:28 como carimbo da última revalidação; resultados e pendências permanecem.

### 2026-11-10 13:59 -03:00 - correções G1/G2/G3/A1 do checker de configuração

- Fact: G2 corrigido em `harnesses/agent-note-writer-mcp/src/config-check.mjs`. O checker agora trata como servidor de nota qualquer entrada cujo comando contenha `--role`, inclusive embutido em comando composto (`sh -c "… --role coder"`), além do prefixo `note_`; exige nome exato `note_<role>` e mantém a detecção de colisão após normalização. Testes novos: alias `Note.Coder` com comando composto gera `CONFIG_NAME`; o mesmo comando com nome `note_coder` passa (sensibilidade); alias junto do canônico gera `CONFIG_DUPLICATE_ROLE` e `CONFIG_DUPLICATE_TOOL`.
- Fact: G3 corrigido. Todo servidor de nota exige `codemode: false` explícito; `true` ou ausente gera `CONFIG_CODEMODE`. Teste cobre ambos e o caso explícito correto.
- Fact: A1 corrigido. `examples/opencode.json` removeu o servidor `note_developer` e o grant correspondente; exemplos e README agora declaram que somente `planner`, `coder`, `tester` e `reviewer` usam o MCP e que o developer escreve o registro consolidado manualmente. Workflow/template deixam a mesma regra explícita. O teste do exemplo rejeita role fora desse conjunto e a ausência de `developer`.
- Fact: G1 fechado. `tools/validate_resources.py` exige, para cada papel de nota, as menções `task_slug`, `` `edit` `` e "não os inclua no texto"; workflow exige as frases de não escrever a nota por `edit` e de não enviar os campos gerados, e o template exige as equivalentes. Testes Python verificam a presença e a mutação/remoção de cada frase em papéis, workflow e template. Code-map atualizado.
- Fact: nenhuma alteração em `src/note-writer.mjs`, `src/server.mjs`, `index.mjs` ou no backend; nenhuma config global/Jev tocada; sem commit.
- Evidence: `node harnesses/agent-note-writer-mcp/validate-config.mjs` no config negativo com alias e `codemode:true` | exit 1 | códigos `CONFIG_CODEMODE` e `CONFIG_NAME`, `ok:false` | 2026-11-10 13:59 -03:00. CLI nos dois exemplos | exit 0 cada | `ok:true`. `npm test --prefix harnesses/agent-note-writer-mcp` | exit 0 | `ℹ tests 76`, `ℹ pass 76`, `ℹ fail 0` | 13:59, log `/tmp/opencode/anw-test-final-gaps.log`. `python3 -m unittest discover -s tests -p 'test_validate_resources.py'` | exit 0 | 78 testes, OK | 13:59. `python3 tools/validate_resources.py` | exit 0 | PASS. `node --check` dos módulos/testes | exit 0. Varredura de links dos Markdown alterados | exit 0. HEAD `eb0186a`, worktree sujo sem commit.
- Limitação observada: uma execução paralela intermediária do pacote falhou 3 testes por timeouts internos de 2 s/5 s sob carga; `node --test --test-concurrency=1` e nova execução paralela passaram 76/76. O script do pacote não foi alterado. Notas de backend F1/F2/L5 e riscos ESC1/ESC2 permanecem como antes.
- Supersedes or discards: fecha as recomendações G1/G2/G3/A1 do tester; não altera comportamento do servidor, requisitos ou risco aceito. Pendente: tester independente reconferir o delta do checker/exemplos e depois reviewer final; ativação de ACL no frontmatter dos agentes segue como passo separado se o harness não resolver grants pela config do projeto.

### 2026-11-10 14:06 -03:00 - fecha O1: checker restrito aos quatro papéis de nota

- Fact: `src/constants.mjs` ganhou `NOTE_ROLES` com `planner`, `coder`, `tester` e `reviewer`. `src/config-check.mjs` rejeita qualquer outro role válido, inclusive `developer`, com `CONFIG_ROLE_NOT_ALLOWED`; a mensagem lista os papéis permitidos. O erro `CONFIG_EMPTY` agora só aparece quando nenhuma entrada de servidor de nota foi detectada, evitando ruído quando a única entrada foi rejeitada por role.
- Fact: testes de config atualizados para os papéis aprovados e novo teste O1 cobre controle positivo com os quatro, negativo `note_developer`, negativo `analyst` e negativo `alice`. `README.md` e `code-map.md` documentam a restrição; nenhum backend, config global ou repo Jev foi alterado; sem commit.
- Evidence: `node --test tests/config.test.mjs` no pacote | exit 0 | `ℹ tests 14`, `ℹ pass 14`, `ℹ fail 0` | 2026-11-10 14:06 -03:00, log `/tmp/opencode/anw-config-o1b.log`. `validate-config` em `examples/opencode.json` | exit 0 | `ok:true`; em `examples/opencode.env-path.json` | exit 0 | `ok:true`. `validate-config` em config com `note_developer` bem formado | exit 1 | `ok:false`, `CONFIG_ROLE_NOT_ALLOWED` | 14:06. `node --check` dos módulos/testes alterados | exit 0. HEAD `eb0186a`, worktree sujo sem commit.
- Supersedes or discards: fecha a observação O1 de 14:03; F1/F2/L5, G1–G3, ESC1/ESC2 e o restante permanecem como registrados. Pendente: tester independente reconferir O1 e depois reviewer final.

### 2026-11-10 14:26 -03:00 - blockers R1/AC-04 e R2/AC-03 corrigidos

- Fact (R1): `stampToMinutes` agora valida faixa de offset (até 14:00, minutos até 59) e faz round-trip explícito de calendário/hora com `setUTCFullYear`/`setUTCHours`; datas como mês 99, 30 de fevereiro, hora 24, minuto 60 e offsets impossíveis retornam inválido em vez de serem normalizadas por `Date.UTC`. `lastRecordedStamp` reconhece qualquer linha iniciada por carimbo no formato de 23 caracteres; se o carimbo for inválido, lança `NOTE_TIMESTAMP_INVALID` antes de qualquer append, inclusive quando existe carimbo válido anterior e quando a linha inválida é apenas o carimbo sem ` - `. Linha sem forma de carimbo continua ignorada como prosa. O arquivo fica byte-a-byte inalterado, o lock é liberado e nenhum horário é fabricado. README e tabela de erros atualizados.
- Fact (R2): a remoção/criação do mutex de recuperação agora ocorre sob uma guarda de kernel, obtida por socket Unix abstrato no Linux (fallback de porta local em outras plataformas), liberada automaticamente pelo kernel na morte do processo. O guarda é mantido entre ler o dono stale, remover e criar o mutex; nenhum concorrente consegue criar o mutex na janela entre a checagem e o `rm`. O takeover do lock e a verificação de nonce continuam como antes; `lockWaitMs` 500 ms e orçamento 2 s não mudaram. Foi adicionado um hook opcional `afterStaleCheck` apenas para teste, usado por um helper que pausa após a checagem stale mantendo a guarda.
- Fact: regressões determinísticas em `tests/coder-regressions.test.mjs`: R1 com sete carimbos impossíveis e um carimbo bare inválido, todos com arquivo intacto e lock ausente; R2 com guarda mantida por outro processo e concorrente recebendo `LOCK_BUSY` sem remover o mutex; R2 com helper pausado exatamente após a checagem stale e concorrente bloqueado na janela; R2 com processo que morre segurando a guarda e recuperação subsequente. Helpers novos: `tests/helpers/hold-guard-then-die.mjs` e `tests/helpers/append-with-barrier.mjs`. Nenhuma nota alheia alterada; `tests/tester-gaps.test.mjs` intocado.
- Evidence: `npm test` no pacote | exit 0 | `ℹ tests 81`, `ℹ pass 81`, `ℹ fail 0` | 2026-11-10 14:26 -03:00, log `/tmp/opencode/anw-test-blockers.log`; execuções focadas dos quatro testes R1/R2 também exit 0. `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs`, `tests/*.test.mjs` e `tests/helpers/*.mjs` | exit 0. HEAD `eb0186a`, worktree sujo sem commit. Nenhuma suíte Python/global/CI foi executada nesta rodada porque só o harness Node mudou.
- Supersedes or discards: fecha os blockers R1 e R2 registrados pelo reviewer; mantém ESC1/ESC2, TOCTOU de componentes intermediários e a premissa de 30 s para lock/mutex sem dono como riscos best-effort já documentados. Novo risco residual documentado: o guarda é mutex local, não autenticação; outro processo do mesmo UID pode ocupar o nome/porta e bloquear recovery, que falha fechado. Pendente: reviewer final reexecutar gates afetados no novo snapshot após reconferência independente.

### 2026-11-10 14:27 -03:00 - revalidação após fechamento do guarda

- Fact: `releaseRecoveryGuard` agora chama `closeAllConnections` antes de `close`, evitando que uma conexão ociosa ao socket/porta local atrase a liberação do guarda. `npm test` reexecutado | exit 0 | `ℹ tests 81`, `ℹ pass 81`, `ℹ fail 0` | 14:27, log `/tmp/opencode/anw-test-blockers2.log`; `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs`, `tests/*.test.mjs` e `tests/helpers/*.mjs` | exit 0. HEAD `eb0186a`, sem commit.
- Supersedes or discards: substitui 14:26 como carimbo da última revalidação; R1/R2 e os riscos residuais permanecem os mesmos.

### 2026-11-10 14:38 -03:00 - D1: liberação da guarda não espera cliente ocioso

- Fact: `net.Server.closeAllConnections` não existe no Node 24 (é API de servidor HTTP), então a guarda podia ficar presa em `server.close` enquanto um socket ocioso estivesse conectado. Corrigido em `src/note-writer.mjs`: o servidor da guarda registra `connection` e destrói o socket no accept; `releaseRecoveryGuard` chama `server.close()` sem aguardar callback. O listener para imediatamente, o nome/porta é liberado e o kernel continua liberando a guarda na morte do processo. Limites 500 ms/2 s inalterados; sem nova permissão e sem promessa de autenticação.
- Fact: expostos `recoveryGuardOptions` e o seam opcional `guardOptions` para testar o fallback TCP. Regressões novas em `tests/coder-regressions.test.mjs`: cliente ocioso na guarda abstrata, release e reaquisição abaixo de 500 ms; fallback TCP com cliente ocioso, release/reaquisição abaixo de 500 ms; teste de barreira R2 agora também conecta cliente ocioso antes de liberar e exige conclusão do append abaixo de 1 s. README atualizado.
- Evidence: `npm test` no pacote | exit 0 | `ℹ tests 83`, `ℹ pass 83`, `ℹ fail 0` | 2026-11-10 14:38 -03:00, log `/tmp/opencode/anw-test-d1.log`. `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs`, `tests/*.test.mjs` e `tests/helpers/*.mjs` | exit 0. HEAD `eb0186a`, worktree sujo sem commit. Nenhuma suíte Python/global/CI executada; só o harness Node mudou.
- Supersedes or discards: fecha D1; R1/R2 continuam resolvidos e ESC1/ESC2/TOCTOU intermediário permanecem risco best-effort já documentado. Pendente: tester independente reconferir D1 e depois reviewer final no novo snapshot.

### 2026-11-10 15:22 -03:00 - CI dispara em push para develop

- Fact: alteração mínima em `.github/workflows/quality.yml`: `push.branches` passou de `[main]` para `[main, develop]`. `pull_request.branches: [main]` e `workflow_dispatch` foram preservados; nenhum job, permissão ou passo foi alterado. Nenhum outro arquivo foi editado.
- Evidence: não há PyYAML, yamllint, actionlint, yq ou ruby instalados no ambiente; a validação foi estrutural no bloco de triggers (assertivas de `push`, `branches: [main, develop]`, `pull_request` com `[main]` e `workflow_dispatch` presentes) | STRUCTURE_OK | 15:22. `git diff --check -- .github/workflows/quality.yml` | exit 0 | sem erros de whitespace | 15:22. Diff confirmado com uma única linha alterada; HEAD `eb0186a`. Sem commit/push.
- Supersedes or discards: none; a limitação de validação é a ausência de parser YAML local, não uma pendência de código. Pendente: developer retomar stage/commit/push autorizado em `develop`; o push deve acionar o workflow com os mesmos gates.
