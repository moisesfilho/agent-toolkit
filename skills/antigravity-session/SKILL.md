---
name: antigravity-session
description: Recuperar e compactar o contexto de sessões do Google Antigravity (IDE Gemini). Use quando o usuário pedir para "recuperar/reabrir/resumir o contexto de uma sessão do antigravity", "buscar/recolher dados de uma sessão do antigravity por nome", "compactar dados de sessão do antigravity", ou mencionar uma conversa do Antigravity que precisa ser retomada aqui no opencode.
---

# Antigravity Session Recovery & Compaction

Recupera o contexto de uma sessão do Google Antigravity (IDE) de forma direta
e gera um resumo compacto, em vez de ler megas de transcripts crus.

## Onde os dados ficam

| Dado | Caminho |
| --- | --- |
| Transcript legível (JSONL) | `$ANTIGRAVITY_HOME/brain/<cascade_id>/.system_generated/logs/transcript.jsonl` |
| Artefatos da sessão | `$ANTIGRAVITY_HOME/brain/<cascade_id>/` (`implementation_plan.md`, `walkthrough.md`, `tasks/`) |
| Banco SQLite (metadados) | `$ANTIGRAVITY_HOME/conversations/<cascade_id>.db` |
| Estado da UI (IDs de cascata) | Configuração do cliente Antigravity, no campo `aux-pane-session` |

O `transcript.jsonl` é a fonte principal: cada linha é um passo
(`USER_EXPLICIT`/`USER_INPUT` para pedidos, `MODEL` para respostas/análises,
`SYSTEM`/`CHECKPOINT` com o título da sessão em `USER Objective:`).

O banco `.db` guarda o workspace do projeto em `trajectory_metadata_blob`
(id `main`) — usado para confirmar que a sessão pertence ao projeto atual.

## Ferramenta

Script de extração + compactação:

```
skills/antigravity-session/scripts/recover.py
```

```
python3 skills/antigravity-session/scripts/recover.py \
  --title "Falha na Reprodu" --project "workspace-name" [--out resumo.md] [--full]
```

- `--title`: parte do título (com ou sem acentos, case-insensitive).
- `--project`: filtra pela pasta do workspace (ex.: `workspace-name` ou caminho).
- `--out`: grava o resumo num arquivo; sem ele, salva em
  `$ANTIGRAVITY_HOME/opencode/resumos/<cascade_id>.md` automaticamente.
- `--full`: inclui os blocos CHECKPOINT no resumo.

## Fluxo

1. **Localizar** a sessão: o script procura o título no transcript (bloco
   `USER Objective:`) e nos bytes dos `.db` (cobre variações de acentuação).
   Se múltiplos resultados, filtra por `--project` e lista candidatos.
2. **Confirmar o projeto**: o workspace é lido de `trajectory_metadata_blob`
   (caminho `file:///...`). Só prosseguir se bater com o projeto em questão.
3. **Extrair** do `transcript.jsonl`: pedidos do usuário (turnos) e textos
   `MODEL` que não sejam dumps de arquivo.
4. **Compactar** e apresentar o resumo ao usuário.

## Processo de compactação

O resumo gerado tem seções fixas: **Objetivo**, **Cronologia (pedidos +
síntese)** e **Estado pendente**. Regras:

- **Manter**: pedidos do usuário (na íntegra), a melhor síntese por turno
  (prefere `PLANNER_RESPONSE`; prioriza textos com "causa raiz/diagnóstico/
  correção"; senão a última resposta do turno), e o último pedido sem síntese
  (vira "Estado pendente").
- **Descartar**: dumps de arquivo (`view_file` com "File Path:"), logs de
  flash (`Writing at...`, `Wrote...`), logs de task (`Log output:`),
  checkpoints repetidos e ruído de polling de pipeline.
- **Truncar**: cada síntese em ~1600 caracteres; no máximo 60 turnos.
- O resumo é salvo automaticamente em
  `$ANTIGRAVITY_HOME/opencode/resumos/<cascade_id>.md` para reuso futuro.

## Após recuperar

1. Apresente o resumo compacto ao usuário (objetivo, o que já foi feito,
   estado pendente).
2. Alinhe com o estado real do repositório: rode `git branch --show-current`,
   `git log --oneline -10` e `git status` para casar commits/situação com o
   fim da sessão.
3. Se o usuário quiser retomar o trabalho, use o resumo como contexto inicial
   (leia os arquivos relevantes listados na cronologia, não o transcript cru).
4. Ofereça salvar o essencial na memória de projeto (`memory_set`), se a
   sessão trouxer fatos duradouros (causas raiz, pinos, arquivos-chave).

## Gotchas

- `sqlite3` (CLI) pode não estar instalado; o script usa o módulo `sqlite3`
  da stdlib do Python, então funciona sem.
- Títulos podem ter acentos e a busca ignora acentuação/caixa.
- O transcript pode ter "CHECKPOINT" de truncamento; o título real está em
  `USER Objective:` do primeiro checkpoint.
- Sessões antigas podem não ter `trajectory_metadata_blob`; nesse caso o
  filtro de projeto usa os caminhos encontrados nos transcripts.
