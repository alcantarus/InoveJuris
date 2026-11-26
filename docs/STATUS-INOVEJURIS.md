# InoveJuris — Status e Handoff

> Documento de continuidade gerado para retomar o trabalho em futuras sessões.
> Atualizado em: 2026-11-20 (Fase 0 de segurança e **F4b-1** executadas; Fase 1A/1C fechadas; retenção em 90 dias agendada; **F4b-2b Fases A e B concluídas e validadas**; injeção do JWT corrigida; correção de performance no fluxo de caixa publicada; **Dashboard reorganizada e otimizada**; **isolamento de ambientes e ordem cronológica dos lançamentos corrigidos e validados visualmente pelo usuário**; branches alinhadas em `c9faaa4`; **auditoria de digitação lenta (Fases 1 a 4) validada e encerrada**; **teste financeiro ponta a ponta realizado com sucesso pelo usuário**; pendência de segurança restante **F4b-2c/chave ECC própria**, a retomar somente com autorização explícita — ver `docs/HANDOFF-PENDENCIAS-20261120.md`).
>
> **Fechamento do dia 2026-11-20:** resumo único, deploys, validações, pendências e rollback em `docs/RESUMO-DIA-20261120.md`.
>
> **Atualização em 23/11/2026:** `GEMINI_API_KEY` configurada no Vercel (Secret, Production/Preview/Development). Chaves manuais do navegador e fallbacks legados removidos; limpeza automática via `components/GeminiLegacyCleanup.tsx`. Detalhes em `docs/GEMINI-CHAVE-SERVIDOR-20261123.md`.
>
> **Otimização de performance em 23/11/2026:** lotes P0.2/P0.3 (Gemini enxuto e Dashboard com 7 queries), P0.1 (AuthProvider único), P1.2, P1.3 e P2 publicados. Diagnóstico e deploys em `docs/OTIMIZACAO-PERFORMANCE-20261123.md`. P1.1 (banco/RLS) foi aplicado, validado e mantido: funções de sessão ~2,3× a ~4× mais rápidas; alerta de Disk IO investigado e descartado como causa; rollback não aplicado. Continuidade em `docs/HANDOFF-P1-1-20261123.md`.

> **REGRA PERMANENTE — AMBIENTES (26/11/2026):** existe **um único banco de dados** (PostgreSQL 17.6 acessado pelo SQL Editor) com **dois ambientes lógicos**: `production` (produção) e `test` (homologação), distinguidos pela **coluna `environment`**. Não há banco físico separado para homologação. **Toda rotina — SQL, diagnóstico, forense, KPI e relatório — deve declarar explicitamente qual ambiente consulta e incluir `environment` no filtro ou no resultado.** Nunca chamar `test` de “outro banco”. Detalhes e regras de escrita em `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

> **DECISÕES APROVADAS PELO USUÁRIO EM 26/11/2026 (item 1 da checagem):** (a) **manter o KPI “Recebido este Mês” inalterado** — o par entrada/estorno de R$ 1.000,00 da parcela 227 é neutro na regra atual (`lib/payments.ts` não muda); (b) **manter `Prorrogada` fora de “vencido”** — parcela prorrogada não é inadimplente, então a view `contract_receivables_summary` continua excluindo esse status de `overdue_amount`, `overdue_installments` e `is_overdue`. Nenhuma correção em código ou em dados de negócio. Registro de retomada em `docs/HANDOFF-CONTAS-A-RECEBER-20261125.md`.
>
> **ISOLAMENTO DA VIEW — MEDIÇÃO PRÉVIA DE 26/11/2026 (item 2):** sessões válidas em `production` (12:06:38 UTC) e em `test` (12:09:37 UTC). A view `contract_receivables_summary` mostrou **125 linhas em ambos**, com 106 próprias + 19 do outro ambiente na sessão de produção e 19 próprias + 106 do outro na sessão de teste; `contracts_via_rls` acompanhou as linhas próprias. **Conclusão: a view não isola ambientes no banco** (`rls_na_view=false`, sem `security_invoker`); a tela esconde o cruzamento porque `lib/supabase.ts` injeta `.eq('environment', ...)` no cliente. Relatório em `docs/ISOLAMENTO-VIEW-RESULTADO-20261126.md`. Correção aplicada pelo usuário em 26/11: `security_invoker=on` na view, com precheck favorável e medição pós-forward em ambos os ambientes (`test` 19/19/0 e `production` 106/106/0, iguais a `contracts_via_rls`). Definição da view preservada, rollback **não** acionado, nenhum dado de negócio alterado. Artefatos em `docs/PRECHECK-ISOLAMENTO-VIEW-20261126.sql`, `docs/FORWARD-ISOLAMENTO-VIEW-20261126.sql`, `docs/VERIFY-ISOLAMENTO-VIEW-20261126.sql` e `docs/ROLLBACK-ISOLAMENTO-VIEW-20261126.sql`. Item 3.1 **decidido pelo usuário em 26/11: manter o vencimento da parcela residual como está** (se houver acordo de prazo, usar **Prorrogar**). Item 3.2 **decidido pelo usuário em 26/11: `Estornado` é título a receber** — estorno desfaz recebimento equivocado e devolve a parcela à condição de devedora. Medição prévia executada em 26/11 às 12:38:50 UTC (`docs/MEDICAO-ESTORNADO-RECEBIVEL-20261126.sql`): `test` tem 3 estornadas e R$ 15.000,00 de saldo (a receber 15.000 → 30.000; vencido 14.000 → 19.000; lote 7 → 10; previsão 30d 0 → 10.000); `production` tem zero estornadas e impacto zero. Front editado em `app/contas-a-receber/page.tsx` (lote, atraso, `totalOpen` e previsão 30d) e publicado em `main` no commit `0cc6bdb`. Forward estrutural aplicado pelo usuário e verificado em 26/11 às 12:44:20.654672+00:00 (`docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql`): `view_sem_estornado=true`, `view_security_invoker_on=true`, `gatilho_sem_estornado_no_filtro=true`, `gatilho_preserva_rotulo_estornado=true`, `dashboards_com_estornado=0`; KPIs conferidos (`test`: 30.000,00 / 19.000,00 / lote 10 / 10.000,00; `production`: 320.655,80 / 65.270,00 / 50 / 19.329,60), saldo estornado inalterado. Rollback estrutural **não** acionado; nenhuma linha alterada na etapa estrutural. O verify apontou `amount_receivable_desatualizado=3` em `test` e `0` em `production`. Correção de `contracts."amountReceivable"` dos 3 contratos de `test` preparada à parte (`docs/FORWARD-ESTORNADO-RECEBIVEL-DADOS-20261126.sql`) e **executada pelo usuário em 26/11 às 12:50:01 UTC**: contratos 74, 76 e 134 de `test` (0,00 → 2.000,00 / 3.000,00 / 10.000,00; total R$ 15.000,00), nenhum de `production`. Verify final executado em 26/11 às 12:54:50.848899+00:00: `amount_receivable_desatualizado=0` em `test` e `production`, estrutura e KPIs mantidos. Item 3 encerrado; nenhum rollback acionado. Plano completo em `docs/ESTORNADO-RECEBIVEL-PLANO-20261126.md`. Rótulo `Estornado`, KPI "Recebido este Mês" e regra de `Prorrogada` preservados.
>
> **Checagem forense de Contas a Receber concluída em 25/11/2026 (18:31:15 UTC, reexecutada às 18:40:03 UTC com resultados idênticos):** script somente leitura executado pelo usuário e relatório em `docs/DIAGNOSTICO-CONTAS-A-RECEBER-RESULTADO-20261125.md`. Achado principal: 8 parcelas com `amountPaid` divergente somam R$ 14.800,00 — exatamente as 9 reversões sem vínculo —, mais 5 parcelas `Quitado` com saldo (R$ 4.310,00). As duas regras de negócio levantadas foram decididas em 26/11 e estão registradas no parágrafo acima. Previsão 30d, órfãos, duplicatas e vínculos de estorno: sem problemas. Nenhuma escrita em banco; script terminou em `rollback`. Nenhuma correção aplicada.
>
> **Rastreio das 13 parcelas candidatas executado em 25/11/2026 (18:50:55 UTC) e complementado em 26/11/2026 (10:53:53 UTC):** `docs/RASTREIO-ESTORNOS-20261125.sql` (célula `rastreio_reversoes_20261125`) e `docs/RASTREIO-COMPLEMENTAR-20261125.sql` (célula `rastreio_complementar_20261125`), ambos somente leitura, rodados pelo usuário em PG 17.6 e terminados em `rollback`. Relatório corrigido em `docs/RASTREIO-ESTORNOS-RESULTADO-20261125.md`. As 9 reversões sem vínculo (R$ 14.800,00) se dividem em quatro mecanismos: pagamentos convertidos em reversão (113 e 122, em 22/11 00:10:42 UTC, `performed_by=null`), vínculo explícito removido (227), reversões sem origem de mesmo valor (147, 87, 129) e candidato só na mesma data/depois (103, 148). A única reversão que entra no KPI de novembro é a da 227; a célula complementar mostrou que o original `3715c3de…` tinha `payment_date=21/11` e foi **apagado** em 22/11 00:10:42 UTC, enquanto a reversão de R$ 1.000,00 permanece sendo subtraída — decisão registrada em 26/11: manter o KPI como está. As cinco reversões antigas têm `qtd_logs=0` e não podem ser datadas por `audit_logs`. Os R$ 4.310,00 das 5 parcelas `Quitado` com saldo são **desdobramentos regulares**: residuais 257, 256, 240, 244 e 239, todas criadas `Aberto`; a 239 foi quitada em 22/11 com pagamento próprio `046c7262…` (transação 1271), refutando a suspeita de “residual nascida quitada sem pagamento”. As consultas rodaram no **banco único**, e todas as linhas da célula complementar são `environment=test`. Nenhuma célula pendente; nenhuma correção aplicada. **Retomar pelo handoff `docs/HANDOFF-CONTAS-A-RECEBER-20261125.md`.** `main` no commit desta interpretação, árvore limpa, publicado no GitHub.
>
> **Retomada em 24/11/2026:** handoff final único em `docs/HANDOFF-FECHAMENTO-20261124.md` (auditoria de Contratos, P0/P1, investigação de lentidão, inventário de scripts, commits e pendências). Nenhuma célula de SQL pendente; nenhum rollback aplicado.
>
> **Lentidão investigada em 24/11/2026 (18:40:45 UTC):** benchmark com 5 repetições confirmou RLS por linha como causa — `clients` 163,3 ms, `installments` 114,5 ms, `payments` 111,6 ms, `contracts` 79,0 ms, contra 0,02–0,05 ms sem RLS. `to_jsonb` do `search_all` foi refutado (11,0 ms × 11,9 ms com colunas diretas). Sem regressão mensurável frente ao baseline P1.1; gargalo é a policy `P0 sessao` com `_rls_can_access(environment)` por linha. Prova de correção com `InitPlan` executada às 18:44:42 UTC: 111,5 → 1,0 ms em `payments`, 79,5 → 1,0 ms em `contracts`, 71,8 → 0,9 ms em `clients`. `docs/FORWARD-RLS-INIPLAN-20261124.sql` **aplicado** às 18:47:25 UTC: 47 policies convertidas + portal em `clients`, contagens e busca inalteradas; 8 policies ficaram em forma direta por normalização do catálogo. `VERIFY` corrigido e `ROLLBACK` reconstruído; `docs/FIX-RLS-INIPLAN-REMANESCENTES-20261124.sql` **aplicado** às 18:51:19 UTC; verify final: 55 policies com InitPlan, 0 em forma direta, 0 com argumento coluna, contagens e busca inalteradas. Benchmark de produção repetido às 18:52:52 UTC: `payments` 111,6 → 1,1 ms, `contracts` 79,0 → 0,9 ms, `installments` 114,5 → 1,1 ms, `clients` 163,3 → 13,7 ms, `search_all` 81,8 → 21,3 ms. Resíduo de 13,7 ms em `clients` rastreado até 125 chamadas por linha de `_rls_portal_indicator_id()` no filtro da policy do portal (18:55:50 UTC: 13,464 ms com função × 0,124 ms com literal). `IN` e `EXISTS` dão o mesmo custo. Prova de InitPlan executada às 18:58:19 UTC: portal em `clients` 14,084 → 0,328 ms, em `contracts` 13,913 → 0,286 ms, em `commission_payments` 1,700 → 0,241 ms; onboarding sem ganho (0,125 → 0,149 ms), portanto fora do escopo. `docs/FORWARD-PORTAL-INIPLAN-20261124.sql` **aplicado** às 19:01:01 UTC; verify: 4 policies com InitPlan, 0 chamadas diretas, `restantes=[]`, contagens e busca inalteradas. **Investigação encerrada** com benchmark final de produção às 19:02:51 UTC (PG 17.6, `authenticated`, 5 repetições, contagens `125/181/177/15`): `clients` 163,3 → **2,071 ms**, `payments` 111,6 → **1,023 ms**, `contracts` 79,0 → **0,930 ms**, `installments` 114,5 → **1,037 ms**, `vw_dashboard_top_defaulters` 103,5 → **3,872 ms**, `search_all` 81,8 → **9,131 ms** (número válido; expectativa informal de ~3 ms não confirmada). `to_jsonb` e `IN` vs `EXISTS` refutados por medição. Nenhum `UPDATE`/`DELETE`, nenhuma grant/função nova, nenhum rollback aplicado (ambos arquivados). Detalhes em `docs/HANDOFF-P0-P1-CONTRATOS-20261124.md`, seção 9.

> **Correções estruturais P0 de Contratos aplicadas e validadas em 24/11/2026 (18:24:54 UTC):** policies do portal com `_rls_can_access(environment)`, 3 views de dashboard excluindo `Estornado` e `search_all` reparado (removidas `contractNumber`, `clientId` e `processes.processNumber`). Busca global voltou a retornar clientes e contratos. production inalterado (18 inadimplentes / R$ 77.931,60); teste caiu de 7 para 5 inadimplentes e de R$ 19.000,00 para R$ 14.000,00 — duas parcelas `Estornado` saíram corretamente dos KPIs. Contagens de tabelas inalteradas; nenhum UPDATE/DELETE; rollback não aplicado. Detalhes em `docs/HANDOFF-P0-P1-CONTRATOS-20261124.md`. **P1 (unicidade/índices) aplicado e validado em 18:29:06 UTC:** `UNIQUE(contract_id,"installmentNumber")` ativa, 8 índices presentes e nenhum inválido, 0 duplicatas, contagens inalteradas (125/181/177/15). A 1ª tentativa falhou com erro `25001` (`CONCURRENTLY` em transação); corrigido para `CREATE INDEX` normal, sem aplicação parcial. Nenhum rollback aplicado; nenhum UPDATE/DELETE.
>
> **Auditoria do módulo Contratos — fechada em 24/11/2026:** diagnóstico estrutural, forense, validação e auditoria consolidada executados somente leitura, em uma única célula (`auditoria_contratos_completa`, `coletado_em=2026-11-24T18:01:50.243675+00:00`). Resultado: **44/44 totais explicados** pela fórmula real do trigger (os “17 inconsistentes” eram falso positivo); **26 excessos confirmados como entrada real** em `payments` — `pago == SUM(payments)` nos 26, `interest=0`/`fine=0`, nenhum com transação vinculada; **9 pagamentos sem conta recuperável** (0 com conta na transação, 4 sem transação; candidatas por valor/data ambíguas e em `test`). Nenhum UPDATE/DELETE e nenhuma escrita em banco. Correções estruturais (policies do portal, views com `Estornado`, `search_all`, índices/unicidade) seguem **pendentes de autorização explícita e medição prévia**. Resultado em `docs/VALIDACAO-CONTRATOS-RESULTADO-20261124.md`; handoff em `docs/HANDOFF-CONTRATOS-20261124.md`; script em `docs/AUDITORIA-CONTRATOS-COMPLETA-20261124.sql` (commit `de19564`).
>
> **Recebimento parcial corrigido em 25/11/2026:** o desdobramento fechava a parcela original antes de inserir a residual; quando ela era a última em aberto, o contrato ficava momentaneamente `Quitado` e o recálculo era barrado com `P0001 Não é possível reabrir um contrato quitado.`. As funções `prevent_update_delete_paid_contract` e `fn_protect_contracts_status` passaram a permitir `Quitado → Parcial` **somente com parcela real em aberto** (mesma regra do recálculo). Verificação: `backup_objetos=4`, `v3=true` nas duas funções, 2 gatilhos intactos. Nenhum dado alterado; rollback disponível em `backup_contratos_protecao_20261125`. Detalhes em `docs/CORRECAO-RECEBIMENTO-PARCIAL-20261125.md`; script em `docs/CORRECAO-RECEBIMENTO-PARCIAL-20261125.sql` (commit `2134bf1`). Validação funcional na tela pendente pelo usuário.
>
> **Recebimento parcial em parcela estornada corrigido em 25/11/2026:** após o estorno, a parcela fica `Estornado` com `amountPaid = 0`, mas `rpc_recebimento_com_desdobramento` bloqueava qualquer status de encerramento — enquanto o recebimento integral (`process_installment_payment`) aceitava. Agora o desdobramento permite `Estornado` **somente com `amountPaid = 0`**; `Quitado`/`Cancelado` e `Estornado` com saldo pago residual continuam bloqueados. Verificação: `backup_objetos=1`, `v8=true`, `ainda_bloqueia_quitado_cancelado=true`. Nenhum dado alterado; rollback em `backup_recebimento_desdobramento_20261125`. Detalhes em `docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.md`; script em `docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.sql` (commit `24d510f`). Reteste do parcial de R$ 811,00 na parcela 207 **aprovado pelo usuário em 25/11/2026**: original `Quitado` com 811, residual `Aberto` com 810 e extrato com recebimento integral, estorno e novo parcial (total recebido 811,00).
>
> **Relatório de Recebimentos corrigido em 25/11/2026:** o relatório lia `payments` diretamente e somava a linha de estorno (gravada com valor positivo) além de manter o recebimento original, inflando o total do período. Novo helper `lib/payments.ts` (`filterEffectiveReceipts`) remove a reversão **e** o pagamento estornado; aplicado no relatório e no KPI **Recebido este Mês**. Nenhuma alteração de banco ou dados. Detalhes em `docs/CORRECAO-RELATORIO-RECEBIMENTOS-20261125.md`. Validação visual **aprovada pelo usuário em 25/11/2026**: apenas o recebimento real de R$ 811,00 aparece, total em R$ 10.790,44 e 8 lançamentos.
>
> **Fechamento do dia 25/11/2026:** handoff único em `docs/HANDOFF-RECEBIMENTOS-20261125.md` — as três correções do fluxo de recebimento, evidência de auditoria da parcela 207, arquivos-chave, rollback, pendências de validação manual (logout, permissões, Marketing/IA, impersonação, iPhone), decisões abertas (vencimento da residual e lote com `Estornado`) e observações técnicas. `main` em `fe80c69`, árvore limpa, nenhuma célula de SQL pendente.

## Gemini — chave única no servidor (2026-11-23)

- Variável `GEMINI_API_KEY` adicionada como Secret nos três ambientes da Vercel.
- Deploy com modelo `gemini-3.8-flash`: `dpl_E5gvpmkScw6Gh95gKDBcFL3F3LZ6` — `READY`.
- Código simplificado: sem `manualKey`, sem `localStorage` de chave, sem `NEXT_PUBLIC_GEMINI_API_KEY`.
- Procedimento, validação e rollback: `docs/GEMINI-CHAVE-SERVIDOR-20261123.md`.

## F4b — RLS, grants e integridade de auditoria/settings (2026-11-19)

Executado na branch `fase0-seguranca`, em etapas pequenas, cada uma com backup/rollback e validação antes da seguinte. **Autenticação não foi alterada**: heartbeat de 20 s, `app_validate_session` e tolerância de 90 s seguem intactos. Nenhuma decisão de tenant foi tomada.

### F4b-0 — proteção dos backups de policies
- Tabelas `_auth_hardening_policy_backup_20261118` e `birthday_templates_backup` com **RLS habilitada** e **zero grants** para `anon`/`authenticated`/`public`. Deixaram de ser legíveis pela chave pública.

### F4b-2a — remoção de policies decorativas
- **82 policies** anuladas por policies `USING (true)` foram removidas; resta **1** (`users / Isolamento por Organização em users`), preservada por dependência.
- `clients` ficou com 7 policies (inclui `Filter by organization`, hoje morta pela policy permissiva).
- Rollback: `backup_policies_tenant_20261119.sql` (83 `CREATE POLICY` em 40 tabelas) em `C:\InoveTecnologia\InoveJuris-Backups\FASE0-20261119\`.
- Nada foi dropado de tabela alguma — apenas policies que nunca eram avaliadas.

### F4b-1a — trigger de auditoria como `SECURITY DEFINER`
- `log_audit_event` convertida para `SECURITY DEFINER`, owner `postgres`, `search_path=public` (confirmado no SQL Editor).
- Sem isso, a revogação de escrita em `audit_logs` derrubaria a auditoria de toda a aplicação.

### F4b-1c1 — escrita em `audit_logs` revogada do cliente
- `INSERT/UPDATE/DELETE` revogados de `anon`/`authenticated`/`public`; `SELECT` e o `INSERT` do `service_role` mantidos.
- Prova de que a auditoria continua gravando: evento de `clients/UPDATE` registrado em **2026-11-19 12:01:52 UTC**.
- Rollback: `rollback_f4b1c1_revoke_audit_logs.sql` — **atenção:** volta ao estado inseguro; o `1a` só pode ser revertido depois de reverter o `1c1`.

### F4b-1b — configurações gravadas pelo servidor
- Nova rota `POST /api/settings/update` (valida sessão/admin e grava com `service_role`).
- `lib/supabase-service.ts`: cliente `service_role` com **falha explícita** quando a chave não existe (sem fallback silencioso para a anon key).
- `SettingsProvider.updateSetting` passou a chamar a rota via `fetch`.
- Regressões do `1c1` corrigidas no mesmo passo: `/api/backup/restore` e `/api/settings/audit/cleanup` também migrados para `service_role`.
- Efeito colateral conhecido: usuário com apenas `canAccessTestEnv` perde a gravação de configurações, porque a rota exige `requireAdminContext('settings')`.

### F4b-1c2 — escrita em `system_settings` revogada do cliente
- `INSERT/UPDATE/DELETE` revogados de `anon`/`authenticated`/`public`; leitura mantida; `service_role` intacto.
- Confirmação devolvida: `anon_insert/update/delete=false`, `anon_select=true`, `authenticated_insert=false`, `service_insert/update/select=true`.
- Rollback: `rollback_f4b1c2_revoke_system_settings.sql`.

### Validação funcional
- **Aparência** salva em **12:50:59** (`updated_by=2`) com o `1c1` já aplicado e novamente em **12:59:21**, depois do `1c2` — ou seja, o `anon` perdeu a escrita e o sistema continua salvando pela rota de servidor.
- `npx tsc --noEmit` e `eslint` sem erros nos arquivos alterados.

### Deploys
| Commit | Deploy | Conteúdo |
|---|---|---|
| `3874884` | `dpl_2ipCc5iYGBNrynn2HpPYWjJXRChM` (Production) | rota de settings + `lib/supabase-service.ts` + `SettingsProvider` + restore |
| `286de74` | `dpl_APjXUSLhcsE4Rm6bhkXXKvP7iAeA` (Production, alias `https://inove-juris.vercel.app`) | limpeza de auditoria em `service_role` |

