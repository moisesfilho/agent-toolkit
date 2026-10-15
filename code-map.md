# agent-toolkit Code Map

Colecao portatil de recursos para agentes e harnesses de desenvolvimento com
IA. O repositorio nao possui runtime proprio; seu produto e documentacao
reutilizavel e arquivos de configuracao portaveis.

## Organizacao

| Caminho | Responsabilidade |
| --- | --- |
| `agents/` | Definições reutilizáveis em frontmatter nativo V2; `retrospectiv.md` analisa sessões de harness em modo somente leitura. |
| `skills/` | Capacidades e procedimentos focados. |
| `workflows/` | Fluxos de planejamento, alternativas/replanejamento, implementacao, revisao e release. |
| `templates/` | Modelos reutilizáveis; `handoff-contract.md` é o contrato compartilhado entre agentes. |
| `docs/` | Conceitos, compatibilidade e guias. |
| `README.md`, `README.pt-BR.md` | Apresentação do toolkit e instruções de descoberta no OpenCode V2. |
| `docs/agent-instruction-delivery.md` | Dispatch portatil de instrucoes, fallback de conteudo e limites de symlinks. |
| `docs/typesafe-jev-policy.md` | Gatilhos enxutos para Jev, limites humanos e escalonamento. |
| `harnesses/` | Adaptadores para ferramentas de coding. |
| `tools/validate_handoffs.py` | Valida contrato, limites de ciclo, frontmatter `steps` e invariantes dos handoffs. |
| `tests/test_validate_handoffs.py` | Testes positivos e negativos do validador do contrato, ciclo e limites de etapas. |
| `CONTRIBUTING.md` | Regras de contribuicao, portabilidade e seguranca. |

## Entrada e validacao

Nao ha ponto de entrada executavel. A validacao e feita pelo workflow CI em
`.github/workflows/quality.yml`. O README e `README.pt-BR.md` documentam o
proposito e a estrutura publica. Recursos nao devem conter credenciais,
caches, logs, memoria privada ou caminhos absolutos da maquina.
