# Developer Workflow

## Objetivo

Configuração global para desenvolvimento orientado por especificações, testes automatizados, loops de execução autônomos, checkpoints inteligentes baseados em risco, revisão técnica rigorosa, documentação e memória técnica.

A ordem padrão de execução é `implementação -> testes -> revisão` (`developer -> coder/coder-expert -> tester -> reviewer`). O TDD não é obrigatório: a criação de testes é responsabilidade do `tester` e ocorre depois da implementação entregue pelo `coder`/`coder-expert`, permanecendo obrigatória antes da aprovação final. Em correções de bug, o teste de regressão é criado depois da correção.

## Agentes

- `developer`: orquestrador e responsável pela máquina de estados, roteamento de handoffs e gestão de loops.
- `planner`: especialista em requisitos, contexto, critérios de aceite e arquitetura.
- `tester`: especialista em testes automatizados, criação e expansão de suítes depois da implementação, refino de testes, testes de regressão de bug, guarda de integridade e qualidade da validação.
- `coder`: especialista na stack do projeto e implementação padrão de código de produção, com verificação local limitada ao contexto alterado e sem execução da suíte de testes.
- `coder-expert`: especialista em algoritmos complexos, concorrência crítica, refatorações arquiteturais profundas e escalação técnica quando o coder encontrar dificuldades.
- `reviewer`: especialista em execução da suíte completa de testes e da regressão, inspeção de qualidade de testes, validação de critérios de aceite, revisão de código, segurança, qualidade técnica, documentação e memória persistente.
- `analyst`: agente primário e independente, acionado manualmente pelo usuário para produzir especificações funcionais detalhadas; não é subagente do `developer`.

## Fluxo de trabalho

1. `developer` recebe a solicitação e inicia `discovery`. Se o usuário tiver executado o `analyst` antes, deve entregar manualmente ao `developer` o handoff com `origin: analyst`.
2. O `developer` reconhece o handoff do Analyst somente quando o contrato estiver completo (`origin`, `status`, `request_type`, `next_action`, `REQ-*` e `AC-*`). Preserva o conteúdo como `analyst_handoff` e o usa como baseline funcional.
3. `requirements_ready` só deve ser emitido pelo Analyst quando objetivo, escopo, conteúdo observável, formato/compatibilidade, critérios de aceite, casos-limite e validação estiverem resolvidos. Decisões funcionais pendentes permanecem em `needs_clarification`.
4. Para handoffs do Analyst, o `developer` encaminha ao `planner` a análise técnica de arquitetura, impactos, dependências, implementação, testes, riscos, observabilidade e limitações de validação. `requirements_ready` não equivale a `objective_confirmed`; os gates humanos continuam obrigatórios.
5. Se a solicitação for uma correção de bug, regressão ou falha observável, `developer` entra em `bug_diagnosis` e `bug_reproduction` antes de delegar ao `planner`, inclusive quando o contexto veio do Analyst.
6. Durante a reprodução, `developer` identifica como executar a aplicação, tenta replicar o cenário e coleta comandos, logs, stack traces, respostas, códigos de saída e contexto de ambiente. A investigação é não destrutiva, limitada por timeout e não altera código de produção ou testes.
7. Se não conseguir reproduzir e verificar o problema localmente, `developer` entra em `assisted_reproduction`. Antes de solicitar a intervenção do usuário, prepara a estratégia de observação e coleta: canal disponível, comandos, filtros, nível de log, timestamps, correlação, evidências esperadas e forma segura de compartilhamento.
8. Só então solicita ao usuário a reprodução no ambiente/dispositivo real, com passos numerados, pré-requisitos, sequência de coleta e instruções do que observar. Analisa os dados em tempo real ou após o envio, evitando pedidos vagos e novas tentativas sem valor diagnóstico.
9. `developer` envia ao `planner` o relato original, o `analyst_handoff` quando existir, fatos observados, passos tentados, resultado da reprodução e hipóteses explicitamente marcadas como hipóteses. Quando não reproduzir, informa `not_reproduced`; se não houver canal viável para observação/coleta, informa `blocked` e as limitações.
10. Para outras solicitações, `developer` encaminha o entendimento ao `planner` diretamente.
11. `planner` inspeciona o contexto e faz perguntas até eliminar ambiguidades relevantes, sem repetir respostas já presentes no handoff do Analyst.
12. `planner` entrega requisitos, critérios de aceite, arquitetura, cenários de teste e riscos, preservando a rastreabilidade `REQ-*`/`AC-*`.
13. Antes de decidir entre alternativas técnicas ou avançar com um plano interno, `developer` consulta obrigatoriamente o Jev para avaliar consistência, aderência aos requisitos, riscos, reversibilidade e manutenção. Com confiança `>= 0.90`, pode adotar automaticamente uma decisão técnica reversível e de baixo risco dentro do escopo aprovado; caso contrário, escala a decisão ao agente responsável ou ao usuário.
14. **Gate Humano 1**: `developer` solicita aprovação explícita do objetivo e do plano ao usuário. A avaliação do Jev não substitui esse gate.
15. Após aprovação do plano, `coder` (ou `coder-expert` para tarefas de complexidade inicial elevada) implementa o código de produção de acordo com as especificações, executa apenas verificações locais limitadas ao contexto alterado e a compilação/build potencialmente afetados, e entrega sem executar a suíte de testes.
16. `tester` cria ou expande a suíte de testes para os requisitos, critérios de aceite e comportamento implementado, mantendo a guarda de integridade dos testes. Em correções de bug, cria o teste de regressão depois da correção já entregue pelo `coder`/`coder-expert`.
17. `reviewer` executa a suíte de testes automatizados e a regressão, inspeciona a qualidade dos testes e do código, analisa segurança, lint e aderência aos critérios de aceite.
18. **Roteamento de Retorno do Reviewer**:
   - **Refinamento/Correção de Testes (`test_refinement_needed`)**: Se o `reviewer` detectar testes frágeis, instáveis, com vazamentos de recursos ou asserções fracas:
     - `developer` aciona o `tester` com o diagnóstico.
     - `tester` julga a solicitação, garante que o propósito do teste não seja subvertido, corrige os testes e, por ter vindo do `reviewer`, **devolve diretamente ao `reviewer`** para reexecução e reavaliação.
     - Se o `tester` considerar que a solicitação subverte o propósito original do teste, responde com `tester_disputed` para mediação do `developer`.
   - **Novos testes necessários (`needs_more_tests`)**: Se o `reviewer` notar cenários/casos de borda, cobertura de requisito ou teste de regressão de bug não cobertos:
     - `developer` aciona o `tester` para criar os novos testes. Se a implementação já cobrir o cenário, o retorno é direto ao `reviewer`; se os testes revelarem implementação ausente ou incorreta, o `developer` aciona o `coder` para implementar as alterações correspondentes $\rightarrow$ `reviewer` reexecuta a suíte e revisa.
   - **Falhas de teste ou código de produção (`needs_correction`)**:
     - `developer` aciona o `coder` para aplicar os ajustes. Caso o `coder` encontre dificuldades persistentes para solucionar, o `developer` escala para o `coder-expert` antes de acionar intervenção humana (limite total de até 3 ciclos de auto-correção).