- Verificação: `/login` → `200`; `/configuracoes` sem cookie → `307`.
- Rollback de deploy: promover `dpl_A5BoCyrTwcv35UXskj8eqBgeY5SP`; rollback de código: `git revert 286de74` e `git revert 3874884`.

### O que a F4b-1 **não** resolve
- As ~50 tabelas de domínio continuam abertas por policies `USING (true)`. Apenas **6 tabelas** têm RLS efetiva (`users`, `user_sessions`, `login_attempts`, `login_challenges`, `trusted_devices`, `_auth_hardening_policy_backup_20261118`).
- Quem tiver a anon key (que é pública) continua **lendo** clientes, processos, contratos e financeiro direto pela API REST.
- O que ficou fechado foi a **integridade**: auditoria e configurações não podem mais ser forjadas, alteradas ou apagadas pelo cliente.

### F4b-2b — identidade no banco (FASE A CONCLUÍDA E VALIDADA em 2026-11-19)
- Autorização explícita do usuário para a **Fase A**: token JWT com `role=anon` (mesmo privilégio de hoje). **Nenhuma policy foi alterada.**
- Comparação JWT próprio × BFF registrada em `docs/PARECER-JWT.md`. BFF descartado; JWT próprio continua sendo a recomendação técnica.
- Implementação na branch `fase0-seguranca`:
  - `9ebe9a3` — emissão do token em `/api/auth/session` (login, validação e heartbeat), transporte em `lib/supabase.ts` (header `Authorization` + Realtime), token em memória em `lib/session-token.ts`, renovado no heartbeat de 20 s. Dependência `jose@6.1.3`.
  - `e910740` — trava de preflight: o token só chega ao navegador depois que o próprio PostgREST confirma que o aceita. Chave errada → app segue sem token, sem queda.
  - `080e042` — aceita `SUPABASE_JWT_PRIVATE_JWK` (ES256) ou `SUPABASE_JWT_SECRET` (HS256 legado, ainda aceito para verificação).
- SQL aditivo aplicado pelo usuário no SQL Editor (arquivos externos em `FASE0-20261119`, **não** em `supabase/migrations`):
  - `forward_f4b2a_token_payload.sql` — `organization_id` em `_auth_user_payload` e `user` no retorno de `app_heartbeat`. Devolução: `payload_tem_organizacao=true`, `heartbeat_devolve_usuario=true`. Não altera validade, tolerância de 90 s nem intervalo de 20 s.
- Assinatura: `SUPABASE_JWT_SECRET` (HS256 como ponte) salva na Vercel em Production, Preview e Development. A chave ECC própria por importação ficou para depois por causa da standby `c73f6852-eeca-455d-9549-647afae7e493`.
- Deploy final: `dpl_9FZNmjmnNT3JV1GJvTE2Wg92KEfu` — Ready, alias `https://inove-juris.vercel.app`; `/login` `200`, `/configuracoes` `307`.
- **Validação do token (2026-11-19):** `alg=HS256`, `role=anon`, `sub=2`, `organization_id=eaf29983-1998-40a4-bd07-03ea09b4adfa`, `environment=production`, `session_id` presente, `exp=iat+600` (10 min). O token só chegou ao navegador porque o preflight do PostgREST o aceitou. Logs do deploy novo: nenhum `[jwt]` e nenhum `"level":"error"`; os avisos de 13:52/13:53 UTC (`dpl_BivwWM4NH2ZUnPtmvLy1hppFNzAi`) são de builds anteriores.
- Rollback imediato da Fase A: remover `SUPABASE_JWT_SECRET` na Vercel e republicar; ou promover `dpl_3Z5EZi41FQPWPSZsviw2SLfyM6fs` (código sem chave). Rollback do payload: `rollback_f4b2a_token_payload.sql`.
- **Fase B não executada:** trocar `SUPABASE_JWT_ROLE=authenticated` exige autorização explícita e conferência prévia dos grants de `authenticated` nas 34 tabelas/views e nas 30 RPCs. O snapshot F0 (`grants_rollback.json`) cobre 67 objetos × `anon`/`authenticated` (465 grants por role) e **não contém grants de funções** — as RPCs precisam de verificação ao vivo antes da troca.
- **F4b-2c** (dropar as policies `true`) continua dependente da identidade completa; sozinha derrubaria clientes, prazos, Publicações, contratos e financeiro.

### Retenção de logs — concluída em 2026-11-19
- Usuário escolheu **tudo em 90 dias**. Antes: `audit_logs` 2.465 (0 vencidos em 90/180 dias), `login_attempts` 17 (14 vencidos em 90 dias), nenhum job.
- `forward_retencao_90d.sql` aplicado: `cleanup_old_logs()` passou a 90/90 dias, `SECURITY DEFINER`, sem `execute` para `anon`/`authenticated`/`public`, e job `cleanup-old-logs-90d` ativo (`jobid=8`, `15 3 * * *` = 00:15 BRT).
- Rollback: `rollback_retencao_90d.sql` (volta a 90/180 e remove o job).

### Pendências abertas

> **Atualização em 23/11/2026:** Fase B da identidade (`role=authenticated`) e F3
> (`http_*`, executado pelo Supabase Support) já estão concluídas. A chave ECC própria e
> `organization_id`/multitenancy foram **adiados**, com plano completo em
> `docs/PLANO-ROTACAO-ECC-E-MULTITENANCY-20261123.md`. O status corrente de segurança está
> em `supabase/migrations/STATUS_SEGURANCA.md`.

- **Merge** — concluído em 2026-11-20: `main`, `trabalho-com-claude` e `fase0-seguranca` alinhados em `995fdb7` (5 commits trazidos: `483009a`, `c4d806c`, `f1bac58`, `85dc94b`, `995fdb7`).
- **Fase B da identidade** — trocar `SUPABASE_JWT_ROLE=authenticated` (depende de autorização + verificação de grants/RPCs).
- **Chave ECC limpa** — a standby `c73f6852-eeca-455d-9549-647afae7e493` precisa ser marcada como `previously_used`/revogada para liberar a importação de chave própria.
- **F3** (~17 funções `http*` de `supabase_admin`) — depende do chamado no Supabase Support.

## Fase 1A — otimização de I/O (2026-11-19)
- Autorização do usuário: itens 1 a 5, um de cada vez, com backup/rollback. **Fase 1B não autorizada** — heartbeat de 20 s, `app_validate_session` e tolerância de 90 s intactos. Nenhum acesso alternativo criado.
- **Itens 1–3 entregues** no commit `8cdf51e` (pushed em `trabalho-com-claude`): `lib/birthdays.ts` (cache/dedupe, 6 → 3 consultas de aniversariantes), 5 canais Realtime do dashboard → 1 canal `dashboard-changes`, e dedupe de `fetchSettings` no `SettingsProvider` (com `force` no Realtime/rollback).
- `npx tsc --noEmit` e `npm run build`: **OK** (25 páginas). Ponto de restauração: `5014dee`; rollback do código: `git revert 8cdf51e`.
- **Item 4 concluído em 2026-11-19:** `forward_otim1_index_audit_logs.sql` executado pelo usuário; `EXPLAIN ANALYZE` da consulta do dashboard mostrou `Index Scan using idx_audit_logs_env_performed_at` e **0,766 ms** (era 133,32 ms), com 4 buffers. Rollback: `rollback_otim1_index_audit_logs.sql` em `C:\InoveTecnologia\InoveJuris-Backups\AUDITORIA-IO-20261119\`.
- **Item 5 concluído em 2026-11-19:** `ANALYZE` em todas as tabelas `public`; `last_analyze = 09:38:11 UTC`; `n_live_tup`: `audit_logs` 2.248, `clients` 113, `publications` 56, `system_settings` 11 (antes 57/0/0/0). Nenhum dado alterado, sem rollback.
- **Deploys da Fase 1A (2026-11-19):** Preview `dpl_4HU25Fp4t6oJYo9vj5UsoJsECC6h` e Production `dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC` (alias `https://inove-juris.vercel.app`). Rotas `/`, `/publicacoes`, `/processos`, `/configuracoes` → `307 → /login` sem cookie.
- **Rollback completo da Fase 1A:** promover `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj` (Production) e `dpl_AWWbfXvcZNSJaqQcz1bygGfZ5otY` (Preview), `git revert 8cdf51e` e executar `rollback_otim1_index_audit_logs.sql`.
- **Medição pós-Fase 1A (preliminar, janela contaminada — `stats_reset` ainda 03:32):** `audit_logs` 133,32 → 46,63 ms de média (0,766 ms no `EXPLAIN` isolado); `realtime.list_changes` 6,75 ms/chamada mas 17,79 s agregados; `app_validate_session` 95,18 ms/chamada (Fase 1B, intacta); cache 99,97%. Para medição justa: `reset_stats_medicao_limpa.sql` + ~10 min de uso + `queries_app.sql`. Detalhes: seção 13.14 do parecer.
- **Medição LIMPA (seção 13.16, `stats_reset = 09:57:07.940908`):** `audit_logs` **9,76 ms** (era 133,32 ms) e 8,00 ms na segunda consulta — 0,5% do tempo da app; `app_validate_session` 59,48 ms/chamada (32 chamadas / 1,90 s) e `app_heartbeat` 42,90 ms (31 / 1,33 s) = **87% do tempo da app**; `realtime.list_changes` **8,28 s agregados** em 871 polls; cache 99,979% (19 leituras físicas novas). `system_settings` sem chamadas registradas na janela (dedupe). Fase 1B e redução de tabelas do Realtime seguem intactas/sem autorização.
- **Fase 1C (autorizada e aplicada em 2026-11-19):** trigger `audit_user_sessions` confirmado como `AFTER INSERT OR DELETE` (removido apenas UPDATE, responsável por 1.919 linhas / 79,8% do `audit_logs`). Verificação devolvida pelo SQL Editor: `CREATE TRIGGER audit_user_sessions AFTER INSERT OR DELETE ON public.user_sessions FOR EACH ROW EXECUTE FUNCTION log_audit_event()`. Nenhum dado apagado. **Medição pós-1C (seção 13.18, `stats_reset` 10:25:37):** `app_validate_session` 59,48 → **6,68 ms** (−89%); `app_heartbeat` 42,90 → **17,53 ms** (−59%); tempo total das queries da app 3,71 → **0,69 s** (−81%); cache 99,985%. O custo que motivava a Fase 1B era em grande parte o trigger — **Fase 1B não é mais necessária e segue intacta**. Forward: `forward_otim3_audit_user_sessions.sql`; rollback: `rollback_otim3_audit_user_sessions.sql`. Código ajustado em `SystemTab.tsx`, `fix_audit_triggers.sql` e `fix_audit_triggers-1.sql` (`setup/page.tsx` já excluía a tabela). `tsc` e `build` OK. Fase 1B e Realtime permanecem intactos.
- **Deploys Fase 1C:** Preview `dpl_EHKa4yJLZUyPbge4QonYiXGdLzmc`, Production `dpl_CamrC5NmuaqbRThnGTL3DbD8a4QZ` (alias `https://inove-juris.vercel.app`). Rollback de código: `git revert c3eff3e`; rollback de deploy: promover `dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC` (Production) e `dpl_4HU25Fp4t6oJYo9vj5UsoJsECC6h` (Preview); rollback do banco: `rollback_otim3_audit_user_sessions.sql`.
- **Validação final concluída em 2026-11-19 (seção 13.19):** login com conta de teste (credenciais não registradas), A/B/C com cookie fresco → A `200`/`expiresIn: 3600`, B `302` → URL assinada (storage `200`), C `200`/`expiresIn: 3600`; rotas protegidas carregando com cookie e `307 → /login` sem cookie; `Ctrl+Shift+R` com 0 erros e 0 warnings (8 warnings transitórios do Recharts só no 1º carregamento, não reproduzidos). Fase 1A e 1C fechadas; Fase 1B permanece intacta e desnecessária. **`Disk IO Balance` observado: 60%** (saldo restante do burst; 100% = cheio, 0% = esgotado), com `Disk Usage` 4%, `Peak Connections` 22/60, `Memory` 42%, `CPU` 14% e `Slow Queries` 3 — sem pressão de CPU/memória/conexões/espaço. Orçamento recuperado; acompanhar a tendência por 24–48 h.
- Detalhes: seção 13.13 de `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md`.

## Parecer guardado — multitenancy para locação futura (2026-11-18)
- Relatório completo: `docs/PARECER-TENANT-INOVEJURIS.md`.
- Análise **somente leitura**: nenhum código, banco ou deploy foi alterado por este parecer.
- Conclusão: viável de forma gradual; começar por **backup validado + segurança/Camada B**, antes de qualquer seletor de organização.
- Modelo recomendado: um banco, `organization_id` por tabela de domínio, `organization_members` e RLS derivada da sessão.
- Pontos de restauração registrados: commit `ed9103d` e deploy `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`.

## Parecer guardado — impacto das correções de segurança (2026-11-18)
- Relatório completo: `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md`.
- Auditoria passiva concluída nas frentes de repositório/Git/dependências, HTTP/TLS e banco Supabase. **Nada foi alterado** em código, banco ou deploy.
- Resposta à pergunta do usuário: a maior parte das correções é invisível; ajustes internos ficam concentrados em backup/restore, chave Gemini, storage e CSP; Next.js vai em trilha própria de staging.
- Ordem recomendada: F0 backup → F1 segredos → F2 rotas administrativas → F3 `exec_sql`/`http` → F4 grants/RLS → F5 views → F6 storage → F7 headers → F8 dependências.

## F0 concluída — ponto de retorno antes das correções (2026-11-18)
- Autorização do usuário registrada; execução **somente leitura** em produção.
- Timestamp PITR: `2026-11-18 18:01:02.49299+00`. `archive_mode=on`, `wal_level=logical`, `archive_command` configurado — elegível a PITR.
- Tag no Git: `pre-security-fix-f0-20261118` (enviada para `origin`). HEAD: `878fd03`.
- Local dos arquivos (fora do repositório): `C:\InoveTecnologia\InoveJuris-Backups\F0-20261118`.
- Conteúdo: `MANIFEST.txt` com SHA256, `table_counts.json`, `schema_columns.json`, `schema_indexes.json`, `views_snapshot.json`, `functions_snapshot.json`, `policies_rollback.json/.sql` (261 policies), `grants_rollback.json/.sql` (930 grants) e `data_chunk_1..6.json` (58 tabelas / 3.806 linhas).
- `npx supabase db dump` exige Docker, indisponível; a exportação lógica foi feita via API SQL (`npx supabase db query`). Nada foi instalado e nenhuma alteração de código/banco/deploy ocorreu.
## F1 — preparação de código concluída (2026-11-18)
- Usuário autorizou **somente preparar o código**, sem alterar variáveis de ambiente, banco ou deploy.
- Chave Gemini removida do cliente: nova rota server-side `/api/ai/generate`, helper `lib/gemini-server.ts`, remoção da injeção `window.GEMINI_API_KEY` no layout e do bloco `env` do `next.config.ts`.
- Componentes adaptados: `AIInsightsWidget`, `TaskIntelligence` e `app/leads/page.tsx` (3 chamadas).
- `npm run build` passou; nenhuma chave Gemini aparece no bundle client.
- **Novo achado:** `.env.example` tinha senha literal do pooler Supabase em comentário; valor removido e substituído por placeholder. Rotacionar essa senha junto com a F1.
- Pendente do usuário: novas chaves (Gemini, DataJud, `pg_cron`) e revogação do token antigo da Vercel. Nenhum deploy publicado.

## F2 concluída — rotas administrativas protegidas (2026-11-18)
- Continuação autorizada pelo usuário **sem trocar as chaves**: chaves atuais seguem em uso, inclusive o fallback server-side do Gemini.
- Novo helper `lib/server-auth.ts`: `requireAdminContext`, `AdminAuthError` e `authErrorResponse`, baseados em `app_validate_session` com os cookies `session_id` e `app_env`.
- Rotas protegidas: `/api/backup/restore`, `/api/backup/generate`, `/api/settings/audit/cleanup` e `/api/settings/smtp/test`. O ambiente e o `userId` agora vêm da sessão validada, não do cookie cru ou do body.
- `npm run build` passou. Validação local com build de produção: sem cookies → `307` para `/login`; com cookie forjado → `401` nas rotas protegidas (inclusive `/api/ai/generate`).
- Pendente: validar o fluxo positivo com administrador real em staging/preview. **Nenhum deploy de correção foi publicado.**
- Rollback F2: promover `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`.

## F3 executada parcialmente em 2026-11-18
- Autorização do usuário para a F3 completa. `exec_sql(text)` **foi revogado** de `PUBLIC`/`anon`/`authenticated`; `service_role` e `postgres` intactos.
- `verify_before.json` (18/18 com anon=true) e `verify_after.json` (1/18 — somente `exec_sql` — com anon=false) salvos em `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118`.
- Produção: `GET /api/diagnose-db` retornou `42501 permission denied for function exec_sql`; jobs `pg_cron` 1/2/5 seguem ativos como `postgres`.
- **Bloqueio:** as 17 funções `http`/`urlencode` pertencem a `supabase_admin`; a conexão `postgres` não tem permissão para revogar e o `REVOKE` foi ignorado silenciosamente. Detalhes em `BLOCKED-http.md` no mesmo diretório.
- Rollbacks disponíveis: `rollback_partial.sql` (exec_sql) e `rollback.sql` (completo). **Nenhum deploy; nenhuma chave trocada.**
- Decisão do usuário: abrir chamado no **Supabase Support** para revogar as 17 funções com role elevada. Arquivos `support_http_revoke.sql` e `SUPPORT-REQUEST.md` prontos no diretório da F3; chamado ainda não foi aberto por este agente.
- Próximo passo: abrir o chamado e, em paralelo, seguir para F4 com o risco `http` registrado.

## F4 — parecer preparado, nada aplicado (2026-11-18)
- Seção 10 de `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md`. Snapshots em `C:\InoveTecnologia\InoveJuris-Backups\F4-20261118`: 261 policies, 134 linhas de grants (67 objetos × 2 roles), 54 tabelas com policy ampla.
- **Achado que mudou a fatia:** o app usa a anon key em cliente e servidor, sem JWT Supabase; a identidade está no cookie `session_id`. Os GUCs de organização/usuário das policies não são setados pelo código (só `app.current_env`), então as policies de tenant estão inertes e as permissivas `USING (true)` sustentam o sistema.
- Em vez de “dropar `USING (true)` e aplicar `FORCE RLS`” agora, o parecer propõe **F4a**: revogar apenas `TRUNCATE`, `REFERENCES` e `TRIGGER` de `anon`/`authenticated` nos 67 objetos. `SELECT/INSERT/UPDATE/DELETE` intactos; sem deploy e sem troca de chave.
- Arquivos prontos em `F4-20261118`: `forward_f4a.sql`, `rollback_f4a.sql`, `verify_f4a.sql`.
- **F4b (reescrita de RLS) fica para decisão futura**: exige definir identidade por requisição no banco (JWT, RPCs `SECURITY DEFINER` ou GUC derivado da sessão) e escolher o modelo de tenant. Fazer isso agora pararia clientes, prazos, Publicações, contratos e financeiro.
- Risco residual registrado: vazamento via REST com a anon key e tokens OAuth em `system_settings` não é resolvido pela F4a; depende da F4b.
- **F4a aplicada em produção em 2026-11-18:** 402 → 0 linhas de `TRUNCATE/REFERENCES/TRIGGER` (`verify_f4a_before.json` → `verify_f4a_after.json`); CRUD inalterado (66 objetos por role). Leitura via anon key validada em 6 tabelas (`HTTP 206`); F3 continua com `42501`. Rollback em `rollback_f4a.sql`. **Nenhum deploy; nenhuma chave trocada.**
- **F4b-2a, F4b-1a, 1c1, 1b e 1c2 executados em 2026-11-19** (ver seção F4b no topo). A **F4b-2b Fase A (identidade/JWT com `role=anon`) foi concluída e validada**; a Fase B (`role=authenticated`) e a **2c** (dropar as policies `true`) seguem pendentes e dependem de autorização explícita.

