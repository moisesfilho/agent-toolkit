# agent-toolkit Code Map

Colecao portatil de recursos para agentes e harnesses de desenvolvimento com
IA. O repositorio nao possui runtime proprio; seu produto e documentacao
reutilizavel e arquivos de configuracao portaveis.

## Organizacao

| Caminho | Responsabilidade |
| --- | --- |
| `agents/` | Definições reutilizáveis em frontmatter nativo V2; o developer orquestra, mantém o mapa efêmero de sessões e consolida o registro da tarefa, sem contrato de handoff; planner, coder, tester e reviewer escrevem apenas a própria nota e retornam `resultado`, `nota` e `proximo`; `coder` absorve a implementação de alta complexidade (escalação por modelo) e mantém a regra anti-pin; `reviewer` separa feedback incremental de aprovação final e exige evidência do mesmo estado; `model-setter.md` separa atribuições locais do catálogo global `opencode-console` e documenta fallbacks em `plugins[].options`; `research.md` sintetiza evidência web e contexto local somente leitura (`read`/`glob` e `websearch`/`webfetch`, sem shell, escrita ou `external_directory`); `retrospectiv.md` analisa sessões em modo somente leitura. |
| `skills/` | Capacidades e procedimentos focados. |
| `workflows/` | Fluxo de planejamento, aprovação única, implementação, validação independente e revisão final; define nota por papel, consolidação do developer, reuso de sessão, classificação de escopo, progresso/estagnação observáveis sem teto numérico, alternativas/replanejamento, gates amplos em worktree destacado e evidência do mesmo `head`. |
| `templates/` | `task-note.md` define a nota de trabalho de um papel (um autor por nota, sem limite de linhas, evidência referenciada); `task-record.md` define o registro consolidado do developer, commitável como referência futura. |
| `plans/` | Planos de melhoria do proprio toolkit e dos agentes, com status, linha de base medida, criterios de sucesso e riscos; `plans/README.md` define o ciclo de vida e as regras de aprovacao por fase. |
| `docs/` | Conceitos, compatibilidade e guias. |
| `README.md`, `README.pt-BR.md` | Apresentação do toolkit e instruções de descoberta no OpenCode V2. |
| `docs/agent-instruction-delivery.md` | Dispatch portatil de instrucoes, fallback de conteudo e limites de symlinks. |
| `docs/contexto-persistente.md` | Nota por papel, registro consolidado, reuso de sessao, compactacao nativa e o que foi removido do fluxo. |
| `docs/typesafe-jev-policy.md` | Gatilhos enxutos para Jev, limites humanos e escalonamento. |
| `harnesses/` | Adaptadores para ferramentas de coding. |
| `tools/validate_resources.py` | Valida papeis e frontmatter, bloco de retorno (`resultado`, `nota`, `proximo`), piso de `steps` do reviewer, regras fail-closed, grants de `research` (layout canônico de `permissions` com cabeçalho fail-closed, deny-all antes dos grants, somente `read`/`glob` e web, `allow`/`ask` rejeitados para shell, edição, escrita, patch e `external_directory`), modelos de nota/registro, invariantes do workflow e ausencia de referencias retiradas ou caminhos absolutos de home. |
| `tests/test_validate_resources.py` | Testes positivos e negativos do validador de recursos, incluindo ausencia de limite de caracteres no retorno, rejeicao de referencias retiradas, regras de permissao de `research`, rejeicao de `allow`/`ask` para acoes proibidas e de variantes YAML nao reconhecidas, inclusive cabecalho malformado. |
| `CONTRIBUTING.md` | Regras de contribuicao, portabilidade e seguranca. |

## Entrada e validacao

Nao ha ponto de entrada executavel. A validacao e feita pelo workflow CI em
`.github/workflows/quality.yml`. O README e `README.pt-BR.md` documentam o
proposito e a estrutura publica. Recursos nao devem conter credenciais,
caches, logs, memoria privada ou caminhos absolutos da maquina.
