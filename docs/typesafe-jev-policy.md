# Politica de uso do TypeSafe Jev

O MCP `typesafe-jev_jev_decide` e uma ferramenta de apoio a decisoes estruturadas. Use-o apenas quando houver uma decisao semantica que nao seja determinada diretamente por regras, documentacao ou comandos.

## Regras gerais

- Use o Jev apenas quando houver decisao semantica que nao seja determinada por regras, documentacao, comandos ou resultados de testes.
- Use Jev proativamente nos gatilhos abaixo quando a resposta puder mudar a
  proxima acao; omita-o se for objetiva, trivial ou nao alterar a decisao.
- Envie somente o estado minimo necessario e formule perguntas atomicas.
- Ao chamar `typesafe-jev_jev_decide`, envie `questions` como mapa
   `{id: {type, instructions, criteria}}`, nunca como array. `type` fica na
   pergunta, nunca em `criteria`.
- No schema desta ferramenta, `choice` aceita `criteria` como objeto opcional,
  `score` aceita `criteria` como array opcional e `noul` aceita `criteria` como
  objeto opcional ou omitido.
- Use `noul` para condicoes booleanas, `choice` para alternativas fechadas e `score` para severidade, risco ou cobertura ordenada.
- Prefira uma unica chamada com varias perguntas independentes quando isso reduzir latencia sem misturar decisoes.
- Limiares de automacao:
  - `noul`: probabilidade de resposta positiva `>= 0.90` (o `noul` nao expoe `confidence` separado).
  - `choice` e `score`: `confidence >= 0.90`.
  - Em qualquer tipo, exige-se decisao reversivel, de baixo risco e dentro do escopo aprovado.
- Registre no handoff a pergunta, resposta, probabilidade/confianca, decisao adotada e eventual motivo de escalonamento.
- Se o MCP falhar ou a confianca for insuficiente, escolha um default
  conservador, reversivel e dentro do plano quando isso nao alterar resultado,
  escopo ou risco aceito; registre a premissa. Caso contrario, encaminhe ao
  agente responsavel ou ao usuario.

## Nunca delegar ao Jev

Nao use o Jev para confirmar objetivo, escopo, requisitos, criterios de aceite ou aprovacao de plano. Nao use para decisoes de negocio, credenciais, deploy, migracao, exclusao, alteracao irreversivel, quebra de compatibilidade ou qualquer checkpoint explicitamente humano.

## Limites por agente

- `developer`: pode orquestrar decisoes tecnicas locais e resolver `blocking_questions` de baixo risco.
- `planner`: pode escolher defaults tecnicos conservadores, mas nao pode fechar objetivo, escopo, requisitos ou aprovacao do plano.
- `coder` e `coder-expert`: podem escolher alternativas reversiveis ja contidas no plano. Nao podem ampliar escopo nem substituir testes ou revisao.
- `tester`: pode priorizar casos de borda, risco de regressao e lacunas de cobertura. Nao pode remover cenarios nem enfraquecer assercoes.
- `reviewer`: pode classificar severidade, risco residual e prioridade de correcoes. Nao pode aprovar com testes falhando ou substituir um gate humano.
- `minimal`: nao usa ferramentas, mesmo que a permissao global do MCP exista.

## Gatilhos de baixo custo

Use uma chamada Jev somente quando a resposta nao for determinada por regras,
documentacao, comandos ou testes e houver uma decisao reversivel e de baixo risco:

- empate real entre alternativas tecnicas ja delimitadas no plano;
- selecao entre alternativas viaveis quando a abordagem aprovada falhar ou
  revelar risco impeditivo, desde que a escolha seja de baixo risco e nao mude
  escopo, comportamento ou risco aceito;
- `blocking_questions` que nao alterem escopo ou comportamento;
- classificacao de severidade, risco residual ou cobertura.

Agentes devem resolver blocking questions nao materiais sem consultar o usuario:
use contexto, Jev quando aplicavel ou um default reversivel conservador. So
escale se a decisao puder alterar comportamento, escopo, compatibilidade, risco
aceito ou gate humano. Agrupe perguntas independentes na mesma chamada. Registre no handoff uma linha
compacta no formato `jev: pergunta -> resposta/confianca -> decisao`. Nao releia
a skill de TypeSafe se ela ja estiver no contexto da sessao.

Quando nao houver alternativa aprovada viavel, retorne ao planner para propor
outra abordagem. Se a alternativa alterar escopo, comportamento, compatibilidade
ou risco material, pare e obtenha esclarecimento/aprovacao humana; Jev nao
substitui esse checkpoint. O fluxo deve tentar alternativas dentro do limite
de ciclos do workflow e nao repetir uma abordagem que falhou sem nova evidencia.