## F5 — parecer executado em 2026-11-18
- Seção 11 de `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md`. Arquivos em `C:\InoveTecnologia\InoveJuris-Backups\F5-20261118`: `views_current.json`, `view_columns.json`, `kpi_baseline.sql/.json`, `forward_f5.sql`, `rollback_f5.sql`, `verify_f5.sql`.
- 13 views no schema `public`, todas de `postgres`. 4 já têm `security_invoker=on`; 9 não têm e são o alvo do forward.
- Baseline salvo com 48 medições (contagens e agregados por view/ambiente). Ex.: receivables metrics production `total_expected=488095.63`, `total_overdue=82470.40`.
- Achados preexistentes sinalizados (não causados pela F5): views sem coluna `environment` recebem filtro injetado pelo Proxy e retornam `42703`; `app/page.tsx:246` seleciona colunas inexistentes em `vw_process_velocity`.
- Impacto esperado: nenhum nos KPIs no estado atual; preparação necessária para a F4b.
- **F5 aplicada em produção em 2026-11-18:** `verify_f5_before.json` 9/4 → `verify_f5_after.json` 0/13; 48 medições de KPI idênticas (`kpi_after.json`, 0 alterações); REST com anon key validado em 7 views; F4a (0 sensíveis) e F3 (`42501`) revalidadas. Rollback em `rollback_f5.sql`. **Nenhum deploy; nenhuma chave trocada.**
- Achados preexistentes das views seguem em aberto; não foram corrigidos pela F5.

## F6 — parecer preparado; F6a implementada, sem deploy (2026-11-18)
- Seção 12 de `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md`. Arquivos em `C:\InoveTecnologia\InoveJuris-Backups\F6-20261118` com `MANIFEST.txt`.
- 3 buckets públicos: `client_documents` (0 objetos), `templates` (5), `marketing` (29). 17 policies permissivas em `storage.objects`, inclusive `SELECT` público e escrita por `anon`/`public`.
- Achado crítico: gerar URL assinada no cliente com a anon key não resolve, porque o atacante pode gerar a dele; é preciso gerar no servidor com `SUPABASE_SERVICE_ROLE_KEY` e negar `SELECT` a `anon`.
- A F6 exige código + deploy; o SQL sozinho quebraria upload/download. Proposta: **F6a** preparar rotas servidor e ajustar os 3 pontos (`clientes/[id]`, `documentos`, `MarketingTab`) sem deploy; **F6b** aplicar `forward_f6.sql` e publicar o código juntos; `rollback_f6.sql` pronto.
- Pré-requisito: confirmar `SUPABASE_SERVICE_ROLE_KEY` na Vercel e nenhuma service role em `NEXT_PUBLIC_*`.
- **F6a implementada em 2026-11-18, sem deploy e sem banco:** rotas `/api/storage/upload`, `/api/storage/signed-url` (redireciona para URL assinada de 1h) e `/api/storage/remove`, todas com validação de sessão/permissão e service role somente no servidor. Helpers em `lib/storage-server.ts`, `lib/storage-policy.ts` e `lib/storage-client.ts`; `requireSessionContext()` extraído em `lib/server-auth.ts`.
- Pontos ajustados: `app/clientes/[id]`, `app/documentos`, `components/settings/MarketingTab` e, adicionalmente, `components/BirthdayCardGenerator` (também consome as imagens de marketing). Nenhum `getPublicUrl` resta no cliente; URLs antigas continuam gravadas e são resolvidas pelo proxy assinado.
- Build concluído; sem sessão as três rotas retornam `307` para `/login`. **Nenhum deploy publicado; nenhuma alteração em buckets/policies/objetos.**
- **Preview da F6a publicado em 2026-11-18:** `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU` → `https://inove-juris-9nni894w2-alcantarus-projects.vercel.app`. Deploy de preview, **não promovido a produção**.
- Com autorização do usuário, `SUPABASE_SERVICE_ROLE_KEY` foi adicionada como **Secret somente no Preview** do Vercel, usando a chave `service_role` atual do Supabase. Production e Development continuam sem a variável. Rollback: `vercel env rm SUPABASE_SERVICE_ROLE_KEY preview`.
- Validação feita no preview: as três rotas retornam `307` para `/login` sem sessão; localmente, a chave atual gerou URL assinada com sucesso para um objeto existente de `templates`. **Validação positiva dos fluxos (upload/download/exclusão) ainda pendente** — depende de sessão válida de teste; não foi usada sessão de usuário real.
- F6b (buckets privados + remoção das 17 policies) depende dessa validação positiva e de replicar a variável em Production no mesmo deploy. Rollback em `rollback_f6.sql`.
- Último deploy de produção continua `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`.
- **Validação positiva da F6a concluída em 2026-11-18:** os três testes (assinatura em `templates`, `redirect=1` e assinatura em `marketing`) passaram no preview `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU`, com `expiresIn: 3600`. Registro na seção 12.9 do parecer de impacto.
- **F6b executada em 2026-11-18 — concluída:** Secret `SUPABASE_SERVICE_ROLE_KEY` adicionada em Production (valor `sb_secret_...`, novo formato); deploy `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i` com alias de produção; `forward_f6.sql` aplicado no SQL Editor do Supabase porque a service role não é dona de `storage.objects` (`42501`). Estado final: 0 buckets públicos e 0 policies. Testes A/B/C repetidos em produção com sucesso; `/`, `/documentos` e `/publicacoes` com `200`; URL pública antiga e assinatura com anon key retornam `400`. Detalhes na seção 12.10 do parecer.
- **Ponto 2 / unificação de chaves concluída em 2026-11-18:** Preview passou a usar anon key `sb_publishable_...` e service role `sb_secret_...`; Production passou a usar a publishable (a secreta já estava correta). Novos deploys: `dpl_DVUkHA4hhKzni8ENe62i8wvsM65w` (Preview) e `dpl_7PA9Yead2KsQSNhjAf1dhULMap7s` (Production, alias atual). Testes A/B/C, páginas e redirect de login validados nos dois ambientes. Detalhes na seção 12.11 do parecer.
- Chaves legadas **desativadas** em 2026-11-18; a anon antiga retornou `401` em teste direto. O job 5 do `pg_cron` usa token DataJud (não chave Supabase) e estava `succeeded` antes da desativação; monitorar no próximo disparo.
- **Correção crítica após a desativação:** `lib/supabase.ts` tinha a anon key legada fixa e alimentava todo o acesso a dados. A constante agora lê `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Deploys intermediários: `dpl_5qvCZ4fmEzYkcjrXugZRBFSJBEUo` (Production) e `dpl_HoAt2kNRiBweZS9itN7kUipzBYor` (Preview). Detalhes nas seções 12.12/12.13 do parecer.
- **Correção de chave legada no cliente (12.14):** cache do Firefox servia chunk antigo com a chave antiga e o `localStorage` podia conter chave custom legada. `getSupabaseConfig()`, `SystemTab.tsx` e `app/setup/page.tsx` agora aceitam apenas `sb_publishable_`. Deploys intermediários: `dpl_2vB2eVQRtA4Qm5YrhR2Uz1MaNLU2` (Production) e `dpl_4f7xJnTzyjcQu8k7TLvgzhMRRGAP` (Preview). Usuários devem fazer hard reload (`Ctrl+Shift+R`).
- **Correção dos erros `42703` nas views (12.15):** Proxy isenta as cinco views sem coluna `environment` e `app/page.tsx` usa as colunas reais de `vw_process_velocity`. Deploy atual: Production `dpl_2i4To1n9zycciTw2cuVLuB6yjwvL` (alias `https://inove-juris.vercel.app`) e Preview `dpl_HeKYexkBYyaELZR2DN46femm2YHK`. Pendência: ajustar no banco as views que não filtram `environment`, para os KPIs não misturarem `production` e `test`.
- Validação com cookie de teste fresco concluída nos dois deploys: A/B/C OK, páginas `200`, sem cookie `307`. Aplicação operando sem nenhuma chave legada.
- Pendente: concluir a rotação F1 restante (Gemini, DataJud, token do `pg_cron`, senha do pooler e token antigo da Vercel), limpar os scripts avulsos com chave fixa, monitorar o job 5 no próximo disparo e validar manualmente upload/remoção e as telas (DOCX, marketing, cartões). Rollback da F6b: `rollback_f6.sql` + `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`.

## Índice da entrega mais recente — logout ao fechar aba em qualquer dispositivo (2026-11-18)
- Solicitação do usuário: ao fechar a aba/janela, em qualquer navegador, celular, tablet ou computador, a sessão deve ser encerrada e exigir login/senha. Decisões confirmadas: **encerrar todas as sessões do usuário em todos os dispositivos** e tolerância de **90 segundos** se o aviso de fechamento não chegar.
- Parecer técnico emitido antes da alteração: eventos de fechamento não são 100% confiáveis; por isso a solução combina `sendBeacon` no fechamento com prazo curto no servidor.
- Migration aplicada em produção: `supabase/migrations/20261118170000_session_close_all_devices.sql` (`_auth_session_payload` com 90s + `app_logout_all_user_sessions`).
- Commit `119e1e1` enviado para `trabalho-com-claude`; deploy de produção `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` com alias `https://inove-juris.vercel.app` (`vercel curl /login` OK).

## Índice da entrega anterior — Camada A de permissões granulares (2026-11-18)
- Parecer técnico emitido **antes** de qualquer alteração; proposta de Camada A aprovada por citação do usuário.
- Migration aplicada em produção: `supabase/migrations/20261118160000_module_permissions.sql` (`npx supabase db query --remote=jhlxzqsgmudkbjkynqdl --yes --file ...`), com patch final da RPC e `grant select` das colunas novas já aplicados diretamente no banco.
- Commit `9dc7827` enviado para `trabalho-com-claude`; deploy de produção `dpl_8FnNJ22Za6efpojF5gNqP5vxentp` com alias `https://inove-juris.vercel.app`.
- Escopo aprovado entregue: 3 colunas com backfill, 3 slugs vinculados a Administrador/Advogado/Estagiário, RPCs, `User`, formulário de Usuários, Sidebar, `PERMISSION_MAP`, correção fail-closed, regras anti-elevação e auditoria do diff de permissões.
- Mantido para depois (Camada B): enforcement server-side em RPCs/APIs de domínio, RLS restritiva, RPCs para gestão de perfis, unificação RBAC ↔ booleanas e limpeza de arquivos obsoletos.

## Índice da entrega anterior (2026-11-18)
- Commit desta entrega: `feat(clientes): vinculos de representacao legal e filtro de ambiente em prazos` (hash atual em `git log -1`).
- Migration aplicada em produção: `20261118140000_client_legal_guardians.sql` (`client_relationships`, `v_client_guardians`, `save_client_guardians`).
- Deploys de produção desta sequência: `dpl_HEdGnjmMiKjkAKEJo2wQc4K15TQJ` (Clientes + filtro) e `dpl_9GZuKWe56Dmu8VcgKqPtXhoc73Sy` (endurecimento em `/processos/[id]`), ambos com alias `https://inove-juris.vercel.app`.
- Detalhes: ver seções **"Correção do filtro por ambiente"** e **"Representação legal de menores em Clientes"**.
- Commits anteriores desta sequência: `ed47f32` (exclusão de prazos), `aa675ff` (deploy), `ec6d462` (agendamento), `0165c37` (índice no STATUS).

## Contexto do projeto
- **Stack:** Next.js 15 + Supabase (Postgres), uso de um único escritório (não SaaS/multi-tenant).
- **Ambiente local:** `C:\InoveTecnologia\InoveJuris` (git repo, Windows/PowerShell).
- **Repositório GitHub:** https://github.com/alcantarus/InoveJuris
- **Deploy:** Vercel (conectada ao repo; branch de trabalho efetiva `trabalho-com-claude`, com push também em `main` conforme o histórico abaixo). Variáveis sensíveis/`NEXT_PUBLIC_*` devem estar configuradas na Vercel; migrations devem ser aplicadas no Supabase do ambiente alvo.

## Objetivos/temas trabalhados
- Segurança/performance e recomendações priorizadas (P0/P1/P2) — análise entregue; refactors amplos não executados.
- **Busca acento-insensível** em todo o sistema (`Débora`/`Debora`, `João`/`Joao`, `Ação`/`Acao`): normalização no front (`lib/utils.ts`) e no banco (`unaccent`/`immutable_unaccent`, RPCs/índices).
- **Contas a Receber:** ajuste preciso de data prevista/forecast (mantém `dueDate` como previsão atual, preserva original/metadados, restaurar/prorrogar).
- **Responsividade mobile/iOS:** ajustes base e de telas.
- **GPS:** alertas/contagens não devem considerar contratos inativos (cancelado/cancelada/quitado/arquivado).
- **Fluxo de Caixa → Movimentações:** edição segura da **descrição** (apenas `description`), melhorias de layout dos botões de ação e correção de scroll sobrepondo valores nas listas de distribuição (Entradas/Despesas). Edição de **valor** não implementada (exige estorno/reaplicação, atomicidade e auditoria).
- **Inconsistência de valores no módulo Clientes quando contrato está cancelado:** contrato deve permanecer no sistema com status Cancelado, mas **não** compor valores a receber/recebido/atrasado no cadastro do cliente.
- **Erro ao cancelar contrato:** `BLOQUEADO: OLD=Cancelado , NEW=Aberto. Não é possível alterar um contrato já quitado ou cancelado.` — tratado com correções de app e gatilho de banco.

## O que foi implementado (código/migrations no workspace)

### App / Frontend
- `lib/utils.ts`: `removeAccents`, `normalizeSearchText`, `matchesSearch` e utilitários.
- Busca normalizada em módulos (exemplos): `components/GlobalSearch.tsx` (env-aware via `getAppEnv()`), `app/clientes/page.tsx`, `app/clientes-v2/page.tsx`, `app/advogados/page.tsx`, `app/contas-a-receber/page.tsx`, `app/configuracoes/page.tsx`, `app/processos/page.tsx`, `app/documentos/page.tsx`.
- `app/contas-a-receber/page.tsx`: ajuste/restauração de data prevista.
- Responsividade base: `app/layout.tsx`, `app/globals.css`, `components/Modal.tsx`, `app/dashboard-layout.tsx`, `components/ModuleHeader.tsx`, `components/ui/KPICard.tsx` (entre outros ajustes no working tree).
- GPS: `components/GPSNotificationChecker.tsx`, `components/dashboard/GPSDashboardCard.tsx` excluem status inativos.
- Dashboard resiliente/logs: `components/dashboard/dynamic/ProcessVelocityCard.tsx` (`vw_process_velocity`), `CashFlowForecastCard.tsx` (`vw_cash_flow_forecast`), `AreaEfficiencyCard.tsx` (`vw_area_efficiency`).
- `app/fluxo-caixa/movimentacoes/page.tsx`: botão/modal de **editar descrição** (atualiza só `financial_transactions.description`), layout/área de toque dos botões de ação, cabeçalho/coluna “Ações”, e listas de categoria/valor com `scrollbar-gutter`/espaçamento para não sobrepor valores.
- `lib/supabase.ts`: `processContractCancellation` mais robusto (normaliza status, idempotente se já cancelado, bloqueio claro se quitado, tratamento defensivo de erro do banco).

### Banco / Migrations (arquivos no repo)
- `20261116120000_add_expected_receipt_adjustments_to_installments.sql`: campos/metadados de ajuste de previsão em parcelas.
- `20261116130000_enable_unaccent_and_update_search_all.sql`: base `unaccent`/`search_all` (usuário informou como **aplicada**).
- `20261116130500_update_get_clients_with_process_summary_unaccent.sql`: RPC de resumo de clientes acento-insensível (usuário informou como **aplicada**). Existe variante `-1.sql` no diretório (verificar duplicidade ao aplicar/versionar).
- `20261116131000_expand_search_all_coverage_unaccent.sql`: expansão de busca (pode ficar **redundante** se `31500` for aplicada; variantes `-1.sql` podem existir).
- `20261116131500_add_unaccent_search_indexes.sql`: **canônica/revisada** (`immutable_unaccent`, `search_all` expandido, `get_clients_with_process_summary` atualizado, índices condicionais/trigram quando seguro). Corrigiu erros anteriores `42P17` (IMMUTABLE) e `42703` (`processNumber`). **Pendente de confirmação de aplicação no ambiente alvo** (verificar).
- `20261116140000_exclude_cancelled_contracts_from_client_financials.sql` (**nova**): `get_clients_with_process_summary` passa a **excluir contratos `cancelado/cancelada` apenas do cálculo financeiro** (`total_receivable`, `total_received`, `total_overdue`). **Contratos NÃO são apagados**; permanecem com status cancelado.
- `20261116141000_fix_protect_contracts_status_trigger.sql` (**nova**): recria `fn_protect_contracts_status`/trigger em `contracts` para permitir transição para `Cancelado/Cancelada`, bloquear reabertura de quitado/cancelado, com comparação trim/case-insensível.

## Estado atual conhecido / pendências
- **Build local:** chegou a compilar com sucesso após correções (remoção de `page-1.tsx` legados e ajuste de import `normalizeSearchText` em `app/clientes/page.tsx`). Antes havia falhas no Vercel por commit inconsistente (`page-1.tsx` / export ausente).
- **Git/Deploy (confirmado em 2026-11-17):** branch `trabalho-com-claude` está no mesmo commit de `origin/main`/`origin/HEAD` — `8dcf005 Corrige cancelamento de contratos e totais de clientes`. `git diff --stat origin/main...HEAD` vazio (nada pendente de push). As alterações anteriores (migrations 20261116140000/20261116141000 e `lib/supabase.ts`) já estão publicadas. Pendente apenas: versionar `docs/` (atualmente `?? docs/`).
- **Banco (Supabase de produção/uso):** aplicar/confirmar migrations pendentes conforme ambiente, especialmente `20261116131500_*` (se não aplicada), `20261116140000_*` e `20261116141000_*`. Push no GitHub não aplica migrations automaticamente (salvo CI).
- **Caso Geovanna Bertunes da Rocha Brandão:** contrato **#95** (`Salário-Maternidade`, client_id 80) já consta como **`Cancelado`** no banco (`amountReceived 0`, observação de desistência). Após aplicar `20261116140000` e recarregar, não deve exibir valor a receber no módulo Clientes; o contrato deve permanecer registrado como cancelado.
- **GPS:** correção evita futuros alertas/contagens para status inativos, mas não remove notificações já criadas.
- **Dashboard:** avisos podem persistir se as views `vw_process_velocity`, `vw_cash_flow_forecast`, `vw_area_efficiency` não existirem ou não tiverem permissão.

