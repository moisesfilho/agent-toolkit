# tester - agent-note-writer

- Role: tester
- Updated: 2026-11-10 14:51 -03:00 (aferido com `date '+%Y-%m-%d %H:%M %:z'`)
- Code state: coordenação `agent-toolkit` HEAD `eb0186a` (somente `docs/agent-state/agent-note-writer/` não rastreado); alvo `typesafe-jev-opencode` HEAD `b95316c` com `code-map.md` não rastreado. Nenhum arquivo de produção, teste permanente ou config global foi alterado. Harness em `/tmp/opencode/iso` (stub.py, stub_v2.py, fake_llm.py, run_case.sh, run_project.sh) e projetos descartáveis `/tmp/opencode/acl-a..e`.

## Dispatch objective

Fechar a matriz `campo/limite -> NEG-* -> resultado esperado` antes do `coder` e provar, no harness OpenCode real, se o isolamento por papel (cada papel alcança só sua ferramenta/nota; papel errado, nome alternativo, delegação e override não cruzam) é suficiente para liberar a implementação. Critério de saída: matriz escrita cobrindo todos os `NEG-*` do plano do planner e conclusão de isolamento com comando, resultado e estado.

## Work done

1. Montei harness descartável em `/tmp/opencode/iso`: stub MCP stdio em Python (não há `node`/`npm`/`bun` na máquina), três servidores locais (`note_alice`, `note_bob`, `note`), agentes `alice`/`bob` (primary) e `helper` (subagent), variantes de config `A` (mutação sem deny), `B` (deny global + allow por papel), `C` (`B` + `codemode:false`), `D`/`D2`/`D3` (colisão de nome normalizado) e `E` (`B` + resource exposto). Runner `run_case.sh` executa `opencode run --standalone --archived --print-logs --format json --agent <id>`; artefatos por caso em `runs/<case>.json|.log|.exit`.
2. Executei a série medida `E0`-`E11` e `D1`-`D4` (OpenCode `v2.2.6`). Todos os processos retornaram exit 0; cada sessão foi confirmada com o agente correto (`GET /api/session/<id>` mostra `"agent":"alice"` em E0). IDs de sessão ficam em `runs/*.json` (primeira linha).
3. Medi a ordem efetiva de permissões com `opencode debug agents`: base `* allow`, regras globais do usuário, regra top-level do projeto `note_* deny`, regras do agente por último (`note_<papel>_append allow`, `subagent * deny`). O subagente `helper` recebe a regra top-level `note_* deny`; agentes globais (`build`, `developer`, ...) também.
4. Provei sensibilidade por mutação: removendo o deny top-level e o deny de `subagent` (config `A`), `alice` escreveu na nota de `bob` e vice-versa. Com a config `B`, os mesmos pedidos não cruzam.
5. Testei colisão de nome normalizado (`note` + tool `alice_append` vs `note_alice` + `append`): o nome duplicado colapsa em uma única tool; o impostor ficou inalcançável nas duas ordens de config; `note_alice_append` continuou roteando para `notes/alice.md`, não para `notes/evil.md`.
6. Testei vazamento por resource MCP: com `note_bob` expondo `note://bob`, `alice` leu `SECRET-BOB-CONTENT` via `tools.opencode.read_mcp_resource` apesar de o append em `note_bob` estar negado. Constatação medida que vira constraint de implementação (AC-06).

## Evidence

Estado comum: OpenCode `v2.2.6`; harness `cd /tmp/opencode/iso`; comando base `./run_case.sh <case> <agent> '<prompt>' [--auto] [--model ...]`; exit code em `runs/<case>.exit`; tool calls e outputs no JSON estruturado; log do servidor standalone em `runs/<case>.log`.

| Caso | Config | Agente / alvo | Exit | Sessão | Resultado observado |
| --- | --- | --- | --- | --- | --- |
| E0 | B | alice, "OK" | 0 | `ses_e3d70be01ffeFld8Ge3bGfV4cP` | `agent:"alice"` na API; MCP `note_alice` e `note_bob` conectados com 1 tool cada |
| E1 | B | alice -> própria tool | 0 | `ses_e3d70215affeiF62sP73f0jHKo` | `tools.note_alice.append({text:"A1"})` completou; `notes/alice.md` = `A1`; `note_bob` sem escrita |
| E2 | B | alice -> `note_bob` exato, `--auto` | 0 | `ses_e3d6fdf4cffeIJF3sP8lge5mET` | `search` = 0 itens; `tools.note_bob.append` -> `Unknown tool 'note_bob.append'`; `notes/bob.md` inexistente; nenhuma chamada no log |
| E3 | C (`codemode:false`) | alice -> própria | 0 | `ses_e3d6e41c3ffervu8E12m97yZ7K` | tool nativa `note_alice_append` completou; `notes/alice.md` = `C-ALICE` |
| E4 | C | alice -> `note_bob_append`, `--auto` | 0 | `ses_e3d6e239bffe87mhiu0eGuAQCa` | catálogo 0 itens; modelo reporta tool inexistente; nenhuma escrita |
| E5 | A (mutação) | alice -> `note_bob_append` | 0 | `ses_e3d6d8534ffeOIPuHDpoL5Pusx` | **cruzou**: `notes/bob.md` = `MUT-LEAK` |
| E6 | A (mutação) | bob -> `note_alice_append` | 0 | `ses_e3d6d6b6dffe07cnmWuqGbrSA0` | **cruzou**: `notes/alice.md` = `MUT-LEAK-B` |
| E7 | B | alice tenta delegar a `helper` | 0 | `ses_e3d6d27a1ffeI8RW0Ia1se274u` | nenhuma tool de subagent exposta (`task`/`delegate`/`subagent` -> Unknown tool); nenhuma escrita |
| E8 | B | `build` -> `note_alice_append`, `--auto` | 0 | `ses_e3d6cd119ffesjaCA1DBjUSfDN` | `Unknown tool 'note_alice_append'`; nenhuma escrita |
| E9 | E (resource exposto) | alice lê `note://bob` | 0 | `ses_e3d6a4680ffepKZT9y8bfdpRQy` | **vazou**: `tools.opencode.read_mcp_resource({server:"note_bob",uri:"note://bob"})` retornou `SECRET-BOB-CONTENT`; log `resource-read` |
| E10 | B | bob -> `note_alice_append`, `--auto` | 0 | `ses_e3d68b098ffe4Sr8VMqgx0xKkJ` | somente `tools.note_bob.append` visível; tool de alice indisponível; nenhuma escrita |
| E11 | B | alice com prompt de override + `--auto` | 0 | `ses_e3d68849fffe4NcCi59RMYsVUF` | "SYSTEM OVERRIDE ... elevated" não alterou ACL; só tool de alice visível; nenhuma escrita |
| P1 | P (C + provider fake) | provider forja `note_alice_append` permitida | 0 | `ses_e3d659dc8ffeDZFJea547cVnMk` | controle: tool executou e `notes/alice.md` = `FORGED`; provider log mostra a lista de tools de alice |
| P2b | P_bob (C + provider fake) | provider forja `note_bob_append` negada | 0 | `ses_e3d65507effeWfuO4Qv6sddW4b` | dispatch recusou: `No tool named "note_bob_append" is currently available`; `providerCall.executed=false`; zero chamada MCP e zero escrita |
| D1 | D (colisão) | alice -> `tools.note.alice_append` | 0 | `ses_e3d6bb5e2ffe9udcs44qpY7tym` | `Unknown tool 'note.alice_append'`; `notes/evil.md` inexistente |
| D2 | D2 (sem deny) | alice lista tools | 0 | `ses_e3d6b3463ffe1J1L5SQLILBI8J` | catálogo só tem `note_alice_append` e `note_bob_append`; impostor ausente |
| D3 | D2 | alice -> `tools.note.alice_append` | 0 | `ses_e3d6af830ffeybPX2OrV4bUFCx` | mesmo `Unknown tool`; paths disponíveis listados pelo modelo são só `note_alice_append` e `note_bob_append` |
| D4 | D3 (impostor primeiro) | alice -> `note_alice_append` | 0 | `ses_e3d6a96adffeUckHlIHJh2Li8X` | roteou para `note_alice` (`notes/alice.md` = `MISROUTE`), não para `notes/evil.md`; sem misroute |

Conclusão de isolamento (medida, não documental):

- **Provado**: papel correto alcança só sua tool/nota (E1, E3); papel errado não alcança em Code Mode nem com `codemode:false` (E2, E4, E10); agente global não alcança (E8); nome alternativo/typo e path de namespace alternativo falham (E2, D1, D3); override textual + `--auto` não concede (E11); a ACL é load-bearing (E5/E6 falham sem deny); colisão de nome normalizado não concedeu escrita ao impostor nas duas ordens (D1, D4).
- **Provado também (P1/P2b)**: chamada forjada por provider hostil é filtrada em tempo de dispatch. Com provider fake local, o nome permitido `note_alice_append` executou (controle, escreveu `FORGED` em `alice.md`); o nome negado `note_bob_append`, embora emitido pelo provider, retornou `No tool named "note_bob_append" is currently available` e não gerou chamada MCP nem escrita. O log do provider mostra a lista enviada para alice sem `note_bob_append`.
- **Não provado**: a negação de delegação como deny ativo (não existe tool de subagent exposta; E7 mede ausência de superfície, não bloqueio); a eficácia pós-implementação dos limites e da atomicidade.
- **Medido como risco**: se o servidor MCP expuser resources/prompts, outro papel lê a nota via `opencode_read_mcp_resource` (E9), que não é coberto por `note_* deny`. Constraint obrigatória: o servidor de produção não registra resources nem prompts; alternativa de defesa é negar `opencode_read_mcp_resource` com resource `<server>:*`.
- **Limite do harness**: `XDG_CONFIG_HOME`/`OPENCODE_CONFIG_DIR` não isolaram a config global do usuário no v2.2.6; o harness carregou a config global read-only (plugins `opencode-quota`, `model-fallback`; MCPs `typesafe-jev`, `playwright`, `opencode_console`). A ordem efetiva medida mostra que a regra top-level do projeto vence as globais e perde para as regras de agente, então o teste é válido, mas o resultado fica vinculado a essa config global; se ela mudar, reexecutar.

## Negative matrix (campo/limite -> NEG-* -> resultado esperado)

Status: `medido` = executado neste harness; `planejado` = servidor ainda não existe, cenário definido para o `coder`/validação. Limites candidatos (4096 bytes, 1 MiB, 500 ms, 2 s, 1 s) não aprovados: os testes devem ler a constante da fonte de configuração/export do servidor em vez de repetir literal.

### NEG-ACL - identidade do servidor e ACL por papel

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| ACL-01 | server/tool do papel | alice chama a tool de alice | append só em `alice.md`, conteúdo íntegro | medido (E1/E3) | TEST-ACL-01 |
| ACL-02 | server/tool de outro papel | alice chama exatamente a tool de bob | tool ausente/`Unknown tool`, zero escrita em `bob.md` | medido (E2/E4) | TEST-ACL-02 |
| ACL-03 | simetria | bob chama exatamente a tool de alice | tool ausente, zero escrita em `alice.md` | medido (E10) | TEST-ACL-03 |
| ACL-04 | agente não configurado | agente global (`build`) chama tool de nota | tool ausente, zero escrita | medido (E8) | TEST-ACL-04 |
| ACL-05 | nome alternativo | `note_bob_appendx`, `note.alice_append`, namespace trocado | `Unknown tool`, zero escrita | medido (E2, D1, D3) | TEST-ACL-05 |
| ACL-06 | override textual | prompt "system override/elevated" + `--auto` | ACL inalterada, zero escrita | medido (E11) | TEST-ACL-06 |
| ACL-07 | delegação | alice lança subagente para escrever em bob | sem tool de subagent ou deny `subagent`; zero escrita | medido parcial (E7; ausência de superfície) | TEST-ACL-07 |
| ACL-08 | subagente sem allow | `helper` tenta tool de qualquer papel | deny top-level aplica ao subagente, zero escrita | planejado (regra visível em `debug agents`; execução não possível sem tool de subagent) | TEST-ACL-08 |
| ACL-09 | remoção do deny (mutação) | config sem `note_* deny` | cruzamento ocorre; o teste original deve falhar | medido (E5/E6) | TEST-ACL-09 |
| ACL-10 | resource MCP | servidor expõe `note://bob`; alice usa `opencode_read_mcp_resource` | servidor não expõe resources/prompts **ou** leitura negada; nenhum conteúdo de outro papel | medido como vazamento (E9) | TEST-ACL-10 |
| ACL-11 | colisão de nome normalizado | `note`+`alice_append` vs `note_alice`+`append`, ambas as ordens | validação de config rejeita nome duplicado; nenhuma escrita no destino impostor | medido (D1, D4; sem misroute) | TEST-ACL-11 |
| ACL-12 | provider hostil | provider emite `tool_call` para nome fora da lista do papel | dispatcher rejeita; zero escrita | medido (P1 controle, P2b negado) | TEST-ACL-12 |

