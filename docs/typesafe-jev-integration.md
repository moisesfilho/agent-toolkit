# TypeSafe Jev como ferramenta de apoio a decisoes no OpenCode

Este documento descreve como integrar o Jev, da TypeSafe AI, ao OpenCode como
uma ferramenta MCP usada pelo `developer` e por agentes especializados para
apoiar decisoes estruturadas de baixo risco.

O Jev nao substitui o modelo conversacional do OpenCode. Ele avalia um estado
contra perguntas tipadas e devolve respostas estruturadas e probabilidades.

O MCP usa dois provedores em ordem de prioridade:

1. Primario: OpenCode Zen, modelo `jev-1.13-free` (gratuito), endpoint
   `https://opencode.ai/zen/v1/systemone`, autenticado com `OPENCODE_API_KEY`.
2. Fallback: API direta TypeSafe, modelo `jev-latest`, endpoint
   `https://api.typesafe.ai/v1/systemone`, autenticado com `TYPESAFE_API_KEY`.

O fallback e interno ao MCP: ocorre quando o provedor primario falha (sem
credencial, erro de rede, timeout de 20s, HTTP nao-2xx ou payload invalido).
O resultado indica qual `provider` respondeu. O fallback e restrito a este
MCP e nao altera a selecao de modelos conversacionais do OpenCode.

## Plano implementado

1. Instalar a skill oficial TypeSafe no escopo global do OpenCode.
2. Instalar o SDK oficial do Model Context Protocol.
3. Criar um servidor MCP local usando Node.js e `StdioServerTransport`.
4. Expor a ferramenta `jev_decide` para chamadas tipadas ao Jev.
5. Persistir a API key fora das configuracoes do OpenCode, com permissao `600`.
6. Registrar o MCP na configuracao global do OpenCode.
7. Definir no Developer os limites de autonomia e o limiar de confianca.
8. Validar sintaxe, carregamento do MCP e uma chamada real ao Jev.

## Objetivo

Permitir que o agente Developer consulte o Jev de forma PROATIVA ao longo do
ciclo de desenvolvimento, nao apenas diante de `blocking_questions`, para
decisoes tecnicas simples, reversiveis e de baixo risco, mantendo no usuario as
decisoes de escopo, aprovacao e autorizacao.

Exemplos adequados:

- classificar uma decisao tecnica;
- avaliar se uma alteracao e consequencia necessaria de outra;
- escolher entre alternativas previamente definidas;
- pontuar risco ou severidade;
- verificar uma condicao booleana.

Exemplos que continuam humanos:

- confirmacao do objetivo;
- aprovacao do plano;
- alteracao de escopo ou requisitos;
- deploy, migracao ou exclusao;
- uso de credenciais;
- qualquer acao irreversivel ou checkpoint critico.

## Arquitetura

```text
Developer ou subagente
  -> ponto de decisao tecnica local de baixo risco
  -> agente classifica a pergunta (noul/choice/score)
  -> agente chama o MCP TypeSafe/Jev quando permitido
  -> Jev retorna decisao estruturada, probabilidade e confianca
  -> continua a execucao, registra no handoff ou consulta o usuario
```

A skill ensina o agente a modelar perguntas TypeSafe. O MCP fornece a
capacidade executavel para chamar a API do Jev.

```text
Skill TypeSafe = conhecimento e orientacoes
MCP TypeSafe/Jev = ferramenta executavel
Developer = orquestracao e politica de autorizacao
Agentes especializados = decisoes locais dentro do escopo aprovado
```

## Instalacao da skill

A skill oficial foi instalada globalmente para o OpenCode com:

```bash
npx skills add typesafe-ai/skills --skill typesafe-ai --global --agent opencode --yes
```

No OpenCode, o arquivo instalado fica em:

```text
<opencode-skills-dir>/typesafe-ai/SKILL.md
```

A skill orienta o agente a consultar a documentacao atual da TypeSafe, escolher
entre `noul`, `choice` e `score`, decompor decisoes complexas e usar
probabilidades e confianca.

A skill, sozinha, nao cria uma ferramenta MCP e nao intercepta a ferramenta
`question` do OpenCode.

## Persistencia das API keys

As chaves nao devem ser colocadas no arquivo de configuracao do harness. Devem
ser armazenadas em arquivos de usuario com permissao `600` ou fornecidas por
um gerenciador de segredos:

```text
<secrets-dir>/opencode-keys.env    # export OPENCODE_API_KEY=... (OpenCode Zen)
<secrets-dir>/typesafe-ai.env      # export TYPESAFE_API_KEY=... (TypeSafe direta)
```

