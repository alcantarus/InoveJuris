# HANDOFF — Contratos / Contas a Receber

**Encerrado em:** 21/11/2026
**Objetivo:** retomar sem reconstruir histórico. Diagnóstico original em `RELATORIO-CONTRATOS-CONTAS-A-RECEBER-20261121.md`.
**Alvo das alterações:** **produção**. Homologação (`test`) não foi alterada nesta rodada, exceto as 3 reparações de Fase A já autorizadas (contratos 66, 68, 69).

---

## 1. Regras de trabalho mantidas

- Um comando SQL por etapa; o usuário executa no SQL Editor e devolve o resultado antes da próxima.
- O agente **não tem credenciais de banco** e não executa SQL em produção.
- O SQL Editor **não aplica o Proxy de ambiente** — todo comando filtra `environment` explicitamente.
- Backup antes de alterações.
- Não alterar autenticação, permissões ou fluxo financeiro sem autorização.
- Nomenclatura **Publicações** (nunca "Intimações").
- Grafia canônica: parcela **`Cancelada`**, contrato **`Cancelado`**.
- Não repetir teste financeiro já validado pelo usuário.
- Editor mostra só o último resultset; não usar tabela temporária (`42P01`). Usar CTE + `jsonb_build_object`.
- CTEs irmãs veem o **mesmo snapshot**: um `SELECT` de conferência na mesma instrução de um `UPDATE` lê o estado anterior. Conferir sempre em comando separado.

---

## 2. Decisões de negócio registradas

| Tema | Decisão |
|---|---|
| Contrato `Estornado` | Pode voltar a receber pagamento (opção A) |
| Pro bono sem saldo aberto | Permanece `Quitado` |
| `Atrasada` | Opção B — calcular na hora, **sem gravar status** |
| Duplicidade em `test` (contrato 75, parcelas 116/144) | **Pulada**, sem alteração |
| Parcelas 72/73 | Criar pagamento + registro de caixa, **sem impacto de saldo** (`account_id = NULL`, categoria 13, datas de vencimento) |
| 4 pagamentos sem caixa | 27/28 alinhados ao caixa existente (tx 16/17); 153/103 com registro sem saldo e `account_id` do pagamento ajustado para `NULL`; `environment` normalizado |
| Sobrecarga legada de 7 argumentos | Removida |

---

## 3. Backups

| Tabela | Linhas |
|---|---:|
| `backup_contracts_20261121` | 122 |
| `backup_installments_20261121` | 166 |
| `backup_payments_20261121` | 160 |

Definição da sobrecarga legada (salva antes do `DROP`, para restaurar se necessário):

```sql
CREATE OR REPLACE FUNCTION public.process_installment_payment(
  p_installment_id bigint,
  p_amount_paid numeric,
  p_date timestamp with time zone,
  p_account_id bigint,
  p_category_id bigint,
  p_description text,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_amount_paid DECIMAL;
    v_total_amount DECIMAL;
    v_new_amount_paid DECIMAL;
BEGIN
    SELECT amount, COALESCE(amountPaid, 0)
      INTO v_total_amount, v_current_amount_paid
      FROM public.installments
     WHERE id = p_installment_id;

    v_new_amount_paid := v_current_amount_paid + p_amount_paid;

    INSERT INTO public.payments
        (installment_id, amount, payment_date, account_id, category_id, description, user_id)
    VALUES
        (p_installment_id, p_amount_paid, p_date, p_account_id, p_category_id, p_description, p_user_id);

    UPDATE public.installments
       SET amountPaid = v_new_amount_paid,
           status = CASE WHEN v_new_amount_paid >= v_total_amount THEN 'Quitado' ELSE 'Parcial' END
     WHERE id = p_installment_id;
END;
$$;
```

---

## 4. Banco — objetos aplicados em produção

