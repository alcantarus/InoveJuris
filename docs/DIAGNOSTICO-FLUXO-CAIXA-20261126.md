# Diagnóstico do módulo Fluxo de Caixa — resultado da execução (26/11/2026)

> **Regra permanente:** um único banco (PostgreSQL 17.6). `production` e `test`
> são valores da coluna `environment`, não bancos separados. Toda rotina declara
> o ambiente e inclui `environment` no filtro ou no resultado. Ver
> `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

## Execução

- Script: `docs/DIAGNOSTICO-FLUXO-CAIXA-20261126.sql`, uma única célula
  (`diagnostico_fluxo_caixa_20261126`), somente leitura, finalizada em `rollback`.
- Coletado em **2026-11-26T13:25:28.3493+00:00**, PostgreSQL **17.6**.
- Ambientes consultados: `production` e `test`. Período do mês atual:
  01/11/2026 a 30/11/2026.
- Nenhum `UPDATE`/`DELETE` em dados de negócio foi executado ou autorizado.
  Nenhum rollback de mudança foi acionado.

## Veredito

**O módulo não está plenamente saudável.** O isolamento por `environment`, as
policies de RLS e as views do dashboard estão corretos. Os problemas estão
concentrados em três frentes:

1. **saldo persistido divergente** em 5 contas de `production`;
2. **escrita de saldo em três camadas**, com uma RPC que não existe no banco;
3. **KPIs e previstas da visão geral incompletos ou zerados**.

`test` está consistente: zero divergências de saldo e volume bem abaixo do
limite que quebra os KPIs. Todos os achados abaixo são, portanto, de
`production`, salvo indicação explícita.

## Classificação dos achados

| # | Achado | Classificação | Evidência |
|---|---|---|---|
| 1 | Saldo persistido × saldo recalculado divergente | **Confirmado — P0** | 5 contas em `production`, delta líquido **-11.271,90**; `test` 0/0 |
| 2 | Escrita de saldo em três camadas; RPC `update_account_balance` sem assinatura | **Confirmado — P0** | função só com `args: ""` e `retorno: trigger`; 1 trigger ativo na tabela |
| 3 | KPIs da visão geral calculados sobre no máximo 100 linhas | **Confirmado — P1** | `production` tem **122** transações no mês; `test`, 14 |
| 4 | Receitas/Saídas Previstas sempre zeradas | **Confirmado — P1** | `installments.type` **não existe**; o front filtra `i.type` |
| 5 | Policies `USING (true)` nas tabelas financeiras | **Refutado** | RLS ativo nas 5 tabelas; 0 policies sem filtro; policy `P0 sessao` valida `_rls_can_access()` + `environment` do JWT |
| 6 | Views com `environment` e `security_invoker=on` | **Confirmado — ponto bom** | 4 views analisadas, todas com `reloptions = security_invoker=on` |
| 7 | RPCs com `p_environment` | **Confirmado — ponto bom** | `get_financial_summary`, `get_financial_chart_data`, `get_future_receivables_projection` |
| 8 | Tipos fora do padrão em lançamentos | **Refutado** | `check_transaction_type` existe; 0 linhas fora de `income`/`expense`/`transfer` |
| 9 | Ausência de `CHECK (amount > 0)` | **Confirmado — P2** | nenhuma constraint de valor positivo; 0 linhas inválidas hoje |
| 10 | Ausência de `UNIQUE` para contas/categorias | **Confirmado — risco latente** | 0 duplicatas hoje, mas nada impede novas |
| 11 | `ON DELETE CASCADE` em transações e pagamentos | **Confirmado — P2** | excluir conta apaga lançamentos; excluir parcela apaga pagamentos |
| 12 | Lançamentos sem conta | **Confirmado — P1** | 9 linhas; não afetam saldo de conta alguma |
| 13 | Lançamentos sem categoria | **Confirmado — P2** | 110 linhas; `get_financial_chart_data` as agrupa como "Sem Categoria" |
| 14 | Grupos duplicados de lançamentos | **Confirmado — P1, pendente de interpretação** | 6 grupos, 17 linhas |
| 15 | Pagamentos com conta de ambiente diferente | **Confirmado — P1 de isolamento** | 3 linhas; 0 com transação de ambiente diferente |
| 16 | Parcela com `amountPaid` divergente da soma de pagamentos | **Confirmado — P1** | 1 parcela |
| 17 | Reversões sem vínculo com pagamento original | **Confirmado — já conhecido** | 9 sem vínculo, 1 com vínculo (10 no total) |
| 18 | Ausência de `schema_migrations` | **Confirmado — P2** | `schema_migrations_existe: false`; migrações `-1`/`-2` seguem sem fonte de verdade |
| 19 | Rótulo `permissiva` invertido no próprio diagnóstico | **Corrigido** | era `p.permissive = 'r'`; corrigido para `= 'P'` e o contador renomeado |

## 1. Saldo persistido × saldo recalculado — confirmado (P0)

`delta = current_balance - saldo_calculado`, onde `saldo_calculado` parte de
`initial_balance` e aplica entradas, saídas e transferências de/para a conta.

| Ambiente | Contas | Divergentes | Delta |
|---|---:|---:|---:|
| `test` | 5 | 0 | 0,00 |
| `production` | 8 | 5 | **-11.271,90** |

Contas divergentes em `production`:

| ID | Conta | Persistido | Calculado | Delta |
|---:|---|---:|---:|---:|
| 2 | Caixa Econômica Federal | 0,00 | 4.600,00 | -4.600,00 |
| 3 | Inter | 546,45 | 10.616,45 | -10.070,00 |
| 5 | Cofre | 54.000,00 | 57.000,00 | -3.000,00 |
| 6 | Banco do Brasil | 1.512,10 | 1.614,00 | -101,90 |
| 16 | Mercantil | 2.016,42 | -4.483,58 | +6.500,00 |

Quatro contas têm saldo gravado **menor** que o histórico; a conta 16 tem saldo
gravado **maior**. O delta total é -11.271,90, mas isso não significa que
"faltam R$ 11.271,90" — os sinais se compensam parcialmente e a conta 16
chega a ter saldo calculado negativo.

**Não é possível afirmar a causa com esta medição.** Há três mecanismos
candidatos, todos confirmados no código:

- `app/fluxo-caixa/movimentacoes/page.tsx:404-416` grava `current_balance` com
  valor lido em cache antes do lançamento, sobrescrevendo o que o trigger já
  escreveu no banco;
- `:396-401` chama uma RPC `update_account_balance(acc_id, amount_change)` que
  **não existe** — só existe a função trigger `update_account_balance()`, sem
  argumentos (o retorno da chamada não é verificado);
- `app/fluxo-caixa/contas/page.tsx:83-128` recalcula o saldo em memória a partir
  de `initial_balance`, enquanto a visão geral
  (`app/fluxo-caixa/page.tsx:179`) usa o `current_balance` persistido. Resultado:
  as telas podem mostrar números diferentes para a mesma conta.

Antes de qualquer correção é preciso decidir qual é a fonte de verdade e
rastrear as 5 contas no log de auditoria.

## 2. KPIs e previstas da visão geral — confirmado (P1)

`app/fluxo-caixa/page.tsx:155` busca no máximo **100** lançamentos
(`.limit(100)`) e calcula entradas, saídas, maior saída e gráfico de 30 dias em
cima dessa amostra.

| Ambiente | Transações no mês | Excede 100? |
|---|---:|---|
| `production` | 122 | **sim** |
| `test` | 14 | não |

Os números completos do mês, vindos do banco (`get_financial_summary`), são:

| Ambiente | Entradas | Saídas | Transferências |
|---|---:|---:|---:|
| `production` | 13.214,54 | 10.235,91 | 20.989,44 |
| `test` | 21.000,00 | 100,00 | 0,00 |

Além disso, `receitasPrevistas` e `despesasPrevistas` (`:192-198`) filtram
`installments.type === 'income' / 'expense'`, mas a coluna `type` **não existe**
em `installments` (confirmado no catálogo). As duas previstas da visão geral
são, portanto, **zero** em ambos os ambientes.

> Isso é distinto da "Previsão 30d" de Contas a Receber, já decidida no item 3.2.
> Aqui se trata apenas dos KPIs da visão geral de Fluxo de Caixa.

## 3. Pontos bons confirmados

- **Isolamento:** RLS ativo em `bank_accounts`, `financial_categories`,
  `financial_transactions`, `payments` e `installments`. A policy `P0 sessao`
  combina `_rls_can_access(NULL::text)` com
  `environment = COALESCE(NULLIF(jwt.claims->>'environment', ''), 'production')`.
  Nenhuma policy `USING (true)` e nenhuma sem condição.
- **Views:** `vw_cash_flow_forecast`, `vw_dashboard_receivables_forecast`,
  `vw_dashboard_receivables_metrics` e `vw_dashboard_top_defaulters` expõem
  `environment` e usam `security_invoker=on`.
- **RPCs:** assinaturas com `p_environment` conferem; nenhuma é
  `SECURITY DEFINER`; `get_financial_summary`, `get_financial_chart_data` e
  `get_future_receivables_projection` executam apenas como `authenticated`.
- **Valores e ambientes:** 0 valores não positivos, 0 tipos fora do padrão,
  0 `environment` nulo ou fora de `production`/`test`, 0 transações com
  conta/categoria/conta de destino de ambiente diferente.
- **Projeção 30 dias:** `production` de 11/2026 a 05/2027 e 11/2027 e 05/2028;
  `test` em 02/2027 e 09/2027. `vw_cash_flow_forecast` devolve 8 linhas /
  R$ 31.922,64 em `production` e 3 linhas / R$ 12.350,00 em `test`.

## 4. Pontos que exigem aprofundamento antes de decidir

| Item | Número medido | Por que não decidir agora |
|---|---|---|
| 6 grupos duplicados (17 linhas) | `grupos_duplicados: 6` | Podem ser lançamentos legítimos com descrição repetida; excluir sem rastrear é arriscado |
| 3 pagamentos com conta de ambiente diferente | `pagamento_conta_de_ambiente_diferente: 3` | É preciso saber se o pagamento ou a conta está no ambiente errado |
| 1 parcela com `amountPaid` divergente | `parcelas_amountpaid_diferente_soma_pagamentos: 1` | Pode ser juros/multa separados, caso já fechado em Contratos |
| 9 transações sem conta | `transacoes_sem_conta: 9` | Podem ser lançamentos históricos-intencionais; precisam de IDs e datas |
| `vw_cash_flow_forecast` × projeção da RPC | R$ 31.922,64 × R$ 10.726,00 em nov/2026 | A view usa `amount` cheio e não exclui canceladas/estornadas; a RPC usa saldo e exclui. Medir quantas parcelas afetadas antes de mexer |
| Ausência de `CHECK (amount > 0)` / `UNIQUE` | 0 linhas inválidas hoje | Risco latente; mudança estrutural exige medição prévia e `forward`/`verify`/`rollback` |

## 5. Próximo passo

Preparar `docs/APROFUNDAMENTO-FLUXO-CAIXA-20261126.sql`, também somente
leitura e em uma única célula, para detalhar:

1. as 5 contas divergentes com o histórico de `financial_transactions` e os
   registros de `audit_log` correspondentes;
2. os 9 lançamentos sem conta e os 6 grupos duplicados, com IDs e datas;
3. os 3 pagamentos com conta de ambiente diferente, com `environment` de
   pagamento e de conta;
4. a parcela com `amountPaid` divergente;
5. as parcelas de `vw_cash_flow_forecast` que estão canceladas/estornadas ou
   parcialmente pagas.

Só depois disso, e com autorização explícita, defender qualquer correção —
com medição prévia, `forward`/`verify`/`rollback` e `environment` declarado.
Nenhuma escrita em dados de negócio foi feita até aqui.
