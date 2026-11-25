# Handoff — Recebimentos e Contas a Receber (25/11/2026)

> Estado do repositório ao final do dia: `main` em **`fe80c69`**, árvore limpa, sem célula de SQL pendente.
> Deploy: a Vercel publica automaticamente a partir de `main`.

## 1. Resumo do dia

Foram fechadas três correções no fluxo de recebimento, todas validadas em produção pelo usuário:

| # | Problema | Correção | Commit |
|---|---|---|---|
| 1 | `P0001 Não é possível reabrir um contrato quitado.` no recebimento parcial quando a parcela era a última em aberto | Exceção `Quitado → Parcial` **somente com parcela real em aberto** nas duas funções de proteção | `2134bf1` / `4866e92` |
| 2 | `P0001 A parcela 207 não possui saldo para desdobramento (status: Estornado).` | Desdobramento aceita `Estornado` **somente com `amountPaid = 0`** | `24d510f` / `3022922` |
| 3 | Relatório de Recebimentos listava e somava o par recebido + estornado | `lib/payments.ts` remove a reversão **e** o pagamento original estornado | `334073b` |

Nenhum dado foi alterado por script. As correções 1 e 2 são `CREATE OR REPLACE` de função, com backup e rollback. A 3 é apenas lógica de exibição no front.

## 2. Estado final do caso que originou o trabalho

Contrato **120** — Jessica Gomes Alves de Souza (produção), total R$ 1.621,00:

| Objeto | Estado |
|---|---|
| Parcela 207 | `Quitado` — 1.621,00, pago 811,00 |
| Parcela 256 (residual) | `Aberto` — 810,00, vencimento herdado 24/11/2026 |
| Contrato | `Parcial` — recebido 811,00 / a receber 810,00 |
| `payments` | 1.621,00 (`payment`) → 1.621,00 (`reversal` com `reverses_payment_id`) → 811,00 (`payment`) |
| `financial_transactions` | apenas a transação 1281, de 811,00 |
| Relatório de Recebimentos | apenas R$ 811,00; total do período R$ 10.790,44; 8 lançamentos |

Evidência completa em `docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.md` (seção "Evidência de auditoria").

## 3. Arquivos-chave

### Código

| Arquivo | Papel |
|---|---|
| `app/contas-a-receber/page.tsx` | recebimento (individual e lote), estorno, KPIs, extrato |
| `app/relatorios/page.tsx` | Relatório de Recebimentos |
| `lib/payments.ts` | `isReversalPayment`, `getReversedPaymentIds`, `filterEffectiveReceipts` |
| `supabase_recebimento_metodo_pagamento.sql` | definição de `rpc_receber_parcela_com_metodo` (v2) |

### Scripts aplicados

| Arquivo | Efeito |
|---|---|
| `docs/CORRECAO-RECEBIMENTO-PARCIAL-20261125.sql` | v3 de `prevent_update_delete_paid_contract` e `fn_protect_contracts_status` |
| `docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.sql` | v8 de `rpc_recebimento_com_desdobramento` |

### Diagnósticos (somente leitura, terminam em `ROLLBACK`)

| Arquivo | Uso |
|---|---|
| `docs/DIAGNOSTICO-RECEBIMENTO-PARCIAL-20261125.sql` | títulos com uma única parcela em aberto |
| `docs/DIAGNOSTICO-PARCELA-207-20261125.sql` | histórico completo da parcela 207 / contrato 120 |

### Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/CORRECAO-RECEBIMENTO-PARCIAL-20261125.md` | causa raiz do estado intermediário do desdobramento |
| `docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.md` | guarda de `Estornado` + evidência de auditoria |
| `docs/CORRECAO-RELATORIO-RECEBIMENTOS-20261125.md` | filtro de estornos no relatório e no KPI |

## 4. Verificação e rollback

### Verificações já executadas

| Célula | Resultado |
|---|---|
| `correcao_recebimento_parcial` | `backup_objetos=4`, `v3=true` nas duas funções, 2 gatilhos intactos |
| `correcao_estorno_recebimento` | `backup_objetos=1`, `v8=true`, `ainda_bloqueia_quitado_cancelado=true` |
| `npx tsc --noEmit` | sem erros |

### Rollback

- Proteções do contrato: tabela `backup_contratos_protecao_20261125`; bloco comentado no fim de `docs/CORRECAO-RECEBIMENTO-PARCIAL-20261125.sql`.
- Desdobramento: tabela `backup_recebimento_desdobramento_20261125`; bloco comentado no fim de `docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.sql`.
- Relatório: reverter o commit `334073b`.

## 5. Pendências de validação manual (usuário)

Estas não foram executadas nesta rodada e continuam abertas:

1. **Logout e expiração de sessão** — validar encerramento e timeout.
2. **Salvar permissão em `ProfilesTab`** — confirmar persistência após recarregar.
3. **Upload/IA em Marketing** — enviar arquivo e conferir geração com a chave única do servidor.
4. **Impersonação pela UI em `/usuarios`** — havia `42501 permission denied for table user_roles`.
5. **Conferência no iPhone** — layout e usabilidade em Safari mobile.

## 6. Decisões abertas (precisam de definição antes de implementar)

1. **Vencimento da parcela residual**: hoje herda a data do título original, então um parcial em título vencido nasce em atraso. Alternativa: data própria (ex.: 30 dias após o recebimento). É regra de negócio — não alterar sem decisão.
2. **Recebimento em lote de parcela `Estornado`**: `isBatchEligible` em `app/contas-a-receber/page.tsx` ainda exclui `estornado`/`estornada`. O recebimento individual já aceita quando `amountPaid = 0`; decidir se o lote deve acompanhar.
3. **Estornos legados sem vínculo**: o helper cobre por valor + parcela. Se aparecer divergência, rodar consulta de conferência antes de qualquer ajuste.

## 7. Observações técnicas para a próxima sessão

- Produção em **PostgreSQL 17.6**.
- `payments.id` é **uuid** (o baseline do repositório diz BIGINT); `payments.payment_date` é **timestamptz**.
- `payments` tem `financial_transaction_id`, `reverses_payment_id`, `payment_method`, `user_id` e `created_by`.
- `installments` **não tem** `updated_at`.
- Gatilhos em `contracts`: `prevent_update_delete_paid_contract_trigger` dispara antes de `trg_protect_contracts_status` (ordem alfabética).
- `fn_recalculate_contract_totals` v4 ignora `estornado` no saldo em aberto e força contrato `Estornado` quando há parcela nesse estado.
- `process_installment_estorno` zera `amountPaid`/`interest`/`fine`, apaga a transação vinculada e grava `payments.type='reversal'`.
- `tsconfig.tsbuildinfo` muda a cada build; restaurar com `git checkout -- tsconfig.tsbuildinfo`.
- PowerShell não aceita `&&`; usar `;`.

## 8. Próximos passos sugeridos

1. Retomar as validações manuais da seção 5, uma por vez, registrando o resultado.
2. Decidir os itens da seção 6 (vencimento da residual e lote com estornado).
3. Se quiser, rodar uma conferência global de estornos para garantir que todos têm `reverses_payment_id` preenchido.