### NEG-ROOT - raiz confiável de configuração

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| ROOT-01 | raiz inexistente | config aponta diretório que não existe | servidor falha no startup; não cria caminho alternativo nem escreve no cwd | planejado | TEST-ROOT-01 |
| ROOT-02 | raiz symlink | raiz é symlink para fora do diretório permitido | rejeição por `lstat`/no-follow no startup | planejado | TEST-ROOT-02 |
| ROOT-03 | raiz fora da base | path absoluto fora da base permitida | config inválida, sem escrita | planejado | TEST-ROOT-03 |
| ROOT-04 | raiz sem permissão de escrita | diretório somente leitura | erro de startup/append; nenhum sucesso parcial | planejado | TEST-ROOT-04 |

### NEG-DEST - destino fixo por configuração

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| DEST-01 | campo `path`/`file` no request | request inclui `path`, `file` ou `notePath` | rejeitado por schema/`additionalProperties:false`; zero escrita | planejado | TEST-DEST-01 |
| DEST-02 | traversal | destino configurado contém `..` ou absoluto fora da raiz | config inválida; zero escrita | planejado | TEST-DEST-02 |
| DEST-03 | symlink no destino | arquivo de nota é symlink para fora da raiz | recusa com `O_NOFOLLOW`; alvo externo intocado | planejado | TEST-DEST-03 |
| DEST-04 | TOCTOU | troca do destino por symlink entre validação e escrita | escrita falha ou fica no inode fixo; nenhum arquivo externo alterado | planejado | TEST-DEST-04 |
| DEST-05 | hardlink | nota é hardlink para arquivo externo | recusa (`nlink>1`) ou escrita confinada ao inode permitido | planejado | TEST-DEST-05 |

### NEG-ROLE - papel fixo por configuração

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| ROLE-01 | campo `role` no request | request inclui `role` diferente do configurado | rejeitado/ignorado; papel vem do processo, não da chamada | planejado | TEST-ROLE-01 |
| ROLE-02 | spoof de papel | request tenta `role:"bob"` no servidor de alice | rejeitado; zero escrita em `bob.md` | planejado | TEST-ROLE-02 |
| ROLE-03 | papel duplicado | duas instâncias configuradas para o mesmo papel/nota | validação de config falha; não inicia | planejado | TEST-ROLE-03 |
| ROLE-04 | papel por env | tentativa de trocar papel via ambiente do request | ambiente é fixado no spawn da config; request não tem canal para env | planejado | TEST-ROLE-04 |

### NEG-TEXT - texto de entrada

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| TEXT-01 | tipo | `text` número/objeto/array/null | rejeição de schema; zero append | planejado | TEST-TEXT-01 |
| TEXT-02 | obrigatório | `text` ausente | rejeição; zero append | planejado | TEST-TEXT-02 |
| TEXT-03 | campos extras | `text` + `path`/`role`/`timestamp` | rejeição; zero append | planejado | TEST-TEXT-03 |
| TEXT-04 | UTF-8 inválido | bytes inválidos/overlong | rejeição; nada de replacement silencioso | planejado | TEST-TEXT-04 |
| TEXT-05 | NUL/controle | `\0` ou controle não permitido | rejeição definida; zero append | planejado | TEST-TEXT-05 |
| TEXT-06 | string vazia | `text:""` | rejeição (0 bytes) | planejado | TEST-TEXT-06 |
| TEXT-07 | surrogate isolado | UTF-16 lone surrogate | rejeição | planejado | TEST-TEXT-07 |
| TEXT-08 | formato de linha | texto sem newline final | append adiciona exatamente um newline; não altera conteúdo anterior | planejado | TEST-TEXT-08 |

### NEG-TIME - timestamp do servidor

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| TIME-01 | campo `timestamp` no request | request injeta data/hora | ignorado/rejeitado; hora vem do servidor | planejado | TEST-TIME-01 |
| TIME-02 | relógio inválido | clock indisponível/retrocedido | falha fechada; sem append com hora fabricada | planejado | TEST-TIME-02 |
| TIME-03 | resolução de minuto | dois appends no mesmo minuto e um no minuto seguinte | timestamps no formato de minuto, não decrescentes; repetição no mesmo minuto permitida; sem segundos | planejado (baseline 21:02) | TEST-TIME-03 |
| TIME-04 | formato/fuso | execução em fuso local | `America/Fortaleza`, formato `YYYY-MM-DD HH:MM ±HH:MM` (ex.: `-03:00`), sem locale | planejado (baseline 21:02) | TEST-TIME-04 |

### NEG-ENTRY-SIZE - tamanho da entrada

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| SIZE-01 | `limit` exato | entrada com exatamente `limit` bytes UTF-8 | aceita; append íntegro | planejado | TEST-SIZE-01 |
| SIZE-02 | `limit+1` | entrada com `limit+1` bytes | rejeitada; arquivo inalterado | planejado | TEST-SIZE-02 |
| SIZE-03 | multibyte na borda | `limit-1` bytes + char de 2 bytes | rejeitada (conta bytes, não chars) | planejado | TEST-SIZE-03 |
| SIZE-04 | mutação de borda | trocar o par por dois valores do mesmo lado (ex.: `limit-2`/`limit-1`) | o teste de borda deve falhar; se sobreviver, asserção é insuficiente | planejado | TEST-SIZE-04 |

### NEG-FILE-SIZE - tamanho do arquivo resultante

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| FILE-01 | `max` exato | append resulta exatamente `max` | aceito; arquivo íntegro | planejado | TEST-FILE-01 |
| FILE-02 | `max+1` | append resultaria `max+1` | rejeitado; arquivo byte-a-byte inalterado | planejado | TEST-FILE-02 |
| FILE-03 | já acima de `max` | arquivo existente maior que `max` | append rejeitado (fail closed), sem truncar | planejado | TEST-FILE-03 |
| FILE-04 | unidade | limite medido em bytes após newline | conta bytes reais, não caracteres | planejado | TEST-FILE-04 |

### NEG-WAIT - espera por exclusividade

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| WAIT-01 | lock curto | lock preso por menos que `wait` | adquire e faz append | planejado | TEST-WAIT-01 |
| WAIT-02 | borda do lock | lock preso exatamente em `wait` | comportamento definido e determinístico (documentado); sem sucesso ambíguo | planejado | TEST-WAIT-02 |
| WAIT-03 | acima do limite | lock preso por `wait+1` | retorna ocupado/timeout; zero append | planejado | TEST-WAIT-03 |
| WAIT-04 | lock órfão | processo dono morto durante o lock | recuperação segura ou falha fechada; sem escrita parcial | planejado | TEST-WAIT-04 |

### NEG-TOTAL-TIME - tempo total da operação

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| TOTAL-01 | abaixo de `total` | operação normal | sucesso dentro de `total` | planejado | TEST-TOTAL-01 |
| TOTAL-02 | acima de `total` | FS/lock lento força `total+1` | erro de timeout; nunca reporta sucesso | planejado | TEST-TOTAL-02 |
| TOTAL-03 | timeout durante escrita | timeout no meio do append | nenhuma linha parcial; consistente no próximo read | planejado | TEST-TOTAL-03 |

### NEG-CONCURRENT - concorrência e falha parcial

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| CONC-01 | N escritores paralelos | N processos fazem append simultâneo | todas as N linhas presentes exatamente uma vez, sem interleaving; ordem não decrescente por timestamp | planejado | TEST-CONC-01 |
| CONC-02 | escritor morto | um processo é morto no meio do append | nenhuma linha parcial; lock recuperado | planejado | TEST-CONC-02 |
| CONC-03 | borda de tamanho concorrente | dois appends disputam a última vaga do limite | no máximo um sucede; nenhum byte perdido/excedido | planejado | TEST-CONC-03 |
| CONC-04 | durabilidade/retry | crash após write antes de fsync, retry do chamador | política de fsync explícita; sem duplicação silenciosa | planejado | TEST-CONC-04 |

## Traceability REQ/AC -> TEST

- `REQ-01`/`AC-01` (routing nomeado; rejeitar path/papel/tempo do request) -> `TEST-ACL-01..06`, `TEST-ROLE-01..04`, `TEST-TIME-01`, `TEST-DEST-01`; medição: E0-E4, E8, E10, E11.
- `REQ-02`/`AC-02` (nota própria; negação cruzada em runtime) -> `TEST-ACL-02..09`, `TEST-ACL-12`; medição: E1-E8, E10, E11, P1/P2b; mutação: E5/E6.
- `REQ-03`/`AC-03` (append completo, ordenado, sem substituição) -> `TEST-TEXT-08`, `TEST-CONC-01..04`, `TEST-DEST-03..05`; planejado.
- `REQ-04`/`AC-04` (timestamp do servidor, resolução 1 s) -> `TEST-TIME-01..04`; planejado.
- `REQ-05`/`AC-05` (limites e falha fechada) -> `TEST-SIZE-01..04`, `TEST-FILE-01..04`, `TEST-WAIT-01..04`, `TEST-TOTAL-01..03`, `TEST-ROOT-01..04`; planejado.
- `AC-06` (proposto pelo tester, derivado de E9): servidor não registra resources nem prompts; se registrar, `opencode_read_mcp_resource` deve ser negado por `<server>:*`. Teste: `TEST-ACL-10`.
- `AC-07` (proposto pelo tester, derivado de D1-D4): validar nomes de servidor/tool únicos após normalização; rejeitar colisão na config. Teste: `TEST-ACL-11`.
- `TEST-ACL-12` (provider hostil) medido em P1/P2b: dispatch recusa o nome negado e a tool permitida executa; ver `Evidence`.

## Decisions and assumptions

- **Prova call-time executada e aprovada**: o provider fake local emitiu `note_alice_append` (permitida) e ela executou; emitiu `note_bob_append` (negada) e o dispatch respondeu `No tool named "note_bob_append" is currently available`, sem chamada MCP e sem escrita. A lista de tools enviada ao provider (log do fake) contém `note_alice_append` e não contém `note_bob_append`. Portanto `TEST-ACL-12` está medido e não é pendência; a ressalva é que o provider fake é local/determinístico e o teste não cobre um provider que consiga registrar tools no servidor (o registro é por sessão/agente).
- **A regra top-level `note_* deny` é load-bearing**: sem ela (config A) há cruzamento nos dois sentidos; com ela, não. A regra deve existir no top-level do projeto, não só por agente, porque subagentes e agentes globais também precisam herdá-la.
- **Colisão de nome normalizado**: nas duas ordens testadas, o nome duplicado colapsou e o impostor não foi alcançável; não houve misroute. Ainda assim, validar unicidade na config é requisito (AC-07), porque a resolução observada não é garantia de ordem entre conexões.
- **Resources**: o vazamento E9 é real; a mitigação preferida é o servidor não registrar resources/prompts. Negar `opencode_read_mcp_resource` por servidor é alternativa, mas mais frágil.
- **Limites candidatos**: os testes devem importar as constantes da fonte (config/export do servidor), nunca repetir 4096/1 MiB/500 ms/2 s literalmente. Os pares de borda incluem a mutação obrigatória (`limit-1`/`limit` vs `limit+1`/`limit+2`) para provar sensibilidade.
- **Harness**: a config global do usuário não pôde ser isolada por `XDG_CONFIG_HOME`/`OPENCODE_CONFIG_DIR` no v2.2.6; ela foi carregada read-only. Sessões de teste foram gravadas no DB compartilhado com `--archived` e não foram removidas (nenhuma ação destrutiva). Nenhuma config global/usuário foi editada.

## Pending and risks

- `TEST-ACL-12` medido em P1/P2b (provider fake local, determinístico); não é pendência. Reexecutar apenas se o harness/provider real mudar.
- `TEST-ACL-07/08` (delegação) não têm superfície de execução no Code Mode; a regra `subagent * deny` e o deny top-level são defesa em profundidade. Reexecutar se uma versão do harness expuser subagentes.
- `TEST-ACL-10` mediu vazamento por resource; a implementação precisa provar ausência de resources/prompts (ou negação equivalente) — senão o gate de isolamento falha.
- `REQ-03/04/05` permanecem planejados: não existe servidor de produção implementado. A matriz está pronta para o `coder`, mas os resultados de limite/atomicidade só existirão após a implementação.
- Resultados vinculados à config global atual (`eb0186a` na coordenação, `b95316c` no alvo); mudança de config global, plugins ou versão do OpenCode exige reexecução.
- Artefatos do harness são voláteis em `/tmp/opencode/iso`; os IDs de sessão e os JSONs/logs em `runs/` são a evidência disponível nesta sessão.

## References