19. Com a revisão e os testes 100% aprovados (`review_approved`), o `reviewer` atualiza a documentação técnica e a memória do projeto.
20. **Gate Humano 2**: `developer` apresenta o resumo consolidado, resultados dos testes e instruções para validação manual final do usuário.

## Máquina de estados

`discovery` -> (`analyst_handoff` -> `bug_diagnosis` -> `bug_reproduction` -> `assisted_reproduction`, se necessário) -> `clarification` -> `objective_ready` -> `awaiting_objective_confirmation` -> `planning` -> `awaiting_plan_approval` -> `implementation` -> `local_verification` -> `test_creation` -> `autonomous_review` -> `test_refinement` (se teste ruim) -> `correction` (loop auto de código) -> `documentation` -> `memory_update` -> `completed`

`implementation` e `local_verification` precedem `test_creation`: a suíte de testes é criada e ampliada depois da entrega do código, e não antes. `local_verification` cobre apenas as verificações locais do coder/coder-expert limitadas ao contexto alterado e a compilação/build potencialmente afetados. `test_validation` deixa de ser estado próprio: a validação dos testes acontece em `autonomous_review`, executada pelo `reviewer`.

Em correções de bug, o ciclo é `implementation` (correção) -> `test_creation` (teste de regressão) -> `autonomous_review`, garantindo que o teste de regressão seja criado depois da correção e validado na suíte completa.

`analyst_handoff` é um marcador de contexto dentro de `discovery`, não um agente ou uma nova sessão filha. O fluxo manual continua sendo `usuário -> analyst -> developer -> planner`.

Estados alternativos: `tester_disputed`, `critical_checkpoint` (parada intermediária por risco/exceção), `blocked` e `cancelled`.

