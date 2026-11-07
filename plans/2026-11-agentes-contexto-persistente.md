# Plano: contexto persistente entre agentes

- Status: **em andamento** - F1 aprovada e aplicada em 2026-11-07
  (Q1-Q8 resolvidas; ver secao 14). F2 (adaptador opcional) segue pendente de
  medicao.
- Data de abertura: 2026-11-07
- Origem: observacao de que os agentes gastam iteracoes apenas trocando
  informacao entre si, sem conseguir focar na atividade. A referencia e o
  modelo simples `plan` + `build` usado em sessoes recentes.
- Escopo: `agents/`, `templates/`, `workflows/`, `docs/`, `plans/README.md`,
  `tools/`, `tests/`, `.github/workflows/quality.yml` e, opcionalmente,
  `harnesses/opencode/`.

## 1. Objetivo

Reduzir o custo de troca entre papeis sem afrouxar gates, fazendo a memoria da
tarefa viver no projeto e reaproveitando a sessao de cada papel entre
iteracoes. O handoff de 15 campos deixa de ser o transporte do contexto.

O objetivo nao e "menos agentes por economia": e eliminar a reserializacao
textual do estado a cada salto e remover o protocolo que existe apenas para
reconstruir contexto.

## 2. Decisoes tomadas

| ID | Decisao | Origem |
| --- | --- | --- |
| D1 | Contexto-alvo: sessao persistente por papel, nao sessao unica com troca de agente | usuario, 2026-11-07 |
| D2 | `coder-expert` e fundido em `coder`; complexidade vira escolha de modelo, nao de papel | usuario, 2026-11-07 |
| D3 | Markdown no nucleo portatil; automacao apenas opcional e isolada em `harnesses/opencode/` | usuario, 2026-11-07 |
| D4 | A memoria da tarefa pertence ao projeto; no fim e compactada e commitada como referencia futura | usuario, 2026-11-07 |
| D5 | **Um escritor por nota**: cada papel escreve somente a propria nota; o `developer` consolida | usuario, 2026-11-07 |
| D6 | O contrato de handoff obrigatorio e **removido**; resta um retorno operacional curto | usuario, 2026-11-07 |
| D7 | Compactacao: usar a nativa por sessao; **sem** hook de compactacao customizado na primeira entrega | discussao, 2026-11-07 |
| D8 | A nota por papel **nao tem limite de linhas**; deve resumir e referenciar, sem copiar logs ou o plano inteiro | usuario, 2026-11-07 |
| D9 | O retorno ao `developer` usa 3 campos sugeridos, **sem limite de caracteres** | usuario, 2026-11-07 |

Decisao consequente: nao usar `switchAgent` na mesma sessao. Contexto unico
literal eliminaria a revisao independente, que os planos anteriores protegeram
(anti-pin, cobertura independente, evidencia do mesmo run).

## 3. Diagnostico

| ID | Problema | Evidencia |
| --- | --- | --- |
| P1 | Sessao filha nova por despacho forca reconstrucao textual do estado | contrato com 15 campos; ledger reescrito a cada retorno |
| P2 | Handoff funciona como relatorio, nao como estado; o mesmo dado e escrito duas vezes | `templates/handoff-contract.md` + ledger do `developer` |
| P3 | Fases finas: `tester` rederiva testes do `coder`, `reviewer` reexecuta e rele | 27 despachos em 4 entregas (`plans/2026-11-agent-iteration-improvements.md`) |
| P4 | Orcamento de `steps` corta o retorno e a continuacao reconstroi contexto | 3/27 despachos encerrados por limite |
| P5 | Seis definicoes de papel para o fluxo principal, com rastreabilidade em toda transicao | `agents/` com `coder` e `coder-expert` duplicando regras |
| P6 | Arquivo unico compartilhado por varios escritores gera sobrescrita | desenho anterior (D5 substitui) |

Fatos do OpenCode V2 usados no desenho:

- Compactacao e por sessao e automatica (`compaction.auto`, `keep.tokens`,
  `buffer`); e lossy e preserva o trecho recente.
- A tool `subagent` aceita `sessionID` para continuar uma sessao filha; nova
  entrada de usuario reinicia o orcamento de `steps`.
- `instructions.entry` anexa blocos `<context key="...">` persistentes a uma
  sessao, sem editar arquivo.
- Existem hooks `context` e `compaction` no plugin server, mas D7 os deixa fora
  da primeira entrega.

## 4. Desenho aprovado

### 4.1 Memoria de trabalho: uma nota por papel