## Verificação do ambiente em produção (sessão 2026-11-17)
- **Solicitação do usuário:** verificar a realidade do sistema em uso em `https://inove-juris.vercel.app/` e, aos poucos, aplicar correções, novas implementações e sugestões a partir de 6 prints (`02-publicacoes`, `03-prazos`, `04-calendario`, `05-processos`, `06-processo`, `07-clientes`) salvos em `C:\Users\ALCANTARUS\Desktop\ALCÂNTARA Advocacia\Desenvolvimento do InoveJuris\Telas para Sugerir\`.
- **Limitação de leitura de imagem:** este modelo não processa PNG (`this model does not support image input`), inclusive ao tentar abrir os arquivos diretamente do disco. Para seguir, o usuário precisa descrever as telas em texto, fornecer HTML/JSON ou disponibilizar login de teste (somente leitura). A pergunta com essas opções foi dispensada na conversa; o usuário pediu apenas para registrar o resumo neste arquivo.
- **Deploy confirmado:** `GET /` retorna `307 Temporary Redirect` para `/login`; a tela de login exibe "Bem-vindo ao InoveJuris / Faça login para acessar o sistema / Acesso restrito a usuários autorizados.". Resposta Vercel em `gru1`, `Server: Vercel`, HSTS ativo (`max-age=63072000; includeSubDomains; preload`). A área autenticada **não** foi inspecionada (sem credenciais; sem tentativa de burlar login).
- **Mapeamento inicial de rotas (código local = deploy):** existem `app/clientes/page.tsx`, `app/clientes/[id]/page.tsx`, `app/processos/page.tsx` (detalhe/prazos em modal), `app/relatorios/page.tsx` (Relatório de Prazos) e "Radar de Prazos" no dashboard (`app/page.tsx`). **Não existem rotas dedicadas** `/publicacoes`, `/prazos` ou `/calendario` — prováveis novas implementações.
- **Migrations — duplicidades extras:** além das variantes `-1` já citadas, existem pares com hash idêntico (`-1`/`-2`) em `20260318000000_create_backup_tables`, `20260318000001_update_backup_settings`, `20260320000000_create_tasks_tables`, `20260320000001_add_set_app_environment_rpc`, `20260325000000_add_original_due_date_to_installments`, `20260618120000_create_cashflow_summary_views`, `20260618130000_create_cashflow_chart_functions`, `20260618140000_create_projection_function`. As versões sem sufixo divergem das `-1`/`-2` (aparentam ser as revisadas). **Não há confirmação de quais estão aplicadas no Supabase de produção** — pendente: montar SQL de checagem (schema_migrations / colunas / funções).
- **Ferramentas locais:** `tesseract` não está instalado, então OCR dos prints não foi possível por aqui.

## Plano para as próximas sessões (trabalho incremental)
1. Usuário fornece o conteúdo dos prints em texto (nome da tela, elementos, o que manter/alterar e prioridade) — ou login de teste/HTML/JSON das telas.
2. Gerar mapa **tela sugerida × tela atual × gaps**, com priorização P0/P1/P2, antes de editar arquivos.
3. Implementar **um item por vez**, executar `npm run build`, commit pequeno e validação do usuário no Vercel.
4. Atualizar este `STATUS-INOVEJURIS.md` (e versioná-lo) a cada entrega.

## Análise comparativa com as 12 telas-sugestão (sessão 2026-11-17)
- As 12 imagens em `Telas para Sugerir/` **não** são legíveis diretamente por este modelo; o texto foi extraído por OCR do Windows (`Windows.Media.Ocr`, pt-BR) — alguns rótulos podem estar degradados e precisam de confirmação antes de codar.
- Deploy inspecionado **com sessão autenticada já existente no navegador**: dashboard real carregou dados de produção. Achados P0 confirmados:
  1. `vw_process_velocity`, `vw_cash_flow_forecast`, `vw_area_efficiency` retornam **HTTP 400** no Supabase (views ausentes/sem coluna `environment`), com warnings no console.
  2. Link do Radar de Prazos (`app/page.tsx:1110`) aponta para `/processos/<id>` → **404**.
  3. `/publicacoes`, `/prazos`, `/calendario` e `/processos/<id>` → **404 confirmado**.
  4. Sidebar exibe Auditoria/Usuários/Configurações para perfil "Usuário"; `/setup`, `/notificacoes`, `/doencas`, `/clientes-v2` fora do `PERMISSION_MAP`.
  5. Recharts com `width(-1)/height(-1)`; dashboard com vários cards "Sem dados disponíveis"/"R$ 0,00".
- **Não há nenhuma implementação de dias úteis/feriados/recesso forense** no repo (busca por `recesso|feriado|businessDay` sem resultados) — é a base conceitual das telas 03/04/06.
- Plano completo (mapa 12 telas × atual × gap, priorização e fases 0-6 com rollout gradual): **`docs/PLANO-MELHORIAS-INOVEJURIS.md`**. Nenhum código foi alterado nesta análise.

## Entrega — telas novas `/prazos` e `/calendario` (2026-11-17)
- Decisão do usuário: **começar pelas telas novas**, sem fase prévia de estabilização. Manter `docs/` versionado.
- Arquivos novos: `lib/deadlines.ts` (camada compartilhada de dados: join `process_deadlines` + `processes` + `contracts` + `clients` + `lawyers`, buckets Vencidos/Hoje/7/30/Em aberto/Concluídos), `app/prazos/page.tsx` (KPIs, filtros, busca acento-insensível, CSV, modal "Novo prazo"), `app/calendario/page.tsx` (grade mensal com `date-fns`, vencidos destacados, lista do dia selecionado).
- Ajustes mínimos: `components/Sidebar.tsx` (itens Prazos e Calendário em "Operacional"), `app/dashboard-layout.tsx` (`PERMISSION_MAP` → `canAccessProcesses`).
- `npm run build`: **OK** (20 páginas; novas rotas listadas). Rotas locais redirecionam para `/login` sem erro de runtime (esperado sem sessão local).
- Versionada e publicada junto com a correção DataJud abaixo.

## Correção DataJud (2026-11-17)
- Diagnóstico confirmado no ar: botão "Sinc" chamava a Edge Function `datajud-sync` (código ausente no repo) e falhava na Apify com `user-or-token-not-found`; `process_sync_status` não tem coluna `environment` (`42703`); `/api/datajud-proxy` apenas fazia fetch e não gravava; `/api/process-consultation` usava chave hardcoded e retornou `429`.
- Implementado: `lib/datajud.ts` (consulta única, sem chave fixa, erros 429/401/400 explicados), `app/api/process-sync/route.ts` (consulta + persistência de `processes.history`, `last_update` como timestamp e da tabela `process_sync_log`).
- `app/processos/page.tsx`: "Sinc" agora chama `/api/process-sync`; removidos os 5 andamentos falsos e o `last_update: 'Agora'`.
- `components/SyncDashboard.tsx`: usa a nova rota, lê `process_sync_log` e exibe erro de carregamento.
- Removidas: `/api/datajud-proxy` e as duplicatas `route-1.ts`.
- Migration `supabase/migrations/20261117150000_fix_datajud_sync.sql`: **corrigida** — `process_sync_status` é uma VIEW (não aceita `ALTER TABLE ADD COLUMN`, erro `42809`), então a migration cria a tabela `process_sync_log` para gravar o status real e corrige registros com `last_update = 'Agora'`.
- `npm run build`: **OK** (rota `/api/process-sync` listada).
- **Publicado em produção:** push em `main` (`cf1f97a`) com deploy automático confirmado. `/prazos` e `/calendario` respondem HTTP 200; `/api/process-sync` responde `500 - DATAJUD_API_KEY não configurada no servidor` (fail-fast esperado).
- **Configuração concluída (2026-11-17):** `DATAJUD_API_KEY` adicionada no Vercel via CLI (ambiente Production) e deploy de produção executado (`dpl_93Fb8dU3TioJUTcBUnKrjVYcwaLV`). Antes disso, o projeto só tinha `DATAJUD_API_TOKEN`/`SCRAPER_API_KEY`, da integração antiga — daí o fail-fast. `SUPABASE_SERVICE_ROLE_KEY` não está configurada; a rota usa anon key + RPC `set_app_environment`.
- **Banco concluído:** migration corrigida aplicada no Supabase; `process_sync_log` existe e responde 200 via REST.
- **Validação final:** `/api/process-consultation` com CNJ real retornou `429 - O DataJud limitou a consulta`; `/api/process-sync` gravou em `process_sync_log` um registro `sync_status=Erro` com `error_message` e `last_sync`. Ou seja, consulta, tratamento de erro e persistência estão funcionando.
- **Único impedimento restante:** a chave disponível é a compartilhada, já limitada pelo CNJ (429 / "processo não encontrado" inconsistente). Para acompanhar andamentos de verdade é necessário obter uma chave de API própria do DataJud e atualizar `DATAJUD_API_KEY` no Vercel.
- **Ainda não implementado (naquele momento):** cálculo de dias úteis com feriados/recesso, baixa justificada de vencidos, Publicações/Triagem (entregues em 2026-11-18, ver abaixo), agendamento automático de sincronização e os achados P0 anteriores.

## Entrega — Módulo de Processos unificado (2026-11-17)
- Decisão do usuário: **foco apenas no módulo de Processos**; remover o Kanban (que não agradou) e unir o que já funciona no InoveJuris com os modelos `05-processos.md` (carteira/lista) e `06-processo.md` (detalhe). Kanban de **tarefas** do dashboard (`TaskKanban`, `TodayFocusWidget`) permanece — é outro módulo.
- **Kanban de Processos removido:** exclusão de `components/KanbanBoard.tsx`; remoção do import, do estado `viewMode`, dos botões Lista/Kanban e da renderização condicional em `app/processos/page.tsx`.
- **Lista (`/processos`):** mantidos cadastro/edição (judicial e previdenciário), consulta DataJud, exclusão, Sinc e privacy. Novo padrão é a **tabela** (`components/processos/ProcessTable.tsx`) com colunas Cliente/CNJ, Área/Vara, Responsável, Próximo prazo, Valor da causa, Situação, Ações (Abrir/Sinc/Editar/Excluir). A visão em **cards** (`BentoProcessGrid`) foi preservada e enriquecida; o seletor agora é **Lista / Cards** (sem Kanban). Em 24/11, por decisão do usuário, `SyncDashboard` foi removido da lista; o status do DataJud passou a ser exibido no detalhe do processo dentro da timeline unificada.
- Busca ampliada para cliente, CNJ, vara e parte adversa; filtros dinâmicos por área, situação e responsável; contadores de vencidos/prazo em 7 dias agora usam cálculo real (o antigo `getNearestDeadlineStatus` era um stub que sempre retornava `Normal`).
- `components/processos/StrategicCockpit.tsx`: KPIs do modelo 05 (Ativos, Com prazo em 7 dias, Segredo de justiça, Valor da carteira) + linha secundária preservando matriz de risco e radar de urgência.
- **Detalhe (`/processos/[id]`) novo:** breadcrumb, dados do processo (área/fase, vara/comarca, tribunal, valor, distribuição, última movimentação, responsável, fonte), segredo de justiça, anotações editáveis, próximo prazo com timeline (DJEN → Publicação → Contagem → Vencimento), confirmação expressa do advogado, lista de prazos, partes e andamentos reais do DataJud.
- Helpers compartilhados em `lib/processes.ts` (`getNextDeadline`, `daysUntilDate`, `getResponsibleName`, `normalizeParties`, `isActiveProcess`).
- **Migration nova:** `supabase/migrations/20261117180000_enhance_processes_detail.sql` — campos em `processes` (`phase`, `comarca`, `tribunal`, `distribution_date`, `source`, `parties`, `secret_justice`) e em `process_deadlines` (`notification_date`, `publication_date`, `count_start_date`, `business_days`, `calculation_memory`, `responsible_id`, `confirmed_at`, `confirmed_by`, `justification`). Idempotente. **Aplicada no Supabase em 2026-11-17** (confirmado por consulta REST às colunas `phase`, `secret_justice`, `confirmed_at`, `business_days`, `calculation_memory` e `notification_date`).
- `npm run build`: **OK** (21 rotas, incluindo `/processos/[id]`). Validação local (porta 3001): `/processos` com Lista/Cards, KPIs e sem Kanban; `/processos/38` com dados, anotações, prazos, partes e andamentos.
- **Publicado (2026-11-17):** commit `72a21de` em `trabalho-com-claude` (push feito) e deploy de produção `dpl_3qyvx9iwnEhDoXeFXrtm1tcHz6Zh` em https://inove-juris.vercel.app. A migration `20261117180000_enhance_processes_detail.sql` foi **aplicada no Supabase** (confirmação em 2026-11-17), habilitando anotações, confirmação de prazos e timeline completa.

## Entrega — Calendário dinâmico (2026-11-17)
- Referência: `04-calendario.md` (controle de prazos com KPIs, Listar/Calendário, prazos vencidos em destaque, grade mensal e exportação).
- `/calendario` reescrito com alternância **Calendário / Listar** na própria página, KPIs **Hoje / Vencidos / 7 dias / Neste mês**, banner de vencidos com atalho para a lista, navegação mensal (anterior/próximo/Hoje), contagem de prazos no mês e **Exportar CSV** da seleção visível.
- Grade mensal dinâmica em `components/calendario/CalendarGrid.tsx`: semana começa no **domingo** (DOM…SÁB, como o modelo), fins de semana com destaque, dia atual marcado, até 3 prazos por dia com cores por bucket (vencido/hoje/7 dias/30 dias/aberto/concluído), indicador de vencido e contador de excedentes.
- Lista em `components/calendario/DeadlineListView.tsx`: busca por prazo/cliente/CNJ/responsável/área, filtro por situação, filtro opcional por data (via "Ver na lista" no painel do dia) e link **Abrir** para o detalhe do processo.
- Painéis inferiores: prazos do dia selecionado (com dias úteis, confirmação do advogado e memória de cálculo quando disponíveis), próximos prazos do mês (clicáveis) e vencidos pendentes de baixa.
- `lib/deadlines.ts`: `DeadlineItem` ganha campos opcionais da migration anterior (`businessDays`, `calculationMemory`, `confirmedAt`, datas de DJEN/publicação/contagem); responsável do prazo passa a preferir `responsible_id` quando existir. Extração compartilhada `exportDeadlinesCsv` usada por `/calendario` e `/prazos`.
- `npm run build`: **OK**. Validação local (porta 3002): KPIs, alternância Listar/Calendário, grade DOM–SÁB, navegação de mês, filtro de vencidos e tabela renderizando corretamente.
- **Ainda não implementado:** cálculo determinístico de dias úteis com feriados nacionais/recessos forenses (o modelo cita, mas a base ainda não tem essa rotina). A migration de prazos já está aplicada; os campos de dias úteis/memória/confirmação aparecem quando preenchidos.
- **Publicado (2026-11-17):** commit `c758490` em `trabalho-com-claude` (push feito) e deploy `dpl_3mU8rYmJZ4ethrY57zsaCSLT543e` em https://inove-juris.vercel.app.

## Entrega — Módulo de Publicações (2026-11-18)
- Referência: `02-publicacoes.md`. Nomenclatura padronizada como **Publicações** em UI, menu, rotas, código e documentação (sem usar o termo anterior como nome de módulo).
- **Regra preservada:** nenhum prazo é criado automaticamente pela importação. A fila apenas recebe as publicações; a criação de prazo exige leitura, classificação e **confirmação expressa** do advogado responsável (campo de justificativa obrigatório).
- Rota `/publicacoes` com KPIs **A triar / Triadas / Ignoradas / Todas** e abas **A triar / Triadas / Ignoradas / Todas** (a aba Triadas é a melhoria acrescentada ao modelo). Colunas da tabela: CNJ, Tribunal, Data, Processo, Advogado e Situação; busca por CNJ/parte/tribunal/texto e filtros por tribunal e origem; exportação CSV da visão filtrada.
- Detalhe da publicação (`components/publicacoes/PublicationDetail.tsx`): **Disponibilidade / Câmara / Página / Importância**, botão **Ler o texto** (teor em texto puro, sem HTML) e link para o inteiro teor no tribunal. Ações: **Criar prazo**, **Classificar sem prazo**, **Ignorar** (com motivo) e **Reabrir para triagem**.
- **Criação de prazo:** grava em `process_deadlines` com `notification_date`, `publication_date`, `count_start_date`, `business_days`, `calculation_memory`, `responsible_id`, `confirmed_at`, `confirmed_by` e `justification`; só depois marca a publicação como `Triada` e grava `deadline_id`. A data sugerida considera apenas fins de semana (sem feriados/recessos) e aparece explicitamente como sugestão revisável.
- **Integração real com o DJEN:** `lib/djen.ts` consulta `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao` (API pública, sem token), com filtros de período, tribunal, processo, OAB, advogado e parte; paginação de 100 itens (limite aceito pela API), teto de segurança de páginas e tratamento de `429` com orientação de esperar ~1 minuto. O teor HTML é convertido em texto e os destinatários/advogados são normalizados.
- `POST /api/djen-sync`: valida filtros, busca no DJEN, vincula publicações a processos pelo CNJ (20 dígitos), insere novas e **atualiza as existentes sem sobrescrever decisão, responsável, leitura ou prazo**, e registra tudo em `publication_sync_log`.
- Cadastro manual na fila (`Nova publicação`) para **Comunica PJe / E-mail / DJEN**, permitindo a fila única prevista no modelo.
- Migration `supabase/migrations/20261118120000_create_publications.sql`: tabelas `publications` e `publication_sync_log`, índices, RLS, grants e comentários. Idempotente. **Aplicada no Supabase em 2026-11-18** via `supabase db query --remote`; tabelas confirmadas por REST (HTTP 200).
- Permissão: `'/publicacoes': 'canAccessProcesses'` em `app/dashboard-layout.tsx`; item **Publicações** no grupo Operacional da sidebar.
- `npm run build`: **OK** (`/publicacoes` e `/api/djen-sync` listados; 21 páginas estáticas geradas).
- **Validação com dados reais (2026-11-17/18):** duas sincronizações DJEN com 100 comunicações cada, ambas `Sincronizado`; a segunda confirmou idempotência (`inserted=0`, `updated=100`) e preservou `status='A triar'`. A correção de entidades HTML case-sensitive gravou corretamente `DESPACHO/DECISÃO` no teor.
- **UI validada em navegador:** `/publicacoes` com 100 registros, KPIs **100 / 0 / 0 / 100**, abas, filtros, busca, colunas CNJ/Tribunal/Data/Processo/Advogado/Situação e detalhe com **Ler o texto** exibindo o teor completo. Nenhum prazo foi criado na validação (`process_deadlines` sem registros para a data consultada). Uma decisão de teste (`Ignorada` / “Teste”) registrada durante a sessão foi revertida para `A triar`.
- Commit `fdc2376` enviado para `trabalho-com-claude` em 2026-11-17 (complemento documental `d61cde3`). **Deploy de produção concluído:** `dpl_4uLoPWGo2mpGXKjb31Vbp5F15N6P`, alias `https://inove-juris.vercel.app`; rota `/publicacoes` respondeu **HTTP 200** em produção. O token antigo da Vercel deve ser revogado definitivamente.

