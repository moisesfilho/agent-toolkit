# Politica de uso do TypeSafe Jev

O MCP `typesafe-jev_jev_decide` e uma ferramenta de apoio a decisoes estruturadas. Use-o apenas quando houver uma decisao semantica que nao seja determinada diretamente por regras, documentacao ou comandos.

## Regras gerais

- Use o Jev apenas quando houver decisao semantica que nao seja determinada por regras, documentacao, comandos ou resultados de testes.
- Use o Jev de forma proativa ao longo do ciclo, nao apenas diante de `blocking_questions`.
- Envie somente o estado minimo necessario e formule perguntas atomicas.
- Use `noul` para condicoes booleanas, `choice` para alternativas fechadas e `score` para severidade, risco ou cobertura ordenada.
- Prefira uma unica chamada com varias perguntas independentes quando isso reduzir latencia sem misturar decisoes.
- Limiares de automacao:
  - `noul`: probabilidade de resposta positiva `>= 0.90` (o `noul` nao expoe `confidence` separado).
  - `choice` e `score`: `confidence >= 0.90`.
  - Em qualquer tipo, exige-se decisao reversivel, de baixo risco e dentro do escopo aprovado.
- Registre no handoff a pergunta, resposta, probabilidade/confianca, decisao adotada e eventual motivo de escalonamento.
- Se o MCP falhar, a confianca for insuficiente ou houver empate relevante, nao invente uma resposta: encaminhe a decisao ao agente responsavel ou ao usuario.

## Nunca delegar ao Jev

Nao use o Jev para confirmar objetivo, escopo, requisitos, criterios de aceite ou aprovacao de plano. Nao use para decisoes de negocio, credenciais, deploy, migracao, exclusao, alteracao irreversivel, quebra de compatibilidade ou qualquer checkpoint explicitamente humano.

## Limites por agente

- `developer`: pode orquestrar decisoes tecnicas locais e resolver `blocking_questions` de baixo risco.
- `planner`: pode analisar alternativas tecnicas, mas nao pode fechar objetivo, escopo, requisitos ou aprovacao do plano.
- `coder` e `coder-expert`: podem escolher entre alternativas de implementacao ja contidas no plano aprovado. Nao podem ampliar escopo nem substituir testes ou revisao.
- `tester`: pode priorizar casos de borda, risco de regressao e lacunas de cobertura. Nao pode remover cenarios nem enfraquecer assercoes.
- `reviewer`: pode classificar severidade, risco residual e prioridade de correcoes. Nao pode aprovar com testes falhando ou substituir um gate humano.
- `minimal`: nao usa ferramentas, mesmo que a permissao global do MCP exista.