Ambos os arquivos sao carregados pelo comando do MCP (via `source`), sem
dependencia do `.bashrc`. Isso atende ambientes em que o OpenCode e iniciado
por um processo grafico que nao le o `.bashrc`.

## Criacao do MCP

O servidor foi criado em:

```text
<harness-config-dir>/typesafe-jev-mcp/index.mjs
```

A dependencia oficial do protocolo MCP foi adicionada com:

```bash
npm install --save @modelcontextprotocol/sdk
```

O servidor utiliza `McpServer`, `StdioServerTransport`, `zod/v4` e `fetch`
nativo. Ele expoe uma ferramenta chamada:

```text
jev_decide
```

O nucleo do servidor segue este formato (primario + fallback):

```js
const PROVIDERS = [
  { name: "opencode-zen", url: "https://opencode.ai/zen/v1/systemone",
    model: "jev-1.13-free", keyEnv: "OPENCODE_API_KEY" },
  { name: "typesafe", url: "https://api.typesafe.ai/v1/systemone",
    model: "jev-latest", keyEnv: "TYPESAFE_API_KEY" },
];

for (const provider of PROVIDERS) {
  // fetch com timeout de 20s; em falha, registra o motivo e tenta o proximo
  // em sucesso, devolve { provider, model, ...payload }
}
// se todos falharem: isError com a lista de falhas
```

O servidor itera sobre os provedores (OpenCode Zen primeiro, TypeSafe depois),
com timeout de 20s por tentativa, valida respostas HTTP e a presenca de
`answers` no payload, e so retorna erro quando ambos falham (com o motivo de
cada um). A resposta inclui `provider` e `model` usados.

A ferramenta recebe um estado e um mapa de perguntas tipadas:

O schema do MCP valida `criteria` conforme o tipo da pergunta: `noul` e
`choice` usam objeto; `score` usa array. Payloads incompatíveis sao rejeitados
localmente e nao sao encaminhados ao provedor nem ao fallback.

```json
{
  "state": "estado a ser avaliado",
  "questions": {
    "id_da_pergunta": {
      "type": "noul | choice | score",
      "instructions": "pergunta atomica",
      "criteria": "objeto para noul/choice; array para score"
    }
  }
}
```

Internamente, o MCP chama, nesta ordem:

```http
POST https://opencode.ai/zen/v1/systemone        (primario)
Authorization: Bearer $OPENCODE_API_KEY
Body: {"model":"jev-1.13-free", ...}

POST https://api.typesafe.ai/v1/systemone        (fallback)
Authorization: Bearer $TYPESAFE_API_KEY
Body: {"model":"jev-latest", ...}
```

O resultado e devolvido ao OpenCode como texto JSON e como
`structuredContent`, preservando a resposta tipada do Jev.

## Registro global no OpenCode

O MCP foi registrado em:

```text
arquivo de configuracao do harness
```

Configuracao utilizada:

```json
{
  "mcp": {
    "typesafe-jev": {
      "type": "local",
      "command": [
        "bash",
        "-lc",
        "source \"<secrets-dir>/opencode-keys.env\"; source \"<secrets-dir>/typesafe-ai.env\" && exec node \"<harness-config-dir>/typesafe-jev-mcp/index.mjs\""
      ]
    }
  }
}
```

O nome completo da ferramenta apresentado ao agente e:

```text
typesafe-jev_jev_decide
```

Por estar no arquivo global do OpenCode, o MCP fica disponivel em todos os
projetos, salvo quando uma configuracao de projeto o sobrescrever ou
desabilitar.

## Politica dos agentes

A politica principal foi adicionada a:

```text
docs/typesafe-jev-policy.md
```

Regras implementadas:

1. Usar somente quando houver decisao semantica que nao seja determinada por
   regras, documentacao, comandos ou resultados de testes.
2. Automatizar com `noul` apenas quando a probabilidade de resposta positiva for
   igual ou superior a `0.90`; para `choice` e `score`, quando `confidence` for
   igual ou superior a `0.90`.
3. Nao alterar objetivo, escopo, requisitos, arquitetura aprovada ou criterios
   de aceite com base apenas na resposta automatica.
4. Manter humanas as confirmacoes do objetivo e a aprovacao do plano.
5. Escalonar ao usuario quando a confianca for insuficiente, o MCP falhar ou a
   pergunta nao for automatizavel.
6. Registrar pergunta, resposta, probabilidade/confianca, decisao e motivo do
   escalonamento no handoff.