## Readequação — captura DJEN somente pelos advogados cadastrados (2026-11-17)
- Parecer técnico favorável emitido **antes** da implementação, conforme solicitado: confirmado que `numeroOab` é o filtro efetivo e `ufOab` é complemento obrigatório no envio; `ufOab` sozinho retorna **422**, e múltiplos OABs na mesma requisição não são combinados de forma confiável.
- Swagger oficial consultado: buscas por OAB limitadas a **10.000 resultados**; pelo menos um filtro é obrigatório; rate limit de **20 requisições** por janela, com cabeçalhos `x-ratelimit-*` e orientação de aguardar ~1 minuto após `429`.
- Migration `supabase/migrations/20261118130000_add_lawyer_oab_uf.sql` aplicada no Supabase: coluna `lawyers.uf_oab`, normalização de `oab_number` para somente dígitos, checks `^[0-9]{1,10}$` e `^[A-Z]{2}$`, e Unique `(oab_number, uf_oab, environment)` no lugar das duas constraints antigas duplicadas. `publication_sync_log` ganhou `lawyer_oabs` para rastreabilidade.
- Backfill aplicado aos registros reais: `84503BA → 84503 / BA` (produção e teste) e `12542BA → 12542 / BA` (teste).
- `app/advogados/page.tsx` refatorada: **UF da OAB** e **Número da OAB** agora são campos separados e obrigatórios; validação, busca e duplicidade consideram `(número, UF, ambiente)`. O cartão exibe `OAB/UF`.
- `components/publicacoes/SyncModal.tsx` refatorado: seleção dos **advogados cadastrados no ambiente**, com OAB/UF vinda do cadastro. Os campos manuais de OAB/UF e o tribunal padrão `TJSP` foram removidos; tribunal e processo são refinamentos opcionais.
- `POST /api/djen-sync` refatorado: exige `lawyerIds`, carrega somente advogados válidos do ambiente e executa **uma consulta por advogado** com `numeroOab` + `ufOab`. Inclui deduplicação por `external_id`, pausa curta entre advogados, retentativa limitada em `429`, registro de falhas por advogado e `lawyer_oabs` no log. Reimportações continuam sem sobrescrever decisão, leitura, responsável ou prazo.
- Testes empiricamente repetidos com os OABs cadastrados no período `2026-11-01` a `2026-11-17`: `84503/BA → count 2` e `12542/BA → count 0`, ambos HTTP 200. Nenhuma captura ampla é mais necessária.
- **Limpeza controlada:** os 100 registros DJEN da validação ampla anterior foram removidos porque estavam todos `A triar`, sem leitura, decisão, justificativa, responsável ou prazo. A fila de Publicações ficou com **0 registros**; nenhum prazo foi criado.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas; `/publicacoes` e `/api/djen-sync` listados).
- Commit `5a0106f` enviado para `trabalho-com-claude`. **Deploy de produção concluído:** `dpl_8CVKdyv4RojDCJQsCim6gXQt5VTx`, alias `https://inove-juris.vercel.app`. `vercel curl` em `/publicacoes` e `/advogados` retornou o redirecionamento esperado para `/login` (sem cookie de sessão no CLI). O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Diagnóstico e correção — fila vazia apesar de existirem publicações (2026-11-17)
- Sintoma: `/publicacoes` vazia para `84503/BA`. O checkbox e o rótulo `Advogado #1 - 84503/BA` **não** bloqueavam a captura: o `publication_sync_log` registrava `Erro` com **HTTP 403** do CloudFront do DJEN (`ERROR: The request could not be satisfied`).
- Parâmetros confirmados corretos: `numeroOab=84503`, `ufOab=BA`, período, `pagina` e `itensPorPagina`. O endpoint da Swagger é **GET** (`get_api_v1_comunicacao`); enviar o mesmo corpo por **POST** retorna **401 Unauthenticated** (a escrita é exclusiva dos tribunais). Com GET: `2026-11-10..2026-11-17 → count 2` e `2026-01-16..2026-11-17 → count 56`.
- Causa raiz: bloqueio por IP/egress. O DJEN responde 200 à máquina local, mas 403 à Vercel. A Edge Function `djen-proxy` funciona em `sa-east-1`, porém é alocada em `us-east-1` quando invocada pela Vercel — região também bloqueada.
- Correção: migration `supabase/migrations/20261117173000_djen_fetch_rpc.sql` criou a RPC `public.djen_fetch`, que consulta o DJEN pelo egress **sa-east-1 do Postgres** (extensão síncrona `http`), com host/caminho fixos e somente leitura. `lib/djen.ts` passou a chamar essa RPC pelo REST do Supabase com a chave anônima; a Edge Function permanece apenas como contingência (`DJEN_PROXY_URL`). `tsconfig.json` exclui `supabase/functions` (runtime Deno).
- Apresentação: sem `Advogado #1` — o rótulo é `84503/BA`; com um único advogado válido, a tela mostra `Advogado considerado` + selo `Selecionado` e **nenhum checkbox**. O modal envia `environment` para alinhar cliente e servidor.
- **Validação em produção:** período curto → `inserted: 2`, `failedLawyers: []`; período informado pelo usuário (`2026-01-16..2026-11-17`) → `fetched: 56`, `inserted: 54`, `updated: 2`, `matchedProcesses: 33`, sem falhas. Fila com **56 publicações**, todas `A triar`, **0 prazos**, **0 decisões**.
- `npx tsc --noEmit` e `npm run build`: **OK**. Deploy final: `dpl_GtArPaEhj25bAupCTgLtc6WDTS8X` (`https://inove-juris.vercel.app`). O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Prazos editáveis e sincronia Processos ↔ Prazos ↔ Calendário (2026-11-17)
- Migration `supabase/migrations/20261117190000_editable_deadlines.sql` aplicada em produção: colunas `created_by`/`updated_by` em `process_deadlines`, tabela `process_deadline_history`, índices, RPCs transacionais `create_process_deadline`, `update_process_deadline`, `confirm_process_deadline` e `delete_process_deadline`, e inclusão de `process_deadlines` na publicação Realtime do Supabase.
- **Fonte única da verdade:** a tabela `process_deadlines`. Processos (carteira e detalhe), Prazos e Calendário não guardam cópias locais persistentes; todos recarregam a partir dela e assinam `postgres_changes` para refletir alterações em abas abertas.
- Edição disponível em `/prazos` (ação na linha), `/processos/[id]` (botões “Editar” no próximo prazo e na lista) e `/calendario` (data selecionada e lista). O mesmo modal altera data/hora, descrição, situação e responsável.
- Reagendar exige **justificativa**; a RPC reabre a confirmação (`confirmed_at`/`confirmed_by` zerados, situação volta a `Pendente`) e grava `old_data`, `new_data`, `changed_fields`, motivo, origem e usuário no histórico. A data antiga deixa de ser considerada em qualquer módulo.
- A edição de processos deixou de fazer `DELETE` + `INSERT` de todos os prazos: agora atualiza/insere/exclui apenas o que mudou, preservando `id`, vínculo com `publications.deadline_id`, memória de cálculo e auditoria.
- `getNextDeadline()` e os buckets de Prazos/Calendário usam a mesma regra de situações encerradas; `Confirmado` continua significando ciência do advogado, não baixa do prazo.
- RPCs testadas em produção no ambiente `test`: criar → reagendar sem justificativa (rejeitado com 400) → reagendar com justificativa (confirmação reaberta) → confirmar → excluir; 4 registros no histórico. `npx tsc --noEmit` e `npm run build`: **OK**.
- Commit `598b83e` enviado para `trabalho-com-claude`. Deploy: `dpl_DTQcjAWySHvG9vjU9SWzcXhnp4gU` (`https://inove-juris.vercel.app`). Rotas `/prazos`, `/processos`, `/processos/[id]`, `/calendario` e `/publicacoes` responderam **200** em produção. O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Reorganização da dashboard e aviso de aniversariantes (2026-11-17)
- Ordem dos cards em `app/page.tsx` revisada para priorizar decisões imediatas: **Radar de Prazos → ações críticas (Foco de Hoje, liquidez, gargalos, risco de inadimplência) → Fluxo de Compromissos → Gargalos INSS/Justiça → Parcelas em Atraso e Recebimentos Futuros → Meta Mensal/KPIs/Parecer Virtual → Pipeline de Receita → Risco de Abandono → gráficos analíticos**.
- O card **Aniversariantes de Hoje** (`BirthdayWidget`) saiu do topo e foi para o final da página, logo antes de **Atividades Recentes**. Nenhum card foi removido; apenas reordenado.
- O antigo badge flutuante `Aniversariantes Hoje!` (`fixed top-40 md:top-24 right-4 md:right-6 z-40`, com `animate-bounce`/`animate-pulse`) foi substituído por um **chip inline discreto** no cabeçalho da dashboard, ao lado dos filtros e antes de **Gerar Insights**.
- `BirthdayChecker` passou a viver no fluxo do documento (`app/page.tsx`) em vez de ser global no `DashboardLayout`; por isso não há mais `position: fixed`, `z-index` ou sobreposição com o botão **Gerar Insights** em nenhum breakpoint. O confeti automático ao abrir foi removido (o botão manual “Celebrar!” do modal permanece).
- O mesmo ajuste foi aplicado ao layout legado `app/dashboard-layout-1.tsx` para evitar duplicidade caso ele volte a ser usado.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas).
- Commit `e73767f` enviado para `trabalho-com-claude`. **Deploy de produção concluído:** `dpl_HHaT9kq8RNCLqQkMJkhTSmteJKk9`, alias `https://inove-juris.vercel.app`. `vercel curl` em `/`, `/prazos` e `/publicacoes` retornou **307** com `Location: /login` (redirecionamento esperado sem cookie de sessão). O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Responsividade: tabelas viram cards no celular (2026-11-17)
- **Problema:** em `/contas-a-receber` os registros só apareciam com rolagem horizontal (`overflow-x-auto` + `min-w-[800px]`), enquanto `/clientes` e `/contratos` já exibiam cards empilhados no celular.
- Padrão adotado em todos os módulos convertidos: tabela desktop mantida intacta e marcada como `hidden md:table` (ou `hidden md:block` no wrapper de scroll); lista `md:hidden divide-y divide-slate-100` com cards `p-4 space-y-3`, campos rotulados, `break-words`/`break-all`, `min-w-0` e alvos de toque de no mínimo 40 px. As duas visões consomem a mesma lista filtrada/ordenada e os mesmos helpers de status, cor, privacidade e ações.
- **Contas a Receber** (`app/contas-a-receber/page.tsx`): cards para a carteira de contratos e para as parcelas do contrato. Mantidos busca, filtros (Todos/Abertos/Quitados/Atrasados/Vence Hoje), ordenação, olhos de privacidade, barra de progresso, seleção em lote, ações de Receber/Ajustar/Prorrogar/Estornar e os estados de carregamento/vazio.
- Convertidos também: **Prazos** e a lista do **Calendário**; **Processos** (`ProcessTable`) e **Publicações** (`PublicationTable`, com “Ler e triar”); **Leads** (inclui funil, próxima ação, detalhes expansíveis e ações rápidas); **Indicadores** (lista, Comissões e Links Gerados, inclusive dentro dos modais); **Fluxo de Caixa** (page e Movimentações); **Produtos**, **Doenças**, **Relatórios** (7 tipos via renderizador único), **Auditoria** (`AuditAccessLogs`), **Extrato de Recebimentos**, **Configurações** (Auditoria, Matriz de Notificações, Integridade do banco) e **SyncDashboard**.
- Nenhuma funcionalidade desktop foi removida; nenhuma dependência nova foi adicionada. Em Relatórios, o filtro de divergência GPS passou a ser aplicado de forma consistente às linhas e ao estado vazio.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas). Validação em navegador com as visões mobile forçadas: Contas a Receber (106 contratos + parcelas), Prazos, Leads e Relatórios renderizaram cards com `scrollWidth == clientWidth` (sem rolagem horizontal).
- Commit `f5c39d8` enviado para `trabalho-com-claude`. **Deploy de produção concluído:** `dpl_GPe7mkhhfq9NqryVihnhM9BY3bAT`, alias `https://inove-juris.vercel.app`. `vercel curl` em `/contas-a-receber`, `/prazos` e `/relatorios` retornou **307** para `/login` (esperado sem sessão). O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Consolidação integral da sessão — checkpoint 2026-11-17
Esta seção reúne as decisões, identificadores, detalhes de implementação e incidentes da sessão para garantir continuidade completa.

### Regras de negócio e decisões consolidadas
- Nome obrigatório **Publicações**, nunca "Intimações", em UI, menu, documentação e identificadores user-facing.
- DJEN **não cria prazos automaticamente**: captura → leitura → classificação → **confirmação expressa** do advogado responsável (com justificativa obrigatório) antes de gravar em `process_deadlines`.
- Captura DJEN somente pelos **advogados cadastrados**, usando `numeroOab` + `ufOab`, com **uma consulta por advogado**. `numeroOab` é o filtro efetivo; `ufOab` é complemento obrigatório.
- Endpoint correto: **GET** `https://comunicaapi.pje.jus.br/api/v1/comunicacao` (POST retorna `401 Unauthenticated`). Consulta em produção via RPC `public.djen_fetch` pelo REST do Supabase (egress `sa-east-1`); a Edge Function `djen-proxy` ficou apenas como contingência (`DJEN_PROXY_URL`).
- `process_deadlines` é a **fonte única da verdade** para Processos, Prazos e Calendário. Alterações passam pelas RPCs transacionais `create_process_deadline`, `update_process_deadline`, `confirm_process_deadline` e `delete_process_deadline`.
- Reagendar exige **justificativa**; alterar a data reabre a confirmação (`confirmed_at`/`confirmed_by` zerados, situação volta a `Pendente`) e registra `old_data`, `new_data`, `changed_fields`, motivo, origem e usuário em `process_deadline_history`.
- `Confirmado` significa ciência do advogado, **não** baixa do prazo; situações concluídas/canceladas não aparecem em “Próximo prazo”.
- Dashboard reorganizada: Radar de Prazos e ações críticas em destaque; balão de aniversariantes substituído por chip inline discreto no header, sem sobrepor “Gerar Insights”.
- No celular, os registros devem aparecer como **cards empilhados** (padrão Clientes/Contratos), sem rolagem horizontal.

### Ambiente e identificadores
- Vercel: projeto `inove-juris`, produção `https://inove-juris.vercel.app`; CLI autenticada como `alcantarus`.
- Supabase: ref `jhlxzqsgmudkbjkynqdl`.
- Git: branch `trabalho-com-claude`; último commit `afa61a4`; working tree limpa ao final da sessão.
- Advogado de produção: `id=1`, `oab_number='84503'`, `uf_oab='BA'`, `name=null`.
- Comandos usuais: `npx tsc --noEmit`, `npm run build`, `npx vercel --prod --yes`, `npx vercel curl <url>`.
- **PowerShell não aceita `&&` neste ambiente** — usar `;`.
- O token antigo da Vercel continua considerado comprometido e deve ser revogado definitivamente.

### Detalhes da responsividade mobile (por arquivo)
- `app/contas-a-receber/page.tsx`: helpers extraídos `getContractRowStatus`, `filteredContracts` (`useMemo`), `getInstallmentFlags` e `openContract`; tabela desktop oculta com `hidden md:block overflow-x-auto`; cards da carteira (106 contratos validados) e das parcelas, com Receber / Ajustar previsão / Prorrogar / Estornar em `min-h-[40px]`.
- `app/prazos/page.tsx`: `Loader2`, `PriorityBadge`, `StatusBadge`, `DeadlineActions` (variante mobile) e `MobileField`; cards alimentados pela mesma lista filtrada da tabela.
- `components/calendario/DeadlineListView.tsx`: `daysLabel`, `daysClass`, `StatusBadge`, `DeadlineActions` e `MobileField`; sete colunas convertidas em campos rotulados.
- `components/processos/ProcessTable.tsx`: `getRowData`, `StatusBadge`, `DeadlineInfo`, `ResponsibleInfo` e `MobileField`; ações Abrir/Sinc/Editar/Excluir em grid de duas colunas. O seletor Lista/Cards da página permanece intacto.
- `components/publicacoes/PublicationTable.tsx`: `StatusBadge`, `SourceBadge`, `DeadlineRef` e `MobileField`; card inteiro clicável e CTA “Ler e triar”. As ações de triagem continuam em `PublicationDetail`.
- `app/leads/page.tsx`: `FUNNEL_STAGES`/`getFunnelIndex`, `getNextActionInfo`, `getLeadRowTone`, `MobileField`, `FunnelStage`, `WhatsappTemplatesMenu`, `AgendaMenu` e `LeadExpandedDetails`. Os popovers de ação rápida ficam no nível do card (`absolute left-4 right-4 top-16`) para não serem cortados pelo `overflow-hidden`.
- `app/indicadores/page.tsx`: `MobileField`, `getCommissionRowState` e `getTokenStatus`; cards na lista principal, em Comissões e em Links Gerados (inclusive dentro dos modais).
- `app/fluxo-caixa/page.tsx` e `app/fluxo-caixa/movimentacoes/page.tsx`: `CardField`, `TransactionTypeIcon` e `TransactionActions` (alvos de 40 px). As tabelas pequenas de Distribuição de Entradas/Despesas foram mantidas porque não estouram a largura no celular.
- `app/produtos/page.tsx` e `app/doencas/page.tsx`: `CardField`, `getProductAreaName`, `ProductActions`, `getAccessoryCids` e `DiseaseActions`; descrições longas de CID quebram linha.
- `app/relatorios/page.tsx`: `ReportCardField`, `getReportRows`, `getReportColumns` e `reportRows` — um único renderizador para os 7 tipos de relatório. Ajuste visual: `p-4` removido dos `cellClassName` (42 linhas) e aplicado no `<td>` via `cn("p-4", column.cellClassName)`, evitando padding duplicado nos cards. O filtro de divergência GPS passou a ser aplicado de forma consistente às linhas e ao estado vazio.
- `components/AuditAccessLogs.tsx`, `components/contas-a-receber/ContractStatementModal.tsx`, `components/settings/AuditLogsTab.tsx`, `components/settings/IntegrationsApiTab.tsx`, `components/settings/SystemTab.tsx` e `components/SyncDashboard.tsx`: cards para sessões/tentativas falhas, extrato de recebimentos, auditoria, matriz de notificações, integridade do banco e status DataJUD. Em `SystemTab`, `orphanResults = integrityCheckResults?.filter(...) ?? []` corrigiu `TS18047: 'integrityCheckResults' is possibly 'null'`.
- Os checkboxes da Matriz de Notificações continuam **não controlados** (comportamento original), portanto os estados desktop e mobile são independentes.

### Sequência final: validação, commit e deploy
1. `npx tsc --noEmit` acusou `TS18047` em `components/settings/SystemTab.tsx:897`; corrigido com optional chaining → **OK**.
2. `npm run build`: **OK** (21 páginas).
3. Validação em navegador com visões mobile forçadas por CSS injetado: `/contas-a-receber` (106 contratos; clique em “Ver Parcelas” abriu o card da parcela), `/prazos`, `/leads` (estado vazio também em card) e `/relatorios` — todos com `scrollWidth == clientWidth`, sem rolagem horizontal.
4. Commit `f5c39d8` (`feat(mobile): cards responsivos substituem tabelas com scroll horizontal`) e commit `afa61a4` (`docs: registra deploy dos cards responsivos`), ambos enviados para `trabalho-com-claude`.
5. Deploy `npx vercel --prod --yes` → `dpl_GPe7mkhhfq9NqryVihnhM9BY3bAT` → `https://inove-juris.vercel.app`. `vercel curl` em `/contas-a-receber`, `/prazos` e `/relatorios` retornou **307** para `/login` (esperado sem sessão no CLI).
6. `tsconfig.tsbuildinfo` foi restaurado com `git checkout --` (artefato local não versionado). O servidor `npm run dev` na porta 3000 foi encerrado ao final.

### Interrupção e retomada (registro do incidente)
- Uma rotina de validação no navegador que navegava por 12 rotas em sequência foi **abortada por limite de execução da ferramenta**. Isso **não travou o sistema** e não afetou arquivos, build ou deploy.
- A retomada foi feita com navegações curtas e medições pontuais. A aba antiga foi descartada (`browser.tab_unavailable`) e uma nova foi aberta. O log final do `npm run dev` confirmou `GET /contas-a-receber`, `/prazos`, `/leads` e `/relatorios` com `200`.

### Observações finais / pendências leves
- Durante a validação local apareceu no log: `SQL Error: { code: '42501', message: 'must be owner of table leads' }` em `GET /api/fix-db`. Não bloqueou rotas nem a entrega; investigar se esse endpoint voltar a ser usado.
- As imagens anexadas pelo usuário (`clientes.jpeg`, `contratos.jpeg`) não foram interpretadas visualmente por este modelo. O padrão de cards foi extraído diretamente do código de `/clientes` e `/contratos` e replicado nos demais módulos.
- Para retomar em nova sessão: ler este arquivo e `docs/PLANO-MELHORIAS-INOVEJURIS.md` e seguir a partir do estado final acima.

## Reativação da exclusão de prazos — 2026-11-17
- O usuário relatou que, após as implementações de prazos editáveis e cards mobile, tinha deixado de existir a ação de **excluir um prazo, perícia, cumprimento etc.** em Prazos e Processos. A funcionalidade foi reativada e estendida ao Calendário (as três telas consomem `process_deadlines`).
- Investigação: o backend já possuía a RPC transacional `delete_process_deadline(p_id, p_environment, p_edited_by, p_reason, p_source)` e o wrapper `deleteDeadlineRecord(...)` em `lib/deadline-mutations.ts`, mas nenhuma tela ligava um botão explícito a eles. O único botão de exclusão remanescente era o `Trash2` do modal de edição de processo (`app/processos/page.tsx`), que só removia a linha localmente até o "Salvar Alterações".
- Implementação: novo modal reutilizável `components/prazos/DeleteDeadlineModal.tsx` (confirmação, resumo do prazo, **motivo opcional** gravado no histórico, toast e execução da RPC). Ações adicionadas em:
  - `app/prazos/page.tsx`: botão "Excluir prazo" na tabela desktop e nos cards mobile.
  - `app/processos/[id]/page.tsx`: botões em "Próximo prazo" e na lista "Prazos do processo".
  - `components/calendario/DeadlineListView.tsx` + `app/calendario/page.tsx`: botão na lista e no painel do dia selecionado.
- Nenhuma migration nova: a exclusão é **hard delete** pela RPC existente, registrando `action='excluir'` em `process_deadline_history`; `publications.deadline_id` usa `ON DELETE SET NULL`. O motivo não é obrigatório no banco.
- Validação E2E em `/prazos` com prazo temporário no ambiente `test`: criação (id `61`), abertura do modal, chamada `POST /rest/v1/rpc/delete_process_deadline` com HTTP `200` e resposta `true`, lista atualizada de 3 para 2 prazos. Histórico confirmado por SQL: id `11` (`criar`) e id `12` (`excluir`, `justification: "Validacao automatizada da exclusao"`, `source: "prazos"`).
- Conferência visual em `/processos/39` (dois botões, modal abre e cancela) e em `/calendario` (botão na lista após navegar para dezembro/2026, modal abre e cancela).
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas). Atenção naquele momento: `fetchDeadlines()` não filtrava por ambiente; como `getAppEnv()` vem de `document.documentElement.dataset.env`, excluir um prazo de ambiente divergente falhava com `P0002` ("Prazo não encontrado neste ambiente.") — comportamento preexistente, corrigido em 2026-11-18 na seção abaixo.
- Commit `ed47f32` enviado para `trabalho-com-claude`. **Deploy de produção concluído:** `dpl_6RQzU9K8xCBVx8Xyadvk9gKgHt1c`, alias `https://inove-juris.vercel.app`. `vercel curl` em `/prazos`, `/processos` e `/calendario` retornou `Redirecting...` para `/login` (esperado sem sessão no CLI). O token antigo da Vercel continua considerado comprometido e deve ser revogado.
- O servidor local `npm run dev` da porta 3000 foi encerrado ao final da validação.

## Correção do filtro por ambiente — ENTREGUE em 2026-11-18
- Corrigido o comportamento preexistente em que `fetchDeadlines()` carregava registros de **todos os ambientes**, enquanto as RPCs de mutação usam `getAppEnv()`. Isso misturava prazos `test`/`production`, oferecia processos do outro ambiente no modal "Novo prazo" e podia gerar `P0002` na criação/exclusão.
- Implementação em `lib/deadlines.ts`: import de `getAppEnv`/`AppEnv`, assinatura `fetchDeadlines(env: AppEnv = getAppEnv())` e `.eq('environment', env)` nas cinco consultas (`process_deadlines`, `processes`, `contracts`, `clients`, `lawyers`).
- A chamada continua ocorrendo somente em efeitos cliente (`/prazos`, `/calendario`); no servidor `getAppEnv()` cai em `production`, por isso não foi move-la para renderização server-side.
- **Endurecimento em `app/processos/[id]/page.tsx`:** o detalhe agora filtra o próprio processo, os `process_deadlines` embutidos e as consultas auxiliares de `lawyers`, `contracts` e `clients` pelo mesmo `getAppEnv()`. Sem isso, era possível abrir pela URL um processo de outro ambiente e tentar editar/excluir prazos incompatíveis.
- Validação completa com sessão autenticada, alternando **PRODUÇÃO → TESTE → PRODUÇÃO** pela Sidebar:
  - `/prazos` em `production`: `process_deadlines?...&environment=eq.production` → HTTP `200`, **0 prazos**; “Novo prazo” ofereceu somente processos de produção (20 opções; nenhuma com id `29`/`30`).
  - `/prazos` em `test`: mesma consulta com `environment=eq.test` → HTTP `200`, **2 prazos vencidos**; “Novo prazo” ofereceu exatamente os processos `29` e `30`.
  - `/processos/29` em `production`: consulta com `environment=eq.production` + `process_deadlines.environment=eq.production` retornou `.single()` sem linhas (HTTP `406` esperado) e a tela exibiu “Processo não encontrado neste ambiente.”
  - Após trocar para `test` pela Sidebar, o mesmo `/processos/29` abriu normalmente, com o prazo “Juntar CTPS” e a consulta usando `environment=eq.test`.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas). Não foi necessária migration nova.
- Deploy do endurecimento: `dpl_9GZuKWe56Dmu8VcgKqPtXhoc73Sy`, alias `https://inove-juris.vercel.app`.

