# Aprofundamento do Fluxo de Caixa — preparação (26/11/2026)

> **Regra permanente:** um único banco (PostgreSQL 17.6). `production` e `test`
> são valores da coluna `environment`, não bancos separados. Toda seção declara
> ou devolve o ambiente. Ver `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

## Estado

- Script: `docs/APROFUNDAMENTO-FLUXO-CAIXA-20261126.sql`.
- **Ainda não executado.** Uma única célula
  (`aprofundamento_fluxo_caixa_20261126`), somente leitura, termina em
  `rollback`. Nenhum `UPDATE`/`DELETE` foi preparado ou autorizado.
- É a continuação de `docs/DIAGNOSTICO-FLUXO-CAIXA-20261126.sql`, executado
  pelo usuário em 26/11/2026 às 13:25:28 UTC. O resultado interpretado está em
  `docs/DIAGNOSTICO-FLUXO-CAIXA-20261126.md`.
- Reescrito como **uma única consulta com CTEs**, sem tabela temporária e sem
  bloco `DO`, para evitar o `42P01` encontrado nas versões anteriores do
  diagnóstico no SQL Editor.

## Decisão do usuário

- Continuar com o aprofundamento antes de qualquer correção.
- A fonte de verdade do saldo **será decidida depois do rastreio**, não agora.

## O que a célula responde

| Seção | Pergunta |
|---|---|
| `resumo` | Confere os números do diagnóstico: 5 contas, 9 sem conta, 6 grupos/17 linhas, 3 pagamentos, 1 parcela |
| `contas_divergentes` | Para cada conta: inicial, persistido, calculado, delta, quantidade de lançamentos de origem/destino, até 20 logs da conta em `audit_logs` e até 5 logs de transações que a tocam |
| `lancamentos_sem_conta` | Os 9 lançamentos sem `account_id`, com ID, data, valor, tipo, categoria e autor |
| `grupos_duplicados` | Os 6 grupos com 17 linhas, com os IDs envolvidos e intervalo de `created_at` |
| `pagamentos_ambiente_divergente` | Os 3 pagamentos cuja conta pertence a outro `environment`, com o ambiente de pagamento, conta e transação |
| `parcelas_amountpaid_divergente` | A parcela com `amountPaid` diferente da soma de pagamentos, com todos os pagamentos e estornos vinculados |
| `previsao_por_status` | Linhas e valores de `vw_cash_flow_forecast` por ambiente/status, separando contratos cancelados, estornadas e parciais com saldo |
| `previsao_linhas_afetadas` | As parcelas da view que estão canceladas, estornadas ou parcialmente pagas |
| `previsao_vs_projecao` | Comparação por ambiente entre `vw_cash_flow_forecast` e `get_future_receivables_projection`, com o mês atual isolado |

## Interpretação prevista

Ausência de linha em `audit_logs` **não prova** que uma ação nunca ocorreu —
apenas que não foi registrada. O mesmo critério foi usado no rastreio de
estornos de 25/11 (`docs/RASTREIO-ESTORNOS-RESULTADO-20261125.md`).

Nenhuma correção será proposta apenas com base nesta célula. Se houver mudança,
ela passa por medição prévia, `forward`/`verify`/`rollback` e autorização
explícita do usuário.

## Resultado

Pendente — preencher depois que o usuário colar a saída da célula.
