# Correção — recebimento parcial bloqueado por "contrato quitado" (25/11/2026)

## Sintoma

Ao confirmar um **recebimento parcial** em Contas a Receber, o PostgREST devolvia:

```
POST /rest/v1/rpc/rpc_receber_parcela_com_metodo  →  400
code: P0001
message: "Não é possível reabrir um contrato quitado."
```

A transação era revertida por completo: nenhum pagamento, residual ou lançamento de caixa ficava gravado.

## Causa raiz

`rpc_recebimento_com_desdobramento` (v7 em produção) fecha a parcela original **antes** de criar a residual:

```sql
UPDATE installments
   SET "amountPaid" = v_total_acumulado,
       status = 'Quitado'
 WHERE id = p_installment_id;

INSERT INTO installments (...) VALUES (..., v_novo_saldo, 0, 'Aberto', ...);
```

`trg_recalculate_contract_on_installment` roda **ao fim de cada statement**:

1. após o `UPDATE`, se aquela era a **última parcela em aberto**, `v_open = 0` e `v_received > 0` → o contrato vira `Quitado`;
2. o `INSERT` da residual roda o recálculo de novo → tenta `Quitado → Parcial`;
3. `prevent_update_delete_paid_contract` (BEFORE UPDATE, primeiro por ordem alfabética) lança `Não é possível reabrir um contrato quitado.`. Se ele não barrasse, `fn_protect_contracts_status` lançaria `BLOQUEADO: OLD=Quitado, NEW=Parcial`.

Isso não era um problema de dados: `contratos_quitados_com_saldo_aberto = []`. Era só a proteção reagindo a um estado **intermediário** da própria transação.

### Universo afetado

Toda parcela que seja a **única em aberto** do contrato — na prática, quase todos os contratos de parcela única e também os `Parcial`/`Prorrogado` no último saldo. O diagnóstico listou **48 títulos** nessa condição (`parcelas_ultima_em_aberto`).

## Correção aplicada

Script: `docs/CORRECAO-RECEBIMENTO-PARCIAL-20261125.sql` (commit `2134bf1`).

`CREATE OR REPLACE` em duas funções de proteção, com **uma única exceção**:

```sql
Quitado → Parcial
SOMENTE SE existir parcela real em aberto
(status fora de quitado/cancelado/cancelada/estornado e saldo > 0,01)
```

- `prevent_update_delete_paid_contract()` — exceção antes do bloqueio de reabertura;
- `fn_protect_contracts_status()` — mesma exceção antes do `BLOQUEADO`.

A condição é **a mesma regra usada por `fn_recalculate_contract_totals`**, então a reabertura só passa quando o recálculo tem base real. Contrato efetivamente quitado, sem parcela com saldo, continua bloqueado.

Não foram alterados: gatilhos, tabelas, dados, RPCs, policies, grants ou o front.

## Verificação

Execução em produção (25/11/2026), célula `correcao_recebimento_parcial`:

| Indicador | Resultado |
|---|---|
| `backup_objetos` | 4 (2 funções + 2 gatilhos) |
| `prevent_update_delete_paid_contract_v3` | `true` |
| `fn_protect_contracts_status_v3` | `true` |
| `gatilhos_de_protecao_intactos` | 2 |

## Comportamento esperado no recebimento parcial

1. parcela original fica `Quitado` com o valor pago;
2. surge a residual `Aberto` com o saldo restante e numeração nova;
3. contrato passa para `Parcial`, com `amountReceived`/`amountReceivable` recalculados;
4. **um** lançamento em `financial_transactions` e **um** registro em `payments`.

Observação: o `audit_contracts` registra o estado intermediário (`Quitado`) e o final (`Parcial`) na mesma transação. É ruído de auditoria esperado, sem efeito financeiro.

## Rollback

As definições anteriores estão em `backup_contratos_protecao_20261125`. O bloco de rollback (comentado no fim do script) reexecuta `pg_get_functiondef` capturado:

```sql
BEGIN;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT definicao
      FROM public.backup_contratos_protecao_20261125
     WHERE objeto LIKE 'function:%'
     ORDER BY capturado_em
  LOOP
    EXECUTE r.definicao;
  END LOOP;
END $$;
COMMIT;
```

## Validação funcional (25/11/2026)

Reteste aprovado pelo usuário na tela, com o recebimento parcial de R$ 811,00 na parcela 207 (contrato 120):

- parcela original `Quitado` com pago 811,00 e a receber 0,00;
- residual `Aberto` com 810,00;
- extrato mostrando o recebimento integral de 1.621,00, o estorno e o novo recebimento de 811,00, com total recebido 811,00.

Fluxo de estorno seguido de recebimento parcial validado ponta a ponta.
