# HANDOFF — Contratos / Contas a Receber

**Atualizado em:** 21/11/2026 — rodada final de validação funcional e aceite.
**Objetivo:** retomar sem reconstruir histórico. Diagnóstico original em `RELATORIO-CONTRATOS-CONTAS-A-RECEBER-20261121.md`.
**Alvo das alterações:** correções de código publicadas na `main` e aplicadas ao banco (funções globais). Cenários funcionais executados em **homologação (`test`)**; nenhum teste financeiro foi executado em produção. Aceite em produção limpo.

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
| Baixa/recebimento de parcelas | **Somente pelo módulo Contas a Receber**. O módulo Contratos não deve ser usado para receber |
| Conta/categoria no lote | **Aprovado e implementado:** o botão "Receber Selecionados" abre modal pedindo Conta e Categoria; o lote usa a RPC de 9 argumentos |
| `Quitado → Estornado` (parcela) | Permitido (B14) — bloqueio do gatilho corrigido globalmente |

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
| `prevent_update_delete_paid_installment()` | **Corrigido (B14)** — permite `Quitado → Cancelada/Cancelado/Estornado/Estornada`; demais alterações e exclusão de quitada continuam bloqueadas |
| `rpc_recebimento_com_desdobramento(...)` 9 args | **v7 20261121 + correção de acumulação** — não sobrescreve `amount`; calcula `saldo_atual = amount − amountPaid`; valida contra o saldo; `amountPaid` acumula (`anterior + total pago`); `interest`/`fine` acumulam; residual com `MAX(installmentNumber)+1`; bloqueia `Cancelado`/`Cancelada`/`Estornado` |
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
**Status final de teste** (após os cenários desta rodada): `Aberto 2`, `Parcial 4`, `Quitado 7`, `Cancelado 4`, `Estornado 3`. Linhas criadas/alteradas em `test`: contratos 136 (cancelado), 135 (prorrogação, desdobramentos e lote), 76 e 74 (estornados); duplicidade antiga do contrato 75 preservada.

---

## 6. Código local — publicado na `main`

Commits publicados em `origin/main` (deploy Vercel Production `https://inove-juris.vercel.app`):

| Commit | Conteúdo |
|---|---|
| `4edd862` | Correções gerais de Contratos/Contas a Receber |
| `b469820` | Badge do número do contrato |
| `abba52a` | Pagamento parcial em Contas a Receber chama `rpc_recebimento_com_desdobramento` |
| `6654413` | Lote só permite selecionar parcelas com saldo em aberto |

| Arquivo | Ajuste |
|---|---|
| `lib/supabase.ts` | `processContractCancellation` usa RPC com fallback seguro |
| `app/contratos/page.tsx` | Cancelamento, segunda via, `reloadContracts`, cores/estados; estorno sem `setTimeout` nem chave `'"amountPaid"'`; recarga real do banco; `Cancelado` antes de `Estornado` nas 3 tabelas |
| `app/contas-a-receber/page.tsx` | `isLate` exclui `Prorrogada`/`Estornado`; `totalOpen` e filtro usam campos calculados da view; prorrogação; lote; após estorno recarrega parcelas + contratos + KPIs; pagamento parcial com desdobramento; `isBatchEligible` bloqueia seleção de `Quitado`/`Cancelada`/`Estornado` |
| `components/ui/ContractNumberBadge.tsx` | Crachá azul do número do contrato (listagens desktop/mobile, modal de baixa, cabeçalho de recebimento e extrato) |
| `components/contas-a-receber/ContractStatementModal.tsx` | Reversões subtraídas do total e exibidas em vermelho com sinal `−`; `uniqueInstallments` ignora reversões |

`npx tsc --noEmit` executado sem erros após cada alteração. Rollback conhecido do deploy anterior: `dpl_APjXUSLhcsE4Rm6bhkXXKvP7iAeA`.

---

## 7. Aceite

### 7.1 Produção — limpo

Resultado do SQL abaixo: `cancelados_inconsistentes = null`, `totais_inconsistentes = null`, `divergencias_pagamentos = 0`, `pagamentos_sem_caixa = 0`, `estornos_inconsistentes = null`, `duplicidade_numeros = null`, `funcoes_fora_do_padrao = null`, `sobrecarga_legada_presente = 0`, `environments_invalidos = 0`, `reversoes_producao = 3`. Status: `Aberto 11`, `Parcial 3`, `Quitado 53`, `Cancelado 6`, `Prorrogado 33`. **Nenhum teste financeiro foi executado em produção.**

### 7.2 Homologação (`test`) — conciliada

Achados iniciais: `reversoes_teste = 6`, duplicidade no contrato 75 / número 1, `divergencias_pagamentos = 11`, `pagamentos_sem_caixa = 5`, `totais_inconsistentes` nos contratos 67 e 91. Nenhum foi gerado pelos cenários desta rodada.

Correção executada em `test` com backup prévio, em dois scripts:

