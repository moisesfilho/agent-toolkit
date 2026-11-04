# Plano: melhorias na iteracao dos agentes

- Status: **concluido** - F1, F2 e F3 aplicadas, validadas e commitadas em
  2026-11-04 (um commit por item; ver secao 10)
- Data de abertura: 2026-11-04
- Origem: retrospectiva de uma sessao de desenvolvimento no projeto cyberdeck5
  (firmware ESP32-P4), com 4 entregas e 27 despachos de subagente
- Escopo: `agents/`, `templates/handoff-contract.md`,
  `workflows/developer-workflow.md`

## 1. Linha de base medida

| Metrica | Valor observado |
| --- | --- |
| Despachos totais | 27 (11 coder, 7 tester, 9 reviewer) |
| Despachos encerrados por limite de passos | 3/27 (coder 2/11, tester 1/7, reviewer 0/9) |
| Revisoes finais com blocker | 3/7 |
| Blockers da classe "valor estatico obsoleto" | 3/3 |
| Aprovacoes com blocker | 0/7 |
| Gate stale (evidencia de outro commit) | 1/7 |
| Mutacoes que revelaram lacuna de teste real | 1/8 |
| Defeitos que so a validacao fisica mostrou | 2 |
| Despachos gastos pedindo handoff de execucao em background | 1 |
| Handoffs fora do formato acordado | 2/27 |
| Ciclos corretivos | 3 |

## 2. Problemas observados

- **P1 - Pin de snapshot.** Testes e documentacao fixam um valor instantaneo em
  vez de derivar da fonte: contagem de alvos do harness, versao exata do
  firmware, limiar copiado em texto. Cada mudanca intencional quebra o gate e
  custa um ciclo corretivo completo (fix, revalidacao, re-revisao).
- **P2 - Orcamento de passos.** Despachos que somam producao, suite de testes,
  documentacao e build estouram o limite do papel e retornam estado parcial; a
  continuacao precisa reconstruir contexto.
- **P3 - Serializacao por worktree compartilhado.** O reviewer executa gates
  amplos no worktree vivo, bloqueando o developer por dezenas de minutos, e
  ainda produz falso positivo quando o developer trabalha.
- **P4 - Criterio de aceite no nivel do modelo.** "Percentual estavel" sem
  resolucao de amostragem nem exigencia de atingir os extremos deixou passar dois
  defeitos que so apareceram no hardware, com suite e CI verdes.
- **P5 - Evidencia reaproveitada.** Cobertura citada de um commit anterior ao
  head revisado, sem marcar a origem.
- **P6 - Retorno de execucao em background.** A conclusao chegou ambigua e um
  despacho inteiro foi gasto apenas para obter o handoff.
- **P7 - Teste de fronteira fraco.** Um caso que deveria distinguir bordas
  passava com dois valores do mesmo intervalo.
- **P8 - Documentacao como copia da constante.** Um limiar mudou e oito sitios
  de documentacao ficaram para tras, incluindo o indice de simbolos.

## 3. Mudancas propostas

| ID | Arquivo alvo | Mudanca | Evidencia |
| --- | --- | --- | --- |
| B1 | `agents/tester.md` | Proibir pin de snapshot: derivar da fonte ou asserir a propriedade, mantendo a expectativa exata; contrato textual nao repete constante sem derivacao. | P1 |
| B2 | `agents/coder.md` | Mesma regra para testes escritos pelo coder; ao aproximar do orcamento de passos, entregar producao e testes focados com handoff parcial. | P1, P2 |
| B3 | `agents/developer.md` | Dimensionar despacho pelo orcamento do papel (coder 70, tester 50): separar producao + focados de documentacao + build. | P2 |
| B4 | `templates/handoff-contract.md` | Campo opcional `remaining:` para despachos interrompidos. Exige atualizar `tools/validate_handoffs.py` e `tests/test_validate_handoffs.py`. | P2 |
| B5 | `agents/reviewer.md` | Gates em worktree destacado no SHA revisado, em vez de compilar o worktree do developer. | P3 |
| B6 | `agents/planner.md` | Criterio de aceite observavel: todo valor exposto ao usuario declara resolucao de medicao e que os extremos da escala sejam atingiveis. | P4 |
| B7 | `agents/reviewer.md` | Cobertura e gates sempre do mesmo run do head; reutilizacao exige citar o SHA de origem. | P5 |
| B8 | `agents/reviewer.md` | Handoff duravel em arquivo de trabalho quando a execucao for em background, alem da resposta. | P6 |
| B9 | `agents/tester.md` | Teste de fronteira prova sensibilidade: mutacao obrigatoria trocando o par por dois valores do mesmo intervalo. | P7 |
| B10 | `agents/developer.md` | Mudanca de valor de dominio aciona varredura da documentacao pelo valor antigo antes de fechar o ciclo. | P8 |

