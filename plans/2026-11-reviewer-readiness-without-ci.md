# Plano: prontidão da revisão sem CI verde

- Status: **em andamento** (2026-11-11) - objetivo e plano aprovados pelo
  usuário; F1 (regra textual + validador + testes) em aplicação.
- Data de abertura: 2026-11-11
- Escopo: `agents/reviewer.md`, `workflows/developer-workflow.md`,
  `tools/validate_resources.py`, `tests/test_validate_resources.py`,
  `code-map.md` e este plano.
- Fora de escopo: instalar ou alterar pipeline, reduzir suíte/cobertura/
  preflight, flexibilizar aceite humano, declarar validação física por agente,
  criar gatilho automático de publicação.

## 1. Problema observado

A prontidão do gate de código dependia de CI remoto verde. `agents/reviewer.md`
exigia "quality gate de CI/CD", "lint/typecheck/build e CI" e "Gate pendente,
falho, não disparado ou não verificável impede a aprovação final"; o workflow
exigia "remote CI conclusively green when configured and available" e tratava
"pending CI" como motivo de estado incompleto. Consequências: aprovação travada
por indisponibilidade de serviço externo, confusão entre falha de código e falha
de infraestrutura, e nenhuma regra explícita sobre como executar ou pedir teste
funcional.

## 2. Linha de base medida (HEAD 1a41e0d, 2026-11-11 16:23 -03:00)

```
grep -n -E "CI/CD|e CI\.|checks disparados até um estado conclusivo|não verificável impede|CI pendente" agents/reviewer.md
-> 6 linhas residuais (69, 113, 143, 161, 162, 216)

grep -n -E "conclusively green|pending CI" workflows/developer-workflow.md
-> 2 linhas residuais (183, 196)
```

O validador não distinguia CI remoto de gate local: aceitava os dois textos e
não exigia nenhuma invariante de prontidão por implementação/testes/funcional.

## 3. Requisitos, critérios e testes

### REQ-RR-01 / AC-RR-01 - prontidão deriva do trabalho local

`review_approved` só em `final`, com `blockers: []`, revisão do diff e do
comportamento, rastreio `REQ-*`/`AC-*` para testes automatizados e cobertura
pertinente, e gates locais conclusivos no mesmo snapshot. Teste automatizado
faltando, falho, insuficiente, stale ou inconclusivo, falha de código comprovada,
risco crítico ou blocker impedem aprovação.
`TEST-RR-01`: invariantes do validador exigem os tokens de prontidão e falham ao
removê-los; resíduo de gate de CI é rejeitado.

### REQ-RR-02 / AC-RR-02 - teste funcional executado ou instrução reproduzível

O agente executa o teste funcional do alvo quando é seguro, autorizado e viável,
registrando comando/passos, saída/log, resultado, snapshot e cobertura. Se
depende do usuário ou de dispositivo, entrega roteiro reproduzível com
versão/build, monitoramento/log e resultado esperado, e o item fica
`manual_validation` pendente. `evidence_kind` continua apenas `medido`, `relato`
ou `deferido`; pendência não é tipo de evidência e nunca conta como satisfeita.
Aprovação do código pode coexistir com validação funcional manual pendente e não
torna a tarefa `completed`.
`TEST-RR-02`: tokens `testes funcionais`, `validação funcional` e
`` `manual_validation` pendente `` são obrigatórios no reviewer e no workflow;
removê-los falha a validação.

### REQ-RR-03 / AC-RR-03 - CI remoto é evidência operacional posterior

`green` é registrado com o `SHA`; `pending`, não disparado, indisponível ou falha
de infraestrutura não viram PASS nem vetam prontidão local; falha indicativa de
código deve ser investigada e bloqueia até correção/revisão; falha não
classificável que pode ocultar defeito exigido mantém `review_incomplete` até
diagnóstico; CI de `SHA` diferente nunca comprova o snapshot.
`TEST-RR-03`: validador rejeita as frases antigas de gate de CI nos dois arquivos
normativos e exige os tokens de classificação.

### REQ-RR-04 / AC-RR-04 - estados inequívocos

`review_feedback_ready` só em desenvolvimento; `review_approved` é o gate de
código local final com pendência manual/CI discriminada; `review_incomplete`
indica evidência local obrigatória insuficiente ou falha de CI relevante não
diagnosticada; `blocked`/`correcoes_necessarias` indicam impeditivo ou defeito
confirmado; `completed` é decisão do developer após aceite manual exigido.
`TEST-RR-04`: as regras fail-closed existentes (`review_approved` só final,
`review_feedback_ready` só development) continuam exigidas e há token de
`completed` ligado a aceite manual.

### REQ-RR-05 / AC-RR-05 - publicação autorizada após prontidão local

Commit/push exige autorização explícita nesta tarefa, que pode ser condicional à
prontidão local; nunca é automática, nunca ocorre antes do `review_approved`
local e nunca em `main`/`master`/produção. Antes de publicar: conferir branch,
status, diff, escopo e segredos, stage só de arquivos intencionais, staged diff
conferido; depois registrar `SHA`, branch/remoto e estado de CI ligado ao `SHA`.
`TEST-RR-05`: o workflow exige o token `conditional on local readiness` e a
proibição de produção; não existe gatilho automático.

## 4. Mudanças por arquivo

| Arquivo | Mudança |
| --- | --- |
| `agents/reviewer.md` | prontidão por implementação/testes/funcional; CI remoto como evidência operacional com classificação; estados explícitos; publicação autorizada |
| `workflows/developer-workflow.md` | `review_approved` sem CI verde; testes funcionais e pendência manual; `review_incomplete` sem CI pendente; evidência remota amarrada ao SHA; autorização condicional de commit/push |
| `tools/validate_resources.py` | invariantes de prontidão do reviewer e do workflow, mais lista de frases residuais de gate de CI rejeitadas |
| `tests/test_validate_resources.py` | casos positivos e negativos derivados das constantes do validador |
| `code-map.md` | índice coerente com a nova semântica |

## 5. Critério de sucesso mensurável

- 0 linhas do conjunto residual de gate de CI nos dois arquivos normativos;
- validador falha ao reintroduzir cada frase residual e ao remover cada invariante
  de prontidão;
- `python3 tools/validate_resources.py` retorna PASS;
- `python3 -m unittest tests.test_validate_resources -v` sem falhas;
- `review_approved` documentado sem exigir CI verde.

## 6. Risco de regressão

Risco `medium`: muda o significado do gate de revisão. Mitigação: nenhum gate
local é removido (suíte completa, cobertura, lint/build, preflight e evidência no
mesmo snapshot continuam exigidos); aceite manual e autorização de publicação
seguem obrigatórios; falha de código confirmada continua bloqueando. Risco
residual: green local divergir do CI por ambiente - registrar diferenças,
investigar indicação de defeito e nunca converter CI falho em PASS.