| Objeto | Versão / estado |
|---|---|
| `fn_recalculate_contract_totals()` | **v4 20261121** — detecta gatilho em `installments` (`NEW.contract_id`) e em `payments` (`NEW.installment_id` → busca `contract_id`). Regras: cancelado, estornado, pro bono, prorrogado. Marcador `v4 20261121` |
| `fn_protect_contracts_status()` | v2 — permite gravar `Cancelado`/`Cancelada`/`Estornado`, regravar mesmo status e reabrir `Estornado` |
| `prevent_update_delete_paid_contract()` | v2 — permite `Quitado`/`Prorrogado`/`Estornado` → `Quitado`/`Cancelado`/`Estornado` |
| `contract_receivables_summary` | Corrigida; acrescentados `overdue_amount`, `overdue_installments`, `is_overdue` e mantida coluna `environment` |
| `process_contract_cancellation(bigint,text,bigint)` | v2 — idempotente, testada com `ROLLBACK`/subtransação |
| `payments.financial_transaction_id` | Coluna nova (`bigint` → `financial_transactions(id) ON DELETE SET NULL`) |
| `payments.reverses_payment_id` | Coluna nova (`uuid` → `payments(id) ON DELETE SET NULL`) |
| `process_installment_estorno(bigint,text,bigint,bigint)` | **v7 20261121** — apaga somente a transação vinculada por ID; recusa segundo estorno; grava `reversal` referenciando o pagamento original |
| `rpc_recebimento_com_desdobramento(...)` 9 args | **v7 20261121** — não sobrescreve `amount`; residual com `MAX(installmentNumber)+1`; grava `payments` vinculado à transação; bloqueia `Cancelado`/`Cancelada` |
| `process_installment_payment(...)` 9 args | **v7 20261121** — sem `UPDATE contracts` manual; recálculo fica só no gatilho v4 |
| `process_installment_payment(...)` 5 args | **v7 20261121** — nova sobrecarga para o lote (`bigint, numeric, text, bigint, bigint`) |
| `process_installment_payment(...)` 7 args | **Removida** (B23) |

Gatilhos de recálculo presentes: `trg_recalculate_contract_on_installment` (em `installments`) e `trg_recalculate_contract_on_payment` (em `payments`), ambos chamando `fn_recalculate_contract_totals()`.

---

## 5. Reparação de dados já executada

- **Fase A:** 9 contratos cancelados reparados — produção 39, 54, 84, 95, 96, 97; teste 66, 68, 69. Todos com `amountReceivable = 0`, `amountReceived = 0`, `parcelas_vivas = 0`.
- **Fase B:** 31 contratos `Aberto → Prorrogado` em produção; `total_a_receber = 252935,20`.
- **Fase C:** 12 contratos/12 parcelas atrasados em produção (`62960,00`); teste 3 contratos/5 parcelas (`14000,00`) — apenas diagnóstico.
- **Fase E:** 4 pagamentos restaurados (parcelas 17, 20 e dois na 6); parcelas 72/73 com registro sem saldo (`3638,09`); parcelas 27/28 alinhadas ao caixa; parcelas 153/103 com registro sem saldo (`200,00`); `environment` de `c2c02242…` normalizado.
- **Resultado:** `divergencias_restantes = 0`, `pagamentos_sem_caixa = 0`, `environments_invalidos = 0`.

Ambientes: `contracts` 106 produção / 16 teste; `installments` 117 / 49; `payments` 113 produção / 46 teste (havia 1 registro com `production\r\n`, corrigido).

**Status final de produção:** `Aberto 11`, `Parcial 3`, `Quitado 53`, `Cancelado 6`, `Prorrogado 33`.
**Status final de teste:** `Aberto 1`, `Cancelado 3`, `Parcial 4`, `Quitado 8`.

---

## 6. Código local alterado — **ainda não publicado**

| Arquivo | Ajuste |
|---|---|
| `lib/supabase.ts` | `processContractCancellation` usa RPC com fallback seguro |
| `app/contratos/page.tsx` | Cancelamento, segunda via, `reloadContracts`, cores/estados; estorno sem `setTimeout` nem chave `'"amountPaid"'`; recarga real do banco; `Cancelado` antes de `Estornado` nas 3 tabelas |
| `app/contas-a-receber/page.tsx` | `isLate` exclui `Prorrogada`/`Estornado`; `totalOpen` e filtro usam campos calculados da view; prorrogação; lote; após estorno recarrega parcelas + contratos + KPIs |
| `components/contas-a-receber/ContractStatementModal.tsx` | Reversões subtraídas do total e exibidas em vermelho com sinal `−`; `uniqueInstallments` ignora reversões |

`npx tsc --noEmit` executado sem erros após todas as edições.

---

## 7. Aceite (última execução)

Todos os indicadores limpos: `cancelados_inconsistentes = null`, `totais_inconsistentes = null`, `divergencias_pagamentos = 0`, `pagamentos_sem_caixa = 0`, `estornos_inconsistentes = null`, `duplicidade_numeros = null`, `funcoes_fora_do_padrao = null`, `sobrecarga_legada_presente = 0`, `environments_invalidos = 0`.

`reversoes_producao = 3` e a distribuição de status permaneceu inalterada — portanto **os testes na tela ainda não foram executados em produção**. A aceite funcional segue pendente.

### SQL de aceite (reutilizável)

