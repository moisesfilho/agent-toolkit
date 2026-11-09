# Plano: fechamento dos gaps da retrospectiva (BMP / upload autenticado)

- Status: **concluido** (2026-11-08) - fases F1-F5 aplicadas e validadas, sem
  commit. A medicao da secao 6 acontece na proxima entrega de risco alto.
- Data de abertura: 2026-11-08
- Origem: retrospectiva da sessao `ses_e43f05ff1fferlZgXd7r0AynIL`, "Visualizador
  de imagens com navegacao", de 2026-11-08.
- Escopo: `agents/`, `workflows/`, `templates/`, `tools/`,
  `tests/`, `docs/`, `README.md`, `README.pt-BR.md`, `code-map.md`.
- Decisoes do usuario: Q1 mecanizar no validador apenas as regras que mudam
  gate; Q2 sem script de preflight, so regra; Q3 matriz negativa apenas em
  `risk_profile: high`; Q4 plano salvo neste arquivo.

## 1. Objetivo

Fechar as quatro lacunas de processo que a retrospectiva comprovou com
evidencia, sem afrouxar gates e sem aumentar numero de agentes, rodadas ou
campos de retorno:

1. requisito de seguranca sem caso negativo executavel antes do `coder`;
2. gate final com retrabalho operacional (formato, `clean`, cobertura stale,
   resultado "em execucao" tratado como PASS);
3. handoffs nao conclusivos (16/84 retornos sem os tres campos, 10/84 por
   limite de `steps`, 1 retorno vazio e 1 apenas `@`);
4. criterio de aceite manual registrado como medido sem a serie prevista e uma
   acao de recuperacao fisica (`ui.escape`) nao autorizada.

## 2. Diagnostico e mudancas

| ID | Fato observado | Causa de sistema | Mudanca aplicada |
| --- | --- | --- | --- |
| P1a | Plano exigia basename autenticado e streaming limitado; tester e reviewer bloquearam a primeira implementacao | caso negativo nao era gate verificavel antes do handoff | matriz `campo assinado ou limite -> NEG-* -> status esperado` no planner e `cenarios_prontos` no tester antes do primeiro despacho ao coder em risco alto |
| P1b | Arquivos novos fora do gate de formato; `BINS` expandido deixava binarios fora de `clean`; resultado sem exit code | ausencia de preflight do harness de testes no modo final | preflight no reviewer final, inventario de formato/lint/clean/cobertura no coder, gate com exit code na nota |
| P2a | Retornos por limite de passos sem estado; retornos vazios ou `@` | despacho longo sem checkpoint intermediario | checkpoint na nota antes de esgotar `steps` nos quatro papeis com nota; retorno vazio ou `@` e lacuna de evidencia |
| P2b | AC-IMG-03/C4 sem a serie de 1 s por ao menos 2 min | criterio manual sem tipo de evidencia | `evidence_kind` (`medido`, `relato`, `deferido`) no planner, no reviewer e no registro consolidado |
| P2c | `ui.escape` nao autorizado usado para recuperar shell do dispositivo | acao de recuperacao sem autorizacao previa | gate humano de autorizacao explicita para acao de recuperacao fisica |

## 3. Mudancas por arquivo

| Arquivo | Mudanca |
| --- | --- |
| `agents/planner.md` | `evidence_kind` por `AC-*` manual; matriz `NEG-*` obrigatoria em risco alto; checkpoint de nota |
| `agents/tester.md` | especificacao previa cobre o caso negativo de cada campo/limite; sinal `cenarios_prontos`; autorizacao previa para recuperacao fisica; checkpoint de nota |
| `agents/coder.md` | inventario de formato/lint/clean/cobertura ao criar artefato; checkpoint de nota |
| `agents/reviewer.md` | secao de preflight do gate final; `evidence_kind` por criterio manual; checkpoint de nota |
| `agents/developer.md` | despacho longo com checkpoint; retorno vazio ou `@` nunca e conclusao; gate da matriz negativa em risco alto; `evidence_kind` no encerramento |
| `workflows/developer-workflow.md` | passo 4 com criterio de saida da matriz; transicao proibida sem matriz; preflight; `evidence kind` na entrega; autorizacao de recuperacao em gates humanos |
| `templates/task-note.md` | gate como comando/exit/head/timestamp; checkpoint antes do limite de passos |
| `templates/task-record.md` | `evidence_kind` por criterio manual e proibicao de contar relato/deferido como satisfeito |
| `tools/validate_resources.py` | invariantes de matriz negativa, `evidence_kind`, checkpoint, preflight e exit code |
| `tests/test_validate_resources.py` | casos positivos e negativos para cada invariante nova |
| `docs/contexto-persistente.md` | secao de checkpoint e tipo de evidencia |
| `README.md`, `README.pt-BR.md`, `code-map.md` | resumo das novas regras e indice atualizado |

