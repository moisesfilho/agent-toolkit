# Planos

Planos de melhoria do proprio toolkit e dos agentes. Um arquivo por plano,
nome em kebab-case com o mes de abertura quando ajudar a ordenar
(`YYYY-MM-assunto.md`).

## Ciclo de vida

- `proposto`: escrito, sem mudanca aplicada. Nada aqui vale como regra.
- `em andamento`: fase explicitamente aprovada pelo usuario; o plano registra
  qual fase esta ativa.
- `concluido`: todas as fases aplicadas e validadas; manter o arquivo como
  registro historico e citar os commits.
- `descartado`: nao sera aplicado; registrar o motivo para nao repetir a ideia.

## Regras

- Um plano nao altera `agents/`, `workflows/` ou `templates/` por si so: a
  mudanca e feita em commits proprios, com a validacao do repositorio.
- Toda mudanca proposta declara: problema observado, evidencia, arquivo alvo,
  criterio de sucesso mensuravel e risco de regressao.
- Criterios de sucesso devem ser mediveis em uma entrega real; "melhorar a
  qualidade" nao e criterio.
- Alteracao de contrato de handoff exige atualizar
  `tools/validate_handoffs.py` e `tests/test_validate_handoffs.py` no mesmo
  trabalho.
- Planos nao contem credenciais, caminhos privados de maquina nem dados de
  sessao.