## Representação legal de menores em Clientes — ENTREGUE em 2026-11-18
- Decisão de produto: o menor continua sendo uma parte no cadastro; pai/mãe/tutor/curador é **outro registro de Cliente**, relacionado por aresta. A frase usada pelos futuros documentos (“representado por...”) projeta campos do responsável — nunca texto copiado no menor.
- `supabase/migrations/20261118140000_client_legal_guardians.sql` (aplicada em produção com `npx supabase db query --remote=jhlxzqsgmudkbjkynqdl --yes --file ...`; conferido `tabela=1`, `view=1`, `rpc=1`):
  - `client_relationships`: vínculo por `environment`, `client_id`, `related_client_id`, `relationship_type` (`pai|mae|tutor|curador|outro`), rótulo livre para o texto da cláusula, tipo de guarda, `is_primary`, vigência e auditoria. Um relacionamento principal por menor por ambiente.
  - `v_client_guardians`: expõe menor + responsável ao cadastro e, depois, ao catálogo do módulo Documentos.
  - `save_client_guardians(p_client_id, p_environment, p_guardians JSONB, p_edited_by)`: substitui os vínculos em transação, valida mesmo `environment` para menor e responsáveis, rejeita vínculo consigo mesmo e mais de um principal.
  - `clients."legalRepresentative"` permanece como legado; **não há backfill automático nem criação automática de clientes**.
- Frontend: `lib/client-guardians.ts` (tipos, rótulos, leitura/escrita), `components/clients/GuardianPicker.tsx` (busca de clientes do mesmo ambiente), editor **“Vínculos de Representação Legal”** no modal de Cliente, aviso revisável quando existe texto legado sem vínculo, lista/filtro “Assistidos” e `ClientSlideOver` projetando `mãe (principal): Nome · CPF`.
- Validação E2E em produção com o menor real **Anny Gabrielle Carvalho Borges** (`client_id=93`, legado “Arlene Carvalho de Santana Borges”):
  1. Abrir edição: aviso legado exibido corretamente.
  2. Buscar e selecionar **Arlene Carvalho de Santana Borges** (`client_id=94`), manter `mae` e principal, adicionar vínculo e salvar.
  3. `POST /rest/v1/rpc/save_client_guardians` retornou **204**; modal fechou após recarregar a lista.
  4. Recarregar a página e abrir o painel do cliente: `Representação legal — mãe (principal): Arlene Carvalho de Santana Borges · 032.448.265-55`; nenhum aviso de legado.
  5. SQL confirmou `client_relationships.id=1`, `client_id=93`, `related_client_id=94`, `relationship_type='mae'`, `is_primary=true`, `environment='production'`, `created_by=2`, e a linha correspondente em `v_client_guardians`.
- O vínculo de teste foi **mantido** porque reflete dado real correto.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas).
- Deploy de produção concluído: `dpl_HEdGnjmMiKjkAKEJo2wQc4K15TQJ`, alias `https://inove-juris.vercel.app`.
- Pré-requisito para o módulo Documentos/“Modelo Vivo” concluído: o catálogo de dados poderá consumir `v_client_guardians` sem depender de texto livre.

## Blindagem de login, senhas e sessão — ENTREGUE em 2026-11-18
- Solicitação do usuário: validar com “toda a segurança necessária” a tela de login, evitar vazamento de chaves/senhas e corrigir o auto-login após fechar o navegador sem clicar em **Sair do Sistema**. Decisões confirmadas: aplicar mudanças direto em produção; sessão deve encerrar ao fechar janela/aba; **sem MFA agora**.
- **Auditoria do código anterior** (achados confirmados):
  - `bcryptjs` comparava a senha no navegador e o cliente selecionava `password` do banco; havia fallback para texto plano.
  - `select('*')` e logs traziam/exibiam hash, e-mail e estrutura de permissões no console.
  - Identificador da sessão ficava em `localStorage` e era enviado no body do heartbeat/logout; cookie `app_env` usava `sameSite: 'none'`.
  - Rate limit e verificação de expiração eram apenas client-side; presença de cookie/localStorage bastava para considerar autenticado.
  - RLS permissiva em `users`, `user_sessions`, `login_attempts` e `trusted_devices`.
- **Migration aplicada em produção:** `supabase/migrations/20261118150000_auth_session_hardening.sql` (`npx supabase db query --remote=jhlxzqsgmudkbjkynqdl --yes --file ...`). Antes da alteração foi criado o snapshot `_auth_hardening_policy_backup_20261118` com as policies originais.
  - Tabela `login_challenges` e funções auxiliares `_auth_*`.
  - RPCs `SECURITY DEFINER`: `app_authenticate`, `app_complete_login`, `app_validate_session`, `app_heartbeat`, `app_logout`, `app_switch_environment`, `app_admin_save_user`, `app_admin_delete_user`, `app_admin_impersonate`, `app_admin_terminate_session`, `app_admin_trust_device`, `app_get_security_data`, `app_get_my_trusted_devices`, `app_remove_my_trusted_device`.
  - Comparação bcrypt acontece no Postgres (`extensions.crypt`). Os 4 hashes reais usavam `$2b$`; a função `_auth_normalize_bcrypt` converte apenas o prefixo para `$2a$`, exigido pelo `pgcrypto` do Supabase (teste direto: `$2b$` falhou e `$2a$` passou). Nenhum texto plano foi encontrado.
  - Coluna `users.password` deixou de ser selecionável por `anon` (`GET /rest/v1/users?select=password...` → **401 permission denied**; colunas seguras → **200**). Escrita direta em `users` foi revogada e policies permissivas de sessões/tentativas/dispositivos foram removidas. `audit_logs` manteve policies de compatibilidade (resíduo a revisar).
  - Fluxo de dois passos preservado: `authenticate` devolve `challenge` sem senha/hash; `login` troca o challenge por `sessionId` e grava sessão no banco.
- **Sessão:** `session_id` e `app_env` passaram a ser cookies **httpOnly, SameSite=Lax, Secure em produção e sem Max-Age/Expires** (cookie de sessão). Cabeçalho real conferido: `session_id=...; Path=/; HttpOnly; SameSite=lax`. O `app_env` saiu de `sameSite: 'none'`. O `sessionId` não vai mais para `localStorage` nem para o body de heartbeat/logout.
- **Validação server-side:** `useAuth()` chama `app_validate_session` no bootstrap; `middleware.ts` exige ambos os cookies; `SessionMonitor` usa heartbeat por cookie e encerra a sessão se o servidor responder `401`. Sessões expiram após 12 h, 10 min sem heartbeat, logout, troca de ambiente indevida ou data de expiração do usuário.
- **Auto-login ao fechar o navegador:** marker em `sessionStorage` + `session_last_activity`; se o navegador restaurar a aba sem marker e com gap > 2 min, a aplicação chama `logout`, limpa estado local e redireciona para `/login?reason=session`.
- **Código alterado:** `lib/auth.ts` (sem bcrypt/hash/sessionId no cliente), `app/api/auth/session/route.ts` (todas as ações via RPC, sem logs de body/email/permissões), `middleware.ts`, `app/login/page.tsx`, `components/SessionMonitor.tsx`, `app/usuarios/page.tsx`, `components/AuditAccessLogs.tsx` e `components/settings/TrustedDevicesTab.tsx`. Senha é limpa do state React assim que o challenge é recebido.
- **Testes SQL em produção:** fluxo completo `app_authenticate` → `app_complete_login` → `app_validate_session` → `app_heartbeat` → `app_logout` passou; após logout, `app_validate_session` retornou `valid=false`. Teste REST anônimo: 5 senhas erradas → `invalid_credentials`, 6ª → `rate_limited`. Usuário temporário `auth-check@inovejuris.local` removido.
- **E2E no dev (`localhost:3000`)** com usuário temporário `e2e@inovejuris.local` (removido ao final): login em dois passos, dashboard, reload mantido, alternância PRODUÇÃO → TESTE → PRODUÇÃO pela Sidebar, heartbeat `200`, criação e exclusão administrativa de usuário via `admin_save_user`/`admin_delete_user` (HTTP `200`), logout pela UI e `validate` sem cookies retornando `valid=false`. O teste de restauração simulada (sem marker + atividade antiga) redirecionou para `/login?reason=session` e marcou a sessão como encerrada no banco. O travamento observado durante o E2E veio da automação de preenchimento do campo (e-mail duplicado/senha limpa após o challenge), não da aplicação.
- Confirmação final em banco: **4 usuários reais**, **0 temporários**, **0 sessões ativas** após a limpeza. `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas).
- `SUPABASE_SERVICE_ROLE_KEY` **não** foi necessária nem configurada. Commit `67fb5e5` enviado para `trabalho-com-claude`. Deploy de produção concluído: `dpl_3uTJ1pycd3GUT4jJtZXggjUpmsrh`, alias `https://inove-juris.vercel.app`; `vercel curl /login` retornou **200**. **Pendência:** revogar o token antigo da Vercel, considerar MFA/“lembrar de mim” em uma próxima fase e revisar as policies restantes de `audit_logs`.

## Permissões granulares de Prazos, Calendário e Publicações — Camada A entregue em 2026-11-18
- **Parecer prévio:** antes de editar qualquer arquivo foi entregue parecer técnico com opções e riscos. O usuário aprovou a **Camada A** por citação da proposta; a **Camada B** ficou expressamente adiada.
- **Nomenclatura obrigatória:** **Publicações** em UI, menu, docs e identificadores user-facing; o termo anterior não foi reintroduzido como nome de módulo.
- **Migration `20261118160000_module_permissions.sql` aplicada em produção:**
  - Novas colunas `users."canAccessPrazos"`, `"canAccessCalendario"` e `"canAccessPublicacoes"`, todas `boolean NOT NULL DEFAULT false`.
  - Backfill preservou o acesso existente: cada coluna passou a usar o valor de `coalesce("canAccessProcesses", false)`. Validação em produção: **4 usuários, 0 divergências** nas três colunas.
  - `grant select` explícito das três colunas para `anon, authenticated, public`. Isso foi necessário porque a migration `20261118150000` concedeu `SELECT` coluna a coluna (sem `password`) e, sem o grant, `app/usuarios/page.tsx` retornava “Nenhum usuário encontrado”.
  - Slugs `access_prazos`, `access_calendario` e `access_publicacoes` criados em `permissions` e vinculados aos perfis **Administrador, Advogado e Estagiário** em `role_permissions` (todos os ambientes/duplicidades existentes cobertos pelo `INSERT ... SELECT`).
  - `_auth_user_payload()` passou a devolver sempre os três flags com `coalesce(..., false)`; superadmin continua com todos os flags de módulo forçados para `true`.
  - `app_admin_save_user()` foi atualizada para gravar os três flags de forma independente, exigir senha de no mínimo **10 caracteres**, bloquear tentativas de auto-elevação e auditorizar o diff efetivo de permissões.
- **Correções de segurança incluídas no patch final:**
  - Não-superadmin não pode: criar/promover superadmin; conceder `canAccessUsers`, `canAccessSettings`, `canAccessAudit`, `canAccessProdEnv` ou `canAccessTestEnv`; atribuir o perfil **Administrador**; alterar superadmin existente.
  - Mensagens exatas validadas em produção: “Somente superadministradores podem conceder privilégios de superadministrador.”, “Somente superadministradores podem conceder acesso a canAccessAudit.”, “Somente superadministradores podem atribuir o perfil Administrador.”, “Somente superadministradores podem alterar um superadministrador.” e “Somente superadministradores podem conceder acesso a canAccessProdEnv.”.
  - Auditoria gravada com `old_data`, `new_data`, `changed_fields`, `performed_by` e `environment`. `changed_fields` é um **objeto** (`jsonb_object_agg`), compatível com `app/auditoria/page.tsx`; `action` usa `INSERT`/`UPDATE`. Corrigido o `role_id: null` espúrio que aparecia quando o perfil não era alterado.
- **Código alterado:** `lib/auth.ts` (`User` com os 3 flags), `app/usuarios/page.tsx` (select, `formData`, `handleRoleChange`, payload e checkboxes **Prazos/Calendário/Publicações**), `components/Sidebar.tsx`, `app/dashboard-layout.tsx`, `components/UserTable.tsx` (badges desktop/mobile) e `app/page.tsx` (Radar de Prazos agora depende de `canAccessPrazos`).
  - Guarda de rota corrigida para **fail-closed**: `user[requiredPermission] !== true` nega acesso mesmo se a chave estiver ausente/undefined.
  - `app/api/auth/session/route.ts` foi conferido; repassa `admin_save_user` sem necessidade de alteração. `app/dashboard-layout-1.tsx` é legado e não participa do roteamento atual.
- **Validações:** `npx tsc --noEmit` OK; `npm run build` OK (21 páginas). E2E em `localhost:3000` com usuários temporários:
  - Usuário 71 (admin temporário, sem os 3 flags): menu ocultou **Prazos/Calendário/Publicações**; `/prazos`, `/calendario` e `/publicacoes` exibiram **Acesso Negado**; Radar de Prazos ausente.
  - Usuário 72 (perfil **Estagiário**, mudança salva pela própria UI): flags persistidos após recarga (`Prazos=true`, `Calendário=true`, `Publicações=true`); menu mostrou os três itens; as três rotas abriram sem “Acesso Negado”; badges em `UserTable` apareceram como ativos e `Usuários` como inativo; a seleção do perfil Estagiário marcou automaticamente as três checkboxes.
  - SQL conferiu `changed_fields` com exatamente `canAccessCalendario`, `canAccessPrazos` e `canAccessPublicacoes` na atualização de teste, com `performed_by=71` e `environment=production`.
- **Limpeza:** usuários temporários `71` (`admin.temporario.permissoes@example.com`) e `72` (`permissoes.modulo.teste@example.com`), sessões de teste (incluindo IDs `11111111-...`, `22222222-...` e as sessões geradas no E2E), notificações e audit logs correlatos foram removidos. Confirmação final: **4 usuários reais** (`1`, `2`, `23`, `65`), nenhum usuário temporário e nenhum artefato de teste restante. Nenhum usuário real teve suas permissões alteradas.
- **Pendência deliberada:** não houve enforcement server-side novo nas RPCs de domínio nem RLS restritiva adicional nesta camada (Camada B).
- **Versionamento/publicação:** commit `9dc7827` (`feat(permissoes): flags independentes de prazos, calendario e publicacoes (camada A)`) enviado para `trabalho-com-claude`; deploy de produção `dpl_8FnNJ22Za6efpojF5gNqP5vxentp`, alias `https://inove-juris.vercel.app`; `vercel curl /login` retornou o HTML da tela de login sem erro de acesso. Nenhum usuário real precisou ser alterado: os 4 existentes permaneceram com os flags já migrados.

## Logout global ao fechar aba/janela — entregue em 2026-11-18
- **Parecer prévio:** antes de editar foi explicado que nenhum navegador garante a entrega de um evento de fechamento ao servidor (celular em segundo plano, swipe de aba, crash, queda de rede). O usuário escolheu: (1) encerrar **todas as sessões do usuário em todos os dispositivos**; (2) fallback de **90 segundos** quando o aviso não chegar.
- **Migration `20261118170000_session_close_all_devices.sql` aplicada em produção:**
  - `_auth_session_payload()` passou a considerar `last_seen_at` mais antigo que **90 segundos** como inválido (antes eram 10 minutos). Validação SQL: sessão com `last_seen_at = now()` válida; sessão com 100 segundos inválida.
  - Nova RPC `app_logout_all_user_sessions(p_session_id uuid)`: localiza o usuário pela sessão informada e marca `logout_at = now()` em **todas** as sessões ativas dele. A sessão informada pode estar com `last_seen_at` antigo, mas precisa existir e não ter sido encerrada antes.
  - `revoke`/`grant` de execução ajustados para `anon, authenticated`.
- **API:** `app/api/auth/session/route.ts` ganhou a ação `close_session`, que chama a RPC acima e devolve cookies limpos. O endpoint é chamado por `navigator.sendBeacon`, que funciona durante o descarregamento e envia os cookies httpOnly.
- **Cliente:** `components/SessionMonitor.tsx` passou a:
  -Listener de `pagehide`/`beforeunload` com `document.visibilityState === 'hidden'`. Isso evita disparar logout em **reload** (página permanece visível) e cobre fechamento de aba/janela e saída do sistema.
  - Enviar `sendBeacon` para `close_session` com fallback para `fetch(..., { keepalive: true })`.
  - Rearmar o aviso ao voltar do BFCache (`pageshow` com `persisted`).
  - Heartbeat reduzido de 30s para **20s**, compatível com a tolerância de 90s.
  - Aviso de sessão encerrada atualizado para citar aba fechada, novo login ou administrador.
  - `terminationHandled` (useRef) garante **um único** alerta/redirect quando vários heartbeats recebem 401 ao mesmo tempo.
- **Validações:**
  - `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas).
  - SQL em produção: RPC encerrou duas sessões do mesmo usuário (uma fresca e uma com 100s de atraso); `fresh_valida=true`, `stale_valida=false` após a mudança de TTL.
  - E2E em `localhost:3000`: login com usuário temporário, inclusão de uma segunda sessão “de outro dispositivo”, disparo simulado de `pagehide` com `visibilityState=hidden`; **as duas sessões** foram marcadas como encerradas; heartbeat seguinte retornou 401, exibiu o aviso e redirecionou para `/login`. Repetição do teste confirmou **um único alerta** após a correção com `useRef`.
- **Limpeza:** usuários, sessões, notificações, dispositivos confiáveis e audit logs dos testes temporários removidos; verificação final retornou **0 artefatos**. Usuários reais preservados, incluindo o criado pelo próprio usuário durante a sessão (`marcos@gmail.com`, id `73`). Nenhuma sessão real foi encerrada pelos testes.
- **Limitação conhecida:** se o aviso de fechamento não chegar ao servidor, a sessão ainda pode sobreviver por até **90 segundos** — prazo aceito pelo usuário. Reloads deliberados não encerram a sessão. Trocar de app no celular pode disparar `pagehide` e, por consequência, logout global; isso é coerente com a opção “todos os dispositivos”.
- **Commit e deploy:** `119e1e1` (`feat(auth): encerrar todas as sessoes ao fechar aba/janela`) enviado para `trabalho-com-claude`; deploy `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` publicado em `https://inove-juris.vercel.app`; `vercel curl /login` retornou HTML normalmente.

## Comandos úteis (PowerShell, em `C:\InoveTecnologia\InoveJuris`)
```powershell
git remote -v
git branch --show-current
git status

npm run build

git add -A
git commit -m "Mensagem"
git fetch origin
git pull --rebase origin main   # ou: git rebase origin/main
# resolver conflitos: editar -> git add <arquivos> -> git rebase --continue
git push -u origin main         # ou: git push origin trabalho-com-claude:main
```

## Notas importantes
- **Não commitar segredos** (`.env`, `.env.local`, tokens/chaves).
- O erro `BLOQUEADO: OLD=Cancelado, NEW=Aberto...` indica tentativa de reabrir contrato já cancelado/quitado (protegido). Cancelamento válido é transição para `Cancelado`; reabertura exige fluxo específico se desejado.
- Cancelamento no app bloqueia contratos com parcelas recebidas (regra de negócio).
- Este arquivo é um resumo operacional; detalhes finos de schema/regras podem variar conforme o banco em produção.
- **Continuidade de conversas:** este assistente não mantém memória persistente automática entre sessões. Para "armazenar" o histórico/continuidade, mantenha este arquivo (`docs/STATUS-INOVEJURIS.md`) atualizado e versionado no repositório, e ao iniciar uma nova sessão peça para ler este documento e retomar a partir dele. Se desejar, registre também decisões/resumos adicionais em arquivos no repo (ex.: `docs/`).

## F7-VIEWS + limpeza de console — entregue em 2026-11-18

- **F7-VIEWS (concluída):** as cinco views do dashboard (`process_sync_status`, `vw_area_efficiency`, `vw_cash_flow_forecast`, `vw_client_process_summary`, `vw_process_velocity`) agora expõem `environment` como última coluna e mantêm `security_invoker=on`. SQL aplicado pelo usuário no SQL Editor; artefatos em `C:\InoveTecnologia\InoveJuris-Backups\F7-VIEWS-20261118\`.
- Contagens por ambiente: `process_sync_status` 19/2, `vw_area_efficiency` 4/3, `vw_cash_flow_forecast` 10/0, `vw_client_process_summary` 107/6, `vw_process_velocity` 19/2 (production/test). `vw_area_efficiency` passou de 5 para 7 linhas porque passou a agrupar por área **e** ambiente.
- `lib/supabase.ts`: removida a lista `VIEWS_SEM_ENVIRONMENT`. Uma regra única para todas as tabelas/views — sem exceções. Fim do risco de KPIs misturarem `production` e `test`.
- **Limpeza de console:** logs de debug removidos (dashboard, KPIs, aniversariantes, Realtime) e consultas duplicadas eliminadas em `app/page.tsx`. Os 19 `ResponsiveContainer` receberam `minWidth={0} minHeight={0}`. Fonte `Inter` removida; `JetBrains_Mono` e `Playfair_Display` sem preload.
- `npm run build`: **OK** (25 páginas). `.next/static`: 0 arquivos com chave legada e 0 com os textos de debug.
- **Deploys atuais:** Production `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj` (alias `https://inove-juris.vercel.app`), Preview `dpl_AWWbfXvcZNSJaqQcz1bygGfZ5otY`. Sem cookie, as rotas retornam `307` nos dois ambientes.
- **Rollback:** F7-VIEWS → `rollback_f7.sql` + `dpl_2i4To1n9zycciTw2cuVLuB6yjwvL` / `dpl_HeKYexkBYyaELZR2DN46femm2YHK`. Limpeza → promover `dpl_DykQeTzCcRQ3yhhYQ8G3qooATE4Y` / `dpl_GFvFohoh2piXQqNVTYLeNzVMPkFR`.
- **Pendente:** validação A/B/C do storage com cookie de teste fresco (o anterior expirou pela regra de 90 s sem heartbeat) e confirmação visual do console no navegador do usuário (hard reload). `__cf_bm` e o websocket do Realtime são externos ao app.

