# Handoff — Checagem forense de Contas a Receber (25/11/2026)

> Estado do repositório ao sair: `main` no commit desta retomada, árvore limpa,
> publicado no GitHub.
> **Retomada em 26/11/2026:** usuário rodou a célula complementar; agente a
> interpretou e corrigiu o relatório. Checagem forense, rastreio e complemento
> **encerrados** — não há célula de SQL pendente.
> **Item 1 aprovado pelo usuário em 26/11/2026:** manter o KPI inalterado e
> `Prorrogada` fora de “vencido”. Nenhuma mudança em `lib/payments.ts`, na view
> ou em dados de negócio.
> **Item 2 concluído em 26/11/2026:** as duas medições foram feitas (sessão em
> `production` às 12:06:38 UTC e em `test` às 12:09:37 UTC). A view **vaza
> linhas do outro ambiente no banco** em ambos os sentidos; na tela o filtro
> do cliente esconde o cruzamento. Relatório em
> `docs/ISOLAMENTO-VIEW-RESULTADO-20261126.md`. O forward com
> `security_invoker=on` foi **aplicado pelo usuário e verificado nos dois
> ambientes** (teste 19/19/0, produção 106/106/0). Rollback não acionado.
> **Item 3 explicado** na seção 7; nenhuma mudança implementada.
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
| `docs/RASTREIO-COMPLEMENTAR-20261125.sql` | **Executado pelo usuário em 26/11, 10:53:53 UTC** (PG 17.6), célula única, terminou em `rollback`; sem validação prévia em instância descartável |
| Interpretação final | **Escrita** — `docs/RASTREIO-ESTORNOS-RESULTADO-20261125.md` corrigido com as refutações da célula complementar |

## 2. Próximo passo (retomar exatamente aqui)

A checagem forense, o rastreio das 13 parcelas e a célula complementar estão
**concluídos e interpretados** em
`docs/RASTREIO-ESTORNOS-RESULTADO-20261125.md`. Retomar exatamente aqui:

1. **REGRA DO KPI — decidida e aprovada em 26/11/2026:** manter
   `lib/payments.ts` e o KPI “Recebido este Mês” **inalterados**. A entrada de
   R$ 1.000,00 de 21/11 (`3715c3de…`, transação 1248) foi apagada em 22/11
   00:10:42 UTC e a reversão de R$ 1.000,00, também de 21/11, permanece sendo
   subtraída; se a entrada existisse, a heurística por valor + parcela também a
   removeria. O par é neutro: líquido **R$ 31.790,44** nos dois cenários.
   Todas as linhas são `environment=test` no banco único.
2. **REGRA DE “VENCIDO” — decidida e aprovada em 26/11/2026:** manter
   `Prorrogada` **fora** de `overdue_amount`, `overdue_installments` e
   `is_overdue` na view `contract_receivables_summary`. Parcela prorrogada teve
   o vencimento estendido; não é inadimplente. É definição, não erro de dado:
   a view permanece como está.
3. **VERIFICAÇÃO DE ISOLAMENTO — concluída em 26/11/2026:** duas medições,
   uma com sessão em `production` e outra em `test`. Resultado completo em
   `docs/ISOLAMENTO-VIEW-RESULTADO-20261126.md`: `view_total=125` com 106
   linhas próprias e 19 do outro ambiente em cada sessão; `contracts_via_rls`
   igual às linhas próprias. **A view vaza linhas do outro ambiente no banco**;
   a tela não as mostra porque `lib/supabase.ts` injeta
   `.eq('environment', ambiente)` em toda consulta, inclusive na view.
   - 1ª execução (11:58:48 UTC): sem sessão nos dois ambientes; contagens `null`.
   - 2ª execução: falha `22P02` (`user_sessions.user_id` numérico declarado
     como `uuid`); corrigido para `text`.
   - 3ª execução: falha `42501` (`_rls_session_valid()` sem EXECUTE para
     `authenticated`); chamada movida para antes do `set role`.
   - 4ª execução (12:06:38 UTC): medição de `production` — 125 / 106 / 19 / RLS 106.
   - 5ª execução (12:09:37 UTC): medição de `test` — 125 / 19 / 106 / RLS 19.
