# Handoff — Checagem forense de Contas a Receber (25/11/2026)

> Estado do repositório ao sair: `main` em **`7075e30`**, árvore limpa.
> **Tarefa em curso: aguardando o usuário rodar o SQL e colar a célula.**
> Deploy: a Vercel publica automaticamente a partir de `main`.

## 1. O que está feito

Replicou-se em **Contas a Receber** a mesma checagem forense somente-leitura
aplicada ontem (24/11) em Contratos.

| Item | Estado |
|---|---|
| `docs/DIAGNOSTICO-CONTAS-A-RECEBER-20261125.sql` | **escrito, validado e commitado** (`7075e30`, pushado) |
| Sintaxe/semântica | **validada** em PostgreSQL 18 descartável e isolado (porta 5433, schema stub) |
| Instância de teste | **parada e removida** (`pgcheck`, `pgcheck-stub.sql`, `pgcheck.log`) |
| Execução em produção | **PENDENTE — só o usuário faz, no SQL Editor** |
| Relatório de resultado | **PENDENTE** — `docs/DIAGNOSTICO-CONTAS-A-RECEBER-RESULTADO-20261125.md` |

## 2. Próximo passo (retomar exatamente aqui)

1. Usuário abre o **SQL Editor do Supabase** e roda `docs/DIAGNOSTICO-CONTAS-A-RECEBER-20261125.sql`
   **inteiro**.
2. Usuário copia a **única célula** `diagnostico_contas_a_receber` e cola no chat.
3. O agente analisa a célula e escreve
   `docs/DIAGNOSTICO-CONTAS-A-RECEBER-RESULTADO-20261125.md`,
   no padrão de `docs/DIAGNOSTICO-CONTRATOS-RESULTADO-20261124.md`.

> **Lembrete:** o assistente **não lê imagens**. Pedir o resultado em texto.

## 3. Garantias do script

- **Somente leitura** — nenhum `INSERT`/`UPDATE`/`DELETE`.
- Embrulhado em `begin; … rollback;` — nada é persistido, mesmo que algo falhe.
- Nenhum SQL foi executado pelo agente em produção.

## 4. O que ele mede

Contra o que `app/contas-a-receber/page.tsx` realmente lê:

| Bloco | Pergunta |
|---|---|
| `kpi_recebido_mes` | O KPI "Recebido este Mês" reproduz fielmente a regra de `lib/payments.ts`? Quanto é excluído por `type='reversal'`, por descrição "%estorno%" e por `reverses_payment_id`? |
| `kpi_previsao_30d` | A "Previsão (30d)" inclui parcela de contrato cancelado ou sem saldo? |
| `parcela_vs_pagamentos` | `amountPaid` bate com **pagamentos − reversões**? Pagamentos órfãos sem parcela? |
| `status_vs_valores` | Quitado com saldo devedor, aberto já integralmente pago, parcela duplicada, estornado ainda com dinheiro, etc. |
| `view_vs_parcelas` | A `contract_receivables_summary` (que em produção difere do baseline) bate com o recálculo a partir das parcelas? |
| `estornos` | Vínculo `reverses_payment_id` ausente, apontando para inexistente, dupla reversão do mesmo original, parcela de estorno ≠ parcela do original. |
| estrutura | Colunas/FKs/grants/RLS, definição da view e das RPCs (`rpc_receber_parcela_com_metodo`, `process_installment_estorno`, …). |

## 5. Convenção de sinal (cuidado ao interpretar)

- `process_installment_estorno` grava a reversão com `amount` **POSITIVO** e
  `type='reversal'`, e **zera** `amountPaid` da parcela.
- Logo: **líquido = pagamentos − reversões**.
- Estornos antigos sem vínculo são cobertos por valor + parcela (helper em `lib/payments.ts`).

## 6. Erros pegos na validação (já corrigidos no arquivo)

1. Consulta com `order by`/`limit` junto de `jsonb_agg` — virou subconsulta.
2. `pg_get_constraintdef(oid)` ambíguo — virou `pg_get_constraintdef(con.oid)`.
3. Bloco `total_recebido_divergente` com SQL quebrado — reescrito.
4. Convenção de sinal da reversão — `soma_geral` virou `soma_pagamentos − soma_reversoes`.

## 7. Pendências arrastadas (não relacionadas a esta checagem)

1. **Validações manuais (usuário):** logout/expiração de sessão; permissão em `ProfilesTab`;
   upload/IA em Marketing; impersonação em `/usuarios`; conferência no iPhone.
2. **Vencimento da parcela residual** — hoje herda a data do título; é regra de negócio,
   decidir antes de alterar.
3. **Recebimento em lote de `Estornado`** — `isBatchEligible` em `app/contas-a-receber/page.tsx`
   ainda exclui `estornado`/`estornada`; o individual já aceita quando `amountPaid = 0`.

## 8. Contexto técnico útil

- Produção: **PostgreSQL 17.6**.
- `payments.id` é **uuid** (baseline do repo diz BIGINT); `payment_date` é **timestamptz**.
- `installments` **não tem** `updated_at`.
- View `contract_receivables_summary` em produção tem `overdue_amount`,
  `overdue_installments`, `is_overdue` — **diferente do baseline** do repo.
- `tsconfig.tsbuildinfo` muda a cada build; restaurar com `git checkout -- tsconfig.tsbuildinfo`.
- PowerShell não aceita `&&`; separar comandos com `;`.
- Lint tem erros **pré-existentes** (`checkBirthdays`/`setTodayString` em `app/page.tsx`);
  não introduzidos por esta rodada.

## 9. Trabalho anterior do mesmo dia (já commitado e pushado)

| Commit | Assunto |
|---|---|
| `7075e30` | checagem forense de Contas a Receber (este handoff) |
| `f6d368b` | cards de relatório em uma linha no desktop / duas colunas no iPhone |
| `1e4a137` | cronologia da Previsão de Partos + selo "ocorrido" sem data do parto |
| `9c722f7` | dias faltantes calculados pela data do parto quando preenchida |
| `7bac46b` | partos futuros antes dos já ocorridos |

Ver também `docs/HANDOFF-RECEBIMENTOS-20261125.md` (correções de recebimento do dia).