## Incidente de acesso e decisão de banco — 2026-11-19

**BLOQUEIO RESOLVIDO EM 19/11 (válido como registro do incidente):** o Postgres do Supabase (`jhlxzqsgmudkbjkynqdl`) havia ficado inacessível por esgotamento do orçamento de I/O em disco. Após o usuário rodar `select 1;` com sucesso, REST (HTTP 200), RPC de autenticação (HTTP 200) e rota `/api/auth/session` (HTTP 401 com "E-mail ou senha inválidos.") voltaram a responder — ver seção 13.8 do parecer de impacto. **Não houve mudança de código, deploy, rollback nem sessão artificial.** O burst caiu para o baseline de **5 MB/s**, e até `select 1` estoura o `statement_timeout`. Consequências: login exibe "Não foi possível validar as credenciais." com credenciais corretas (RPC `app_authenticate` → `504`), `SettingsProvider` → `57014`, consultas REST → timeout e SQL Editor → `Connection terminated due to connection timeout`. O front está são (`/login` → `200`) e o status global do Supabase está verde.

- **Descartado com teste controlado:** vínculo com a limpeza do console ou com a F7-VIEWS. O deploy anterior (`dpl_DykQeTzCcRQ3yhhYQ8G3qooATE4Y`) e o atual (`dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj`) falham **identicamente** na rota de login. O alias foi devolvido ao deploy atual; nenhum rollback foi mantido.
- **Nenhuma alteração de código de autenticação** foi feita. Nenhum acesso emergencial, backdoor ou enfraquecimento de heartbeat foi criado.
- **Ação imediata (sem deploy):** fechar abas do app, parar retries e testar `select 1;` no SQL Editor. 10–15 min servem só como primeiro teste — a recarga do saldo de I/O pode levar **horas** e exige demanda no baseline; detalhes na seção 13.7 do parecer de impacto. Se não voltar: upgrade de compute, Restart pelo Dashboard ou Support.
- **Sem token de gestão do Supabase** neste ambiente (`~/.supabase` só tem `telemetry.json`; `vercel env pull` devolve `[SENSITIVE]` para a service role). Não foi possível consultar status nem reiniciar o projeto por Management API.
- **Decisão de banco (parecer, sem implementação):** Nhost Free é o substituto gerenciado mais fiel (Postgres real + GraphQL/Auth/Storage, mas exige reescrever a camada de acesso); Appwrite usa MariaDB e foi descartado; Neon é o melhor "só Postgres" free, mas o heartbeat de 20 s esgotaria os 100 CU-hours em ~4 dias; self-host Supabase em VM Oracle Always Free dá paridade total e disco próprio, mas transfere a operação para o time. **Recomendação:** otimizar o padrão de acesso dentro do Supabase (Fase 1) e, se necessário, upgradar compute (Fase 2); migração só como Fase 3 com POC paralela. Comparativo completo na seção 14 do parecer de impacto.
- **Pendências adicionais:** após o banco voltar, repetir REST simples, rota de login, A/B/C com cookie fresco e validação visual do console; levantar `pg_stat_statements`/`pg_stat_activity` para o plano de otimização; avaliar trocar a mensagem de login para "Sistema temporariamente indisponível" em erros `57014`/timeout (somente com aval).
- **Deploys inalterados:** Production `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj`, Preview `dpl_AWWbfXvcZNSJaqQcz1bygGfZ5otY`. Backup dos documentos antes desta atualização: `C:\InoveTecnologia\InoveJuris-Backups\DOCS-20261119\`.
- **Parecer NoSQL (sem implementação):** nenhum NoSQL free comporta os recursos atuais (plpgsql, RLS, views, joins, `pg_cron`, Realtime, Storage assinado) — a mudança seria reescrita integral. Appwrite Cloud Free é o BaaS NoSQL free mais completo; Firebase Spark não cobre Storage/Functions (exige Blaze) e o heartbeat de 20 s estouraria a cota de operações; PocketBase é free self-host, mas exige JS hooks e operação própria. Detalhes na seção 15 do parecer de impacto. Recomendação mantida: Fase 1 (otimização) antes de qualquer migração.

## Fase 0 de segurança — executada em 2026-11-19

- **Branch:** `fase0-seguranca` (a partir de `trabalho-com-claude`, HEAD `c15c30b`). Commits de código `bf364e9` e `86e6c7b`. **Promovida para Production** em 2026-11-19: deployment `dpl_A5BoCyrTwcv35UXskj8eqBgeY5SP` (alias `https://inove-juris.vercel.app`), a partir do Preview testado `qx87roe3z`.
- **Rotas públicas de diagnóstico removidas:** `fix-db`, `diagnose-db`, `check-db`, `check-enum`, `fix-cancellation`, `alter-leads`, `setup-sessions` (incluindo os duplicados `route-1.ts`) e os arquivos soltos `fetch.js`, `fetch-1.js`, `app/fetch.js`, `app/fetch-1.js`. Não havia referências de código a elas.
- **`/api/db/status` protegida** com `requireSessionContext` + `authErrorResponse`; a tela de backup continua funcionando com sessão válida.
- **`app/leads/page.tsx`:** removida a chamada automática a `/api/fix-db`; o carregamento agora usa apenas `fetchLeads()`.
- **Guarda de sessão adicionada** em `check-deadlines`, `process-consultation`, `process-sync` e `djen-sync`. Em `process-sync`/`djen-sync` o ambiente passou a vir de `ctx.environment` (sessão), não de `getAppEnv()`/body.
- **Logs de payload removidos:** `lib/supabase.ts` (insert/update e parcelas no cancelamento) e `lib/supabase-server.ts` (5 logs por query). `next.config.ts` ganhou `removeConsole` em produção, preservando `error`/`warn` no bundle do cliente.
- **`cleanup_old_logs()` corrigido** para `performed_at` (era `created_at`, coluna inexistente). Scripts: `forward_cleanup_old_logs.sql` e `rollback_cleanup_old_logs.sql` em `C:\InoveTecnologia\InoveJuris-Backups\FASE0-20261119\`. **Forward aplicado pelo usuário no SQL Editor em 2026-11-19 (`Success. No rows returned`)**; execução revogada de `public`/`anon`/`authenticated` e concedida a `service_role`. Verificação posterior confirmou `anon_executa = false`, `auth_executa = false` e definição usando `performed_at`. **Não agendado** (nenhum `pg_cron` criado). Nenhuma rota do app chama essa RPC — a limpeza manual usa `/api/settings/audit/cleanup` com sessão admin.
- **Dependências:** `shadcn` movido para `devDependencies`; `npm audit fix` sem `--force` reduziu os avisos totais de **48 → 23** e, em `--omit=dev`, de 48 → **10 (0 critical)**. Restam upgrades maiores (`next` 16, `nodemailer` 10, `adm-zip` 0.6, `archiver` 8) que exigem plano próprio e não entram na Fase 0.
- **Validação:** `npm run build` **OK** (rotas de diagnóstico ausentes do manifesto) e `npx tsc --noEmit` **EXIT 0** após limpar `.next` e remover o duplicado `next-env.d-1.ts`. HTTP local: sem cookie → `307 → /login`; com cookie falso (`session_id` inexistente) → `401 {"error":"Sessão inválida."}` em todas as cinco rotas testadas. `/api/auth/session` segue pública (controle `400` sem body).
- **Validação em Production (2026-11-19, `inove-juris.vercel.app`):** `/login` → `200`; sem cookie → `307 → /login` nas cinco rotas; com cookie falso → `401` nas cinco; rotas removidas (`fix-db`, `diagnose-db`, `check-db`, `check-enum`, `fix-cancellation`, `alter-leads`, `setup-sessions`) → **`404`**; `/api/auth/session` → `400` sem body (pública, esperado).
- **Pendente:** validação autenticada A/B/C com cookie fresco (não havia sessão válida neste ambiente). O Preview `qx87roe3z` está atrás de Deployment Protection (SSO), por isso a validação foi feita no build local e depois em Production. Rollback de deploy: promover `dpl_CamrC5NmuaqbRThnGTL3DbD8a4QZ`; rollback de código: `git revert 86e6c7b` e `git revert bf364e9`.
- **Inventário F4b (read-only):** `inventario_f4b.sql` no mesmo diretório de backup — RLS/policies, grants de `anon`/`authenticated` por tabela, funções executáveis e volume estimado. Ainda não executado no SQL Editor.

## Fase B da identidade e correção do payload — 2026-11-19

- **Fase B autorizada e publicada:** `SUPABASE_JWT_ROLE=authenticated` configurada em Production, Preview e Development. Deploy `dpl_4LKhoEm2NjjKWJ4AHvCT7QLzKM1D`, alias `https://inove-juris.vercel.app`; `/login` → 200, `/configuracoes` → 307, console da tela de login sem erros. Mesmo commit da Fase A (`484291f`): nenhuma policy foi alterada.
- **Pré-verificação:** `verify_faseb_grants.sql` (48/48 tabelas/views OK e RPCs críticas com `execute` para `authenticated`) e `verify_faseb_policies.sql` (179 policies: 130 `public`, 31 `anon`, 17 `authenticated`, 1 `anon+authenticated`). O rótulo `PROBLEMA` do segundo script gerou falsos positivos: as tabelas marcadas também têm policies `TO public`/`TO authenticated`.
- **Checagem focada:** `verify_faseb_focado.sql` cobre as 52 tabelas/views usadas por `supabase.from(...)`. Resultado: `bloqueios=0` e `audit_logs libera authenticated=SIM` (policy `TO public ... using (auth.role() = 'authenticated')`). Os 4 objetos internos sem policies (`_auth_hardening_policy_backup_20261118`, `login_attempts`, `login_challenges`, `trusted_devices`) não são chamados pelo app e têm `FORCE RLS=false`.
- **Regressão detectada depois do deploy:** Prazos, Calendário e Publicações desapareceram da Sidebar. Causa: `forward_f4b2a_token_payload.sql`, aplicado hoje para adicionar `organization_id`, reescreveu `_auth_user_payload` a partir da versão da migration `20261118150000` e removeu o `or is_superadmin` introduzido pela Camada A (`20261118160000`). **Não foi efeito da Fase B**: o payload vem de `app_validate_session`, executada no servidor sem o token do navegador. Nenhum dado foi apagado.
- **Parecer e correção:** `PARECER-REGRESSAO-PAYLOAD-20261119.md`, `forward_corrige_payload_superadmin.sql` e `rollback_corrige_payload_superadmin.sql` no diretório `C:\InoveTecnologia\InoveJuris-Backups\FASE0-20261119\`. Forward aplicado e conferido: `organizacao_preservada=true`, `or_superadmin_restaurado=true`, `ocorrencias_or_superadmin=22`. O rollback volta exatamente ao estado anterior à correção.
- **Validação funcional (19/11):** os três itens da Sidebar foram confirmados na aplicação. O token devolvido por `/api/auth/session` foi lido apenas pelas claims: `HS256`, `role=authenticated`, `sub=2`, `organization_id`, `environment=production`, `exp-iat=600`. Rotas de leitura (Dashboard, Clientes, Prazos, Calendário, Publicações, Configurações) abriram sem erro do app.
- **Achado na validação:** instrumentação no navegador mostrou que as chamadas `/rest/v1/...` ainda enviavam `Authorization: Bearer <chave publicável>` (1 segmento), e não o JWT (3 segmentos). O `supabase-js` preenche o Bearer antes de chamar `sessionAwareFetch`, que só injetava o token se o header estivesse ausente. Ou seja, a Fase B estava configurada, mas **inerte** nas consultas do app. Parecer: `PARECER-TOKEN-NAO-INJETADO-20261119.md` em `C:\InoveTecnologia\InoveJuris-Backups\FASE0-20261119\`.
- **Correção aplicada em `lib/supabase.ts`:** quando há token de sessão, o Bearer da chave publicável é substituído pelo JWT (`if (token) headers.set('Authorization', ...)`); o header `apikey` permanece intacto. `npx tsc --noEmit` e `npm run build` OK. Rollback exato: restaurar `if (!headers.has('Authorization'))`.
- **Publicada e validada em 19/11:** commit `c4d806c`, deploy `dpl_G1MthzfBKKgh76ToAVFQ2bN5vXXf` (`READY`, alias `https://inove-juris.vercel.app`). Instrumentação no navegador confirmou o `Authorization` com 3 segmentos e claims `HS256`, `role=authenticated`, `sub=2`, `organization_id`, `environment=production`, `exp-iat=600`, sobrepondo o Bearer de 53 caracteres/1 segmento da chave publicável. Sidebar e rotas de leitura OK; console sem erros. Logs de runtime não retidos no plano Hobby (0 registros).
- **Atualizado em 2026-11-20:** teste de pagamento/estorno **realizado com sucesso pelo usuário**, com autorização explícita; nenhum pagamento foi executado pelo agente. Restam F4b-2c, chave ECC própria e F3.

## Correção de performance — digitação no fluxo de caixa — 2026-11-20

- **Sintoma:** digitar valor/descrição em "Novo Lançamento Financeiro" (`/fluxo-caixa/movimentacoes`) levava ~385 ms por tecla no navegador de teste (41 caracteres = 15.765 ms). O perfil de CPU era dominado por React/layout: a página inteira (gráficos + tabela) re-renderizava a cada tecla.
- **Parecer e medição:** `PARECER-DIGITACAO-LENTA-20261120.md` em `C:\InoveTecnologia\InoveJuris-Backups\PERF-20261120\`. Nenhuma policy, grant, autenticação ou variável de ambiente foi alterada.
- **Correção (commit `85dc94b`):** modal extraído para `components/cashflow/NewTransactionModal.tsx` com `React.memo` e estado local; `useMemo` em `filteredTransactions`; `Intl.NumberFormat` reaproveitado em `lib/utils.ts`. Lógica de gravação, validação de saldo e confirmação mantidas.
- **Validação:** `npx tsc --noEmit` e `npm run build` OK; deploy `dpl_CKcrymP74sp29R5FiQbpifjntjVf` (`READY`, alias `https://inove-juris.vercel.app`). A mesma digitação instrumentada caiu para **1.119 ms** (≈27 ms/tecla, ~14× mais rápido); perfil com 1.096 ms em `(idle)` de 1.393 ms e console sem erros. O modal zera ao fechar/reabrir. Nenhum lançamento foi submetido — sem efeito financeiro.
- **Rollback:** promover `dpl_G1MthzfBKKgh76ToAVFQ2bN5vXXf` e `git revert 85dc94b`; detalhes no parecer.
- **Atualizado em 2026-11-20:** validação do usuário recebida; teste financeiro ponta a ponta concluído com sucesso. Restam F4b-2c, chave ECC e F3.

## Adiamento das pendências restantes — 2026-11-20

- **Decisão do usuário:** por falta de tempo e horário avançado, os passos restantes ficam para outra oportunidade. **Nenhum deles foi executado** nesta sessão; não houve alteração em banco, variáveis, autenticação ou deploy além do já publicado.
- **Handoff completo:** `docs/HANDOFF-PENDENCIAS-20261120.md` — estado congelado, estimativas de cada item, risco residual, sequência de retomada e rollbacks.
- **Itens adiados naquele momento:** (1) validação da digitação no celular; (2) teste de pagamento/estorno, só com autorização explícita; (3) F4b-2c em ≈11 lotes de 5 tabelas; (4) chave ECC própria; (5) F3 no Supabase Support. **Itens 1 e 2 concluídos com sucesso em 2026-11-20** (ver fechamento no fim deste documento).
- **Risco residual assumido:** policies `USING (true)` ainda liberam acesso pela chave publicável (o JWT já é enviado, mas ainda não filtra por tenant); 17 funções `http` seguem executáveis; assinatura HS256 como ponte. O fluxo financeiro, que era o quarto risco, foi **testado ponta a ponta com sucesso em 2026-11-20** pelo usuário. Sistema funcional e sem erros — são lacunas silenciosas, não falhas visíveis.
- **Estado congelado:** produção `dpl_CKcrymP74sp29R5FiQbpifjntjVf` (`READY`, alias `https://inove-juris.vercel.app`); `fase0-seguranca`, `main` e `trabalho-com-claude` alinhadas na ponta desta entrega (hash no `git log`).

## Dashboard — performance e organização visual (2026-11-20)

- **Autorização:** usuário pediu para "continuar e ajustar tudo" após o diagnóstico. Parecer, backup e rollback registrados **antes** da edição em `C:\InoveTecnologia\InoveJuris-Backups\DASHBOARD-20261120\PARECER-DASHBOARD-20261120.md`; original em `app-page.orig.tsx`.
- **Baseline medido:** 10.236 px de altura, 50 cards, 18 gráficos Recharts, 30 chamadas REST no load (12 com 1,2–2,0 s), troca de filtro com long tasks de 175 + 139 + 104 ms (~418 ms) e 223 ms de tempo próprio da página; nenhum `useMemo`/`React.memo`.
- **Alterações (somente `app/page.tsx`):** debounce de 400 ms no Realtime; `useMemo` em filtros, agregações e séries dos gráficos; `React.memo` nos cards/widgets com comparadores estáveis para callbacks de navegação; montagem tardia dos gráficos abaixo da dobra via `IntersectionObserver` (rootMargin 800 px); grids corrigidos (8 indicadores em 4×2, KPIs em 3×2, listas financeiras em 2 colunas); 6 seções nomeadas com navegação âncora fixa; título duplicado "Fluxo de Compromissos" removido (o componente `TaskKanban` continua dono do título).
- **Validação técnica:** `npx tsc --noEmit` sem erros; `npm run build` OK; `tsconfig.tsbuildinfo` restaurado; chunk do build contém os novos rótulos e o `IntersectionObserver`.
- **Deploy:** commit `41f0191` enviado para `fase0-seguranca`, `main` e `trabalho-com-claude` (locais e remotas, alinhadas); produção `dpl_7a86NJWEyxK7YRoBdfYmJaSToJQL` (`READY`, alias `https://inove-juris.vercel.app`).
- **Pendente:** medição interativa e validação no celular. A sessão do navegador integrado foi perdida ao trocar de aba (o app redirecionou para `/login`); como credenciais não são manuseadas no chat, a conferência visual precisa ser feita pelo usuário logado. **Não houve erro visível nem alteração de autenticação, banco ou variáveis.**
- **Rollback:** promover `dpl_CKcrymP74sp29R5FiQbpifjntjVf`; `git revert 41f0191`; ou restaurar `DASHBOARD-20261120\app-page.orig.tsx`.

## Correção — Movimentações respeitando o ambiente (2026-11-20)

- **Sintoma:** cards Entradas/Saídas/Saldo e gráficos de distribuição apareciam idênticos em Produção e Teste.
- **Causa:** `app/fluxo-caixa/movimentacoes/page.tsx` chamava `get_financial_summary` e `get_financial_chart_data` com `p_environment: 'production'` fixo. O Proxy de `lib/supabase.ts` isola tabelas, mas **não intercepta RPCs**.
- **Prova (somente leitura):** produção = 168.496,57 / 100.114,61; test = 35.600,00 / 600,00 (43 entradas, 4 saídas). A tela de teste mostrava os números de produção. **Não houve duplicação nem alteração de dados.**
- **Correção:** import de `getAppEnv` e 3× `p_environment: getAppEnv()`. Apenas frontend.
- **Validação:** `tsc` e `build` OK; `tsconfig.tsbuildinfo` restaurado.
- **Publicação:** commit `c29dc84` nas três branches; deploy `dpl_GQe4b6y6m1jeeGDnnF13wE6ZhoBC` (`READY`, alias `https://inove-juris.vercel.app`). Produção inalterada; teste deve passar a mostrar 35.600,00 / 600,00 / 35.000,00.
- **Validação visual:** **concluída e confirmada pelo usuário em 2026-11-20** — ambiente de teste exibindo 35.600,00 / 600,00 / 35.000,00.
- **Rollback:** `git revert c29dc84`; parecer em `C:\InoveTecnologia\InoveJuris-Backups\ENV-20261120\`.

## Ordem cronológica dos lançamentos (2026-11-20)

- **Sintoma:** lançamentos do mesmo dia apareciam embaralhados na lista de Movimentações.
- **Causa:** ordenação apenas por `date` (DATE, sem hora) — todos os lançamentos do dia empatavam e o banco devolvia em ordem arbitrária. O sistema já tem `created_at` (TIMESTAMPTZ) e `id` (IDENTITY); faltava usá-los.
- **Correção:** `.order('date', false).order('created_at', false).order('id', false)` em `app/fluxo-caixa/movimentacoes/page.tsx` e `app/fluxo-caixa/page.tsx`.
- **Nenhuma alteração no banco:** nenhuma tabela, coluna, índice ou dado foi modificado. Índice `(environment, date desc, created_at desc, id desc)` fica apenas como opção futura de desempenho, não executado.
- **Validação:** `tsc` e `build` OK; `tsconfig.tsbuildinfo` restaurado.
- **Publicação:** commit `f016df4` nas três branches; deploy `dpl_H9nD3nV1FXH9vSXVq6aZ9rsKegZT` (`READY`, alias `https://inove-juris.vercel.app`).
- **Validação visual:** **concluída e confirmada pelo usuário em 2026-11-20** — ordem exibida: Corte de Cabelo / Dinho → Pagto Painho Mega Sena → Mega Sena Anderson → Mega Sena de Painho.
- **Rollback:** `git revert f016df4`; parecer e originais em `C:\InoveTecnologia\InoveJuris-Backups\ORDEM-20261120\`.

## Correção — Atalhos derrubavam a sessão no celular (2026-11-20)

- **Sintoma:** os atalhos de acesso rápido da Dashboard funcionavam no desktop, mas no celular qualquer toque encerrava a sessão e voltava para `/login`.
- **Causa:** `components/SessionMonitor.tsx` enviava `close_session` no `pagehide` sempre que `visibilityState === 'hidden'`. No celular, a navegação interna (qualquer `<a href>`) passa por `hidden` antes de descarregar, então o aviso era interpretado como "fechou a aba" e o servidor chamava `app_logout_all_user_sessions`, encerrando **todas** as sessões do usuário.
- **Correção:**
  - listener de clique (fase de captura) marca navegação interna e **não** envia o aviso nesse caso;
  - em aparelhos com ponteiro grosso (celular/tablet) o aviso não é enviado de forma alguma — o `pagehide` também ocorre ao trocar de app/bloquear a tela; vale a tolerância de 90 s do servidor;
  - desktop mantém o comportamento aprovado (fechar aba encerra imediatamente).
- **Atalhos ampliados:** +Publicações (`/publicacoes`), +Prazos (`/prazos`), +Contratos (`/contratos`), respeitando `canAccessPublicacoes`, `canAccessPrazos` e `canAccessContracts`.
- **Sem alteração de banco**, cookies, heartbeat de 20 s, `app_validate_session` ou tolerância de 90 s.
- **Validação:** `tsc` e `build` OK; `tsconfig.tsbuildinfo` restaurado.
- **Publicação:** commit `a2614ca` nas três branches; deploy `dpl_FKeXyhUwAExGPgCFRVMGVc6oF16G` (`READY`, alias `https://inove-juris.vercel.app`).
- **Pendente:** confirmação do usuário no celular.
- **Rollback:** `git revert a2614ca`; originais em `C:\InoveTecnologia\InoveJuris-Backups\MOBILE-20261120\`.

### Ajuste de layout dos atalhos — uma única linha (2026-11-20)

- Os 8 atalhos passaram de `flex-wrap` para grade responsiva (`2 → 3 → 4 → 8` colunas, esta última a partir de `xl`), garantindo **uma só linha** no desktop.
- Cards compactados (ícone 14 px, padding reduzido, texto `text-xs` com truncamento e `title` para o nome completo).
- Ordem mantida, com **Relatórios imediatamente ao lado de Contratos**: Novo Cliente · Novo Processo · Publicações · Prazos · Lançar Receita · Nova Despesa · Contratos · Relatórios.
- **Publicação:** commit `cac3177` nas três branches; deploy `dpl_D1jyC5nQx2cDFaxYvDv9KxEnT3QL` (`READY`, alias `https://inove-juris.vercel.app`).
- **Rollback:** `git revert cac3177`.