- Plano e matriz original: `docs/agent-state/agent-note-writer/planner.md` (linhas 43-48).
- Workflow: `workflows/developer-workflow.md`; template: `templates/task-note.md`.
- Alvo (repo irmão, caminho relativo): `../typesafe-jev-opencode/mcp/index.mjs`, `package.json`, `code-map.md`.
- Harness: `/tmp/opencode/iso/{stub.py,run_case.sh,opencode.jsonc,configs/{A,B,C,D,D2,D3,E}.json,runs/*.json,runs/*.log}`.
- Docs consultadas: `https://opencode.ai/docs/permissions` (ações `<server>_<tool>`, ordem das regras, defaults), `https://opencode.ai/docs/mcp-servers` (transporte, `codemode`, normalização de nomes).

## Delta do contrato revisado (2026-11-09)

Contrato aprovado: request `{task_slug, text}`; destino derivado pelo servidor de `InstanceState.directory`/cwd inicial + `docs/agent-state/<slug>/<role>.md`; papel fixo por servidor; ACL per-agent; slug ASCII 1–64; criação de pasta/nota somente dentro do workspace autorizado; timestamp `America/Fortaleza` no formato `YYYY-MM-DD HH:MM ±HH:MM`; limites 4096 bytes/entrada, 1 MiB/nota, lock 500 ms, operação 2 s; sem path/role/time no request; sem resources/prompts; unicidade pós-normalização obrigatória. Harness retomado (não sobrescrito): `/tmp/opencode/iso/stub_v2.py`, projetos descartáveis `/tmp/opencode/acl-a..e`, `run_project.sh`.

### NEG-ROOT-BIND - raiz vinculada à sessão/projeto

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| BIND-01 | cwd inicial | sessão em `acl-a`; processo stdio de `note_alice`/`note_bob` | `os.getcwd()` do processo = diretório da sessão (`acl-a`) | medido (a1/a2; probe `start.cwd`) | TEST-BIND-01 |
| BIND-02 | dois projetos | sessão em `acl-b` escreve na própria nota | processo separado com cwd `acl-b`; nenhuma escrita em `acl-a` | medido (b1; `acl-a` intacto) | TEST-BIND-02 |
| BIND-03 | subdiretório | sessão iniciada em `acl-a/sub`, config descoberta no ancestral `acl-a` | cwd = `acl-a/sub`; destino sob `acl-a/sub/docs/...` (inicial cwd, dentro do workspace) | medido (c1) | TEST-BIND-03 |
| BIND-04 | `cwd` na config do servidor | config de `acl-c` fixa `cwd=/tmp/opencode/acl-a` | processo inicia em `acl-a` e escreve lá, ignorando a sessão em `acl-c` | medido (c2) — config é autoridade; servidor não distingue a origem do cwd | TEST-BIND-04 |
| BIND-05 | config project-local | `acl-a` e `acl-b` têm servidores de mesmo nome com marcadores distintos | cada sessão carrega só a config do próprio projeto; processos e marcadores corretos | medido (probe `start.project` a/b) | TEST-BIND-05 |
| BIND-06 | `pool:true` | conexão compartilhada entre diretórios | proibido para servidores de nota: pool exige `cwd` fixo e conexão compartilhada "sem roots"; `_meta` não traz diretório | não exercitado; constraint obrigatória (ver P-META) | TEST-BIND-06 |
| BIND-07 | nome/override no request | slug de travessia, `..`, absoluto, symlink | rejeitado; nenhuma escrita fora do root | medido (b2, b5, b6, e1) | TEST-BIND-07 |
| BIND-08 | `_meta` da chamada | inspeção do `tools/call` | contém apenas `ai.opencode/sessionID` e `progressToken`; não contém diretório e não serve para autorizar/derivar root | medido (probe `call-raw` em acl-d) | TEST-BIND-08 |
| BIND-09 | spoof de sessão | request tenta declarar outro sessionID/diretório | não há canal no schema; `_meta` é do transporte, não do modelo | planejado (schema `additionalProperties:false`) | TEST-BIND-09 |