Transições proibidas:
- Planejamento técnico antes da confirmação explícita do objetivo.
- Criação de testes ou implementação antes da aprovação do plano.
- Exigir TDD ou testes prévios do `tester` para autorizar ou iniciar a implementação.
- Coder ou coder-expert executar a suíte completa de testes ou a regressão completa.
- Coder alterar ou enfraquecer arquivos de teste.
- Tester alterar arquivos de código de produção.
- Concluir a implementação sem testes do `tester` cobrindo os requisitos antes da revisão final.
- Correção de bug aprovada sem teste de regressão criado pelo `tester` e validado na suíte completa.
- Conclusão da tarefa com testes falhando, revisão reprovada ou riscos críticos sem tratamento.

## Diagnóstico e Reprodução de Bugs

O diagnóstico prévio existe para melhorar a precisão do planejamento, não para substituir a análise do `planner` nem para antecipar decisões de implementação.

O teste de regressão de um bug não é exigido antes da correção: o `coder`/`coder-expert` corrige, o `tester` cria o teste de regressão usando as evidências de reprodução registradas abaixo e o `reviewer` valida, na suíte completa, que o teste falha sem a correção e passa com ela. O teste de regressão deve ser derivado de `expected_behavior`, `observed_behavior` e `reproduction_steps`, e não de hipóteses não confirmadas.

O `developer` deve registrar no handoff, quando aplicável:

- `bug_report`: relato original e contexto fornecido pelo usuário.
- `reproduction_status`: `reproduced`, `partially_reproduced`, `not_reproduced` ou `blocked`.
- `reproduction_steps`: comandos e sequência exata usada.
- `expected_behavior` e `observed_behavior`: comparação objetiva.
- `commands_run`: comandos executados e códigos de saída.
- `logs_and_errors`: logs, stack traces, respostas e timestamps relevantes, sem segredos.
- `environment`: sistema, versões, dependências e configuração não sensível relevante.
- `initial_hypotheses`: hipóteses derivadas das evidências, nunca apresentadas como causa confirmada.
- `evidence_limitations`: dados ausentes, diferenças de ambiente e razões para eventual bloqueio.
- `observation_strategy`: canal, comandos, filtros, timestamps, correlação e evidências esperadas para a reprodução assistida.
- `user_actions_requested`: passos solicitados ao usuário e pré-requisitos para executá-los.

O `developer` pode iniciar e encerrar processos locais, executar testes e fazer chamadas não destrutivas necessárias à reprodução. Na reprodução assistida, deve preparar a coleta antes de pedir a ação do usuário, reduzir o risco de perda de evidências, evitar segredos e definir como os dados serão devolvidos. Deve usar timeout, evitar efeitos persistentes e limpar processos/recursos iniciados. Operações destrutivas, migrações, deploys ou mudanças permanentes exigem autorização e checkpoint crítico.

## Loops e Autonomia

### Uso obrigatório do Jev

Sempre que houver alternativas técnicas, priorização ou um plano interno a avaliar, o `developer` deve consultar `typesafe-jev_jev_decide` antes de escolher ou avançar. A consulta deve usar estado mínimo e perguntas atômicas e avaliar aderência aos requisitos, riscos, reversibilidade, custo de manutenção e impacto no fluxo.

O `developer` pode seguir sem nova pergunta ao usuário quando o Jev retornar confiança `>= 0.90` para uma alternativa ou avaliação técnica do plano, desde que a decisão seja reversível, de baixo risco e não altere objetivo, escopo, requisitos, negócio, arquitetura aprovada ou critérios de aceite. A confiança não autoriza o Jev a substituir a confirmação do objetivo ou a aprovação humana do plano geral.

Cada consulta deve ser registrada no handoff com pergunta, alternativas ou plano avaliado, resposta, confiança, decisão e motivo de eventual escalonamento. Se a confiança for insuficiente, houver empate, erro do MCP ou checkpoint humano, a decisão deve ser escalada sem inventar uma resposta.

### 1. Requisitos e Alinhamento
O `planner` repete inspeção e perguntas até que o objetivo, restrições e critérios de aceite sejam verificáveis e aprovados pelo usuário.

### 2. Implementação
O `coder` é o agente padrão de implementação. O `coder-expert` é reservado para demandas pré-identificadas de alta complexidade técnica ou como escalação técnica quando o `coder` estiver travado. Ambos entregam o código implementado sem executar a suíte de testes: podem rodar apenas verificações locais limitadas ao contexto alterado e a compilação/build potencialmente afetados, sempre registradas em `commands_run`.

