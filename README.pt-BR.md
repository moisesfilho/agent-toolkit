# Agent Toolkit

[![Licenca: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Documentacao](https://img.shields.io/badge/docs-bilingual-blue.svg)](README.md)
[![Validacao](https://github.com/moisesfilho/agent-toolkit/actions/workflows/quality.yml/badge.svg)](https://github.com/moisesfilho/agent-toolkit/actions/workflows/quality.yml)

**Idiomas:** [English](README.md) | [Portugues](README.pt-BR.md)

Uma colecao portatil de agentes de IA, skills reutilizaveis, workflows de
desenvolvimento, templates e documentacao para multiplos harnesses de
codificacao com IA.

## Status

Este repositorio contem recursos portateis extraidos de uma configuracao local
do OpenCode e sanitizados para reuso. Configuracoes especificas da maquina,
credenciais, logs, caches e memoria privada foram intencionalmente excluidos.

## Objetivos

- Manter instrucoes de agentes portateis entre diferentes harnesses.
- Separar skills reutilizaveis de adaptadores especificos de cada harness.
- Fornecer workflows e templates faceis de inspecionar e customizar.
- Documentar premissas, compatibilidade e uso seguro.
- Preferir recursos pequenos e composaveis a automacoes opacas.

## Estrutura do Repositorio

| Diretorio | Finalidade |
| --- | --- |
| `agents/` | Definicoes de agentes e instrucoes de papeis reutilizaveis. |
| `skills/` | Capacidades e procedimentos operacionais reutilizaveis. |
| `workflows/` | Workflows para planejamento, implementacao, revisao e release. |
| `templates/` | Templates de arquivos, prompts e documentacao. |
| `docs/` | Conceitos, convencoes, compatibilidade e guias. |
| `harnesses/` | Adaptadores e notas para harnesses especificos. |

A colecao inicial inclui os agents configurados, skills reutilizaveis, incluindo
a baseline compartilhada de clean code, o workflow de desenvolvimento, a
documentacao e o harness MCP do TypeSafe Jev, alem das politicas de busca e
decisoes.

## Portabilidade E Seguranca

Os recursos nao devem conter credenciais, arquivos de autenticacao, memoria
privada, caminhos absolutos da home, hostnames, enderecos de rede local, logs,
caches de dependencias ou backups especificos da maquina. Integracoes com
harnesses devem ler segredos do ambiente de execucao ou de um gerenciador
externo de segredos.

Para dispatch entre harnesses, consulte o [guia portatil de entrega de
instrucoes](docs/agent-instruction-delivery.md). Caminhos referenciados nao
substituem a inclusao do conteudo necessario quando o agente nao consegue le-los.

## Compatibilidade

O toolkit foi projetado para suportar multiplos harnesses de codificacao com
IA. Cada recurso deve identificar seu harness-alvo, funcionalidades exigidas
e etapas de conversao, sem assumir um formato especifico de um fornecedor.

### OpenCode V2

Os agentes em `agents/` e as skills em `skills/` sao recursos do repositorio,
nao diretorios de descoberta do OpenCode. Para usa-los na v2, copie ou vincule
os arquivos Markdown dos agentes para `.opencode/agents/` e cada diretorio de
skill para `.opencode/skills/` no projeto de destino, ou instale-os nos
diretorios globais correspondentes em `~/.config/opencode/`. Mantenha o nome do
diretorio da skill para preservar seu ID. Valide as permissoes dos agentes e a
descoberta das skills na versao-alvo antes de depender do workflow.

## Contribuicao

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de propor um recurso. O novo
conteudo deve ser focado, portatil quando possivel, documentado e nao conter
credenciais ou dados privados de uma maquina.

## Licenca

Este projeto e distribuido sob a [Licenca MIT](LICENSE).
