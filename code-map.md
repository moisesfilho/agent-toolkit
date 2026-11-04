# agent-toolkit Code Map

Colecao portatil de recursos para agentes e harnesses de desenvolvimento com
IA. O repositorio nao possui runtime proprio; seu produto e documentacao
reutilizavel e arquivos de configuracao portaveis.

## Organizacao

| Caminho | Responsabilidade |
| --- | --- |
| `agents/` | Definições reutilizáveis em frontmatter nativo V2; developer mantém ledger, handoffs com contexto suficiente e retomada fail-closed; correções/replanejamentos continuam enquanto houver convergência observável, sem teto numérico; coder pode implementar testes focados e tester valida cobertura independentemente; reviewer separa feedback incremental de aprovação/gates finais; `model-setter.md` separa atribuições locais do catálogo global `opencode-console`, documenta leitura/alteração de fallbacks via configuração `plugins[].options`, e exige pesquisa online atual e testes novos pelo OpenCode para saúde (não histórico); `research.md` sintetiza evidência web sem escrita; `retrospectiv.md` analisa sessões de harness em modo somente leitura. |
| `skills/` | Capacidades e procedimentos focados. |
| `workflows/` | Fluxos de planejamento, despacho incremental com contexto suficiente, autoria de testes focados pelo coder e validação independente pelo tester, classificação de escopo, retomada de revisão por snapshot, progresso/estagnação observáveis sem limite numérico de ciclos, alternativas/replanejamento, feedback de revisão durante desenvolvimento e gates completos na revisão final, recuperacao limitada de handoff malformado, implementacao e release. |
| `templates/` | Modelos reutilizáveis; `handoff-contract.md` define campos/limites ampliados por papel, `cycle` não limitado como contador de rastreabilidade, evidência incremental vinculada ao estado e recuperacao de handoff, incluindo feedback não aprovador intermediário e sinal/retorno de pesquisa. |
| `plans/` | Planos de melhoria do proprio toolkit e dos agentes, com status, linha de base medida, criterios de sucesso e riscos; `plans/README.md` define o ciclo de vida e as regras de aprovacao por fase. |
| `docs/` | Conceitos, compatibilidade e guias. |
| `README.md`, `README.pt-BR.md` | Apresentação do toolkit e instruções de descoberta no OpenCode V2. |
| `docs/agent-instruction-delivery.md` | Dispatch portatil de instrucoes, fallback de conteudo e limites de symlinks. |
| `docs/typesafe-jev-policy.md` | Gatilhos enxutos para Jev, limites humanos e escalonamento. |
| `harnesses/` | Adaptadores para ferramentas de coding. |
| `tools/validate_handoffs.py` | Valida contrato, campos de roteamento escalares/unicos, enums, ciclo inteiro não negativo sem teto, sinal/retorno de pesquisa, frontmatter `steps` e invariantes dos handoffs. |
| `tests/test_validate_handoffs.py` | Testes positivos e negativos do validador do contrato, roteamento, retorno de pesquisa, ciclo sem teto e limites de etapas. |
| `CONTRIBUTING.md` | Regras de contribuicao, portabilidade e seguranca. |

## Entrada e validacao

Nao ha ponto de entrada executavel. A validacao e feita pelo workflow CI em
`.github/workflows/quality.yml`. O README e `README.pt-BR.md` documentam o
proposito e a estrutura publica. Recursos nao devem conter credenciais,
caches, logs, memoria privada ou caminhos absolutos da maquina.