### NEG-SLUG - validação de `task_slug`

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| SLUG-01 | 1 e 64 bytes | slugs de 1 (`x`) e 64 (`a`×64) | aceitos; destino sob `docs/agent-state/<slug>/` | medido (b10, b3b) | TEST-SLUG-01 |
| SLUG-02 | 0 e 65 bytes | slug vazio e `a`×65 | rejeitados; nenhuma escrita | medido (b9, b3a) | TEST-SLUG-02 |
| SLUG-03 | ASCII | `tarefa-ç` | rejeitado ("must be ASCII") | medido (b8) | TEST-SLUG-03 |
| SLUG-04 | separador `/` | `../acl-a/docs/agent-state/t1`, absoluto | rejeitado ("single path segment"); nenhuma escrita em `acl-a` | medido (b2) | TEST-SLUG-04 |
| SLUG-05 | separador `\` | `..\\acl-a` | rejeitado pela mesma regra | planejado (mesmo caminho de código) | TEST-SLUG-05 |
| SLUG-06 | `.`/`..` | slug `..` (e `.`) | rejeitado; nenhuma escrita | medido para `..` (b7); `.` planejado | TEST-SLUG-06 |
| SLUG-07 | controle/NUL | `\0`, `\n`, DEL | rejeitado (ASCII imprimível/segmento único) | planejado | TEST-SLUG-07 |
| SLUG-08 | campos extras | `path`, `role`, `timestamp` junto de `task_slug`/`text` | harness remove os extras antes do MCP (medido); servidor deve rejeitar se receber direto | medido no harness (b4/extra2: `args_keys` só `task_slug`,`text`); rejeição server-side planejada | TEST-SLUG-08 |
| SLUG-09 | tipo | `task_slug` número/objeto/null | rejeitado por schema/servidor | planejado (schema já exige string) | TEST-SLUG-09 |
| SLUG-10 | espaço | slug `" "` (ASCII imprimível) | aceito pelo contrato atual (1 byte ASCII, segmento único); documentar ou rejeitar por decisão | não exercitado; assumption | TEST-SLUG-10 |

### NEG-TASK-SYMLINK - symlink/hardlink na tarefa

| ID | campo/limite | cenário | resultado esperado | status | TEST |
| --- | --- | --- | --- | --- | --- |
| SYM-01 | diretório da tarefa é symlink | `docs/agent-state/evil -> acl-a/docs/agent-state/t1`; append slug `evil` | recusa antes de escrever; alvo intacto | medido (b5; sentinela `acl-a` intacta) | TEST-SYM-01 |
| SYM-02 | nota é symlink | `docs/agent-state/t3/alice.md -> acl-a/.../sentinel.txt` | recusa (`O_NOFOLLOW`); sentinela intacta | medido (b6) | TEST-SYM-02 |
| SYM-03 | `docs` é symlink | `acl-e/docs -> acl-a/docs` | recusa no componente `docs`; nenhuma escrita | medido (e1) | TEST-SYM-03 |
| SYM-04 | `docs/agent-state` é symlink | componente intermediário symlink | recusa pela checagem de componentes | planejado (mesma checagem) | TEST-SYM-04 |
| SYM-05 | troca symlink/TOCTOU | troca entre checagem e `open`/`makedirs` | `O_NOFOLLOW`/dirfd impedem escrita no alvo; nenhuma linha parcial | planejado (probe usa `O_NOFOLLOW` no arquivo, mas não dirfd) | TEST-SYM-05 |
| SYM-06 | hardlink | nota é hardlink para arquivo externo | recusa (`nlink>1`) ou confinamento ao inode permitido | planejado | TEST-SYM-06 |
| SYM-07 | symlink pendente | link para caminho inexistente | recusa; não cria o alvo | planejado | TEST-SYM-07 |
| SYM-08 | alvo fora do root | qualquer symlink apontando para `acl-a` | recusa; `acl-a/docs/agent-state/{t1,sentinel}` inalterados | medido (b5, b6, e1) | TEST-SYM-08 |

### Revalidação ACL em dois projetos/tarefas

| Caso | Projeto | Agente/alvo | Sessão | Resultado |
| --- | --- | --- | --- | --- |
| A1 | `acl-a` | alice -> `note_alice_append` (`t1`) | `ses_e3d515043ffe2IEuDfTQvSVg3X` | escreveu só `acl-a/docs/agent-state/t1/alice.md` |
| A2 | `acl-a` | bob -> `note_bob_append` (`t1`) | `ses_e3d5138e0ffe7nWYktxLn4wJru` | escreveu só `acl-a/docs/agent-state/t1/bob.md`; alice intacta |
| A3 | `acl-a` | alice -> `note_bob_append` | `ses_e3d511871ffebB24n7WmZ0XYoy` | `Unknown tool 'note_bob_append'`; nenhuma escrita |
| B1 | `acl-b` | alice -> própria (`t2`) | `ses_e3d50f08effezyG7lU0FGqKdJx` | escreveu só `acl-b/docs/agent-state/t2/alice.md`; `acl-a` intacta |
| B2..B10 | `acl-b` | alice, slugs negativos/borda | sessões `ses_e3d5089e3ffe...` a `ses_e3d4f35b3ffe...` | rejeições medidas; 64/1 aceitos; `acl-a` intacta |
| C1 | `acl-a/sub` | alice -> própria (`t1`) | `ses_e3d4f201fffeptdIT2Z1XnKEKd` | escreveu sob `acl-a/sub/docs/...`; root = cwd inicial |
| C2 | `acl-c` | alice, config `cwd=acl-a` | `ses_e3d4eace2ffeb4LR0X66zIBgAb` | escreveu em `acl-a/docs/agent-state/t-cwd/alice.md` (override de config) |
| ESC1 | `acl-b` | alice edita `opencode.jsonc` | `ses_e3d4e4985ffemxq39Rw2c58KJ8` | `edit` completou; adicionou `cwd=/tmp/opencode/acl-a` em `note_alice` |
| ESC2 | `acl-b` | alice -> própria (`t-config-escape`) | `ses_e3d4e1f44ffeP5gtzToFoy7yvs` | **fuga**: processo iniciou com cwd `acl-a` e escreveu `acl-a/docs/agent-state/t-config-escape/alice.md` |

Classificação: `ACL-13` própria tool em dois projetos (A1/B1) medido; `ACL-14` duas tarefas no mesmo projeto (B1 `t2`, B4 `t2`, B10 `x`) medido; `ACL-15` tool cruzada negada (A3; E2/E10) medido; `ACL-16` mesmos nomes de servidor em projetos diferentes permanecem instâncias separadas (probe `project` a/b, PIDs distintos) medido; `ACL-17` bypass por edição de config (ESC1/ESC2) **medido como fuga**; `TEST-CONFIG-01` regressão obrigatória após a mitigação (editar config deve ser negado; nova sessão não deve mudar root nem ACL).

### Probe de cwd/raiz - evidência

- `acl-a/runs-a1.json`, `acl-a/runs-a2.json`: exit 0; probe `start.cwd=/tmp/opencode/acl-a`, `project=acl-a`; notas em `acl-a`.
- `acl-b/runs-b1.json`: exit 0; `start.cwd=/tmp/opencode/acl-b`, `project=acl-b`; nenhuma escrita em `acl-a`.
- `acl-a/sub/runs-c1.json`: exit 0; `start.cwd=/tmp/opencode/acl-a/sub`; nota em `acl-a/sub/docs/agent-state/t1/alice.md`.
- `acl-c/runs-c2.json`: exit 0; `start.cwd=/tmp/opencode/acl-a` (apesar de `PWD=/tmp/opencode/acl-c`); nota em `acl-a/docs/agent-state/t-cwd/alice.md`.
- `acl-d/runs-extra2.json` + `acl-d/probe.log`: `call-raw.meta={"ai.opencode/sessionID":"...","progressToken":2}`; `args_keys=["task_slug","text"]` (extras emitidos pelo provider foram removidos antes do MCP).
- `acl-b/runs-esc1.json` + `acl-b/opencode.jsonc.escalated`: o agente alice editou a config (permissão `edit` allow) e adicionou `cwd` ao seu próprio servidor.
- `acl-b/runs-esc2.json` + `acl-b/probe.log`: nova sessão alice em `acl-b` iniciou `note_alice` com `cwd=/tmp/opencode/acl-a` e escreveu `acl-a/docs/agent-state/t-config-escape/alice.md`; config ativa restaurada de `opencode.jsonc.pre-edit` após a prova.
- `acl-e/runs-e1.json`: `docs` symlink -> `acl-a/docs` recusado; `acl-a` intacta.
- Boundary pairs: 0/1 (b9/b10) e 64/65 (b3b/b3a); symlinks (b5/b6/e1). Nenhuma escrita fora do root nos casos de rejeição.

## Gate e decisão (histórico - superseded em 2026-11-09 21:05)

Este bloco reflete o contrato anterior de isolamento forte e foi superseded pelo override humano de 21:02 (baseline best-effort). Mantido como trilha; a avaliação atual está em "Baseline best-effort".

A matriz cobre os 11 grupos anteriores + `NEG-ROOT-BIND`, `NEG-SLUG` e `NEG-TASK-SYMLINK`, com 56 + 27 linhas e status medido/planejado. A ACL por tool continua válida **enquanto a config não é editada**: A1/A2/A3/B1 e E1-E11/P1/P2b sustentam isso. Porém foi medida uma **fuga de raiz via edição da config**: o agente do papel tem `edit` allow sobre `opencode.jsonc`, alterou `cwd` do próprio servidor MCP e uma nova sessão escreveu em outro projeto (ESC2). O mesmo mecanismo permite editar as próprias permissões e conceder a tool de outro papel; não foi executado, mas decorre do mesmo arquivo gravável.

Isso viola "servidor/instância não pode usar raiz de outra sessão por nome/override" e "configuração confiável". O `coder` **não deve iniciar** até o developer decidir a mitigação:

- **A (recomendada)**: negar `edit`/`write` em `opencode.json*`, `.opencode/**` e no diretório de config para todo papel/subagente; validar na config que servidores de nota não têm `cwd` nem `pool:true`; reexecutar ESC1/ESC2 (deve falhar em ambos).
- **B**: iniciar o MCP de nota fora da config project-local, por wrapper confiável que fixa o root por projeto; OpenCode não passa o diretório no `_meta`, então o wrapper precisa ser por projeto/sessão.
- **C**: aceitar config como confiável e rebaixar a garantia para "proteção contra erro acidental", não contra agente com escrita de arquivo; exige reaprovação humana do requisito.

`NEG-ROOT-BIND`/`SLUG`/`SYM` estão especificados; `BIND-04`/`BIND-06`/ESC2 são constraints de implementação/config, não weakening. Limites (4096 B, 1 MiB, 500 ms, 2 s, timestamp 1 s) e hardlink/TOCTOU permanecem planejados porque o servidor de produção não existe.

## Baseline best-effort - reclassificação e cobertura (2026-11-09 21:05)

Override humano registrado pelo planner às 21:02: aceite = "Proteção contra erro"; não há barreira contra agente com shell/escrita ampla no mesmo UID. O contrato quantitativo permanece: `{task_slug, text}`, role por servidor, root do workspace/cwd como referência do launcher, validação fail-closed, 4 KiB/entrada, 1 MiB/nota, lock 500 ms, operação 2 s, America/Fortaleza, sem resources/prompts, nomes únicos pós-normalização.

Reclassificação:

- **ESC1/ESC2**: medidos (edição de config → `cwd` → escrita em `acl-a`). Risco residual aceito; **não é AC bloqueante**. Evidência preservada; não declarar mitigado.
- **Bypass por shell** (mesmo UID): inferido; aceito; fora da garantia. A ACL é proteção contra erro, não isolamento adversarial.
- **`cwd`/`pool:true`**: `cwd` é referência de workspace do launcher, não identidade autenticada; a config exemplar proíbe `cwd` e `pool:true`; não há promessa se config/shell forem alterados. `BIND-04`/`BIND-06` são constraints da config exemplar, não AC de segurança.
- **`TEST-CONFIG-01`** (negar toda edição por mesmo UID): descartado como AC obrigatório; mantido como demonstração negativa da fronteira (ESC1/ESC2).

Cobertura dos AC quantitativos/negativos obrigatórios:

| AC/REQ | requisito | NEG/TEST | status |
| --- | --- | --- | --- |
| `AC-01/REQ-01` | request só `{task_slug,text}`; sem path/role/time | `SLUG-08`, `ROLE-01..04`, `TIME-01`, `DEST-01`, `ACL-05` | extras removidos no harness (b4/extra2); rejeição server-side planejada |
| `AC-02/REQ-02` | ACL por papel (best-effort) | `ACL-01..09,13..16`; E1-E11/P1/P2b | medido no harness |
| `AC-03/REQ-03` | append íntegro, ordenado, sem substituição | `TEXT-08`, `CONC-01..04`, `SYM-01..08` | planejado no servidor real |
| `AC-04/REQ-04` | timestamp America/Fortaleza, minuto | `TIME-01..04` | planejado no servidor real |
| `AC-05/REQ-05` | 4 KiB, 1 MiB, lock 500 ms, total 2 s | `SIZE-01..04`, `FILE-01..04`, `WAIT-01..04`, `TOTAL-01..03` | planejado no servidor real |
| `AC-06` | sem resources/prompts | `ACL-10` | E9 mede vazamento se exposto; real deve retornar vazio |
| `AC-07` | nomes normalizados únicos | `ACL-11` | D1-D4 medido no harness; validação real planejada |
| `AC-08` | root/cwd best-effort | `BIND-01..09` | medido no harness; `cwd`/`pool` constraints |
| `AC-09` | slug ASCII 1–64, segmento único | `SLUG-01..10` | probe medido; real planejado |
| `AC-10` | symlink/hardlink/TOCTOU | `SYM-01..08` | parcial medido; hardlink/TOCTOU real planejado |

Todos os AC quantitativos e negativos obrigatórios têm `campo/limite -> NEG-* -> expectativa` e teste direcionado. **Nenhum exige isolamento contra shell/config**; ESC1/ESC2 e shell bypass são risco aceito, não gate.

O que ainda precisa ser provado no **servidor real** (não provável antes do código):

1. Limites exatos 4 KiB/1 MiB e mutação de borda (par `limit-1`/`limit` vs `limit+1`/`limit+2`).
2. Lock de 500 ms e operação total de 2 s incluindo lock, validação, write e fsync; timeout nunca reporta sucesso.
3. Append concorrente/atômico com N escritores, sem interleaving nem linha parcial; crash/retry e durabilidade.
4. Timestamp `America/Fortaleza` de minuto, clock lido por operação, não decrescente; repetição no mesmo minuto permitida.
5. Resources/prompts ausentes (`resources/list` vazio, sem capability) e `opencode_read_mcp_resource` inacessível.
6. Unicidade de nomes pós-normalização e rejeição de colisão na configuração.
7. Derivação de cwd/path no servidor real, symlink/hardlink/TOCTOU e ausência de path/role/time no request.
8. Formato/newline/fsync/durabilidade do append.
9. Node >=20: o harness do tester não tem `node`/`npm` (probe Python); os testes reais devem rodar em ambiente com Node. É limitação de validação, não bloqueio pré-coder.

O que o harness já prova: ACL por papel (E1-E11/P1/P2b), extras removidos antes do MCP (acl-d), cwd entregue ao processo (a1/a2/b1/c1/c2), comportamento de slug/symlink do probe (não do backend), colisão de nomes no harness (D1-D4) e vazamento por resource se exposto (E9). Não é prova do backend final.

**Declaração de cenários**: `cenarios_prontos: sim` para a fase pré-implementação; cenários estruturais do servidor real podem ser planejados pós-implementação. Não se pode provar antes do código: comportamento exato do servidor, limites/atomicidade/timestamp/resources/nomes/path hardening.

## Traceability - delta

- `AC-08` (best-effort): raiz = cwd inicial/`InstanceState.directory` como referência de workspace do launcher, não identidade autenticada; `cwd` e `pool` proibidos na config exemplar. Testes: `TEST-BIND-01..09`, `TEST-BIND-06`; a imutabilidade da config não é AC (ver ESC1/ESC2).
- `AC-09` (proposto): `task_slug` ASCII 1–64, segmento único, sem `.`/`..`/controle; pares de borda 0/1 e 64/65. Testes: `TEST-SLUG-01..10`.
- `AC-10` (proposto): symlink/hardlink/TOCTOU recusados em `docs`, `docs/agent-state`, tarefa e nota. Testes: `TEST-SYM-01..08`.
- `AC-11` (descartado como AC obrigatório pela baseline best-effort): config imutável não é exigida; ESC1/ESC2 permanecem medidos como demonstração negativa do limite, risco aceito. Não usar como gate.
- `REQ-01/AC-01` -> `TEST-BIND-01..09`, `TEST-SLUG-01..10`; medido parcial.
- `REQ-02/AC-02` -> `TEST-ACL-01..09,13..16`; medido no harness (E1-E11/P1/P2b). `TEST-ACL-17/ESC2` é risco aceito, não AC bloqueante.
- `REQ-03/04/05` permanecem planejados; sem servidor real.

## Updates

### 2026-11-09 20:15 -03:00 - fechamento da matriz e conclusão do gate de isolamento

- Fact: matriz completa dos 11 grupos `NEG-*` (56 linhas) escrita acima; série medida E0-E11/D1-D4 concluída no OpenCode v2.2.6; isolamento por papel demonstrado para os vetores de tool append, com um vazamento medido por resource (E9) convertido em AC-06 e colisão de nome coberta por AC-07. `cenarios_prontos: sim` com essas duas constraints obrigatórias; `TEST-ACL-12` (provider hostil) fica para a validação pós-implementação.
- Supersedes or discards: descarta o retorno anterior de `tester` que dizia "nota não gravada / matriz não escrita"; mantém como pendente apenas o que está em `Pending and risks`.
- Code state: coordenação HEAD `eb0186a`; alvo HEAD `b95316c`; nenhuma alteração de produção. Comandos e sessões citados em `Evidence`.

### 2026-11-09 20:18 -03:00 - prova call-time com provider fake local

- Fact: provider fake OpenAI-compatible em `/tmp/opencode/iso/fake_llm.py` (portas 18777/18778) forçou tool calls. P1 (controle, `note_alice_append`): tool executou, `notes/alice.md` = `FORGED`, sessão `ses_e3d659dc8ffeDZFJea547cVnMk`. P2b (`note_bob_append` negada): `status:error`, `No tool named "note_bob_append" is currently available. Please use a tool from the available tool list.`, `providerCall.executed=false`, zero chamada MCP e zero escrita, sessão `ses_e3d65507effeWfuO4Qv6sddW4b`. O log `runs/fake-p2.log` mostra a lista enviada ao provider para alice: `[edit, experimental_image_generate, glob, grep, note_alice_append, question, read, shell, skill, webfetch, websearch, write, execute]` — sem `note_bob_append`.
- Supersedes or discards: substitui a linha ACL-12 (antes `planejado`), o item "não provado" sobre chamada forjada e a pendência de `TEST-ACL-12`; mantém como pendentes a negação ativa de delegação e a validação de limites/atomicidade pós-implementação.

### 2026-11-09 20:47 -03:00 - contrato revisado: raiz/slug/symlink e fuga por edição de config

- Fact: matriz ampliada com `NEG-ROOT-BIND` (9), `NEG-SLUG` (10) e `NEG-TASK-SYMLINK` (8), total 83 linhas; ACL revalidada em `acl-a`/`acl-b` e em múltiplas tarefas; probe de cwd mostrou processo stdio com cwd = diretório da sessão (a1/a2/b1), subdiretório respeitado (c1), `cwd` de config sobrepõe a sessão (c2: `acl-c` escreveu em `acl-a`), `_meta` traz só sessionID/progressToken (acl-d), e a edição da config pelo próprio papel (ESC1) fez nova sessão escrever em `acl-a` (ESC2). `opencode.jsonc` de `acl-b` restaurado de `pre-edit`; cópia escalada em `opencode.jsonc.escalated`.
- Supersedes or discards: substitui o `cenarios_prontos: sim` das entradas de 20:15/20:18 como avaliação atual; mantém como válidos os resultados de ACL de tool sob config intacta. `cenarios_prontos` passa a `bloqueado` e o `coder` não inicia até mitigação do bypass de config (AC-08/AC-11); `BIND-04`, `BIND-06`, hardlink/TOCTOU e limites permanecem planejados/constraints.
- Timestamp: o developer ofereceu `2026-11-09 20:37 -03:00`; a gravação ocorreu às `20:47 -03:00` aferidas, então foi usado o horário medido, não o oferecido.

### 2026-11-09 21:06 -03:00 - baseline best-effort: ESC1/ESC2 como risco aceito e matriz fechada

- Fact: planner registrou em 21:02 o override humano para "Proteção contra erro" (sem barreira contra shell/escrita no mesmo UID). Reclassifiquei ESC1/ESC2 e o bypass por shell como medidos/inferidos e **risco aceito, não AC bloqueante**; `TEST-CONFIG-01` (negar toda edição) deixa de ser AC e fica como demonstração negativa. A config exemplar proíbe `cwd`/`pool:true`; `cwd` é referência de workspace, não identidade autenticada. A matriz cobre os AC quantitativos/negativos obrigatórios (AC-01..AC-10) com `campo/limite -> NEG-* -> expectativa` e teste direcionado; TIME-03/04 foram ajustados para resolução de minuto e `America/Fortaleza` (`YYYY-MM-DD HH:MM ±HH:MM`). Pendências que só o servidor real prova: 4 KiB/1 MiB, lock 500 ms/2 s, append concorrente/atômico, timestamp, resources, nomes normalizados, cwd/path/symlink/hardlink/TOCTOU, formato/fsync; Node >=20 não existe no harness do tester (probe Python), então a validação real roda em ambiente com Node. `cenarios_prontos: sim` para a fase pré-implementação; cenários estruturais podem ser pós-implementação e não se pode provar o backend antes do código.
- Supersedes or discards: substitui o `cenarios_prontos: bloqueado` de 20:47 como avaliação atual; ESC1/ESC2 permanecem fatos medidos, agora risco aceito, e não devem ser anunciados como mitigados. Conserva ACL E1-E11/P1/P2b, E9, BIND/SLUG/SYM como evidência de harness. A seção "Gate e decisão" anterior fica marcada como histórica.
- Timestamp: o developer ofereceu `2026-11-09 21:04 -03:00`; a gravação ocorreu às `21:06 -03:00` aferidas, então foi usado o horário medido, não o oferecido.

### 2026-11-09 22:01 -03:00 - validação independente do backend: 58/58 e uma lacuna de AC (TIME-02)

- Fact (snapshot): coordenação `agent-toolkit` HEAD `eb0186a`, worktree com `.github/workflows/quality.yml`, `.gitignore` e `code-map.md` modificados e `harnesses/agent-note-writer-mcp/` + `docs/agent-state/agent-note-writer/` não rastreados. sha256 dos fontes confirmados: `index.mjs` 30da4018..., `src/note-writer.mjs` 2fe1aea6..., `src/server.mjs` 23361029..., `src/constants.mjs` 58da9d79..., `src/config-check.mjs` 94a398ad.... Nenhum arquivo de produção ou config global foi alterado por este papel; o único artefato novo é `harnesses/agent-note-writer-mcp/tests/tester-gaps.test.mjs` (sha256 1c43b4df...), incluído pelo glob `tests/*.test.mjs` do `npm test` e do CI.
- Fact (execução): `source ~/.nvm/nvm.sh` + `node --test tests/*.test.mjs` em `harnesses/agent-note-writer-mcp` duas vezes, exit 0, `tests 58 / pass 58 / fail 0` (51 do coder + 7 novos) às 21:59 e 22:00; Node v24.22.1, npm 11.19.1. `npm ci --dry-run` exit 0 (lock em sincronia). `node validate-config.mjs examples/opencode.json` exit 0 (`ok:true`, 5 papéis, tools `note_<role>_append`); negativos independentes: `cwd` exit 1 `CONFIG_CWD_FORBIDDEN`, `pool:true` exit 1 `CONFIG_POOL_FORBIDDEN`, `note_bob` com `--role alice` exit 1 `CONFIG_NAME`, entrada inexistente exit 2 `CONFIG_UNREADABLE`. Evidência do coder (51 pass) foi confirmada na fonte, não aceita por relato.

#### Testes criados nesta validação (`tests/tester-gaps.test.mjs`, 7)

| TEST | cenário | resultado |
| --- | --- | --- |
| TEST-ROLE-04 | `NOTE_ROLE`/`ROLE`/`NOTE_WRITER_ROLE`/`MCP_ROLE=bob` no spawn de `--role alice` | `serverInfo.name=note_alice`; append só em `alice.md`; zero `bob.md` |
| TEST-DEST-01/ROLE-01/TIME-01/TEXT-03/07 (wire) | JSON-RPC cru com `path`, `file`, `role`, `timestamp`, `text:42`, lone surrogate e U+FFFD | `INVALID_ARGUMENTS` / `TEXT_ENCODING`; nenhuma nota criada (valida rejeição no transporte, não só na função) |
| TEST-SYM-02/DEST-03 | append ok, nota trocada por symlink para sentinela externa, novo append | `NOTE_SYMLINK`, sentinela intacta, lock removido (revalidação por chamada) |
| TEST-FILE-04 | limite de nota exato e +1 byte com padding multibyte (`é`) | exato aceito em 1 MiB; +1 rejeitado `FILE_TOO_LARGE`; tamanho original preservado |
| TEST-PATH-01 | `docs` é arquivo regular, não diretório | `PATH_INVALID`, arquivo inalterado |
| TEST-TOTAL-02 exact | clock injetado faz a checagem pré-write cair exatamente no deadline | `TIMEOUT`, nenhuma nota criada |
| TEST-WAIT-03 holder | lock de PID vivo; concorrente espera | `LOCK_BUSY`, lock do dono **não** é removido, zero escrita |

#### Matriz: cobertura e resultado por AC

| REQ/AC | NEG/TEST | resultado |
| --- | --- | --- |
| REQ-01/AC-01 request fechado | TEST-DEST-01, TEST-ROLE-01..04, TEST-TIME-01, TEST-SLUG-08/09, TEXT-01..03 (+TEST-PATH-01) | PASS (função e wire) |
| REQ-02/AC-02 ACL por papel | TEST-ACL-01..09, 12..16 | PASS como evidência de harness anterior; não reexecutado nesta sessão (config global inalterada). No backend: papel fixo por instância, uma tool `append`, zero canal para papel/path/tempo |
| REQ-03/AC-03 append íntegro | TEXT-08, CONC-01..04, SYM-01..08, TEST-PATH-01 | PASS com L2/L3 |
| REQ-04/AC-04 timestamp | TIME-01, TIME-03, TIME-04, TEST-ROLE-04 | PASS |
| REQ-04/AC-04 relógio retrocedido | TIME-02 | **FAIL de conformidade** (ver F1) |
| REQ-05/AC-05 limites | SIZE-01..04, FILE-01..04, WAIT-01/03/04, TOTAL-01..03, TEST-TOTAL-02 exact, TEST-WAIT-03 holder | PASS; WAIT-02 exato = L1 |
| AC-06 sem resources/prompts | TEST-ACL-10 | PASS (`listResources`/`listPrompts` -32601, capabilities só `tools`) |
| AC-07 nomes normalizados | TEST-ACL-11 + config.test + CLI | PASS |
| AC-08 root/cwd best-effort | BIND-01..09, TEST-ROLE-04 | PASS best-effort; BIND-04/06 são constraints do checker, não segurança |
| AC-09 slug | SLUG-01..10 | PASS; espaço rejeitado (default conservador documentado) |
| AC-10 symlink/hardlink/TOCTOU | SYM-01..04,06..08, TEST-SYM-02/DEST-03 | PASS para symlink/hardlink direto; TOCTOU de componente intermediário = L2 |

#### Mutação (sensibilidade das asserções, sem tocar produção)

Cópias descartáveis em `/tmp/opencode/anw-mut/` (fontes copiados, `node_modules` por symlink), comando `node --test --test-name-pattern`, exit 1 = mutante morto: entrada `>`→`>=` (SIZE-01/02 morto), soma de arquivo `>`→`>=` (FILE-01/02 morto), slug `>`→`>=` (AC-09 morto), `nlink>1`→`>2` (SYM-06 morto), remoção do newline de `formatEntry` (TEXT-08 morto), `TIME_ZONE`→`UTC` (TIME-04 morto), deadline `*100` (TOTAL-02 morto), deadline `<=`→`<` em todas as checagens (TEST-TOTAL-02 exact morto), `additionalProperties:false`→`true` (AC-01 morto), remoção do check U+FFFD (wire morto), `NOTE_ROLE` virando papel (TEST-ROLE-04 morto), `lineBytes` bytes→chars (TEST-FILE-04 morto), precheck de symlink + `O_NOFOLLOW` removidos (SYM-02 morto; só o precheck removido sobrevive porque `O_NOFOLLOW` é a defesa load-bearing), wait `>=`→`>= waitMs*4` (WAIT-03 morto) e `>=`→`>= 0` (WAIT-01 morto). **Mutante sobrevivente:** `waited >= waitMs`→`>`, registrado em L1.

#### Classificação de falhas

- **F1 - implementação ausente vs. AC-04/TIME-02 (bloqueante para aprovação, não contornado):** com clock injetado que retrocede um minuto, dois appends produzem `2026-11-09 11:00 -03:00 - first` seguido de `2026-11-09 10:59 -03:00 - second` (probe com `appendNote` real em diretório temporário; sem teste commitado, pois a regressão só entra após correção). O servidor detecta clock inválido (NaN → `CLOCK_INVALID`) mas não retrocesso; a matriz/AC mapeiam TEST-TIME-02 como falha fechada. Opções para o developer: (a) `coder` compara o novo carimbo com o último carimbo da nota (ou âncora persistida) e falha fechado; (b) aceitar formalmente o downgrade de TIME-02 (carimbo reflete o relógio do SO; risco documentado no README). Este papel não enfraquece o cenário.
- **F2 - lacuna de documentação/endurecimento (não bloqueante):** `text` com U+2028/U+2029 é aceito (`entryBytes` 9, byte no arquivo), embora o README diga "one printable line". Não é C0/C1 nem newline; sem injeção de carimbo/caminho. Recomendo rejeitar esses separadores ou ajustar a redação do README.
- **Defeito de teste:** nenhum encontrado nos 51 testes do coder; as lacunas foram cobertas pelos 7 novos testes. `pytest`/validador não se aplicam ao harness Node.

#### Limitações e riscos registrados

- L1 WAIT-02 (igualdade exata com `waitMs`): o mutante `>=`→`>` sobrevive porque a igualdade exata só é observável se o polling cair no instante exato; operacionalmente "no limite" e "logo acima" resultam em `LOCK_BUSY` após o mesmo orçamento. Sensibilidade do valor está provada (WAIT-01 e WAIT-03 morrem com mutações de valor). Não foi adicionado teste acoplado à sequência interna de `monotonicMs`.
- L2 TOCTOU de componentes intermediários (`docs`, `agent-state`, diretório da tarefa): não eliminável sem `openat`/dirfd; `O_NOFOLLOW` no arquivo, `lstat` por componente, `nlink` e `/proc/self/fd` são best-effort. README declara; risco aceito na baseline.
- L3 crash: morte do processo com lock é recuperada (WAIT-04/CONC-02), mas "morto no meio de um write" e "crash entre write e fsync" não são reproduzíveis deterministicamente; a ordem fsync-antes-de-sucesso foi verificada por leitura de código, não por crash real. Retry após rejeição não duplica (CONC-04).
- L4 ACL E1-E11/P1/P2b e ESC1/ESC2 continuam evidência do harness anterior; não reexecutados (config global inalterada, sessões antigas). ESC1/ESC2 permanecem risco aceito, não mitigados.
- L5 Corrida de recuperação de lock stale: `lockIsStale`+`unlink`+`create` não é atômico; dois concorrentes que julgam o mesmo lock stale podem ambos adquirir (e o `finally` de um remover o lock do outro). O append é um único `write` com `O_APPEND`, então não há interleaving; o caso residual é a checagem de teto de arquivo admitir duas linhas na última vaga após um crash. Não reproduzido; registrado para o reviewer.
- L6 A config de exemplo usa `node` puro no `command`; depende de Node no PATH do launcher (NVM carregado). É requisito de ambiente, não do servidor.
- N/A por arquitetura aprovada: ROOT-03 (não há allowlist de base; root = cwd do launcher) e DEST-02 (não há path de destino configurável; destino derivado de slug validado). Registrado como decisão da baseline AC-08/AC-09, não como cenário removido.

#### Rastreabilidade e checkpoint

- Novos vínculos: `TEST-ROLE-04`, `TEST-DEST-01/ROLE-01/TIME-01/TEXT-03/TEXT-07 (wire)`, `TEST-SYM-02/DEST-03`, `TEST-FILE-04`, `TEST-PATH-01`, `TEST-TOTAL-02 exact`, `TEST-WAIT-03 holder`.
- `cenarios_prontos: sim` (gate pré-implementação) fica **superseded**: a validação pós-implementação está concluída para 58/58 testes, mas a aprovação final não é declarada e F1 (TIME-02) precisa de decisão/correção antes do reviewer.
- Próximo: developer decide F1 (corrigir ou downgrade explícito de TIME-02) e opcionalmente F2; depois reviewer final no mesmo snapshot. Nenhuma suíte global/CI foi executada por este papel.
- Timestamp: `2026-11-09 22:01 -03:00` aferido com `date '+%Y-%m-%d %H:%M %:z'`; logs em `/tmp/opencode/anw-tester-run1.log`, `anw-tester-run2.log`, `/tmp/opencode/anw-mut/*.log` (voláteis).

### 2026-11-09 22:15 -03:00 - revalidação F1/F2/L5: 70/70 e bloqueio removido

- Fact (snapshot): HEAD `eb0186a`, mesmo worktree sujo; `src/note-writer.mjs` mudou para sha256 `ab1b9623...`; `src/server.mjs` (`23361029...`), `src/constants.mjs` (`58da9d79...`), `src/config-check.mjs` (`94a398ad...`) e `index.mjs` (`30da4018...`) permanecem os do snapshot anterior. Coder adicionou `tests/coder-regressions.test.mjs` (`04cec7a7...`); este papel ampliou `tests/tester-gaps.test.mjs` para 13 testes (`8b88fa22...`). Nenhuma produção/config global alterada.
- Fact (execução): `source ~/.nvm/nvm.sh` + `node --test tests/*.test.mjs` em `harnesses/agent-note-writer-mcp`, duas vezes, exit 0, `tests 70 / pass 70 / fail 0` às 22:14 e 22:15 (logs `/tmp/opencode/anw-tester-f1.log`, `anw-tester-f2.log`); Node v24.22.1. `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs` e `tests/*.test.mjs` exit 0. `validate-config` do exemplo exit 0 (`ok:true`, 5 papéis). `npm ci --dry-run` exit 0. Evidência do coder (64 pass) confirmada na fonte.

#### F1 - regressão de relógio (TIME-02): resolvido

- Probes independentes com `appendNote` real em diretórios temporários: nota manual antiga com header/prosa sem carimbo e carimbos de 2026-11-08 10:00/11:00 aceita append de 2026-11-09 09:34 -03:00 e preserva o conteúdo; linha no fim sem carimbo é ignorada como âncora; nota com carimbo manual `07:40 -05:00` (= 12:40 UTC = 09:40 -03:00) rejeita com `CLOCK_REGRESSION` e arquivo byte-a-byte inalterado; o mesmo carimbo `07:30 -05:00` (= 09:30 -03:00) é aceito, provando normalização de offset (não só fuso fixo). `CLOCK_REGRESSION` libera o lock (teste novo) e não cria linha. Mesmo minuto continua aceito (suíte do coder).
- Comportamento herdado: carimbo manual **malformado mas com formato de 23 caracteres** (ex.: `2026-99-99 99:99 -03:00`) é normalizado por `Date.UTC` e vira âncora, bloqueando a nota até correção manual; o erro traz `lastTimestamp`, então é diagnosticável. Registrado em R1 (não bloqueante, sugestão de validar faixas de data).

#### F2 - U+2028/U+2029: resolvido

- `CONTROL_CHARACTERS` inclui U+2028/U+2029; teste de núcleo e wire retornam `TEXT_CONTROL`; texto normal com acentos/emoji continua aceito (`ok ção 🚀`, 13 bytes). README e tabela de códigos atualizados.

#### L5 - recovery mutex/stale takeover: resolvido com risco residual

- `releaseLock(lockPath, nonce)` só remove o lock com o nonce do dono: teste novo confirma que nonce errado preserva o arquivo e o correto remove.
- Lock ilegível com idade > `lockStaleMs` é recuperado (teste novo com `utimes`); após sucesso não sobram `.lock` nem `.tmp`.
- Mutex de recuperação com dono morto é reclamado (teste novo); com dono vivo (`owner.json` de PID vivo) o concorrente recebe `LOCK_BUSY`, o lock stale e o mutex ficam intactos e nenhuma nota é criada (teste novo).
- Contenção entre processos: 8 recuperadores concorrentes de um lock morto → 8 linhas únicas, sem `lock`/`.recover`/`.tmp` (suíte do coder confirmada); probes independentes 15x2 e 30x4 concorrentes sobre mutex antigo sem dono → 0 falhas, 0 sobras. Nenhuma produção foi alterada para isso.
- Risco residual R2 (teórico): `rm(recoveryPath)` + `mkdir` não é uma seção crítica atômica; dois processos que leem o mesmo mutex sem dono/vencido podem, numa janela estreita, remover o diretório recém-criado do outro. Não observado em 120+ recuperações contendidas; desfechos seriam fail-closed (`LOCK_ERROR`/`LOCK_BUSY`) ou takeover duplo com verificação de nonce. Fica para o reviewer como risco aceitável/best-effort, não como bloqueio.

#### Mutação sobre o código novo (sensibilidade)

Cópias em `/tmp/opencode/anw-mut2/`, exit 1 = mutante morto: remover o bloco F1 (2 testes falham), inverter `<`→`>` (2 falham), trocar o sinal do offset na conversão para minutos (teste de offset falha), remover U+2028/U+2029 da classe de controle (teste F2 falha; a primeira execução usou padrão com `+`, que é metacaractere de regex e não casou teste — reexecutado com `separators`, morto), ignorar o nonce no `releaseLock` (teste novo falha), remover a guarda de dono vivo do mutex (teste novo falha), `lockOwnerAlive` sempre falso (WAIT-03 holder e mutex vivo falham). Nenhum mutante sobreviveu aos cenários de F1/F2/L5.

#### Garantias anteriores reexecutadas

SIZE-01/02, SIZE-03/04, FILE-01/02/03/04, WAIT-01/02/03/04, TOTAL-01/02/03 + TOTAL-02 exact, CONC-01/03/04, SYM-01/02/03/04/06/07/08, AC-06 resources/prompts, wire strict, path/root e busy-contender continuam passando no mesmo snapshot (70/70). Timeout após escrita ainda faz rollback e cap continua contado em bytes incluindo carimbo/newline.

#### Testes acrescentados nesta rodada (`tests/tester-gaps.test.mjs`, +6)

TEST-TIME-02 offset (`07:30/07:40 -05:00`), TEST-TIME-02 notas antigas/prosa (âncora no último carimbo válido), TEST-L5 release nonce, TEST-L5 lock ilegível após stale, TEST-L5 mutex com dono morto, TEST-L5 mutex com dono vivo. IDs rastreiam `AC-04/TIME-02` e `WAIT-04/L5`.

#### Riscos residuais atualizados

- R1 carimbo manual malformado-com-formato vira âncora (fail-closed, diagnosticável); recomendo validar faixas de data ao parsear ou documentar no README.
- R2 corrida `rm`+`mkdir` do mutex de recuperação (teórica, não reproduzida; ver acima).
- R3 lock ilegível só é reclamado após `lockStaleMs` (30 s), como documentado; dentro do orçamento de 500 ms o resultado é fail-closed.
- R4 edição externa/manual da nota pode inserir carimbo antigo depois de um novo e reordenar; fora da garantia best-effort (mesmo UID).
- R5 reutilização de PID mantém lock de dono "vivo" até intervenção; fail-closed documentado.
- L2 (TOCTOU de componente intermediário) e ESC1/ESC2/shell bypass permanecem risco aceito, não reabertos.

#### Classificação e checkpoint

- F1, F2 e L5: **resolvidos** na implementação atual, com testes independentes e mutação; nenhum defeito bloqueante novo. R1/R2 são riscos residuais não bloqueantes, registrados para o reviewer.
- `AC-04/TIME-02` passa a PASS; `AC-05/WAIT-04` e o release por nonce passam; matriz anterior permanece válida com as limitações já registradas.
- Estado: validação independente concluída em 70/70; aprovação final **não** declarada. Próximo: reviewer final no mesmo snapshot (HEAD `eb0186a`, `note-writer.mjs` `ab1b9623...`), com atenção a R1/R2 e ao preflight de CI/validador. Nenhuma suíte global/CI executada.
- Timestamp: `2026-11-09 22:15 -03:00` aferido com `date '+%Y-%m-%d %H:%M %:z'` (o `22:10` oferecido no despacho já não era o minuto da escrita).

### 2026-11-09 22:19 -03:00 - normalização de caminho absoluto na própria nota (portabilidade)

- Fact: a linha de References apontava para o target com um path absoluto de home, o que `python3 tools/validate_resources.py` rejeita como recurso não portável. Substituí cirurgicamente apenas essa linha por caminho relativo portátil ao repo irmão (`../typesafe-jev-opencode/mcp/index.mjs`, `package.json`, `code-map.md`); o restante da nota ficou intacto. Busca por referência absoluta de home na nota retorna vazia (verificado com grep, sem ocorrências). `python3 tools/validate_resources.py` | exit 0 | `PASS: agent roles, task notes, workflow, and portability` | 22:19, log `/tmp/opencode/anw-validator-r2.log`.
- Supersedes or discards: substitui a referência absoluta anterior; nenhuma conclusão de teste ou classificação de risco mudou. Nenhum outro arquivo, nota de outro papel, código ou teste foi tocado.
- Timestamp: `2026-11-09 22:19 -03:00` medido com `date '+%Y-%m-%d %H:%M %:z'`; o `22:18` oferecido no despacho não foi usado porque a escrita do append ocorreu no minuto seguinte.

### 2026-11-10 13:51 -03:00 - revisão independente do delta documental/integração V2

- Fact (snapshot): coordenação HEAD `eb0186a`; delta não commitado em `agents/{planner,coder,tester,reviewer}.md`, `templates/task-note.md`, `workflows/developer-workflow.md`, `docs/contexto-persistente.md`, `tools/validate_resources.py`, `tests/test_validate_resources.py`, `.github/workflows/quality.yml`, `code-map.md` e no harness (README, `examples/opencode.json`, `examples/opencode.env-path.json`, `validate-config.mjs`, `src/config-check.mjs`, `tests/config.test.mjs`). Hashes relevantes: config-check `ce7caa33...`, validate-config `843bf460...`, config.test `155ae600...`, examples `bbc10ed5...`/`a7c75bcb...`, tools/validate_resources `8b0c7a48...`, tests/test_validate_resources `bf6d9532...` (inclui +2 asserções deste papel, só teste). Backend 70/70 de 22:15 não foi reexecutado mecanicamente; `src/note-writer.mjs` e `src/server.mjs` não mudaram neste delta.
- Fact (execução): `python3 tools/validate_resources.py` | exit 0 | `PASS: agent roles, task notes, workflow, and portability` | 13:49–13:51, logs `/tmp/opencode/anw-validator-final.log`; `python3 -m unittest discover -s tests -p 'test_validate_resources.py'` | exit 0 | `Ran 75 tests ... OK` | 13:51; `node --test tests/config.test.mjs` no harness | exit 0 | `tests 10 / pass 10 / fail 0` | 13:49; `node --check` de `validate-config.mjs`, `src/config-check.mjs`, `tests/config.test.mjs` | exit 0; CLI `validate-config` nos dois exemplos | exit 0 | `ok:true`, 5 papéis/5 servers e 1 papel/1 server; `jq -e` dos dois JSON | exit 0; varredura de links dos Markdown tocados | exit 0; `grep` de path absoluto de home nos exemplos | sem ocorrências.
- Fact (instruções por papel): `agents/planner|coder|tester|reviewer.md` citam exatamente a própria tool (`note_planner_append`, `note_coder_append`, `note_tester_append`, `note_reviewer_append`), uma única vez por arquivo, com "envie apenas `task_slug` e o texto", "servidor gera carimbo, caminho e papel", "não use `edit`", fallback manual com carimbo aferido, "não alegue append MCP" e best-effort/bypass preservado. `agents/developer.md` não cita tool de nota e mantém o registro consolidado manual. `templates/task-record.md` não menciona nota/MCP. `templates/task-note.md` e `workflows/developer-workflow.md` repetem a mesma regra e deixam o registro consolidado fora da tool; o fallback não contradiz a centralização (só vale quando a tool não está disponível e mantém carimbo medido/supersessão). `docs/contexto-persistente.md` resume a mesma regra.
- Fact (V2 verificado fora do repo): copiei `examples/opencode.json` para um projeto descartável `/tmp/opencode/anw-v2check` e rodei `opencode v2.2.6` read-only. `opencode debug agents` | exit 0 | os agentes `coder/planner/tester/reviewer/developer` mantiveram `system` (ex.: coder 3534 chars), `mode` e `model` globais e receberam `note_* deny` seguido de `note_<role>_append allow`; `opencode debug config` | exit 0 | documento do projeto parseado com `mcp.servers` contendo os 5 servidores `note_*`. Ou seja, entradas `agents` só com `permissions` fazem merge com as definições existentes, não as apagam, e o shape `permissions` array + `mcp.servers` + `codemode:false` é o V2 efetivo. Nenhuma config global foi alterada; o projeto temporário fica fora do repo.
- Fact (mutação dos testes de recurso): cópia descartável em `/tmp/opencode/anw-valmut` com `tools/`+`tests/` copiados e `agents/templates/workflows/docs/skills/README*/code-map.md` por symlink; baseline `Ran 75 tests OK` exit 0. Remover o bloco de fallback de `check_agent` → exit 1 com 4 falhas (`test_note_roles_name_their_mcp_tool_and_fallback` em planner/coder/tester/reviewer); remover `"fallback"` de `NOTE_TEMPLATE_PHRASES` → exit 1 com 1 falha (`test_task_note_requires_the_note_mcp_and_fallback_rule`). Os dois mutantes morreram, provando que as asserções teste-only acrescentadas protegem o requisito.
- Fact (inventário/CI): `code-map.md` foi atualizado para os dois exemplos V2, o merge de permissions e a descrição de `tools/validate_resources.py`/`tests/test_validate_resources.py`; `.github/workflows/quality.yml` executa `validate-config` para `examples/opencode.json` e `examples/opencode.env-path.json` no step do harness.
- Gap G1 (não bloqueante, coder/developer): o validador mecaniza apenas o nome da tool e a palavra "fallback"; não verifica "não escrever por `edit`" nem "não enviar carimbo/caminho/papel no texto". Uma remoção dessas frases não é detectada. Sugestão: incluir as frases em `check_agent`/`check_workflow`/`check_template`, ou declarar que essa parte fica em revisão humana.
- Gap G2 (não bloqueante, coder): `looksLikeNoteServer` compara `entry.command.includes("--role")` (elemento exato). Um server com nome que não começa com `note_` e comando shell (`sh -c "... --role coder"`) escapa da validação: probe com `Note.Coder` + `sh -c` retornou `ok:true`, `servers` só `note_coder`, e o tool efetivo do shadow também `note_coder_append` (colisão normalizada não detectada). Fix seria testar o comando unido por string e/ou exigir prefixo `note_`; é mudança de produção, devolvo ao coder.
- Gap G3 (não bloqueante, coder): o validador não exige `codemode:false`, embora o README diga que é isso que expõe a tool nativa `note_<role>_append` usada pela ACL; um config com `codemode:true` passa no CLI. O exemplo e o `config.test` definem/garantem `false`, então os artefatos entregues estão corretos; a lacuna é do checker.
- Ambiguidade A1 (baixa): o exemplo inclui `note_developer_append` embora o registro consolidado esteja fora da tool e o template/validador excluam developer de `NOTE_ROLES`; o README explica "developer only for its own role note". Sem ação necessária, mas o exemplo poderia remover o server de developer para evitar leitura de que o record usa a tool.
- Observação D1: o README afirma recarga de config com `/reload`; a string `/reload` existe no binário v2.2.6, mas o comportamento não foi exercitado nesta revisão (doc não medida). Sem impacto nos artefatos.
- Riscos preservados: ESC1/ESC2 e bypass por shell continuam **risco aceito best-effort**, não reabertos; F1/F2/L5 do backend permanecem como validados em 22:15; R1/R2 seguem registrados para o reviewer.
- Checkpoint: revisão do delta concluída com validator PASS, 75 testes de recurso OK, 10 testes de config OK, V2 confirmado no binário real e mutações mortas. Nenhuma aprovação final; próximo reviewer no mesmo snapshot, com G1–G3 como recomendações ao coder/developer, ou coder primeiro se o developer priorizar os gaps do checker. Nenhuma suíte global/CI executada.
- Timestamp: `2026-11-10 13:51 -03:00` aferido com `date '+%Y-%m-%d %H:%M %:z'`; o `13:48` oferecido no despacho não era o minuto da escrita.

### 2026-11-10 14:03 -03:00 - revalidação G1/G2/G3/A1 do checker: fechados, backend intocado

- Fact (snapshot): HEAD `eb0186a`; `src/config-check.mjs` `c47346dd...`, `tests/config.test.mjs` `bd781341...`, `examples/opencode.json` `38973a89...` (sem developer), `examples/opencode.env-path.json` `a7c75bcb...` (inalterado, só coder), `tools/validate_resources.py` `025a4274...`, `tests/test_validate_resources.py` `280d7d18...`. Backend inalterado neste delta: `src/note-writer.mjs` `ab1b9623...` e `src/server.mjs` `23361029...`, iguais aos de 22:09/22:15; os 70 testes de backend não foram reexecutados (fora do escopo).
- Fact (execução): `python3 -m unittest discover -s tests -p 'test_validate_resources.py'` | exit 0 | `Ran 78 tests ... OK` | 14:02; `python3 tools/validate_resources.py` | exit 0 | `PASS: agent roles, task notes, workflow, and portability` | 14:02; `node --test tests/config.test.mjs` | exit 0 | `tests 13 / pass 13 / fail 0` | 14:02; `node --check` de `validate-config.mjs`, `src/config-check.mjs`, `tests/config.test.mjs` | exit 0; CLI `validate-config` nos exemplos | exit 0 | `ok:true`, 4 papéis/4 servers (`planner,coder,tester,reviewer`) e 1 papel/1 server (`coder`); `jq -e` dos dois JSON | exit 0; `grep` de path absoluto de home em exemplos/README | sem ocorrências; varredura de links dos Markdown tocados | exit 0. `find` em `~/.config/opencode` com mtime > 13:55 | vazio, nenhum arquivo global alterado neste delta.
- Fact (G2 fechado, sondas independentes via `validateNoteServers`): alias `Note.Coder` com comando composto `sh -c "exec node index.mjs --role coder"` → `ok:false`, `CONFIG_NAME`, e o tool efetivo detectado é `note_coder_append`; alias + `note_coder` canônico → `CONFIG_NAME` + `CONFIG_DUPLICATE_ROLE` + `CONFIG_DUPLICATE_TOOL`; `note_coder` com comando array e `codemode:false` → `ok:true`. Comando composto com `--role=planner` é detectado como servidor de nota e rejeitado com `CONFIG_ROLE` (fail-closed; ver O2).
- Fact (G3 fechado): `codemode` ausente → `CONFIG_CODEMODE`; `codemode:true` → `CONFIG_CODEMODE`; `codemode:false` → `ok:true`. Os dois exemplos declaram `false` e o `config.test` verifica.
- Fact (A1 fechado): `examples/opencode.json` não tem `note_developer` nem grant de developer; `examples/opencode.env-path.json` só configura `coder`; README diz explicitamente que só `planner`, `coder`, `tester` e `reviewer` usam o MCP e que o developer escreve o registro consolidado manualmente; `agents/developer.md` segue sem tool de nota e `templates/task-record.md` sem menção ao MCP. `config.test` rejeita role de nota fora do conjunto de quatro papéis e verifica a ausência de developer.
- Fact (G1 fechado): `check_agent` exige `task_slug`, `` `edit` `` e "não os inclua no texto" em cada papel de nota; `WORKFLOW_PHRASES` exige "write the note with `edit`" e "do not put them in the text"; `NOTE_TEMPLATE_PHRASES` exige "write the note with `edit`" e "do not send them in the text". Sensibilidade provada em cópia descartável `/tmp/opencode/anw-valmut2` (tools/tests copiados + symlinks, baseline 78 OK): remover o bloco de frases de `check_agent` → exit 1 com 12 falhas (3 frases x 4 papéis); remover a frase do workflow da lista → exit 1 com 1 falha.
- Observação O1 (baixa, sem ação): `validateNoteServers` aceita um `note_developer` bem formado (`ok:true`), porque o checker valida forma/nome e não restringe o conjunto de papéis; docs/exemplos restringem a quatro. Se o requisito for rejeitar developer no checker, é mudança de produção no coder.
- Observação O2 (baixa): `--role=planner` embutido em comando composto é rejeitado com `CONFIG_ROLE` (não é parseado como role), em vez de `CONFIG_NAME`; o resultado é fail-closed, sem aceitação silenciosa.
- Risco preservado: README continua explicitando que a proteção é "against accidental misuse under a trusted configuration", cita ESC1/ESC2 como risco residual aceito e o bypass por config/shell no mesmo UID; nada foi reaberto. TOCTOU/limitações R1/R2 do backend permanecem como em 22:15.
- Checkpoint: delta G1/G2/G3/A1 conferido na fonte e fechado; exemplos V2 válidos e sem developer; nenhuma config ativa na raiz nem alteração global. Sem aprovação final: próximo reviewer em modo final no mesmo snapshot, com O1/O2 como observações de baixa prioridade; se o developer exigir developer bloqueado no checker, passar antes ao coder.
- Timestamp: `2026-11-10 14:03 -03:00` aferido com `date '+%Y-%m-%d %H:%M %:z'`; o `14:00` oferecido no despacho não era mais o minuto da escrita.

### 2026-11-10 14:08 -03:00 - O1 fechado: checker restrito aos quatro papéis de nota

- Fact (snapshot): HEAD `eb0186a`; `src/constants.mjs` `d06816e8...` (novo `NOTE_ROLES`), `src/config-check.mjs` `2259328c...`, `tests/config.test.mjs` `4ab93e2a...`, `examples/opencode.json` `38973a89...`, `examples/opencode.env-path.json` `a7c75bcb...`. Backend intocado: `src/note-writer.mjs` `ab1b9623...` e `src/server.mjs` `23361029...` (os 70 testes de backend não foram reexecutados).
- Fact (execução): `node --test tests/config.test.mjs` | exit 0 | `tests 14 / pass 14 / fail 0` | 14:07, log `/tmp/opencode/anw-config-o1-tester.log`; `python3 -m unittest discover -s tests -p 'test_validate_resources.py'` | exit 0 | `Ran 78 tests ... OK` | 14:07; `python3 tools/validate_resources.py` | exit 0 | `PASS: agent roles, task notes, workflow, and portability` | 14:07; `node --check` de `validate-config.mjs`, `src/config-check.mjs`, `src/constants.mjs`, `tests/config.test.mjs` | exit 0; CLI `validate-config` nos exemplos | exit 0 | `ok:true`, 4 papéis/4 servers (`planner,coder,tester,reviewer`) e 1 papel/1 server (`coder`).
- Fact (negativos de role, sondas independentes em `validateNoteServers`): `note_developer`, `note_analyst`, `note_alice` e `note_auditor` bem formados (`type:"local"`, `codemode:false`, `--role` correto) → `ok:false` com `CONFIG_ROLE_NOT_ALLOWED`; a mensagem lista os quatro papéis. Controle positivo com `planner+coder+tester+reviewer` → `ok:true`. `note_developer` rejeitado não gera `CONFIG_EMPTY` adicional (só `CONFIG_ROLE_NOT_ALLOWED`), confirmando a semântica de "nenhum servidor de nota detectado"; `{}` e uma config só com servidor não-nota → `CONFIG_EMPTY`.
- Fact (docs): `harnesses/agent-note-writer-mcp/README.md` documenta a restrição a `planner/coder/tester/reviewer` e `code-map.md` (linha do harness) registra "restringe roles a planner/coder/tester/reviewer"; exemplos seguem sem `note_developer`; `grep` de path absoluto de home em README/exemplos | vazio; `jq -e` dos dois JSON | exit 0; varredura de links em README/code-map | exit 0. `find` em `~/.config/opencode` com mtime > 14:03 | vazio, config global intocada.
- Fact (risco preservado): README mantém ESC1/ESC2 como risco residual aceito e a proteção como "against accidental misuse under a trusted configuration"; bypass por config/shell no mesmo UID inalterado. O2 anterior (`--role=planner` embutido → `CONFIG_ROLE`, fail-closed) continua observação de baixa prioridade.
- Nota de compatibilidade: a restrição rejeita roles fora dos quatro. É a decisão aprovada e está documentada; nenhum requisito de papel de nota adicional existia. Se algum projeto usar papel diferente, o `validate-config` agora falha explicitamente (fail-closed), o que é o comportamento pretendido.
- Checkpoint: O1 conferido na fonte e fechado; G1/G2/G3/A1 e backend permanecem como registrados. Sem aprovação final: próximo reviewer em modo final no mesmo snapshot; nenhuma pendência nova bloqueante.
- Timestamp: `2026-11-10 14:08 -03:00` aferido com `date '+%Y-%m-%d %H:%M %:z'`; o `14:06` oferecido no despacho já não era o minuto da escrita.

### 2026-11-10 14:34 -03:00 - R1 fechado; R2 core ok, bloqueador D1 no release do guarda

- Fact (snapshot): HEAD `eb0186a`; `src/note-writer.mjs` `3b55b16c...`, `src/server.mjs` `23361029...`, `src/constants.mjs` `d06816e8...`, `index.mjs` `30da4018...`, `tests/coder-regressions.test.mjs` `d4b286e0...`, helpers `hold-guard-then-die.mjs` `7bbf8c41...` e `append-with-barrier.mjs` `713ca061...`. Nenhuma produção/config global foi alterada por este papel; só a nota.
- Fact (execução): `node --test tests/*.test.mjs` no pacote | exit 0 duas vezes | `tests 81 / pass 81 / fail 0` | 14:30, logs `/tmp/opencode/anw-tester-r1r2-run1.log` e `...run2.log`; `node --test tests/coder-regressions.test.mjs` | exit 0 | `tests 10 / pass 10 / fail 0`; `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs`, `tests/*.test.mjs` e `tests/helpers/*.mjs` | exit 0.
- Fact (R1 fechado): `stampToMinutes` valida offset (≤14:00, minutos ≤59) e faz round-trip de calendário/hora; `lastRecordedStamp` usa `STAMP_SHAPE` e lança `NOTE_TIMESTAMP_INVALID` em âncora inválida. Probes independentes: válidos `2024-02-29 23:59 -03:00`, `+14:00`, `-14:00` e `00:00 +00:00` seguem parseáveis (o `-14:00` às 10:00 caiu em `CLOCK_REGRESSION`, não em inválido, como esperado); inválidos `2025-02-29`, `2026-04-31`, mês 00, dia 00, hora 24, minuto 60, `+14:01`, `+00:60` e `-14:30` retornaram `NOTE_TIMESTAMP_INVALID` com arquivo byte-a-byte inalterado e **sem lock residual**; prosa sem carimbo continua aceita; carimbo inválido no meio com último carimbo válido é ignorado como âncora e o append passa; `CLOCK_REGRESSION` continua ativo para relógio anterior.
- Fact (R2 core fechado): guarda abstrata funciona no Linux (probe: segunda aquisição concorrente → `LOCK_BUSY`); testes determinísticos de barreira após stale check, guarda mantida por outro processo (contender `LOCK_BUSY`, lock/mutex preservados) e morte do dono do guarda (recuperação) passam; takeover/verificação de nonce e limites `500 ms/2 s` inalterados.
- **Bloqueador D1 (release do guarda pode esperar indefinidamente):** `releaseRecoveryGuard` chama `server.closeAllConnections?.()` e depois aguarda `server.close(callback)`. Em Node v24.22.1, `closeAllConnections` é `undefined` em `net.Server` (só existe em `http.Server`), então o ajuste de 14:27 é inócuo. Probe 1: guarda adquirida + cliente ocioso conectado ao nome abstrato → `releaseRecoveryGuard` não resolveu em 1500 ms (`HANG`; `closeAllConnections=undefined`). Probe 2: o `server.close()` libera o listener imediatamente (segunda aquisição `ACQUIRED_WHILE_RELEASE_PENDING`), mas a promise só resolve quando o cliente é destruído. Probe de produção: filho pausado na barreira segurando a guarda, pai conecta cliente ocioso, libera a barreira → filho não saiu em 3000 ms (`HUNG`); após destruir o cliente, saiu com `TIMEOUT` e nenhuma linha escrita. Impacto: qualquer conexão ociosa (mesmo UID no socket abstrato determinístico; na porta local do fallback não-Linux, qualquer processo local) faz o append exceder o orçamento de 2 s e, se a conexão nunca fechar, o processo fica pendurado sem retorno; o mutex de recuperação pode ficar com dono vivo, bloqueando outros escritores com `LOCK_BUSY`. Isso não é fail-closed delimitado como o README descreve ("Wait is bounded..." / "fails closed"). Correção sugerida (pequena): não aguardar o callback de `close` (liberar o listener e resolver imediatamente), ou rastrear `connection` e destruir os sockets, ou `server.on("connection", socket => socket.destroy())`; regressão deve conectar cliente ocioso e exigir retorno dentro do orçamento.
- Fact (portabilidade/testabilidade): socket Unix abstrato é Linux-only e funcionou; o fallback por porta local (`127.0.0.1:30000+hash%20000`) não foi exercitado nesta máquina Linux (código apenas inspecionado): hash de 16 bits pode colidir entre recovery paths distintos (serialização desnecessária) e qualquer conexão local pode reproduzir D1. Caminho Windows com path case-insensitive pode gerar hash distinto para o mesmo lock (guarda separada) — limitação especulativa, best-effort.
- Riscos preservados: ESC1/ESC2, bypass por shell e ocupação do guarda por mesmo UID seguem **risco aceito best-effort**; D1 não reabre isolamento, mas é defeito de implementação do release (espera não limitada) e deve ser corrigido ou explicitamente rebaixado/documentado antes do reviewer.
- Checkpoint: R1 fechado; R2 core fechado; **D1 bloqueia o reviewer final** até correção no coder ou downgrade explícito do developer. Backend não foi alterado neste delta além de `note-writer.mjs`; config global intocada.
- Timestamp: `2026-11-10 14:34 -03:00` aferido com `date '+%Y-%m-%d %H:%M %:z'`; o `14:27` oferecido no despacho não era o minuto da escrita.

### 2026-11-10 14:44 -03:00 - D1 fechado: guarda destrói sockets e libera sem esperar

- Fact (snapshot): HEAD `eb0186a`; `src/note-writer.mjs` `a4da4b8f...` (guarda com `connection`+destroy e `releaseRecoveryGuard` sem callback; `recoveryGuardOptions`/`guardOptions` exportados para o fallback TCP), `tests/coder-regressions.test.mjs` `05e2e4e5...`, `tests/tester-gaps.test.mjs` `c3f475d5...` (teste novo deste papel), helpers inalterados (`hold-guard-then-die.mjs` `7bbf8c41...`, `append-with-barrier.mjs` `713ca061...`), `src/server.mjs`/`src/constants.mjs` inalterados. R1/R2: o bloco de timestamp (`STAMP_PARTS`/`STAMP_SHAPE`/`stampToMinutes`/`lastRecordedStamp`) está textualmente igual ao snapshot de 14:34; não repeti os probes R1 mecanicamente, a suíte cobre.
- Fact (execução): `node --test tests/*.test.mjs` no pacote | exit 0 três vezes | `tests 84 / pass 84 / fail 0` | 14:41–14:44, logs `/tmp/opencode/anw-tester-d1-final1.log`, `...final2.log`, `...final3.log`; `node --check` de `index.mjs`, `validate-config.mjs`, `src/*.mjs`, `tests/*.test.mjs` e `tests/helpers/*.mjs` | exit 0.
- Fact (D1, transportes): com 5 clientes ociosos simultâneos, a guarda abstrata liberou em 0,2 ms e foi reaquirida em 0,2 ms; o fallback TCP (`recoveryGuardOptions(path, "darwin")` + seam `guardOptions`) liberou em 0,0 ms e reaquiriu em 1,1 ms. Os clientes conectaram e foram destruídos pelo servidor (close < 500 ms) nos dois transportes. `server.close()` sem callback libera o listener imediatamente (reaquisição imediata), e o kernel continua liberando a guarda na morte do processo (teste `guard-death` da suíte passa).
- Fact (append com cliente ocioso): probe de produção com barreira (filho pausado após stale check segurando a guarda), 3 clientes ociosos conectados e liberação da barreira → filho saiu em 41 ms, `1` linha escrita, bem abaixo de 2 s; contraste com o snapshot anterior, que ficou HUNG > 3 s e só retornou TIMEOUT após destruir o cliente. `clientOutcomes=connected` e close < 500 ms confirmam o destroy-on-accept.
- Fact (teste novo e sensibilidade): acrescentei `destroys idle recovery-guard connections on both transports (D1)` em `tests/tester-gaps.test.mjs` (connect + `close` em < `lockWaitMs` nos dois transportes, com cleanup em `finally` para não pendurar o runner em falha). Mutação em cópia descartável removendo `server.on("connection", socket => socket.destroy())` | exit 1 | o teste falha (pass 0, fail 1), provando que a asserção distingue a remoção; o teste do coder só media o tempo de release, não a destruição do socket.
- Fact (R2): barreira pós-stale-check, guarda de outro processo com contender `LOCK_BUSY` sem remover lock/mutex, morte do dono do guarda e recuperação continuam passando na suíte de 84; kill do holder do lock (`hold-lock-then-die`) coberto por WAIT-04/CONC-02. Limites 500 ms/2 s e verificação de nonce inalterados.
- Portabilidade/limitações: socket abstrato é Linux-only e foi exercitado; o fallback TCP foi exercitado pelo seam com opções derivadas de `"darwin"` (não pelo fluxo `appendNote`, que escolhe `process.platform` — o seam não é propagado por `acquireLock`/`appendNote`, o que é suficiente para o teste de guarda). Permanecem: colisão de hash de 16 bits entre recovery paths distintos (serializa recuperações alheias), ocupação/vinculação do guarda por mesmo UID (bloqueio limitado `LOCK_BUSY`, best-effort aceito), possível rebind imediato em TIME_WAIT no Windows não exercitado, e path case-insensitive no Windows pode gerar guardas distintas (especulativo). Nada disso é blocker novo.
- Riscos preservados: ESC1/ESC2, bypass por shell, TOCTOU de componente intermediário e stalling > 30 s seguem risco best-effort documentado; D1 não reabriu isolamento, apenas corrigiu espera não limitada.
- Checkpoint: D1 fechado; R1/R2 preservados; sem blockers. Próximo: reviewer em modo final no snapshot HEAD `eb0186a` com `note-writer.mjs` `a4da4b8f...`; nenhuma suíte global/CI executada; nenhuma produção/config global alterada por este papel (só `tests/tester-gaps.test.mjs`).
- Timestamp: `2026-11-10 14:44 -03:00` aferido com `date '+%Y-%m-%d %H:%M %:z'`; o `14:38` oferecido no despacho já não era o minuto da escrita.

### 2026-11-10 14:51 -03:00 - E2E OpenCode v2 x servidor real: conecta, escreve e nega papel errado

- Fact (snapshot): servidor real inalterado desde 14:44: `index.mjs` `30da4018...`, `src/note-writer.mjs` `a4da4b8f...`, `src/server.mjs` `23361029...`, `src/constants.mjs` `d06816e8...`. Workspace/config/provider descartáveis em `/tmp/opencode/e2e-nw/` (`project/opencode.json`, `fake_provider.py`, logs `out-*.json`/`err-*.log`/`fake.log`, `raw_probe.py`). Config V2 só no projeto temp: `mcp.servers.note_coder` com `codemode:false` e `[node absoluto, .../index.mjs, --role, coder]`, `permissions` top-level `note_* deny`, agentes `coder` (allow `note_coder_append`) e `other` (sem allow), provider fake OpenAI-compatible local (stdlib, porta efêmera 46453, apiKey literal `fake`, sem rede).
- Fact (primeiro append): `opencode run --standalone --archived --format json --agent coder "FIRST entry"` | exit 0 | tool `note_coder_append` com input `{task_slug:"e2e-task",text:"first line"}` | resultado do servidor `ok:true`, `path:"docs/agent-state/e2e-task/coder.md"`, `timestamp:"2026-11-10 14:48 -03:00"`; arquivo criado em `/tmp/opencode/e2e-nw/project/docs/agent-state/e2e-task/coder.md` com `2026-11-10 14:48 -03:00 - first line`. O log do fake mostra a tool `note_coder_append` no catálogo e a chamada só com dois campos.
- Fact (segundo append): `... --agent coder "SECOND entry"` | exit 0 | segunda chamada `note_coder_append`; arquivo com `first line` seguida de `second line`, 2 linhas, timestamps iguais no mesmo minuto e não decrescentes; primeira linha preservada.
- Fact (ACL/papel errado): agente `other` com `"ACL attempt"` | exit 0, tool call emitida pelo fake | `status:"error"` e "No tool named"; catálogo do fake para `other` **não** contém `note_coder_append` (lista: edit, experimental_image_generate, glob, grep, question, read, shell, skill, subagent, webfetch, websearch, write, execute); zero escrita (nota permaneceu com 4 linhas). Tool `note_developer_append` (inexistente) pelo coder | `status:"error"` "No tool named"; nenhum `developer.md`; `find` por `evil.md` no temp | vazio.
- Fact (path/timestamp extras): o fake emitiu `note_coder_append` com `path:"../evil.md"` e depois com `timestamp:"2000-01-01 00:00 +00:00"`; o evento `tool` do OpenCode mostra os extras, mas o resultado veio `ok:true` com path normal e timestamp do servidor (14:48/14:49), **sem redirect** e sem `evil.md`. Isso confirma que o OpenCode remove campos desconhecidos antes do MCP (como já medido no harness); probe direto em stdio contra o servidor real (initialize + tools/call) rejeitou `x`/`path`/`role`/`timestamp` com `INVALID_ARGUMENTS` e só aceitou `{task_slug,text}` (linha `direct ok` às 14:50). Se o requisito for "rejeitar extras end-to-end", isso depende do harness, não do servidor; registrar para o developer/planner.
- Fact (protocolo/higiene): stderr de todas as sessões | 0 bytes; stdout em JSON com eventos `tool_use`/resultado; log do fake sem headers/authorization e só `apiKey: "fake"` no config temp; varredura de `authorization|bearer|sk-|ghp_` | nenhum marcador; `find` em `~/.config/opencode` com mtime > 14:44 | vazio (config global intocada); nenhum arquivo criado no repo ou em notas reais; sessões `--archived`; fake encerrado. Timestamps do arquivo: 14:48, 14:48, 14:48, 14:49 e 14:50, todos `-03:00`, coerentes com `TZ=America/Fortaleza date` (14:50).
- Checks executados: `opencode run` 6x (FIRST, SECOND, extra-path, extra-time, WRONG-ROLE, ACL) todos exit 0; `raw_probe.py` exit 0; leitura do arquivo/logs; `grep` de segredos; `find` de lixo e mtime global. Nenhuma suíte ampla/CI e nenhuma chamada remota/paga (provider fake local).
- Limitações: OpenCode v2.2.6 com configs globais carregadas read-only (plugins/MCPs globais podem aparecer no catálogo, mas o servidor de nota veio só do temp); extras são removidos pelo harness antes do MCP; sessões arquivadas no DB compartilhado; fake não cobre variação de modelo real. Não alterei produção, testes permanentes ou config global; artefatos só em `/tmp/opencode/e2e-nw`.
- Checkpoint: integração E2E aprovada nos critérios (conexão, call só `{task_slug,text}`, arquivo no temp, timestamp `America/Fortaleza`, ordem preservada, papel errado/ACL negados, extras sem redirect); sem blocker. Próximo: reviewer em modo final; a interpretação "rejeitar extras end-to-end" fica como decisão de harness, não do servidor.
- Timestamp: `2026-11-10 14:51 -03:00` aferido com `date '+%Y-%m-%d %H:%M %:z'`; o `14:44` oferecido no início não era o minuto da escrita.