## Auditoria de digitação lenta — Fase 1 (2026-11-20)

- **Escopo aprovado pelo usuário:** ganho global (`lib/utils.ts`) + os 2 pontos críticos (`app/contratos/page.tsx`, `app/relatorios/page.tsx`). Fases 2-4 **não aprovadas**.
- **Parecer:** `C:\InoveTecnologia\InoveJuris-Backups\PERF-AUDIT-20261120\PARECER-AUDITORIA-DIGITACAO-20261120.md` (16 pontos mapeados).
- **`lib/utils.ts`:** formatadores `ptBRDateFormatter`, `ptBRTimeFormatter` e `enCAFormatter` no escopo do módulo, reaproveitados por `formatDate`, `formatDateTime`, `getTodayBR` e `getTodayBRString`. Mesmo padrão já usado para `formatCurrency`.
- **`app/contratos/page.tsx`:**
  - `filteredContracts` agora é `useMemo` com `[contracts, productMap, normalizedSearchTerm, filter, sortConfig, nextInstallmentByContract]`;
  - `term` e o mapa de produtos calculados uma vez (antes, `products.find` por contrato);
  - `nextInstallment` pré-calculado em `Map`s memoizados — antes eram 4 `filter().sort()` de parcelas **dentro do comparador de ordenação**, a cada tecla;
  - mantidas as duas variantes de status (3 para ordenação, 4 com `Estornado` para exibição), preservando o comportamento;
  - totais (recebível/recebido/quantidade) agora em `useMemo`;
  - lookup de produto nas três tabelas trocado por `Map`.
- **`app/relatorios/page.tsx`:**
  - `filteredAReceberData` e `reportRows` memoizados; `now` calculado uma vez por filtragem;
  - KPIs de A Receber e GPS agregados em `useMemo` (antes, `new Date()` e `reduce` por render);
  - removido o atraso indexado `index * 0.05` do `motion.tr` (stagger reanimava a tabela).
- **Não alterado:** regras financeiras, RPC de quitação, banco, RLS, autenticação, variáveis de ambiente. `getReportColumns` não foi memoizado de propósito: ele contém handlers de quitação e memoizá-lo poderia capturar closure obsoleta em operação com efeito financeiro.
- **Validação:** `npx tsc --noEmit` e `npm run build` OK; `tsconfig.tsbuildinfo` restaurado.
- **Publicação:** commit `20ab962` nas três branches; deploy `dpl_9wssWT2NUjUpWsbQCkfJuicX6vLZ` (`READY`, alias `https://inove-juris.vercel.app`).
- **Rollback:** `git revert 20ab962`; originais em `C:\InoveTecnologia\InoveJuris-Backups\PERF-AUDIT-20261120\` (`utils.orig.ts`, `contratos-page.orig.tsx`, `relatorios-page.orig.tsx`).
- **Validação do usuário:** **confirmada em 2026-11-20** — Fase 1 aprovada, autorizada a seguir para Fase 2.

## Auditoria de digitação lenta — Fase 2 (2026-11-20)

- **Escopo aprovado pelo usuário:** Clientes, Processos, Indicadores e Auditoria de acesso. Fases 3-4 continuam não aprovadas.
- **`app/clientes/page.tsx`:** `filteredClients` memoizado; `motion.tr` sem stagger indexado; datas e valores das colunas passaram a usar `formatDate`/`formatCurrency` (formatadores globais da Fase 1) em vez de `Intl`/`toLocaleString` por linha.
- **`app/processos/page.tsx`:** `normalizedSearchTerm`, opções de área/status/responsável, `filteredProcesses` e contagens de prazos memoizados. O lookup de advogados por processo passou de `lawyers.find` dentro do filtro para um `Map` pré-construído. As duas contagens passaram a ser calculadas em um único laço.
- **`app/indicadores/page.tsx`:**
  - novos campos de pagamento em `components/indicadores/PaymentFields.tsx`, componente `React.memo` com estado **local** — digitar no valor/descrição não re-renderiza as duas tabelas;
  - máscara de valor usa `Intl.NumberFormat` no escopo do módulo (antes criava um formatador por tecla);
  - `filteredIndicators` memoizado.
  - **Lógica financeira preservada:** mesmo cálculo de `amountPaid`, mesma validação contra o saldo, mesmo payload e mesma RPC/insert em `commission_payments`. O valor e a descrição agora são passados como parâmetros ao confirmar; um contador de reset limpa os campos após pagamento ou troca de indicador.
- **`components/AuditAccessLogs.tsx`:** `filteredLogs` e `filteredFailed` memoizados com um único `now` por filtragem; formatador de data/hora pt-BR compartilhado nas linhas (com proteção contra data inválida). Gráficos e `metrics` já eram memoizados.
- **Não alterado:** banco, RLS, autenticação, variáveis de ambiente, regras financeiras. Nenhum pagamento foi executado.
- **Validação:** `npx tsc --noEmit` e `npm run build` OK; `tsconfig.tsbuildinfo` restaurado.
- **Publicação:** commit `f53e690` nas três branches; deploy `dpl_H5biEvSxQeneKgZXdpbmMcPrFr9y` (`READY`, alias `https://inove-juris.vercel.app`).
- **Rollback:** `git revert f53e690`; originais em `C:\InoveTecnologia\InoveJuris-Backups\PERF-AUDIT-FASE2-20261120\`.
- **Validação do usuário:** **confirmada em 2026-11-20** — Fase 2 aprovada, autorizada a Fase 3.

## Auditoria de digitação lenta — Fase 3 (2026-11-20)

- **Escopo aprovado pelo usuário:** Contas a Receber, Auditoria, Documentos, Leads e Marketing. Fase 4 segue não aprovada.
- **`app/contas-a-receber/page.tsx`:** `SortIcon` saiu do corpo do componente (antes era recriado a cada tecla) e agora recebe `sortConfig` por prop; `getTodayBR()` passou a ser chamado uma vez por render; os quatro KPIs (total, atraso, recebido e a receber) foram unificados em `receivableKpis` memoizado, com as mesmas fórmulas de antes.
- **`app/auditoria/page.tsx`:** `JSON.stringify(log.changed_fields)` e a normalização de acentos passaram a ser feitos uma vez por log em `logsWithSearchFields`; `filteredLogs` memoizado. A busca continua testando os mesmos três campos individualmente (tabela, usuário e campos alterados).
- **`app/documentos/page.tsx`:** os três filtros inline (modelos, clientes e segundo cliente) foram substituídos por listas memoizadas. Os textos de busca e os nomes normalizados são calculados uma vez; digitar em um campo não recomputa os outros dois.
- **`app/leads/page.tsx`:** `counts` (antes seis varreduras) e `filteredLeads` (filtro + ordenação com datas) memoizados. `isLeadAtrasadoOuHoje` virou função de módulo e as datas/flags de atraso são pré-computadas uma vez por lead em `leadTiming`, reaproveitadas pelo filtro, pela ordenação e pelas contagens. Critérios e ordem inalterados.
- **`components/settings/MarketingTab.tsx`:** cards de artes e mensagens extraídos para `TemplateCards`/`MessageCards` (`React.memo`), com `fetchData`, `deleteTemplate` e `deleteMessage` estabilizados por `useCallback`. O editor de mensagem virou `MessageEditor` (`React.memo` + estado local do texto), seguindo o modelo de `PaymentFields`; `saveMessage` agora recebe o texto como parâmetro. **Nenhuma chave de IA, credencial ou dado de pagamento foi alterado.** O editor de arte permanece no pai (depende do preview em tempo real) — ajuste residual para Fase 4.
- **Não alterado:** banco, RLS, autenticação, variáveis de ambiente, regras financeiras, fluxo de pagamento/estorno.
- **Validação:** `npx tsc --noEmit` e `npm run build` OK; `tsconfig.tsbuildinfo` restaurado.
- **Publicação:** commit `f902814` nas três branches; deploy `dpl_EygiPypFuW6HRRHcqGQLPJU3p3Pm` (`READY`, alias `https://inove-juris.vercel.app`).
- **Rollback:** `git revert f902814`; originais em `C:\InoveTecnologia\InoveJuris-Backups\PERF-AUDIT-FASE3-20261120\`.
- **Validação do usuário:** **confirmada em 2026-11-20** — Fase 3 aprovada, autorizada a Fase 4.

## Auditoria de digitação lenta — Fase 4 (2026-11-20) — encerramento

- **Escopo aprovado pelo usuário:** os 5 pontos restantes do parecer. Auditoria encerrada.
- **`components/diseases/DiseaseSelector.tsx`:** a RPC `search_diseases` passou a ser chamada após 300 ms de pausa na digitação, com cancelamento do timer e descarte de respostas antigas. Antes havia uma consulta por tecla.
- **`components/settings/AuditLogsTab.tsx`:** dicionários de tradução e formatador de data/hora levados para o escopo do módulo; campos de busca normalizados uma vez por log; `filteredLogs` memoizado. Mesmos critérios de busca.
- **`app/usuarios/page.tsx`:** `filteredUsers` memoizado com nome/e-mail normalizados uma vez por usuário. **Formulário de permissões mantido intacto no pai** — mexer nesses campos seria alterar regras de acesso, fora do escopo desta correção de performance.
- **`components/publicacoes/PublicationDetail.tsx`:** cabeçalho, metadados e destinatários extraídos para `PublicationSummary` (`React.memo`). Toda a lógica de decisão e criação de prazo permaneceu no componente original — nenhuma confirmação expressa, payload ou regra de prazo foi alterada.
- **`app/fluxo-caixa/movimentacoes/page.tsx`:** os dois gráficos de distribuição viraram `CategoryDistributionChart` (`React.memo`); a visibilidade é passada como booleano estável. Os dados já vinham de `useMemo`. Nenhum valor, filtro ou lançamento foi alterado.
- **`components/settings/MarketingTab.tsx` (residual da Fase 3):** revisado e **mantido sem alteração**. Com o editor de arte aberto a lista de cards não é renderizada e o preview depende do estado do formulário a cada tecla; isolar esse estado mudaria o comportamento do preview. Risco maior que o ganho.
- **Não alterado:** banco, RLS, autenticação, permissões, variáveis de ambiente, chaves de IA, regras de prazo e fluxo financeiro.
- **Validação:** `npx tsc --noEmit` e `npm run build` OK; `tsconfig.tsbuildinfo` restaurado.
- **Publicação:** commit `282b3ad` nas três branches; deploy `dpl_HvVBpU9Esj88cdXePndR26Dgwdb9` (`READY`, alias `https://inove-juris.vercel.app`).
- **Rollback:** `git revert 282b3ad`; originais em `C:\InoveTecnologia\InoveJuris-Backups\PERF-AUDIT-FASE4-20261120\`.
- **Validação do usuário:** **confirmada em 2026-11-20** — Fase 4 aprovada e **auditoria de digitação lenta encerrada**.

## Fechamento de 2026-11-20 — preparação para a próxima sessão

- **Auditoria de digitação lenta:** Fases 1 a 4 executadas, publicadas e validadas pelo usuário. Auditoria **encerrada**; nenhuma fase restante. Parecer mestre em `C:\InoveTecnologia\InoveJuris-Backups\PERF-AUDIT-20261120\PARECER-AUDITORIA-DIGITACAO-20261120.md`.
- **Teste financeiro ponta a ponta:** **realizado com sucesso pelo usuário em 2026-11-20**, com autorização explícita. O agente não executou pagamento nem estorno e não alterou nenhuma regra/código financeiro para o teste. Não precisa ser repetido.
- **Estado publicado:** deploy `dpl_HvVBpU9Esj88cdXePndR26Dgwdb9` (`READY`, alias `https://inove-juris.vercel.app`); `fase0-seguranca`, `main` e `trabalho-com-claude` alinhadas em `c9faaa4`.
- **Única tarefa em aberto:** retomada de **F4b-2c** (substituir as policies `USING (true)` em lotes) e da **chave ECC própria (ES256)**, com a standby `c73f6852-eeca-455d-9549-647afae7e493` ainda bloqueando a importação. Hoje a assinatura segue HS256 (`SUPABASE_JWT_SECRET`) como ponte.
- **Ao solicitar continuidade:** apresentar **uma única decisão** ao usuário — autorizar ou não a retomada de F4b-2c/chave ECC própria. Não iniciar alteração de autenticação, banco, policies ou Permissões sem essa autorização.
- **Fora de escopo por decisão anterior:** implementação de tenant (somente parecer); F3 (depende do Supabase Support); formulário de permissões de Usuários e editor de arte de Marketing (mantidos por segurança/comportamento).
- **Regras que seguem valendo:** heartbeat de 20 s, `app_validate_session` e tolerância de 90 s intactos; scripts SQL executados pelo usuário no SQL Editor; credenciais/tokens/chaves privadas nunca no chat ou em documentos; nomenclatura **Publicações** (nunca "Intimações"); pagamento/estorno com efeito real somente com autorização explícita.
- **Rollbacks da auditoria:** Fase 1 `git revert 20ab962`; Fase 2 `git revert f53e690`; Fase 3 `git revert f902814`; Fase 4 `git revert 282b3ad`. Originais em `C:\InoveTecnologia\InoveJuris-Backups\PERF-AUDIT-FASE1-20261120\`, `PERF-AUDIT-FASE2-20261120\`, `PERF-AUDIT-FASE3-20261120\` e `PERF-AUDIT-FASE4-20261120\`.
- **Não versionado, não alterado:** `docs/RELATORIO-BACKUP-RESTORE-SUPABASE-20261120.md` (documento do próprio usuário, deixado como estava).

## Rotina forense do Fluxo de Caixa — 26/11/2026

- **Diagnóstico:** `docs/DIAGNOSTICO-FLUXO-CAIXA-20261126.sql` e `.md`, executados pelo usuário no SQL Editor às **13:25:28 UTC**, PostgreSQL **17.6**. Resultado: 1.123 transações em `production` (122 no mês), 5 contas divergentes com delta líquido de **-R$ 11.271,90**, 0 divergências em `test`, RLS ativo com policy `P0 sessao`, 0 policies `USING (true)` e views com `security_invoker=on`. `installments.type` é booleano e a RPC `update_account_balance(acc_id, amount_change)` **não existe** — só a trigger function sem argumentos.
- **Aprofundamento:** `docs/APROFUNDAMENTO-FLUXO-CAIXA-20261126.sql` e `.md`, executados pelo usuário às **13:30:53 UTC**. Resultado publicado em `0644289`. Dois achados foram **refutados**: os 9 lançamentos sem conta são registros intencionais ("sem impacto de saldo", "ajuste de conciliação histórica", lote "Outros"), e a parcela 207 está correta (R$ 2.432 de pagamentos menos R$ 1.621 de estorno = R$ 811 de `amountPaid`). As métricas dos dois SQL foram corrigidas para comparar pagamentos menos reversões.
- **Decisões do usuário:** manter **`current_balance`** como fonte de verdade do saldo e reconciliar conta a conta; remover a RPC inexistente e o `UPDATE` manual de saldo em `app/fluxo-caixa/movimentacoes/page.tsx`, deixando `trigger_update_balance` como única escrita; corrigir `vw_cash_flow_forecast` apenas para excluir cancelados e calcular parciais sobre o saldo, **sem excluir `Quitado`** e preservando `Estornado` conforme o item 3.2; manter como histórico as 3 reversões antigas de abril e os 6 duplicados de `test`.
- **Código:** em `app/fluxo-caixa/movimentacoes/page.tsx`, removidas as chamadas a `update_account_balance(acc_id, amount_change)` e os `UPDATE` manuais em `bank_accounts` na inclusão e na exclusão de lançamentos. `npx tsc --noEmit` passou; `tsconfig.tsbuildinfo` restaurado. Nenhuma regra de negócio, autenticação ou variável de ambiente foi alterada.
- **View — pré-medição:** `production` 8 linhas / R$ 31.922,64 → previsto **8 linhas / R$ 30.122,64** (nenhuma cancelada em `production`; só o valor da parcial muda); `test` 3 linhas / R$ 12.350,00 → previsto **2 linhas / R$ 11.000,00**. Parcela 140 (`Parcial`) de R$ 2.700,00 → **R$ 900,00**; parcela 227 (`Estornado`) permanece em **R$ 9.000,00**; parcela 238 (`Cancelada`, contrato cancelado) sai da view. As 2 quitadas de `production` e a de `test` permanecem.
- **Artefatos:** `docs/FORWARD-VW-CASH-FLOW-FORECAST-20261126.sql`, `docs/VERIFY-VW-CASH-FLOW-FORECAST-20261126.sql` e `docs/ROLLBACK-VW-CASH-FLOW-FORECAST-20261126.sql`. O usuário executou o forward e o verify no SQL Editor; o agente não executa banco sem autorização explícita. Nenhum dado de negócio foi alterado.
- **Resultado do verify (13:42:07 UTC, PostgreSQL 17.6):** estrutura toda conforme — `view_existe`, `security_invoker_on`, `colunas_ok`, `anon_select`, `authenticated_select` e `usa_saldo_nas_parciais` = `true`. `production`: **8 linhas / R$ 30.122,64** (2 quitadas, 0 canceladas, 0 estornadas); `test`: **2 linhas / R$ 11.000,00** (1 quitada, 1 estornada, 0 canceladas). Parcela 140 = **R$ 900,00**, parcela 227 = **R$ 9.000,00** e parcela 238 **ausente**. A contagem de 7 linhas inicialmente prevista no script estava errada: a medição prévia já apontava 8 linhas em `production` (1 Parcial + 5 Prorrogadas + 2 Quitadas) e a única cancelada estava em `test`. Corrigida a expectativa nos scripts; **não houve divergência real nem rollback**.
- **Commits desta entrega:** `9c089e8` (código do front + três scripts), `0b09485` (hash no STATUS), `a3ca390` (contagem esperada e resultado do verify), todos publicados em `main`. Rollback do código: `git revert 9c089e8`; rollback da view: `docs/ROLLBACK-VW-CASH-FLOW-FORECAST-20261126.sql`. Nenhum rollback foi acionado.
- **Deploy em Production:** a integração Git do Vercel promoveu automaticamente o commit final. Deploy **`dpl_4ZWWAb3CLp49HuErphsZNkYLy3qo`** (`READY`, criado em 26/11 às 10:43:20), alias `https://inove-juris.vercel.app`. A API confirma `githubCommitSha=a3ca390e8c0a026f8cc931e5425c4739a16d14a9`, `ref=main`. Não foi criado deploy redundante. `npm run build` local OK e `tsconfig.tsbuildinfo` restaurado.
- **Checagem HTTP do alias:** `/login` → **200**; `/` → **307**; `/fluxo-caixa/movimentacoes` → **307** sem cookie. Nenhuma credencial foi manuseada.
- **Rollback de deploy:** promover **`dpl_5BBYQfEocqQwg39abxgSYCP7uK1Z`** (commit `0644289`, último antes da alteração de código) e, se necessário, `git revert 9c089e8`. O deploy imediatamente anterior (`dpl_Ho6QFDbxa1W7C4bvT64UnGHuV1FG`, commit `0b09485`) já continha a correção de código e só serve para reverter a documentação do verify. Rollback da view continua em `docs/ROLLBACK-VW-CASH-FLOW-FORECAST-20261126.sql`.
