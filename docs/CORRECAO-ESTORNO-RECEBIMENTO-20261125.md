# Correção — recebimento parcial em parcela estornada (25/11/2026)

## Sintoma

Depois de estornar um recebimento, o mesmo título não aceitava mais recebimento **parcial**:

```
POST /rest/v1/rpc/rpc_receber_parcela_com_metodo  →  400
code: P0001
message: "A parcela 207 não possui saldo para desdobramento (status: Estornado)."
```

O recebimento **integral** no mesmo título funcionava normalmente.

## Contexto do caso

Parcela 207 / contrato 120 — Jessica Gomes Alves de Souza, produção, total R$ 1.621,00:

1. recebimento integral de **1.621,00**;
2. estorno do recebimento ("Erro no recebimento");
3. tentativa de recebimento parcial de **811,00** → erro acima.

O estorno deixou a parcela `Estornado` com `amountPaid = 0` e o contrato `Estornado`.

## Causa raiz

`rpc_recebimento_com_desdobramento` (v7, de 21/11) bloqueava o desdobramento para qualquer parcela em estado de encerramento:

```sql
IF v_status IN ('quitado', 'cancelado', 'cancelada', 'estornado', 'estornada') THEN
  RAISE EXCEPTION 'A parcela % não possui saldo para desdobramento (status: %)...';
```

A guarda está correta para `Quitado`/`Cancelado`, mas não para `Estornado`: o estorno **devolve o título ao aberto** e zera o valor pago. A inconsistência era que `process_installment_payment` (recebimento integral) **não** bloqueia `Estornado`, então só o caminho parcial falhava.

A rotina não foi alterada entre 21/11 e 25/11. O teste de 21/11 usou um título que nunca havia sido estornado; o cenário "estornar e depois receber parcial" não estava coberto.

## Correção aplicada

Script: `docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.sql` (commit `24d510f`).

`CREATE OR REPLACE` apenas em `rpc_recebimento_com_desdobramento`:

| Status da parcela | Comportamento |
|---|---|
| `Quitado` / `Cancelado` / `Cancelada` | bloqueado (inalterado) |
| `Estornado` com `amountPaid > 0` | bloqueado — exige regularização do valor residual |
| `Estornado` com `amountPaid = 0` | **permite** novo recebimento, inclusive parcial |
| Demais status | inalterado |

Nada mais mudou: cálculo do saldo, residual, lançamento de caixa e `payments` seguem iguais. Gatilhos, tabelas, policies, grants e front intactos.

O front já permitia o botão **Receber** em `Estornado` (só desabilita `Quitado`/`Cancelada`), então não houve alteração de tela.

## Verificação

Execução em produção (25/11/2026), célula `correcao_estorno_recebimento`:

| Indicador | Resultado |
|---|---|
| `backup_objetos` | 1 |
| `rpc_recebimento_com_desdobramento_v8` | `true` |
| `ainda_bloqueia_quitado_cancelado` | `true` |

## Comportamento esperado no reteste

Receber **811,00** na parcela 207:

1. parcela 207 fica `Quitado` com `amountPaid = 811`;
2. surge residual `Aberto` com `amount = 810` e numeração nova;
3. contrato 120 passa para `Parcial` (recebido 811 / a receber 810);
4. **um** lançamento em `financial_transactions` e **um** registro em `payments`.

## Rollback

Definição anterior em `backup_recebimento_desdobramento_20261125`. Bloco de rollback comentado no fim do script:

```sql
BEGIN;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT definicao
      FROM public.backup_recebimento_desdobramento_20261125
     WHERE objeto LIKE 'function:%'
     ORDER BY capturado_em
  LOOP
    EXECUTE r.definicao;
  END LOOP;
END $$;
COMMIT;
```

## Validação funcional (25/11/2026)

Reteste aprovado pelo usuário na tela:

- recebimento parcial de **R$ 811,00** na parcela 207 (contrato 120, Jessica Gomes Alves de Souza);
- parcela 1: valor 1.621,00 / pago 811,00 / a receber 0,00 / `Quitado`;
- parcela 2 (residual): valor 810,00 / pago 0,00 / a receber 810,00 / `Aberto`;
- extrato do contrato: recebimento PIX 1.621,00, estorno 1.621,00 e novo recebimento PIX 811,00 — total recebido 811,00.

O fluxo estorno → novo recebimento parcial está fechado.

## Evidência de auditoria (diagnóstico somente leitura)

Execução de `docs/DIAGNOSTICO-PARCELA-207-20261125.sql` em 25/11/2026 (`coletado_em=2026-11-25T07:58:01Z`), sem escrita:

| Objeto | Estado |
|---|---|
| Parcela 207 | `Quitado`, `amount = 1.621,00`, `amountPaid = 811,00` |
| Parcela 256 (residual) | `Aberto`, `amount = 810,00`, `amountPaid = 0` |
| Contrato 120 | `Parcial`, recebido 811,00 / a receber 810,00 |
| `payments` | 1.621,00 (`payment`) → 1.621,00 (`reversal`, `reverses_payment_id` = pagamento original) → 811,00 (`payment`, `financial_transaction_id = 1281`) |
| `financial_transactions` | apenas a transação 1281, de 811,00 |

A trilha de auditoria registra a sequência `Prorrogada → Quitado → Estornado → Quitado → Parcial` nas parcelas e `Prorrogado → Quitado → Estornado → Parcial` no contrato, tudo dentro das transações correspondentes. O estorno tem vínculo explícito com o pagamento original, o que permite ao relatório excluir corretamente o par estornado.

Observação: a residual herda o vencimento original (24/11/2026), por isso aparece como 1 dia em atraso — comportamento esperado do desdobramento.