7. Usar de forma proativa durante o ciclo do developer (diagnostico, escolha de
   alternativas delimitadas, priorizacao de testes/correcoes, classificacao de
   risco), nao apenas diante de `blocking_questions`.

As responsabilidades por agente sao delimitadas na politica global e
reforcadas nos arquivos dos agentes `planner`, `coder`, `coder-expert`,
`tester` e `reviewer`. O `minimal` continua sem uso de ferramentas.

## Exemplo de uso

Um subagente pode retornar:

```text
blocking_questions:
- O package-lock.json deve ser atualizado junto com package.json?
```

O Developer pode transformar a pergunta em uma decisao Jev:

```json
{
  "state": {
    "task": "correcao de bug",
    "changed_files": ["package.json"],
    "lockfile_present": true,
    "risk": "low"
  },
  "questions": {
    "update_lockfile": {
      "type": "noul",
      "instructions": "A atualizacao do package-lock.json e consequencia necessaria da alteracao proposta?"
    }
  }
}
```

Se a resposta tiver confianca suficiente, o Developer pode registrar a decisao
como automatica. Caso contrario, deve utilizar `question` e aguardar o usuario.

O uso proativo nao depende de `blocking_questions`. Exemplos ao longo do ciclo:

Priorizacao de correcoes por severidade (`score`):

```json
{
  "state": {
    "failing_tests": ["auth.flow", "billing.round"],
    "impact": "auth.flow bloqueia login; billing.round apenas arredonda valor exibido",
    "workaround": "auth.flow sem workaround"
  },
  "questions": {
    "severity_auth": {
      "type": "score",
      "instructions": "Classifique a severidade da falha auth.flow.",
      "criteria": [
        "cosmetico, sem impacto em funcionalidade",
        "funcionalidade degradada, com workaround",
        "bloqueante, sem workaround"
      ]
    }
  }
}
```

Escolha de alternativa de implementacao ja delimitada no plano (`choice`):

```json
{
  "state": {
    "opcoes": ["componente separado", "funcao utilitaria", "inline no modulo"],
    "plano": "manter baixa superficie de API e reuso em 2 telas"
  },
  "questions": {
    "abordagem": {
      "type": "choice",
      "instructions": "Qual alternativa tecnica melhor atende o plano aprovado?",
      "criteria": ["componente separado", "funcao utilitaria", "inline no modulo"]
    }
  }
}
```

## Validacao

Verificar se o OpenCode reconhece o servidor:

```bash
opencode mcp list
```

Resultado esperado:

```text
typesafe-jev connected
```

Validar a sintaxe do servidor:

```bash
node --check harnesses/typesafe-jev-mcp/index.mjs
```

Validar a configuracao JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('harness-config.json','utf8')); console.log('config-valid')"
```

Validacoes executadas na atualizacao (22/set/2026):

- `node --check` do servidor: OK.
- Configuracao do harness parseavel: `config-valid`.
- `opencode mcp list`: `typesafe-jev connected`.
- Chamada real via protocolo MCP com as duas chaves: respondeu
  `provider=opencode-zen`, `model=jev-1.13-free`, `noul=0.95`.
- Mesma chamada sem `OPENCODE_API_KEY` (fallback): respondeu
  `provider=typesafe`, `model=jev-1.13.0` (alias de `jev-latest`), `noul=0.95`.

Depois de alterar configuracoes globais, e necessario reiniciar o OpenCode.

## Limitacoes

O MCP nao intercepta automaticamente chamadas diretas a ferramenta `question`.
A automacao acontece quando o agente Developer (ou um subagente autorizado)
decide chamar `typesafe-jev_jev_decide` de forma proativa em um ponto de
decisao tecnica local, inclusive quando nenhum `blocking_questions` foi
retornado.

O Jev nao substitui Gemini, Claude ou GPT na geracao de codigo e texto. Ele e
uma funcao de decisao estruturada:

```text
estado nao estruturado + perguntas tipadas
    -> respostas estruturadas + probabilidades
```

## Referencias

- Skill TypeSafe: <https://github.com/typesafe-ai/skills>
- Documentacao: <https://docs.typesafe.ai/>
- Quick start: <https://docs.typesafe.ai/introduction/quickstart>
- API: <https://docs.typesafe.ai/api>
- System One: <https://docs.typesafe.ai/concepts/system-one>
- Confianca: <https://docs.typesafe.ai/confidence>
- OpenCode Zen (Jev free): <https://opencode.ai/docs/zen/>