Cada papel escreve **somente a propria nota** da tarefa; nao existe arquivo
compartilhado de escrita concorrente.

```text
<projeto>/docs/agent-state/<task>/planner.md
<projeto>/docs/agent-state/<task>/coder.md
<projeto>/docs/agent-state/<task>/tester.md
<projeto>/docs/agent-state/<task>/reviewer.md
```

- A nota e um resumo do trabalho executado, nao um log: objetivo do papel,
  o que foi feito, o que ficou pendente, decisoes e ponteiros de evidencia
  (comando/arquivo/estado do codigo). Nao ha limite fixo de linhas; a nota deve
  conter o contexto util para retomada sem copiar logs ou o plano inteiro.
- Nota nao e prova. "Testes passaram" so vale com comando, resultado e
  identificacao do estado verificado; o `reviewer` confere na fonte.
- O papel cria/atualiza a nota ao terminar trabalho material, nao a cada
  troca. Atualizacao e sempre do dono da nota.
- O `planner` pode escrever plano completo em `plans/` do projeto alvo; a nota
  apenas aponta para ele.
- Se o projeto tiver convencao propria de documentacao, ela prevalece; o
  caminho e confirmado no despacho e nunca e absoluto de home.

### 4.2 Registro final: consolidacao pelo developer

No encerramento, o `developer` le as notas e escreve **um** documento:

```text
<projeto>/docs/agent-state/<task>.md
```

Conteudo alvo (<= 40 linhas):

```text
# <task>

## Objetivo e criterios
## Resultado
## Mudancas
## Validacao
## Decisoes
## Riscos residuais
## Referencias
```

- Escrito por um unico autor; sem concorrencia por construcao.
- E o artefato commitavel e reutilizavel como referencia futura (D4), sujeito
  a autorizacao de commit do fluxo e nunca em `main`/producao.
- `state: completed` no registro exige validacao manual obrigatoria aceita pelo
  usuario quando aplicavel.

### 4.3 Retorno operacional

Sem contrato de 15 campos e sem limite de caracteres. O retorno ao `developer`
usa tres campos sugeridos, que podem ser tao detalhados quanto o bloqueio exigir:

```text
resultado: concluido | bloqueado | inconclusivo
nota: <caminho>
proximo: <papel ou decisao necessaria>
```

Regras que permanecem:

- `reviewer` continua o unico com aprovacao final, e so depois de conferir a
  implementacao, os testes e os gates na fonte.
- Gate, evidencia, `head` + timestamp e `review_incomplete` continuam valendo
  no registro/notas, nao como campos obrigatorios de resposta.
- Nenhuma aprovacao se baseia apenas em resumo; nenhum aceite humano e
  inferido.

### 4.4 Reuso de sessao

1. Primeiro despacho de um papel na tarefa: sessao nova.
2. Do segundo em diante: reusar o `sessionID` e enviar tarefa, criterio de
   saida e delta.
3. Reset da sessao do papel quando a tarefa muda, o plano e reaprovado, o
   estado fica stale ou a hipotese anterior foi refutada; o reset e registrado
   na nota do papel.
4. Reuso reinicia o orcamento de `steps`, atacando P4.
5. `sessionID` nao entra no registro commitavel: e efemero e por maquina.

## 5. Papeis apos a fusao

| Papel | Mudanca |
| --- | --- |
| `developer` | unico consolidador; mantem mapa efemero `role -> sessionID`; le notas e roteia |
| `planner` | inalterado em responsabilidade; escreve a propria nota |
| `coder` | absorve `coder-expert`; implementa, testa no escopo e escreve a propria nota; escalacao vira escolha de modelo |
| `tester` | valida independentemente e escreve a propria nota |
| `reviewer` | gates finais e aprovacao unica; escreve a propria nota |

`analyst`, `research`, `retrospectiv`, `model-setter` e `minimal` ficam fora do
fluxo principal e nao precisam de nota por tarefa.

## 6. Mudancas propostas