```sql
WITH
cancelados AS (
    SELECT c.id, c."amountReceivable", c."amountReceived",
           COUNT(i.id) FILTER (
               WHERE lower(COALESCE(i.status, '')) NOT IN ('cancelado', 'cancelada')
           ) AS parcelas_vivas
    FROM contracts c
    LEFT JOIN installments i ON i.contract_id = c.id
    WHERE lower(COALESCE(c.status, '')) = 'cancelado'
      AND btrim(COALESCE(c.environment, ''), E' \t\r\n') = 'production'
    GROUP BY c.id, c."amountReceivable", c."amountReceived"
),
totais AS (
    SELECT c.id, c.status, c."amountReceivable", c."amountReceived",
           COALESCE(SUM(GREATEST(i.amount - COALESCE(i."amountPaid", 0), 0))
               FILTER (WHERE lower(COALESCE(i.status, '')) NOT IN
                       ('quitado', 'cancelado', 'cancelada', 'estornado')), 0) AS esperado_receber,
           COALESCE(SUM(i."amountPaid"), 0) AS esperado_recebido
    FROM contracts c
    LEFT JOIN installments i ON i.contract_id = c.id
    WHERE btrim(COALESCE(c.environment, ''), E' \t\r\n') = 'production'
      AND lower(COALESCE(c.status, '')) <> 'cancelado'
    GROUP BY c.id, c.status, c."amountReceivable", c."amountReceived"
),
div AS (
    SELECT i.id
    FROM installments i
    LEFT JOIN payments pm ON pm.installment_id = i.id
    WHERE btrim(COALESCE(i.environment, ''), E' \t\r\n') = 'production'
    GROUP BY i.id, i."amountPaid"
    HAVING i."amountPaid" IS DISTINCT FROM COALESCE(
        SUM(pm.amount) FILTER (WHERE lower(COALESCE(pm.type, 'payment')) = 'payment'), 0
    )
),
sem_caixa AS (
    SELECT p.id
    FROM payments p
    WHERE lower(COALESCE(p.type, 'payment')) = 'payment'
      AND btrim(COALESCE(p.environment, ''), E' \t\r\n') = 'production'
      AND NOT EXISTS (
          SELECT 1 FROM financial_transactions ft
          WHERE lower(ft.type) = 'income'
            AND ft.amount = p.amount
            AND ft.date = p.payment_date::date
            AND ft.account_id IS NOT DISTINCT FROM p.account_id
            AND btrim(COALESCE(ft.environment, ''), E' \t\r\n') =
                btrim(COALESCE(p.environment, ''), E' \t\r\n')
      )
),
estornos AS (
    SELECT i.id AS parcela, i.contract_id, i."amountPaid",
           EXISTS (SELECT 1 FROM payments p
                    WHERE p.installment_id = i.id
                      AND lower(COALESCE(p.type, '')) = 'reversal') AS tem_reversal
    FROM installments i
    WHERE lower(COALESCE(i.status, '')) = 'estornado'
      AND btrim(COALESCE(i.environment, ''), E' \t\r\n') = 'production'
),
duplicidade AS (
    SELECT i.contract_id, i."installmentNumber", COUNT(*) AS quantidade
    FROM installments i
    WHERE btrim(COALESCE(i.environment, ''), E' \t\r\n') = 'production'
    GROUP BY i.contract_id, i."installmentNumber"
    HAVING COUNT(*) > 1
),
funcoes AS (
    SELECT p.proname, pg_get_function_arguments(p.oid) AS args,
           pg_get_functiondef(p.oid) LIKE '%v7 20261121%' AS versao_v7
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('process_installment_estorno',
                        'process_installment_payment',
                        'rpc_recebimento_com_desdobramento')
),
status_contratos AS (
    SELECT status, COUNT(*) AS total
    FROM contracts
    WHERE btrim(COALESCE(environment, ''), E' \t\r\n') = 'production'
    GROUP BY status
)
SELECT jsonb_build_object(
    'cancelados_inconsistentes', (
        SELECT jsonb_agg(jsonb_build_object(
                   'contrato', c.id, 'parcelas_vivas', c.parcelas_vivas,
                   'a_receber', c."amountReceivable", 'recebido', c."amountReceived"
               ) ORDER BY c.id)
        FROM cancelados c
        WHERE c.parcelas_vivas > 0
           OR COALESCE(c."amountReceivable", 0) <> 0
           OR COALESCE(c."amountReceived", 0) <> 0
    ),
    'totais_inconsistentes', (
        SELECT jsonb_agg(jsonb_build_object(
                   'contrato', t.id, 'status', t.status,
                   'a_receber_gravado', t."amountReceivable",
                   'a_receber_esperado', t.esperado_receber,
                   'recebido_gravado', t."amountReceived",
                   'recebido_esperado', t.esperado_recebido
               ) ORDER BY t.id)
        FROM totais t
        WHERE ABS(COALESCE(t."amountReceivable", 0) - t.esperado_receber) > 0.01
           OR ABS(COALESCE(t."amountReceived", 0) - t.esperado_recebido) > 0.01
    ),
    'divergencias_pagamentos', (SELECT COUNT(*) FROM div),
    'pagamentos_sem_caixa', (SELECT COUNT(*) FROM sem_caixa),
    'estornos_inconsistentes', (
        SELECT jsonb_agg(jsonb_build_object(
                   'parcela', e.parcela, 'contrato', e.contract_id,
                   'pago', e."amountPaid", 'tem_reversal', e.tem_reversal
               ) ORDER BY e.parcela)
        FROM estornos e
        WHERE COALESCE(e."amountPaid", 0) <> 0 OR NOT e.tem_reversal
    ),
    'duplicidade_numeros', (
        SELECT jsonb_agg(jsonb_build_object(
                   'contrato', d.contract_id, 'numero', d."installmentNumber",
                   'quantidade', d.quantidade
               ) ORDER BY d.contract_id, d."installmentNumber")
        FROM duplicidade d
    ),
    'funcoes_fora_do_padrao', (
        SELECT jsonb_agg(jsonb_build_object(
                   'nome', f.proname, 'args', f.args, 'versao_v7', f.versao_v7
               ) ORDER BY f.proname, f.args)
        FROM funcoes f
        WHERE NOT f.versao_v7
    ),
    'sobrecarga_legada_presente', (
        SELECT COUNT(*) FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.proname = 'process_installment_payment'
          AND pg_get_function_result(p.oid) = 'void'
    ),
    'environments_invalidos', (
        SELECT
            (SELECT COUNT(*) FROM payments
              WHERE COALESCE(environment, '') <> btrim(COALESCE(environment, ''), E' \t\r\n'))
          + (SELECT COUNT(*) FROM financial_transactions
              WHERE COALESCE(environment, '') <> btrim(COALESCE(environment, ''), E' \t\r\n'))
    ),
    'reversoes_producao', (
        SELECT COUNT(*) FROM payments p
        WHERE lower(COALESCE(p.type, '')) = 'reversal'
          AND btrim(COALESCE(p.environment, ''), E' \t\r\n') = 'production'
    ),
    'contratos_por_status', (
        SELECT jsonb_object_agg(s.status, s.total) FROM status_contratos s
    )
) AS aceite;
```

