# Handoff — Checagem forense de Contas a Receber (25/11/2026)

> Estado do repositório ao sair: `main` no commit desta retomada, árvore limpa,
> publicado no GitHub.
> **Retomada em 26/11/2026:** usuário rodou a célula complementar; agente a
> interpretou e corrigiu o relatório. Checagem forense, rastreio e complemento
> **encerrados** — não há célula de SQL pendente.
> **Item 1 aprovado pelo usuário em 26/11/2026:** manter o KPI inalterado e
> `Prorrogada` fora de “vencido”. Nenhuma mudança em `lib/payments.ts`, na view
> ou em dados de negócio.
> **Item 2 em curso:** `docs/VERIFICACAO-ISOLAMENTO-VIEW-20261126.sql` escrito,
> **ainda não executado**; depende de o usuário manter o app aberto nos dois
> ambientes e colar a célula `verificacao_isolamento_view_20261126`.
> **Item 3 pendente de explicação**, após os itens 1 e 2 — ver seção 7.
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
3. **VERIFICAÇÃO DE ISOLAMENTO — em curso:** rodar
   `docs/VERIFICACAO-ISOLAMENTO-VIEW-20261126.sql` inteiro, com o app aberto em
   `production` e em `test` (heartbeat de 20 s, limite de 90 s na sessão), e
   colar a ÚNICA célula `verificacao_isolamento_view_20261126`. O script é
   somente leitura, declara o banco único e separa os dois rótulos; termina em
   `rollback`. Se apontar vazamento, preparar forward/verify/rollback **sem
   aplicar**.
   - 1ª execução (26/11, 11:58:48 UTC): estrutura da view lida, mas
     `sessao_encontrada=false` nos dois ambientes e contagens `null`.
   - 2ª execução: falha `22P02` — `user_sessions.user_id` é numérico (`2`) e
     tinha sido declarado `uuid` no bloco; corrigido para `text` (o mesmo
     padrão de `docs/VALIDACAO-P1-1-20261123.sql`), sem mudança na lógica.
   - 3ª execução: falha `42501` — `_rls_session_valid()` foi chamada depois de
     `set_config('role','authenticated')`, e esse papel não tem EXECUTE nela;
     a chamada foi movida para antes da troca de papel, como no script de
     validação P1.1.
   - 4ª execução (26/11, 12:06:38 UTC): **medição de `production` obtida** —
     sessão válida, `view_total=125`, `view_do_ambiente=106`,
     `view_de_outro_ambiente=19`, `contracts_via_rls=106`. Ou seja, **a view
     vaza 19 linhas `test` para uma sessão `production`** no banco (sem RLS na
     view e sem `security_invoker`). A tela não as mostra porque
     `lib/supabase.ts` injeta `.eq('environment', ambiente)` em toda consulta,
     inclusive na view. `test` ficou sem sessão (`sessoes_sem_logout=0`) e
     precisa de nova execução com o app naquele ambiente.
   - Correção estrutural (avaliar `security_invoker` ou filtro explícito por
     `environment` na view) **não foi aplicada**: depende da medição de `test`,
     de forward/verify/rollback preparados e de autorização explícita.
4. Nenhuma correção é aplicada sem autorização explícita, medição prévia e
   forward/verify/rollback. A única célula pendente agora é a do item 3.

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
2. **Vencimento da parcela residual** — hoje herda a data do título; é regra de negócio,
   decidir antes de alterar.
3. **Recebimento em lote de `Estornado`** — `isBatchEligible` em `app/contas-a-receber/page.tsx`
   ainda exclui `estornado`/`estornada`; o individual já aceita quando `amountPaid = 0`.

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