### Redacoes de referencia

B1 (apos "Nunca remova cenarios ou enfraqueca assercoes"):

> Nao fixe valores instantaneos (contagem de alvos, total de TUs, versao exata,
> limiar literal). Derive da fonte (Makefile, header, `version.txt`) ou asserir a
> propriedade que importa, mantendo a expectativa exata. Contrato textual nao
> repete constante sem derivar dela.

B2 (apos "Implemente também testes unitários/de componente e regressões"):

> Testes escritos pelo coder seguem a regra anti-pin: nao copie contagem de
> alvos, versao exata ou limiar literal; derive da fonte e mantenha a
> expectativa exata. Se o orcamento de etapas estiver proximo do fim, pare antes
> da documentacao e entregue producao mais testes focados, com handoff parcial
> em `remaining`.

B3:

> Dimensione o despacho pelo orcamento do papel. Quando o escopo somar producao,
> suite de testes, documentacao e build, divida em dois despachos e instrua:
> ao aproximar do limite, pare e entregue producao mais testes focados, com
> handoff parcial.

B4 (campo novo no bloco do contrato):

```text
remaining: [<proximo passo verificavel>]
```

- Chave **opcional**: ausente quando o despacho concluiu; presente apenas em
  retorno interrompido por limite, timeout ou dependencia externa.
- Lista de strings; nao e roteamento (`next_action` continua escalar unico) nem
  substitui `blockers`.
- `tools/validate_handoffs.py` precisa aceitar a chave e validar o tipo (lista
  de strings nao vazias); handoffs existentes sem a chave seguem validos. O
  validador nao policia chaves desconhecidas hoje, e este campo nao muda isso.
- `tests/test_validate_handoffs.py` ganha um caso positivo (lista valida) e ao
  menos dois negativos (string escalar; item vazio). O caso "handoff sem
  `remaining`" deve continuar passando.

B6:

> Todo `AC-*` sobre valor visivel declara a resolucao de medicao (por exemplo,
> amostragem de 1 s por N minutos) e a exigencia de que os extremos da escala sejam atingiveis.
> Criterio que apenas compara com o modelo nao e suficiente.

## 4. Fases

| Fase | Itens | Motivo da ordem |
| --- | --- | --- |
| F1 | B1, B2, B3, B4 | ataca a causa raiz do retrabalho observado; baixo risco |
| F2 | B5, B6, B7 | muda fluxo e custo de planejamento; precisa de evidencia propria |
| F3 | B8, B9, B10 | robustez de retorno, testes e documentacao |

Cada fase e aprovada e aplicada separadamente, com o repositorio em estado
validado ao final. Excecao registrada na secao 8: em 2026-11-04 as tres fases
foram aprovadas e aplicadas na mesma sessao.

### F1 - detalhamento executavel (aprovada e aplicada)

Objetivo: eliminar a classe de blocker "valor estatico obsoleto" e o encerramento
por limite de etapas, sem tocar em regras de aprovacao, permissoes ou gates.