## 4. Fases

| Fase | Conteudo | Conclusao |
| --- | --- | --- |
| F1 | P1a: planner, tester, workflow, validador, testes | validador PASS e testes verdes |
| F2 | P1b: reviewer, coder, template de nota, validador, testes | idem |
| F3 | P2a: developer, quatro papeis com nota, workflow | idem |
| F4 | P2b e P2c: planner, reviewer, developer, template de registro, workflow | idem |
| F5 | indices, documentacao e medicao na proxima entrega real | primeira entrega de risco alto medida contra a baseline |

Cada fase exige `agent`/`workflow`/`template` e validador/testes no mesmo
trabalho, conforme `plans/README.md`.

## 5. Validacao

```bash
python3 tools/validate_resources.py
python3 -m unittest discover -s tests -v
git diff --check
```

## 6. Criterios de sucesso (proxima entrega de risco alto)

| Metrica | Baseline da retrospectiva | Alvo |
| --- | --- | --- |
| Campos e limites assinados do plano com caso negativo antes do primeiro `coder` | 0/2 bloqueados so depois | 100% |
| Gates inconclusivos tratados como PASS | 10/23 revisoes inconclusivas; 1 rodada com artefato manual | 0 |
| Retrabalho de formato/clean/cobertura no gate final | 1 ocorrencia (`BINS` + arquivos novos) | 0 rodadas de correcao manual de artefato |
| Retornos com os tres campos | 68/84 | 100%, inclusive interrompidos |
| Retornos por limite de `steps` sem checkpoint na nota | 10/84 | 0 |
| Retorno vazio ou `@` encaminhado como conclusao | 2 | 0 |
| Criterio quantitativo marcado como medido sem serie/comando | 1 | 0 |
| Acao de recuperacao fisica sem autorizacao previa | 1 | 0 |

## 7. Riscos e mitigacoes

| Risco | Mitigacao |
| --- | --- |
| Agentes longos e custo maior | regras curtas, sem repetir o workflow |
| Validador virar checagem de frase sem efeito | mecanizar apenas invariantes que mudam roteamento ou gate |
| Matriz negativa virar burocracia | obrigatoria somente em `risk_profile: high` |
| Preflight atrasar a revisao | roda uma vez, no estado revisado, antes dos gates amplos |
| `relato`/`deferido` virar escape para nao medir | deferimento exige decisao do usuario e o registro nunca conta como satisfeito |
| Checkpoint duplicar a nota | checkpoint e a mesma nota, sob `## Updates` |

## 8. Fora de escopo

- Alterar gates humanos, aprovacao do plano ou politica de commit.
- Alterar permissoes, modelos ou `steps` dos agentes.
- Criar script de preflight automatizado (decidido em Q2).
- Alterar o projeto consumidor (Tab5) ou reexecutar validacao no dispositivo.
- Limpar os backups `.bak` versionados em `agents/`.

## 9. Checkpoint humano

Aplicado com aprovacao do usuario em 2026-11-08 (dúvidas Q1-Q4 respondidas).
Mudanca de comportamento, escopo, compatibilidade ou risco aceito durante a
execucao volta ao usuario.

## 10. Registro de aplicacao (2026-11-08)

| Item | Resultado |
| --- | --- |
| F1 | `planner` com matriz `NEG-*` e `evidence_kind`; `tester` com `cenarios_prontos`; workflow com criterio de saida e transicao proibida |
| F2 | preflight no `reviewer` final; inventario de artefatos no `coder`; gate com exit code no template de nota |
| F3 | checkpoint nos quatro papeis com nota, no template e no despacho do developer |
| F4 | `evidence_kind` no planner, reviewer, developer e template de registro; autorizacao de recuperacao em gates humanos e no tester |
| F5 | `docs/contexto-persistente.md`, READMEs e `code-map.md` atualizados |
| Validador | `ROLE_REQUIRED_RULES`, `REVIEWER_REQUIRED_RULES`, frases novas em `WORKFLOW_PHRASES`, `NOTE_TEMPLATE_PHRASES` e `RECORD_TEMPLATE_PHRASES`; checkpoint por papel |
| Testes | 11 casos novos em `tests/test_validate_resources.py` |
