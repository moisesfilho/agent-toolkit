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
4. Para risco alto, `tester` define os cenários de aceitação e regressão antes
   da implementação; isso não torna TDD obrigatório para tarefas simples.
5. `coder` implementa; `coder-expert` só é usado para alta complexidade ou escalação.
6. `tester` cria ou amplia os testes conforme os cenários aprovados.
7. `reviewer` executa a suíte completa, revisa código e testes e integra a
   validação ao quality gate de CI/CD quando houver um pipeline funcional.
8. Após `review_approved`, documenta-se a solução e aguarda-se a validação manual final.

O TDD não é obrigatório. Em bugs, o `coder` corrige primeiro, o `tester` cria a
regressão depois e o `reviewer` valida a suíte completa.

## Estados

Estados principais: `discovery`, `clarification`, `planning`, `awaiting_approval`,
`test_specification`, `implementation`, `test_creation`, `review`, `correction`
e `completed`.

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
- `reviewer`: único agente que executa a suíte completa, revisa o quality gate
  e aprova ou reprova. Pode criar commit e fazer push somente em branches de
  trabalho, nunca em `main` ou `master`.
- `analyst`: agente primário opcional; entrega requisitos, não inicia execução.

No discovery, classifique `risk_profile` como `low`, `medium` ou `high`. Use
`high` para mudanças de contrato, segurança, dados, concorrência, integrações
externas, comportamento crítico ou bugs com impacto relevante. O perfil deve
determinar a profundidade do plano, os cenários exigidos e a validação do gate;
não deve ser usado para dispensar testes necessários.

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
- Se o quality gate estiver pendente ou falhar, o `reviewer` retorna ao agente
  responsável pela correção e não aprova a mudança.
- Se não houver quality gate funcional, o `reviewer` retorna ao `developer` com
  uma proposta de criação ou ajuste do pipeline e as ferramentas necessárias.
- Limite de três ciclos de correção; depois disso, checkpoint humano.

## Quality gate e CI/CD

Durante a revisão, o `reviewer` deve identificar a stack, os comandos e as
convenções do projeto e verificar se o CI/CD valida, quando aplicável:

- formatação e validação de sintaxe;
- lint e typecheck;
- testes unitários, integração e regressão;
- build e empacotamento;
- análise de code smells, complexidade, duplicação, vulnerabilidades e outros
  padrões de qualidade relevantes para a tecnologia utilizada.

Use plugins, analisadores e ferramentas já adotados pelo projeto. Quando não
existirem, sugira opções compatíveis com a stack e registre o motivo, o escopo
e os comandos esperados; não introduza uma ferramenta genérica sem justificar
o benefício e o custo de manutenção.

Depois das verificações locais, o `reviewer` pode executar `git commit` e
`git push` para uma branch de trabalho, como `developer` ou uma branch de
feature, para disparar e acompanhar o quality gate remoto. Antes disso, deve
confirmar a branch atual, revisar o diff e o status, incluir somente alterações
intencionais e não expor segredos. É proibido fazer commit ou push em `main`,
`master` ou qualquer branch de produção, bem como usar force push.

O quality gate remoto deve ser acompanhado até um estado conclusivo quando a
integração permitir. Gate pendente, falho, não disparado ou não verificável é
uma validação incompleta e impede `review_approved`. O handoff deve registrar
a branch, commit, workflow ou check, URL ou identificador quando disponível,
resultado, validações não executadas e riscos residuais.

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
quality_gate: []
decisions: []
risks: []
blockers: []
```

Use `REQ-*`, `AC-*` e `TEST-*` para referenciar contexto já conhecido, em vez de
copiá-lo. Inclua detalhes de bug somente quando houver alteração ou evidência nova.
Não inclua campos vazios nem diffs, logs ou explicações repetidas.
Para cada requisito relevante, preserve a referência compacta
`REQ/AC -> TEST -> resultado/evidência`; em risco alto, inclua também os
cenários negativos, de limite e de falha esperada.

## Gates humanos

1. Aprovação explícita do objetivo e do plano antes de editar código.
2. Entrega final com diff, testes, riscos residuais e roteiro de validação manual.

Decisões de negócio, escopo, compatibilidade, ações irreversíveis, divergências
conceituais e três ciclos sem convergência exigem intervenção humana.

## Rastreabilidade

Mantenha a referência compacta `REQ -> implementação -> TEST -> REVIEW`.
Para bugs: `BUG_REPORT -> evidência -> correção -> TEST_REGRESSION -> REVIEW`.
