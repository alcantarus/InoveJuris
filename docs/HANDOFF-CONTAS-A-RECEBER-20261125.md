# Handoff — Checagem forense de Contas a Receber (25/11/2026)

> Estado do repositório ao sair: `main` em **`3235ec6`** mais os documentos
> deste rastreio, árvore limpa.
> **Tarefa em curso:** rastreio executado e interpretado; célula complementar
> somente leitura preparada, aguardando o usuário rodá-la e colar
> `rastreio_complementar_20261125`.
> Deploy: a Vercel publica automaticamente a partir de `main`.

## 1. O que está feito

Replicou-se em **Contas a Receber** a mesma checagem forense somente-leitura
aplicada ontem (24/11) em Contratos.

| Item | Estado |
|---|---|
| `docs/DIAGNOSTICO-CONTAS-A-RECEBER-20261125.sql` | **escrito, validado e commitado** (`7075e30`, pushado) |
| Sintaxe/semântica | **validada** em PostgreSQL 18 descartável e isolado (porta 5433, schema stub) |
| Instância de teste | **parada e removida** (`pgcheck`, `pgcheck-stub.sql`, `pgcheck.log`) |
| Execução em produção | **Feita pelo usuário em 25/11, 18:31:15 UTC e reexecutada às 18:40:03 UTC (resultados idênticos)** |
| Relatório de resultado | **Escrito** — `docs/DIAGNOSTICO-CONTAS-A-RECEBER-RESULTADO-20261125.md` |
| `docs/RASTREIO-ESTORNOS-20261125.sql` | **Executado pelo usuário em 25/11, 18:50:55 UTC** (PG 17.6), célula única, terminou em `rollback` |
| Relatório do rastreio | **Escrito** — `docs/RASTREIO-ESTORNOS-RESULTADO-20261125.md` |
| `docs/RASTREIO-COMPLEMENTAR-20261125.sql` | **Preparado** (somente leitura, célula `rastreio_complementar_20261125`); **pendente de execução pelo usuário** e sem validação em instância descartável nesta rodada |

## 2. Próximo passo (retomar exatamente aqui)

A checagem forense e o rastreio das 13 parcelas estão **concluídos e
interpretados** em `docs/RASTREIO-ESTORNOS-RESULTADO-20261125.md`. Retomar
exatamente aqui:

1. Usuário abre o SQL Editor e roda `docs/RASTREIO-COMPLEMENTAR-20261125.sql`
   **inteiro** (começa com `-- Rastreio complementar`, não com `#`).
2. Usuário copia a **única célula** `rastreio_complementar_20261125` e cola no
   chat.
3. Agente interpreta: (a) se o pagamento `3715c3de…` ainda existe e em que mês
   está, para fechar a decisão do KPI; (b) se a parcela 239 tem pagamento
   próprio, para fechar a anomalia da parcela 231.
4. Decisões de negócio continuam em aberto: regra do estorno órfão no KPI,
   destino dos R$ 1.000,00 da parcela 231 e definição de `Prorrogada` no campo
   “vencido”. Nenhuma correção é aplicada sem autorização explícita, medição
   prévia e forward/verify/rollback.

O que o rastreio cobriu:

- 9 reversões sem `reverses_payment_id` (R$ 14.800,00) nas parcelas 129, 147
  (duas), 87, 113, 122, 227, 103 e 148.
- 5 parcelas `Quitado` com saldo (R$ 4.310,00): 194, 231, 207, 230 e 237,
  incluindo as parcelas irmãs de cada contrato (para identificar residual).
- Histórico linha a linha com saldo acumulado, transação financeira vinculada,
  descrição, conta, categoria, método e usuários.
- Candidatos a pagamento original por valor + parcela, reprodutindo a
  heurística de `lib/payments.ts`, com o candidato dentro da janela do mês da
  tela separado do candidato no histórico completo.
- `audit_logs` de parcelas, contratos e payments, e observações `[ESTORNO]`.
- Resultado do rastreio: 9 reversões classificadas em quatro mecanismos —
  conversão de pagamento em reversão (113 e 122, em 22/11 00:10:42 UTC com
  `performed_by=null`), vínculo removido (227), reversão sem origem de mesmo
  valor (147, 87, 129) e candidato só na mesma data/depois (103, 148). Das 5
  parcelas `Quitado` com saldo, 4 têm residual `Aberto` regular (257, 256,
  240, 244) e a 231 tem a residual 239 **nascida quitada** sem pagamento próprio.

Ainda em aberto: decidir a regra do KPI para estorno órfão, o destino dos
R$ 1.000,00 da parcela 231 e a regra de “vencido” para `Prorrogada`; verificar
o isolamento da view `contract_receivables_summary` em tarefa separada.

Nenhum `UPDATE`/`DELETE` foi feito; os três scripts terminam em `rollback`.

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
5. No rastreio: `jsonb_agg` aninhado em `parcelas_dos_contratos_alvo` e
   `contratos_dos_alvos` — resolvido com as CTEs `parcelas_por_contrato` e
   `obs_por_contrato`. Validado com `ON_ERROR_STOP=1` (saída 0, uma célula).

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