| ID | Arquivo alvo | Mudanca | Problema |
| --- | --- | --- | --- |
| C1 | `templates/task-note.md` (novo) | Modelo da nota por papel | P1, P6 |
| C2 | `templates/task-record.md` (novo) | Modelo do registro consolidado | D4 |
| C3 | `templates/handoff-contract.md` | Remover; substituido por C1/C2 | P1, P2 |
| C4 | `workflows/developer-workflow.md` | Reescrita: notas, consolidacao, reuso de sessao, sem protocolo de handoff | P1-P5 |
| C5 | `agents/developer.md` | Consolidador; mapa de sessoes; leitura de notas; reset | P1, P4 |
| C6 | `agents/coder.md` | Absorve `coder-expert`; nota | P5 |
| C7 | `agents/coder-expert.md` | Remover | P5 |
| C8 | `agents/planner.md`, `agents/tester.md`, `agents/reviewer.md` | Nota propria; remover bloco de contrato | P2 |
| C9 | `tools/validate_handoffs.py` -> `tools/validate_resources.py` | Validar frontmatter/permisssoes, ausencia de caminho absoluto de home, presenca de nota/registro nos modelos e consistencia dos agentes | C3, CI |
| C10 | `tests/test_validate_handoffs.py` -> `tests/test_validate_resources.py` | Reescrever casos para o novo validador | C9 |
| C11 | `.github/workflows/quality.yml` | Trocar o comando de validacao | C9 |
| C12 | `plans/README.md` | Substituir a regra "contrato de handoff exige validador+testes" pela regra de recurso/validador | C3 |
| C13 | `docs/contexto-persistente.md` (novo) | Como funciona a memoria por notas, o registro final e o reuso de sessao | C1-C4 |
| C14 | `README.md`, `README.pt-BR.md`, `code-map.md` | Atualizar estrutura, fluxo e remocao de `coder-expert`/handoff | C3-C13 |
| C15 | `harnesses/opencode/agent-context/` (opcional) | Helper de sessao (`role -> sessionID`) e leitura das notas; sem hook de compactacao | P1, P4 |
| C16 | `docs/agent-instruction-delivery.md`, `docs/README.md`, `docs/typesafe-jev-*.md`, `skills/clean-code/SKILL.md`, `tests/test_agent_instruction_delivery_docs.py` | Varredura das referencias a handoff e `coder-expert` remanescentes fora dos arquivos ja listados | C3, C7 |

## 7. Politica de transicoes

- Fluxo: `developer` -> `planner` -> aprovacao -> `coder` -> `tester` ->
  `reviewer` final.
- `tester` obrigatorio em risco alto ou quando a cobertura do `coder` for
  disputada; em risco baixo/medio a validacao independente ocorre na sessao ja
  existente do `tester`, com delta.
- `reviewer` em modo `development` apenas em hardware ou risco alto; `final`
  uma unica vez.
- Estados principais sugeridos, reduzidos: `discovery`, `planning`,
  `implementation`, `validation`, `review`, `manual_validation`, `completed`;
  excepcionais: `blocked`, `review_incomplete`, `cancelled`.
- Nenhuma transicao e dispensada por economia de contexto; reducao de despacho
  so vale quando a evidencia exigida continua sendo produzida.
- Gates humanos, aprovacao do plano, proibicao de commit em producao e aceite
  de validacao manual permanecem inalterados.

## 8. Riscos e mitigacoes

| Risco | Mitigacao |
| --- | --- |
| Notas viram relatorios longos e recriam o custo | limite de linhas por nota e conteudo so de marcos; sem repeticao do plano |
| Resumo esconde defeito | evidencia aponta comando/resultado/estado; reviewer verifica na fonte |
| Consolidacao perde informacao | notas originais permanecem no projeto; registro e resumo, nao substituto |
| Sessao reusada carrega premissa errada | reset por mudanca de plano/estado stale, registrado na nota |
| Sessao persistente custa mais em tarefa curta | reuso a partir do segundo despacho |
| Remover o contrato quebra o validador e o CI | C9-C11 no mesmo trabalho; repositorio verde a cada commit |
| Remover `coder-expert` perde capacidade | complexidade passa a orientar modelo/variant, nao um papel separado |
| Nenhuma automacao de compactacao | compactacao nativa por sessao; plugin opcional medido depois |

## 9. Fases

| Fase | Itens | Validacao |
| --- | --- | --- |
| F1 | C1-C14, C16 | `python3 tools/validate_resources.py`; `python3 -m unittest discover -s tests`; `git diff --check`; links do CI |
| F2 | C15 (adaptador opcional) | `node --check`; teste manual em tarefa de risco baixo/medio |

F1 e um unico trabalho: remover `templates/handoff-contract.md` e
`agents/coder-expert.md`, ajustar os papeis e trocar o validador/CI no mesmo
commit, para o repositorio ficar verde a cada passo. Ordem interna sugerida:

1. C1, C2 e C13 (modelos e documentacao do desenho).
2. C9, C10 e C11 (validador, testes e CI), antes de mexer nos agentes.
3. C3 e C7 (remocao dos arquivos substituidos).
4. C4-C6 e C8 (workflow e papeis).
5. C12, C14 e C16 (indices, READMEs e varredura de referencias).