| Item | Arquivo | Acao |
| --- | --- | --- |
| B1 | `agents/tester.md` | inserir a redacao B1 apos "Nunca remova cenarios ou enfraqueca assercoes" |
| B2 | `agents/coder.md` | inserir a redacao B2 apos a frase que autoriza testes focados do coder |
| B3 | `agents/developer.md` | inserir a redacao B3 no passo de despacho (item 5), junto das regras de handoff |
| B4 | `templates/handoff-contract.md`, `tools/validate_handoffs.py`, `tests/test_validate_handoffs.py` | campo `remaining:` conforme o schema da secao 3, com validador e testes no mesmo commit |

Progresso: **F1 aplicada** - B1 em `agents/tester.md`, B2 em
`agents/coder.md`, B3 em `agents/developer.md`; B4 (`remaining` no template,
validador e 5 testes) ja estava aplicado.

Sequenciamento (um commit por linha):

1. B1 + B2 - mesma classe de defeito, um arquivo de papel cada.
2. B3 - regra de orcamento e handoff parcial.
3. B4 - contrato mais validador mais testes; e o unico item que pode quebrar CI.

Definicao de pronto da F1:

```bash
python3 tools/validate_handoffs.py          # exit 0
python3 -m unittest discover -s tests -v    # todos os testes OK
git diff --check                            # limpo
```

Alem disso: `steps` dos agentes inalterado; nenhum campo obrigatorio removido;
nenhuma mudanca em `review_mode`, regras de aprovacao ou validacao fisica;
checagem de links do CI com rc=0.

Criterio de reversao: se em duas entregas o total de despachos crescer mais de
20% sem reduzir blockers nem retornos por limite, reverter B3 e manter B1/B2.

### F2 - detalhamento executavel (aprovada e aplicada)

Objetivo: cortar o custo de serializacao e de retrabalho de medicao (P3, P4, P5)
sem afrouxar gates.

| Item | Arquivo | Acao aplicada |
| --- | --- | --- |
| B5 | `agents/reviewer.md`, `workflows/developer-workflow.md` | gates amplos em worktree destacado no estado revisado (`git worktree add --detach`); worktree sujo exige snapshot imutavel do diff; build nativo caro pode ficar no worktree principal com a excecao registrada |
| B6 | `agents/planner.md` | todo `AC-*` sobre valor visivel declara resolucao de medicao e exige que os extremos da escala sejam atingiveis |
| B7 | `agents/reviewer.md`, `templates/handoff-contract.md`, `workflows/developer-workflow.md` | cobertura e gates do mesmo run do `head` revisado; reuso cita o estado de origem e exige estado atual inalterado; evidencia de outro snapshot e stale |

### F3 - detalhamento executavel (aprovada e aplicada)

Objetivo: robustez de retorno, sensibilidade de teste e consistencia de
documentacao (P6, P7, P8).

| Item | Arquivo | Acao aplicada |
| --- | --- | --- |
| B8 | `agents/reviewer.md` | em execucao background, handoff duravel no arquivo de trabalho indicado no dispatch, alem da resposta; shell apenas para esse arquivo; o arquivo nao e aprovacao |
| B9 | `agents/tester.md` | teste de fronteira prova sensibilidade com mutacao obrigatoria (dois valores do mesmo intervalo ou comparacao invertida); mutacao sobrevivente vira assercao ajustada ou lacuna em `risks` |
| B10 | `agents/developer.md`, `workflows/developer-workflow.md` | mudanca de valor de dominio varre documentacao, README e indices pelo valor antigo antes de fechar o ciclo |

## 5. Criterios de sucesso

Medidos em duas entregas reais apos a fase aplicada:

| Metrica | Baseline | Alvo |
| --- | --- | --- |
| Blockers "valor estatico obsoleto" | 3/3 revisoes finais | 0 |
| Despachos encerrados por limite de passos | 3/27 | 0 |
| Defeitos descobertos so no hardware | 2 | 0 |
| Gate stale | 1/7 | 0 |
| Despachos gastos pedindo handoff | 1 | 0 |
| Mutacoes que revelam lacuna real | 1/8 | todas detectadas |

## 6. Como validar

1. Aplicar F1 e rodar **duas** entregas de escopo parecido com a de origem:
   mudanca de comportamento com teste, documentacao e build, uma delas com
   validacao no dispositivo.