4. **CORREÇÃO ESTRUTURAL — aplicada e verificada em 26/11/2026:** o usuário
   rodou o precheck (`pronto_para_forward=true`) e o forward
   (`security_invoker=on`). Verificação pós-forward: sessão em `test` às
   12:22:26 UTC com `19/19/0` e sessão em `production` às 12:25:02 UTC com
   `106/106/0` (view total / próprias / de outro), ambas iguais a
   `contracts_via_rls`. Definição da view inalterada, rollback **não**
   acionado, nenhum dado de negócio alterado. Detalhes em
   `docs/ISOLAMENTO-VIEW-RESULTADO-20261126.md`.

Atenção ao escopo (regra permanente): as consultas rodaram no **banco único**
(PG 17.6), onde `production` e `test` são rótulos da coluna `environment`, não
bancos separados. Todas as linhas da célula complementar são
`environment=test`; no primeiro rastreio havia também linhas `production`
(parcelas 147 e 148). Ver `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

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
  valor (147, 87, 129) e candidato só na mesma data/depois (103, 148).
- Resultado da célula complementar: o original da 227 (`3715c3de…`) tinha
  `payment_date=21/11` e foi **excluído** em 22/11 00:10:42 UTC (`performed_by=null`),
  junto com a remoção do vínculo da reversão; a hipótese “original fora da
  janela do mês” está **refutada**. As cinco reversões antigas têm
  `qtd_logs=0` e não podem ser datadas por `audit_logs`. A parcela 239 foi
  criada `Aberto` em 21/11 23:38:12 e quitada em 22/11 20:13:51 com pagamento
  próprio `046c7262…` (conta 11, `Cartão de Débito`, transação 1271); a suspeita
  de “residual nascida quitada sem pagamento” está **refutada**. Os R$ 4.310,00
  das cinco `Quitado` com saldo são desdobramentos regulares (257, 256, 240,
  239 e 244).

Ainda em aberto: decidir a regra do KPI para estorno órfão e a regra de
“vencido” para `Prorrogada`; verificar o isolamento da view
`contract_receivables_summary` em tarefa separada.

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
2. **Vencimento da parcela residual — DECISÃO APROVADA EM 26/11: manter como
   está.** `rpc_recebimento_com_desdobramento` (`app/setup/page.tsx`, insert da
   parcela remanescente) copia `"dueDate"` da parcela original. Assim, após um
   pagamento parcial, o saldo remanescente continua com o vencimento antigo e
   pode entrar em `overdue_amount`/`is_overdue` da view no mesmo dia da baixa.
   **Não é erro de dado**: é regra de negócio. Se houver acordo de prazo, usar a
   ação **Prorrogar**, que registra `original_due_date`. Nenhuma mudança em
   código, view ou dados.
3. **`Estornado` como recebível — DECISÃO APROVADA EM 26/11.** O usuário
   definiu: "o estorno é uma operação de desfazimento de um recebimento
   equivocado; ao desfazer o recebimento, a parcela/título volta ao estado de
   devedor, a receber". Isso confirma a correção já aplicada em 25/11 no
   desdobramento (`docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.sql`, v8: estorno
   limpo com `amountPaid = 0` pode ser recebido inclusive de forma parcial).
   **O que falta é alinhar as regras de leitura**, sem alterar dados nem o rótulo
   `Estornado` (o histórico da reversão fica em `payments` e nas observações do
   contrato):
   - **Front (`app/contas-a-receber/page.tsx`):** `isBatchEligible` (`:364`) e os
     checkboxes (`:983`, `:1054`, `:1149`) — incluir estornada no lote;
     `getInstallmentFlags` (`:397`) — estornada pode contar como atrasada;
     `totalOpen` (`:417`) — incluir saldo estornado; Previsão 30d (`:468`)
     — incluir `Estornado` no `.in('status', ...)`. Manter `Prorrogada` fora de
     "vencido", conforme decisão do item 1.
   - **Banco:** view `contract_receivables_summary` (quatro filtros com
     `estornado`), trigger `fn_recalculate_contract_totals` (v4: filtro de
     `amountReceivable` na linha 1232) e as funções `process_installment_payment`
     e `process_installment_estorno` (cálculo de `amountReceivable`), além das
     views de dashboard `vw_dashboard_receivables_forecast`,
     `vw_dashboard_receivables_metrics` e `vw_dashboard_top_defaulters`, que o
     P0 de 24/11 alterou para excluir `Estornado`.
   - **Não mexer:** KPI "Recebido este Mês" (`lib/payments.ts`), conforme decisão
     do item 1; nenhum `UPDATE`/`DELETE` em dados de negócio.
   - **Medição prévia executada em 26/11, 12:38:50 UTC:**
     `docs/MEDICAO-ESTORNADO-RECEBIVEL-20261126.sql` (uma célula, somente
     leitura, `rollback`). Resultado: `test` 3 estornadas / R$ 15.000,00 de
     saldo / 2 vencidas (R$ 5.000,00) / 3 contratos; `production` zero em tudo.
     KPIs em `test`: a receber 15.000 → 30.000, vencido 14.000 → 19.000,
     previsão 30d 0 → 10.000, lote 7 → 10. As definições reais mostraram que
     `process_installment_payment` (2 sobrecargas) e `process_installment_estorno`
     **não** excluem estornado; quem recalcula é o gatilho v4.
   - **Front publicado em `main` no commit `0cc6bdb`:** mudanças em
     `app/contas-a-receber/page.tsx` (`:364`, `:397`, `:417`, `:468`).
   - **Forward estrutural aplicado pelo usuário e verificado em 26/11 às
     12:44:20.654672+00:00:** `docs/FORWARD-ESTORNADO-RECEBIVEL-20261126.sql`
     alterou apenas DDL; `docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql`
     confirmou `view_sem_estornado=true`, `view_security_invoker_on=true`,
     `gatilho_sem_estornado_no_filtro=true`,
     `gatilho_preserva_rotulo_estornado=true`, `dashboards_com_estornado=0`.
     KPIs: `test` a receber 30.000,00 / vencido 19.000,00 / lote 10 / previsão
     30d 10.000,00; `production` 320.655,80 / 65.270,00 / 50 / 19.329,60.
     Parcelas estornadas e saldo inalterados (3 / R$ 15.000,00 em `test`).
     `docs/ROLLBACK-ESTORNADO-RECEBIVEL-20261126.sql` disponível, **não acionado**.
   - **Pendente de autorização explícita (UPDATE em dados):** o verify apontou
     `amount_receivable_desatualizado=3` em `test` e `0` em `production`; os 3
     contratos seguirão com `contracts."amountReceivable"` antigo até um evento
     em parcelas/pagamentos. Preparados
     `docs/FORWARD-ESTORNADO-RECEBIVEL-DADOS-20261126.sql` e
     `docs/ROLLBACK-ESTORNADO-RECEBIVEL-DADOS-20261126.sql`, com guarda contra
     contratos de `production`. Nenhum dado de negócio foi alterado até aqui.
     Plano em `docs/ESTORNADO-RECEBIVEL-PLANO-20261126.md`.

## 8. Contexto técnico útil

- **REGRA PERMANENTE (26/11/2026):** **um único banco** (PostgreSQL 17.6) com
  dois ambientes lógicos — `production` e `test` (homologação) — separados pela
  coluna `environment`. Não há banco separado para homologação. Toda rotina
  deve declarar o ambiente consultado e incluir `environment` no filtro ou no
  resultado. Ver `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.
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
