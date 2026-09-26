# Politica Global de Busca Progressiva

Use este fluxo para localizar codigo em qualquer projeto. A politica deve ser
adaptada a estrutura real do projeto e nao presume que arquivos ou diretorios
especificos existam.

## Ordem obrigatoria

1. **Consultar o indice:** procure e leia o `AGENTS.md` aplicavel, se existir,
   e leia o `code-map.md`, se existir. Identifique o modulo, diretorio, arquivos
   e testes mais provaveis.
2. **Inspecionar arquivos direcionados:** leia primeiro os arquivos indicados
   pelo mapa ou pela documentacao disponivel; consulte imports, simbolos e
   dependencias diretas.
3. **Pesquisar dentro do modulo:** se os arquivos direcionados nao forem
   suficientes, use `glob` ou `grep` exclusivamente no diretorio identificado,
   limitado aos nomes, extensoes e padroes relevantes.
4. **Ampliar para modulos relacionados:** examine interfaces, chamadas,
   implementacoes e testes de integracao somente quando a tarefa exigir.
5. **Justificar a busca global:** se a localizacao continuar incerta, faca uma
   pesquisa mais ampla somente depois das etapas anteriores, limitada por
   diretorios, extensoes e padroes relevantes. Registre mentalmente o motivo e
   o escopo da ampliacao. Busca global nao deve ser o primeiro passo.

## Salvaguardas

- Se `AGENTS.md` nao existir, continue com as instrucoes globais e procure
  outras orientacoes locais relevantes, como `CONTRIBUTING.md`, `README.md`,
  `docs/` e manifests.
- Se `code-map.md` nao existir, isso nao bloqueia a tarefa. Use o README,
  documentacao, manifests, pontos de entrada e estrutura de diretorios para
  definir o primeiro escopo de busca, ainda sem fazer busca global prematura.
- Nao invente caminhos, modulos ou convencoes com base em outro projeto.
- Confirme no codigo atual qualquer informacao encontrada em indices ou
  documentacao antes de usa-la como fonte de verdade.

## Alteracoes e mapas

- Se o projeto tiver `code-map.md`, atualize-o no mesmo trabalho ao alterar
  arquivos existentes ou criar novos arquivos, conforme as regras locais.
- Se o projeto tiver `AGENTS.md` exigindo um mapa e `code-map.md` nao existir,
  crie o mapa e atualize-o no mesmo trabalho, salvo se a tarefa for somente
  leitura ou a criacao for explicitamente fora do escopo.
- Se nenhum mapa existir e nao houver regra local exigindo sua criacao, nao
  crie um arquivo novo apenas por causa desta politica global. Continue o
  trabalho e mantenha o escopo da documentacao sob controle.
- Nunca inclua artefatos gerados no mapa, exceto quando forem necessarios para
  documentar uma dependencia ou comando de validacao.