F2 so depois de medir duas entregas com F1: se o reuso de sessao ainda for
manual e custoso, aplicar C15; caso contrario, descartar o adaptador. Cada fase
em commits proprios, sem push.

## 10. Criterios de sucesso

Medidos em duas entregas reais apos F1, contra
`plans/2026-11-agent-iteration-improvements.md`:

| Metrica | Baseline | Alvo |
| --- | --- | --- |
| Despachos por entrega | 27 em 4 entregas | reducao de 40% |
| Retornos por limite de `steps` | 3/27 | 0 |
| Campos no retorno ao developer | 15 | 3 (sem limite de caracteres) |
| Gate stale | 1/7 revisoes | 0 |
| Defeitos escapados | 2 (hardware) | nao aumentar |
| Notas editadas pelo mesmo autor | nao medido | 100% (um escritor por nota) |

## 11. Fora de escopo

- Contexto unico literal com `switchAgent` na mesma sessao.
- Hook de compactacao customizado.
- Alterar regras de aprovacao, gates humanos, revisao final ou validacao fisica.
- Alterar permissoes, modelos ou `steps` dos agentes.
- Alterar projetos consumidores durante esta implementacao.
- Limpar os `.bak` versionados em `agents/` (achado adjacente, deferido).

## 12. Decisoes resolvidas antes da aplicacao

| ID | Pendencia | Decisao |
| --- | --- | --- |
| Q1 | Local das notas e do registro | `docs/agent-state/<task>/<role>.md` e `docs/agent-state/<task>.md`; convencao do projeto alvo prevalece e o caminho e confirmado no despacho |
| Q2 | Limite por nota | sem limite de linhas; resumo com referencias, sem copiar logs ou o plano |
| Q3 | Formato do retorno | tres campos sugeridos (`resultado`, `nota`, `proximo`), sem limite de caracteres |
| Q4 | Validador | reaproveitado como `tools/validate_resources.py` |
| Q5 | Plugin | adiado para F2, apos medicao |
| Q6 | Notas apos encerrar | mantidas no projeto como rastreabilidade |
| Q7 | Aprovacao | F1 aprovada em 2026-11-07 |
| Q8 | Escalacao do `coder` | sinal no retorno/nota; o `developer` troca o modelo na mesma sessao |

## 13. Checkpoint humano

Este arquivo e um plano, nao autorizacao para editar o repositorio. F1 foi
aprovada e aplicada em 2026-11-07. F2 (adaptador opcional) continua pendente de
aprovacao e de medicao em entregas reais. Mudanca de comportamento, escopo,
compatibilidade ou risco aceito durante a execucao volta ao usuario.

## 14. Registro de aplicacao (2026-11-07)

F1 aplicada, sem commit e sem push.

| Item | Resultado |
| --- | --- |
| C1, C2 | `templates/task-note.md` e `templates/task-record.md` criados |
| C3 | `templates/handoff-contract.md` removido |
| C4 | `workflows/developer-workflow.md` reescrito (notas, sessoes, sem handoff) |
| C5 | `agents/developer.md` reescrito como orquestrador e consolidador |
| C6, C7 | `coder` absorve alta complexidade; `agents/coder-expert.md` removido |
| C8 | `planner`, `tester` e `reviewer` com nota propria e retorno de 3 campos |
| C9, C10, C11 | `validate_resources.py` + testes + comando do CI atualizados |
| C12 | regra de `plans/README.md` substituida |
| C13 | `docs/contexto-persistente.md` criado |
| C14 | `README.md`, `README.pt-BR.md` e `code-map.md` atualizados |
| C16 | varredura de `docs/`, `skills/` e do teste de entrega de instrucoes |

Validacao executada:

```bash
python3 tools/validate_resources.py   # PASS
python3 -m unittest discover -s tests # 19 testes OK
git diff --check                      # limpo
```

- Links relativos verificados manualmente, excluindo `node_modules`.
- `node --check` nao foi executado localmente (Node nao instalado no ambiente);
  o passo do CI segue cobrindo o harness MCP.
- `coder` e `planner` receberam permissao de escrita restrita a
  `docs/agent-state/**` para escrever apenas a propria nota; projetos que usarem
  outra convencao precisam ajustar a regra de permissao.
- Pendencias mantidas: F2 (adaptador de sessao), limpeza dos `.bak` versionados,
  e a medicao em duas entregas reais prevista na secao 10.