### 3. Criação e Ajuste de Testes
O `tester` cria e amplia a suíte depois da implementação entregue, e cria o teste de regressão depois da correção de um bug. Ele executa apenas os testes que criou ou alterou, preservando o propósito dos testes existentes, e nunca altera código de produção.

### 4. Execução de Testes, Revisão e Ciclos de Qualidade
O `reviewer` é o responsável exclusivo por rodar a suíte de testes automatizados, a regressão completa e a inspeção de qualidade de código e testes.
- **Fluxo padrão**: `coder` (implementa) $\rightarrow$ `tester` (cria/expande) $\rightarrow$ `reviewer` (suíte completa e revisão).
- **Se teste ruim/instável/vazamento**: `reviewer` $\rightarrow$ `tester` (refina) $\rightarrow$ `reviewer`.
- **Se novos cenários necessários e implementação já correta**: `reviewer` $\rightarrow$ `tester` (cria) $\rightarrow$ `reviewer`.
- **Se novos cenários necessários e implementação incompleta**: `reviewer` $\rightarrow$ `tester` (cria) $\rightarrow$ `coder` (implementa) $\rightarrow$ `reviewer`.
- **Se bug no código**: `reviewer` $\rightarrow$ `coder` (corrige) [ou `coder-expert` se escalado] $\rightarrow$ `tester` (cria o teste de regressão) $\rightarrow$ `reviewer`.
- O sistema opera autonomamente por até **3 ciclos**. Persistindo o problema ou em caso de `tester_disputed` com impacto em regras de negócio, o `developer` aciona o usuário.

## Política de Checkpoints Inteligentes

### Checkpoints Autônomos (Internos)
- Execução e validação de testes automatizados pelo `reviewer`.
- Refinamento de testes pelo `tester` com retorno direto ao `reviewer`.
- Criação e expansão da suíte pelo `tester` depois da implementação, e teste de regressão depois da correção de bug.
- Verificações locais limitadas ao contexto alterado e compilação/build potencialmente afetados pelo `coder`/`coder-expert`.
- Ajustes de implementação e correções de código.
- Escalação controlada de `coder` para `coder-expert`.
- Ciclos de correção de revisão (até 3 tentativas).
- Geração de documentação e atualização de memória.

### Checkpoints Críticos (Humanos / Síncronos)
1. **Confirmação de Objetivo e Plano**: Alinhamento inicial de escopo e arquitetura antes de qualquer código ser escrito.
2. **Entrega Final**: Apresentação de diff consolidado, evidências de testes e roteiro de validação manual.
3. **Paradas por Exceção**:
   - Dúvidas impeditivas ou decisões de negócio não previstas.
   - Três ciclos de auto-correção sem convergência.
   - `tester_disputed` com divergência conceitual sobre requisitos.
   - Ações de alto risco explicitamente marcadas no plano (ex.: migração de banco irreversível).

## Compactação e Handoff

- O `developer` mantém contexto enxuto após cada chamada, preservando apenas objetivo, critérios de aceite, decisões, arquivos alterados, resultados de testes, pendências e riscos. Em correções de bug, preserva também as evidências de reprodução e suas limitações.
- Todo agente deve retornar metadados estruturados de origem, ação e próximo destino (`status`, `origin`, `objective`, `requirements`, `files_changed`, `commands_run`, `tests`, `decisions`, `risks`, `blockers`, `next_action`). Handoffs de bug incluem ainda `bug_report`, `reproduction_status`, `reproduction_steps`, `expected_behavior`, `observed_behavior`, `logs_and_errors`, `environment`, `initial_hypotheses`, `observation_strategy`, `user_actions_requested` e `evidence_limitations`.
- O handoff manual do Analyst deve incluir `origin: analyst`, `status`, `request_type`, `next_action`, requisitos `REQ-*` e critérios `AC-*`. `requirements_ready` não confirma o objetivo nem autoriza execução.

## Rastreabilidade

Cada requisito segue a cadeia na ordem padrão `implementação -> testes -> revisão`: `REQ-001 -> implementação -> TEST-001 -> REVIEW-001`.

Cada bug segue a cadeia: `BUG_REPORT -> BUG_EVIDENCE -> REQ -> IMPLEMENTATION_CORRECTION -> TEST_REGRESSION -> REVIEW`, com o teste de regressão sempre criado depois da correção e validado na suíte completa pelo `reviewer`.

## Documentação e Memória Técnica

Ao finalizar, o `reviewer` documenta a solução, registra decisões arquiteturais, limitações e riscos residuais, atualizando a memória persistente do projeto com informações verificadas.