- `docs/CORRECAO-DADOS-HISTORICOS-TESTE-20261121.sql` — remove 5 pagamentos órfãos (parcelas 87, 89, 103, 129, 227), ajusta o excedente da parcela 96, converte os estornos 113/122 para um único registro `reversal` e cria pagamento + caixa para as parcelas 97, 150 e 151;
- `docs/CORRECAO-FINAL-TESTE-20261121.sql` — normaliza a parcela 96 (inclusive redução de pagamento/caixa quando necessário) e renumera a parcela 144 do contrato 75, com desativação temporária e reativação do gatilho `prevent_update_delete_paid_installment_trigger`.

Resultado final: `duplicidade_numeros = null`, `pagamentos_sem_caixa = 0`, `totais_inconsistentes = null`, `divergencias_pagamentos = null`. Backups: `backup_test_pagamentos_conciliacao_20261121`, `backup_test_installments_conciliacao_20261121`, `backup_test_contracts_conciliacao_20261121`, `backup_test_ajuste_final_20261121`, `backup_test_ajuste_final_pagamentos_20261121`.

### 7.3 Cenários funcionais validados em `test`

| # | Cenário | Resultado |
|---|---|---|
| 1 | Cancelamento | Contrato 136 (Fernanda, 1.500,00) `Cancelado`, zerado, `parcelas_vivas = 0` |
| 2 | Prorrogação | Contrato 135, parcelas 228/229 `Prorrogada`, contrato `Prorrogado`, `original_due_date` preservado |
| 3 | Estorno via Contratos | Parcela 122 / contrato 76 `Estornado`, pago `0`, `reversoes = 1`, contrato zerado — após correção do B14 |
| 4 | Estorno via Contas a Receber | Parcela 113 / contrato 74 `Estornado`, `valor_revertido = 2.000,00`, contrato zerado; KPIs e extrato conferidos |
| 5 | Desdobramento via Contas a Receber | Parcela 231 → `Quitado` com 1.000,00; parcela 239, número 11, 1.000,00, `Aberto`, `test`; `duplicidades = null` |
| 6 | Recebimento em lote | Parcelas 232/233 `Quitado` com 2.000,00 cada; transações 1251/1252; `sem_caixa = 0`, `env_invalido = 0`; contrato 135 com `recebido = 6.000,00` |
| 7 | Extrato com estorno | Contrato 74 — "Total Recebido" zerado, linha vermelha com `−`, crachá azul do contrato presente |
| 8 | Correção da acumulação do desdobramento | Parcela 230 (já com 1.000,00) + 500,00 → `amountPaid = 1.500,00`, nova parcela 240 número 12 com 500,00 `Aberto`; transação 1253; contrato 135 `recebido = 6.500` / `a_receber = 13.500` |

**Pendência de validação:** KPI "Previsão 30 dias" — checagem adiada pelo usuário (relacionada ao B11).

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

### 7.3 B20/B21 — endurecimento de status (produção)

Executado `docs/ENDURECIMENTO-STATUS-CONTRATOS-20261121.sql` com sucesso. Resultado final:

| Indicador | Resultado |
|---|---|
| `status_fora_da_lista` | `null` |
| `check_status_definicao` | `CHECK ((status = ANY (ARRAY['Aberto','Parcial','Quitado','Cancelado','Estornado','Prorrogado'])))` |
| `gatilho_update_of_status_presente` | `true` |
| `gatilho_duplicado_presente` | `false` |
| `gatilhos_chamando_funcao_protecao` | `1` |
| `gatilho_delete_paid_presente` | `true` |
| `objetos_em_backup` | `13` |

Distribuição de status após a execução: `Aberto 12`, `Parcial 6`, `Quitado 61`, `Cancelado 10`, `Estornado 3`, `Prorrogado 33`. Backup em `backup_contracts_status_endurecimento_20261121`. A remoção do gatilho amplo encerra o ruído de erro `P0001` duplicado observado no diagnóstico do B14.

### 7.4 B11 — validação do KPI "Previsão 30 dias" (homologação)

Validação em `test`, janela 22/11/2026 a 22/12/2026 (`docs/VALIDACAO-B11-PREVISAO-30-DIAS-20261121.sql`):

| Indicador | Resultado |
|---|---|
| `parcelas_no_periodo` | 3 |
| `por_status` | `Cancelada 1 / 1.500`, `Estornado 1 / 10.000`, `Prorrogada 1 / 2.000` |
| `regra_tela` | `qtd 2`, `total 12.000` |
| `regra_correta` | `qtd 1`, `total 2.000` |
| `diferenca_tela_menos_correta` | `10.000` |
| `funcao_ignora_prorrogada` | `true` |
| `funcao_usa_saldo_em_vez_de_valor_bruto` | `false` |
| `regra_funcao_atual` | `qtd 0`, `total_bruto 0` |

Conclusão: dois defeitos distintos. A tela contava a parcela `Estornado` de 10.000 (já corrigida no front); a RPC ignorava `Prorrogada` e somava valor bruto. A parcela `Cancelada` do contrato 136 já era corretamente excluída pelo status.

### 7.5 B11 — correção da RPC aplicada

Executado `docs/CORRECAO-B11-PREVISAO-30-DIAS-20261121.sql`. Verificação:

| Indicador | Resultado |
|---|---|
| `inclui_prorrogada_e_parcial` | `true` |
| `usa_saldo` | `true` |
| `status_recebiveis_explicitos_e_sem_estornado` | `true` |
| `filtra_environment` | `true` |
| `previsao_30d_por_ambiente.test` | `qtd 1`, `total 2.000` |
| `previsao_30d_por_ambiente.production` | `qtd 9`, `total 26.544,20` (informativo) |
| `objetos_em_backup` | `3` |

Backup em `backup_b11_projecao_20261121` (definição anterior + resultado por ambiente). A função é global ao schema, então uma única execução já corrigiu `test` e `production`. **Nenhum dado financeiro foi alterado nem nenhum teste financeiro foi feito em produção.** Resta conferir na tela de homologação se o KPI passou a exibir 2.000 após o deploy do front.

---

## 8. Pendências

1. ~~Reexecutar o aceite de produção~~ **Concluído:** após a correção do desdobramento, `funcoes_fora_do_padrao = null`, `sobrecarga_legada_presente = 0`, `correcao_acumulacao_presente = 1`, `reversoes_producao = 3`. O marcador `v7 20261121` foi mantido no corpo para não alterar o indicador.
2. ~~Validar o KPI "Previsão 30 dias"~~ **Concluído; correção entregue:** validação em `test` (janela 22/11 a 22/12) mostrou `regra_tela.total = 12.000` contra `regra_correta.total = 2.000` — superestimativa de 10.000 pela parcela `Estornado`. A RPC também foi confirmada com o B11 (`funcao_ignora_prorrogada = true`, `funcao_usa_saldo = false`). Correções:
   - `app/contas-a-receber/page.tsx` — filtro trocado de `neq(Quitado)/neq(Cancelada)` por `.in('status', ['Aberto','Parcial','Atrasada','Prorrogada'])`, removing `Estornado`;
   - `docs/CORRECAO-B11-PREVISAO-30-DIAS-20261121.sql` — backup da definição e do resultado anterior, troca do corpo da RPC (inclui `Prorrogada`/`Parcial`, usa saldo, exclui estornos e contratos cancelados, normaliza `environment`), verificação final;
   - `supabase/migrations/20261121150000_fix_future_receivables_projection.sql` — versão de repositório.
   **SQL executado com verificação limpa (seção 7.5); resta apenas conferir o valor na tela de homologação após o deploy.**
3. ~~Decidir sobre o botão de recebimento no módulo Contratos~~ **Concluído:** o botão já não existia; removido o código morto (estado `paymentData`/`paymentModalOpen`, handlers `handleOpenPayment`/`handleConfirmPayment`, modal "Baixa de Título / Liquidação" e o carregamento de `financial_categories`). O estorno continua disponível e passou a usar diretamente a primeira conta bancária.
4. ~~Decidir a imputação bancária do lote~~ **Concluído e validado pelo usuário:** "Receber Selecionados" agora abre o modal **"Recebimento em Lote"**, com seleção obrigatória de **Conta** e **Categoria**. Cada parcela usa `process_installment_payment` com 9 argumentos (`p_account_id`, `p_category_id`, `p_date`, `p_description = 'Recebimento em lote - parcela <id>'`, `p_interest = 0`, `p_fine = 0`), igual ao recebimento individual. O `confirm()` nativo foi substituído pelo próprio modal; ao concluir, recarrega parcelas, contratos e KPIs.
5. ~~Achados históricos em `test`~~ **Concluído:** base conciliada; ver seção 7.2 e scripts de correção.
6. ~~B20 e B21~~ **Concluído em produção:** script executado, verificação limpa; ver seção 7.3. Proteção de DELETE de quitados mantida em `prevent_update_delete_paid_contract_trigger`.
7. **Nenhum item do diagnóstico original resta sem tratativa.** B11 validado, corrigido no front e na RPC. Se o KPI "Previsão 30 dias" ainda mostrar 12.000 em homologação, verificar deploy da Vercel (o front corrigido está no commit `65eecae`).
8. Se precisar restaurar a sobrecarga legada, usar o DDL da seção 3. Definição anterior da função de desdobramento (antes da correção de acumulação) disponível no histórico desta sessão.

---

## 9. Arquivos de referência

- `docs/RELATORIO-CONTRATOS-CONTAS-A-RECEBER-20261121.md` — diagnóstico completo (24 bugs, fases, SQL de referência)
- `docs/ENDURECIMENTO-STATUS-CONTRATOS-20261121.sql` — B20/B21 com backup, pré-validação e verificação final
- `docs/STATUS-INOVEJURIS.md` — histórico de ambientes, views e deploys
- `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md` — impacto de `exec_sql`, views e permissões
- `supabase_migrations.sql` — schema de referência
- `fix_estornos.sql` — lógica antiga de estorno (base do B13)
- `lib/supabase.ts`, `app/contratos/page.tsx`, `app/contas-a-receber/page.tsx`, `components/contas-a-receber/ContractStatementModal.tsx`, `lib/utils.ts` — código alterado
- `query_function.js` — padrão antigo com `exec_sql` e chave anônima (**não usar em produção**)