Interpretação: tudo `null`/`0`; `reversoes_producao` e `contratos_por_status` são informativos. Se `reversoes_producao` subir de 3, o estorno pela tela gravou corretamente.

---

## 8. Pendências para a próxima atividade

1. **Publicar o código local** e executar os 6 cenários de teste na tela:
   1. Cancelar contrato sem pagamento (e repetir para idempotência);
   2. Prorrogar parcela (contrato `Prorrogado` + previsão 30 dias);
   3. Estornar parcela paga (`amountPaid = 0`, contrato `Estornado`, caixa revertido, extrato em vermelho);
   4. Desdobrar parcela (residual com número novo + pagamento no histórico);
   5. Receber em lote (caixa + KPIs atualizados);
   6. Abrir extrato com estorno e conferir "Total Recebido".
2. Rodar novamente o SQL de aceite acima.
3. **Itens do diagnóstico não tratados nesta rodada** (avaliar se entram em nova atividade):
   - **B11** — `get_future_receivables_projection` ignora `Prorrogada` (`supabase/migrations/20260618140000_create_projection_function.sql:17`);
   - **B20** — ausência de `CHECK` de status em `contracts`;
   - **B21** — dois gatilhos de proteção equivalentes em `contracts`.
4. Se precisar restaurar a sobrecarga legada, usar o DDL da seção 3.

---

## 9. Arquivos de referência

- `docs/RELATORIO-CONTRATOS-CONTAS-A-RECEBER-20261121.md` — diagnóstico completo (24 bugs, fases, SQL de referência)
- `docs/STATUS-INOVEJURIS.md` — histórico de ambientes, views e deploys
- `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md` — impacto de `exec_sql`, views e permissões
- `supabase_migrations.sql` — schema de referência
- `fix_estornos.sql` — lógica antiga de estorno (base do B13)
- `lib/supabase.ts`, `app/contratos/page.tsx`, `app/contas-a-receber/page.tsx`, `components/contas-a-receber/ContractStatementModal.tsx`, `lib/utils.ts` — código alterado
- `query_function.js` — padrão antigo com `exec_sql` e chave anônima (**não usar em produção**)
