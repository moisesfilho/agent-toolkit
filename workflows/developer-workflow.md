# Developer Workflow

## Objetivo

Fluxo enxuto para desenvolvimento orientado por requisitos, com implementação,
testes, revisão e checkpoints humanos sem repetir contexto entre agentes.

O `workflow` é a fonte canônica para estados, roteamento, limites e contratos.
Os agentes devem receber apenas o contexto necessário para a etapa atual.

## Fluxo padrão

1. `developer` faz discovery e classifica a solicitação.
2. `planner` resolve ambiguidades técnicas e produz o plano.
3. Gate humano aprova objetivo e plano.
4. `coder` implementa; `coder-expert` só é usado para alta complexidade ou escalação.
5. `tester` cria ou amplia os testes depois da implementação.
6. `reviewer` executa a suíte completa, revisa código e testes.
7. Após `review_approved`, documenta-se a solução e aguarda-se a validação manual final.

O TDD não é obrigatório. Em bugs, o `coder` corrige primeiro, o `tester` cria a
regressão depois e o `reviewer` valida a suíte completa.

## Estados

Estados principais: `discovery`, `clarification`, `planning`, `awaiting_approval`,
`implementation`, `test_creation`, `review`, `correction` e `completed`.

Estados excepcionais sob demanda: `bug_diagnosis`, `bug_reproduction`,
`assisted_reproduction`, `test_refinement`, `tester_disputed`,
`critical_checkpoint`, `blocked` e `cancelled`.

Um handoff válido do Analyst pode seguir diretamente para `planning`; só reabra
o objetivo se existir contradição funcional objetiva.

## Responsabilidades e limites

- `developer`: único orquestrador, mantém o estado canônico e fala com o usuário.
- `planner`: somente leitura; define arquitetura, riscos e cenários de teste.
- `coder`/`coder-expert`: alteram produção, não alteram testes e não executam a suíte completa.
- `tester`: altera somente testes, executa apenas testes criados ou alterados.
- `reviewer`: único agente que executa a suíte completa e aprova ou reprova.
- `analyst`: agente primário opcional; entrega requisitos, não inicia execução.

Transições proibidas: implementação antes do plano aprovado; aprovação com
testes ausentes ou falhando; coder alterando testes; tester alterando produção;
suíte completa executada pelo coder/tester; bug aprovado sem teste de regressão.

## Bugs

Antes do planejamento, o `developer` pode reproduzir o bug sem alterar código.
Preserve somente evidências úteis: `reproduction_status`, passos, esperado,
observado, comandos/resultados, logs sem segredos, ambiente e limitações.
Reprodução assistida exige estratégia de observação antes de pedir ação ao usuário.

## Roteamento de qualidade

- `reviewer -> tester -> reviewer`: teste frágil ou cobertura ausente quando a implementação está correta.
- `reviewer -> coder -> reviewer`: falha ou defeito de produção; depois de uma correção de bug, passe pelo `tester` para criar regressão.
- `tester_disputed`: sempre retorna ao `developer`.
- Limite de três ciclos de correção; depois disso, checkpoint humano.

## Jev

Use `typesafe-jev_jev_decide` somente quando a resposta não for determinada
objetivamente e houver um caso fechado de baixo risco:

- empate real entre alternativas técnicas já delimitadas no plano;
- `blocking_questions` reversíveis;
- classificação de severidade, risco ou cobertura.

Não use Jev para confirmar objetivo, aprovar plano, decidir negócio, credenciais,
deploy, migração, exclusão ou qualquer ação irreversível. Agrupe perguntas
independentes numa chamada. Registre apenas uma linha no handoff:
`jev: pergunta -> resposta/confiança -> decisão`.

## Handoff incremental

O `developer` mantém o contexto canônico. Cada agente retorna no máximo 25 linhas
e repete somente dados alterados. Campos mínimos:

```text
status:
origin:
next_action:
changed: []
commands: []
tests: []
decisions: []
risks: []
blockers: []
```

Use `REQ-*`, `AC-*` e `TEST-*` para referenciar contexto já conhecido, em vez de
copiá-lo. Inclua detalhes de bug somente quando houver alteração ou evidência nova.
Não inclua campos vazios nem diffs, logs ou explicações repetidas.

## Gates humanos

1. Aprovação explícita do objetivo e do plano antes de editar código.
2. Entrega final com diff, testes, riscos residuais e roteiro de validação manual.

Decisões de negócio, escopo, compatibilidade, ações irreversíveis, divergências
conceituais e três ciclos sem convergência exigem intervenção humana.

## Rastreabilidade

Mantenha a referência compacta `REQ -> implementação -> TEST -> REVIEW`.
Para bugs: `BUG_REPORT -> evidência -> correção -> TEST_REGRESSION -> REVIEW`.