2. Registrar, por entrega, as metricas da secao 5 e o total de despachos.
3. Comparar com a linha de base da secao 1 e decidir:
   - metricas na faixa alvo e total de despachos estavel ou menor: promover F2;
   - metricas na faixa alvo com mais despachos: manter F1 e investigar B3 antes
     de abrir F2;
   - metricas fora do alvo: aplicar o criterio de reversao da F1.

## 7. Riscos e mitigacoes

| Risco | Mitigacao |
| --- | --- |
| B1 lido como "proibido asserir valor" e enfraquecer testes | redacao explicita: proibido duplicar o literal, obrigatorio derivar ou asserir propriedade |
| B3 aumenta o numero de despachos e o overhead de contexto | medir despachos totais, nao apenas falhas; reverter se subir sem ganho |
| B5 duplica build (custo de disco e tempo em projetos nativos) | usar worktree para gates de host e manter o build caro no worktree principal |
| B6 encarece o planejamento | aplicar apenas a valores visiveis ao usuario |
| B4 quebra o validador de handoffs | mudar contrato, validador e testes no mesmo commit |

## 8. Decisoes

- Resolvido em 2026-11-04: F1 (B1 a B3) aprovada e aplicada; B4 ja estava
  aplicado.
- Resolvido: o campo `remaining` foi autorizado; e opcional e convive com
  `blockers` (`blockers` = o que impede concluir; `remaining` = passos
  verificaveis pendentes).
- Resolvido em 2026-11-04: F2 e F3 foram aplicadas neste mesmo plano, por pedido
  explicito do usuario ("implemente todas as fases"), sem aguardar a janela de
  medicao de F1. As metricas das secoes 5 e 6 seguem valendo para decidir a
  reversao de B3 e os proximos ajustes.
- Resolvido em 2026-11-04: alteracoes commitadas por item, sem push; os SHAs
  estao na secao 10.

## 9. Fora de escopo

- Alterar regras de aprovacao, de revisao final ou de validacao fisica.
- Mudar permissoes, modelos ou limites de passos dos agentes.
- Qualquer alteracao em projetos consumidores.

## 10. Registro de aplicacao (2026-11-04)

Itens e arquivos alterados: B1 e B9 em `agents/tester.md`; B2 em
`agents/coder.md`; B3 e B10 em `agents/developer.md`; B5, B7 e B8 em
`agents/reviewer.md`; B6 em `agents/planner.md`; B7 tambem em
`templates/handoff-contract.md`; B5, B7 e B10 tambem em
`workflows/developer-workflow.md`; B4 ja estava aplicado.

Commits (2026-11-04, sem push):

| Item | Commit |
| --- | --- |
| B1 + B2 | `c3135b5` Prohibit snapshot pins in tester and coder tests |
| B3 | `6b63629` Size dispatches by the role step budget |
| B5 | `74151a6` Run broad review gates in a detached worktree |
| B6 | `5f1d3c1` Require measurement resolution for visible acceptance criteria |
| B7 | `aa4ff22` Tie reused gate evidence to its origin state |
| B8 | `a825061` Persist background review handoffs to a work file |
| B9 | `b9fb724` Require a boundary mutation in tester scenarios |
| B10 | `584d3da` Sweep documentation when a domain value changes |
| B4 | `27a60f0` Add an optional remaining field to the handoff contract |

Validacao executada (tambem a cada commit):

```bash
python3 tools/validate_handoffs.py          # PASS
python3 -m unittest discover -s tests       # 27 testes OK
git diff --check                            # limpo
```

- `steps` dos agentes inalterado (developer 60, planner 30, coder 70,
  tester 50, reviewer 70); nenhum campo obrigatorio removido; nenhuma mudanca em
  `review_mode`, regras de aprovacao, permissoes ou validacao fisica.
- Achado adjacente nao aplicado: `agents/coder-expert.md` nao recebeu B2 porque o
  plano lista apenas `agents/coder.md`. A regra anti-pin e o handoff parcial em
  `remaining` deveriam valer tambem para o coder-expert em um proximo ciclo.
