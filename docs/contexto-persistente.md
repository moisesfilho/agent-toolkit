# Contexto persistente entre agentes

O fluxo de desenvolvimento nao usa mais um contrato de handoff compartilhado.
Cada papel mantem a propria memoria de trabalho e o developer consolida o
resultado no encerramento.

## Memoria da tarefa

- **Nota por papel**: cada papel escreve somente a propria nota em
  `docs/agent-state/<task>/<role>.md`, seguindo `templates/task-note.md`.
- **Registro consolidado**: no encerramento, o developer le as notas e escreve
  `docs/agent-state/<task>.md`, seguindo `templates/task-record.md`. E o
  artefato commitavel e reutilizavel como referencia futura.
- **Um autor por nota**: nao existe arquivo compartilhado de escrita
  concorrente. Trabalho paralelo so e permitido com escopos e notas distintos.
- **Sem limite de linhas**: a nota resume o que e util para retomar a tarefa e
  referencia o resto (plano, diff, logs). Nao copie logs, diffs ou o plano.
- **Nota nao e prova**: "testes passaram" exige comando, resultado e estado do
  codigo. O reviewer confere na fonte e nao aprova com base em resumo.

Projetos que ja possuem convencao de documentacao mantem a propria; o caminho e
confirmado no despacho. `analyst` e `research` sao somente leitura e retornam
`nota: none`.

## Deltas com carimbo de tempo

- A nota cresce por append. Cada nova adicao comeca com data e hora e fuso
  (`YYYY-MM-DD HH:MM ±HH:MM`), para que outro agente identifique o que e novo.
  Alterar apenas o cabecalho `Updated` nao carimba o conteudo novo.
- Quando um fato novo supera uma conclusao anterior, a entrada diz explicitamente
  o que foi **substituido** ou **descartado** e qual e o estado vigente. Assim
  uma pendencia ja resolvida ou uma hipotese abandonada deixa de ser tratada como
  aberta.
- Reescreva o texto anterior somente quando ele estiver ativamente enganoso e
  puder mudar a proxima acao de outro papel: aprovacao, resultado de teste ou
  risco de seguranca.
- Ao ler, aplique a entrada mais recente aplicavel. Antiguidade nao invalida um
  fato: ele permanece valido ate que um delta o substitua ou descarte.
- O registro consolidado carrega apenas o estado vigente; itens substituidos ou
  descartados permanecem no historico das notas.

## Sessoes

- O primeiro despacho de um papel abre uma sessao nova; os seguintes reutilizam
  o mesmo `sessionID` e enviam apenas tarefa, criterio de saida e delta.
- O mapa `role -> sessionID` e efemero e local. Nunca entra em nota, registro ou
  commit.
- Resete a sessao do papel quando a tarefa mudar, o plano for reaprovado, o
  estado ficar stale ou uma hipotese refutada puder enviesar a proxima tentativa.
- Reutilizar a sessao reinicia o orcamento de `steps`, o que evita reconstruir
  contexto depois de um retorno interrompido.
- A compactacao e a nativa do OpenCode, por sessao. Nao ha hook customizado nem
  resumo compartilhado entre papeis.

## Retorno ao developer

Subagentes retornam tres campos sugeridos, sem limite de caracteres:

```text
resultado: <estado do papel>
nota: <caminho da nota>
proximo: <papel ou decisao necessaria>
```

O developer le a nota, confere a evidencia na fonte e roteia. Retorno ambiguo ou
sem nota e lacuna de evidencia: peca uma execucao delimitada em vez de
reinterpretar o resumo.

## O que foi removido

- O antigo contrato de handoff de 15 campos e o seu template.
- O papel de especialista em implementacao; complexidade agora orienta a escolha
  de modelo.
- A validacao estrutural de handoffs, substituida por
  `tools/validate_resources.py`, que verifica papeis, modelos de nota/registro,
  invariantes do workflow e portabilidade.

## Adaptador opcional (OpenCode)

A automacao de sessao (`role -> sessionID`) e a leitura das notas podem ser
oferecidas por um adaptador em `harnesses/opencode/`. Ele e opcional: sem o
adaptador, o fluxo continua valido com reuso manual de sessao pelo developer.
Nao existe hook de compactacao customizado na primeira entrega.
