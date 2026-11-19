# Retomada da sessão — 2026-11-18

Documento único para retomar o trabalho após desligar o computador. Tudo o que é relevante está também em `docs/STATUS-INOVEJURIS.md`, `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md` e `docs/PLANO-MELHORIAS-INOVEJURIS.md`.

> **INCIDENTE RESOLVIDO (2026-11-19):** o Postgres do Supabase havia ficado inacessível por esgotamento do burst de I/O (baseline de 5 MB/s), com `504`/`57014` no login e `Connection terminated due to connection timeout` no SQL Editor. O usuário rodou `select 1;` e obteve `1`; REST, RPC `app_authenticate` e a rota `/api/auth/session` voltaram a responder (seção 13.8 do parecer de impacto). **Nenhum deploy foi revertido e nenhuma sessão artificial foi criada.** Mantém-se a recomendação de reduzir o tráfego/balance do disco para não recorrer.

## 1. Situação atual — produção íntegra

| Item | Estado |
|---|---|
| Deploy de produção | `dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC` — `target: production`, status **Ready**, alias `https://inove-juris.vercel.app` (Fase 1A) |
| Deploy de preview | `dpl_4HU25Fp4t6oJYo9vj5UsoJsECC6h` (Fase 1A) |
| Verificação HTTP nos dois ambientes | Rotas `/`, `/documentos`, `/publicacoes`, `/configuracoes`, `/relatorios` e `/fluxo-caixa` → `307` sem cookie (redirect de login), conforme esperado |
| Views separadas por ambiente? | **Sim (F7-VIEWS).** `environment` exposto nas 5 views do dashboard; Proxy filtra todas as tabelas/views, sem lista de exceções |
| Código da F6a em produção? | **Sim.** Publicado no deploy `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj` |
| Chaves do Supabase nos dois ambientes? | **Sim.** anon key `sb_publishable_...` e service role `sb_secret_...` em Preview e Production; chaves legadas **desativadas** |
| Alteração em buckets/policies/objetos do Storage? | **Sim (F6b):** 3 buckets passaram a privados e as 17 policies foram removidas. Nenhum objeto foi apagado |
| Git | Git 2.56 instalado via winget (executável em `C:\Program Files\Git\cmd\git.exe`); branch `trabalho-com-claude`; HEAD em `git log -1` |

**Conclusão operacional anterior ao incidente de 2026-11-19:** o sistema de produção vinha sendo usado normalmente — lançar contratos, receber títulos, acessar Publicações, etc. Os downloads passam pelo proxy assinado no servidor. Os KPIs separam `production` de `test` na origem (views), sem misturar dados. **Desde 19/11 o acesso está bloqueado pelo banco** (ver alerta no topo e seção 10); falta a validação manual dos fluxos de upload/remoção e das telas que exibem DOCX/imagens assim que o banco voltar.

## 2. O que já foi entregue

| Fatia | Resultado | Commit / deploy |
|---|---|---|
| Camada A | Concluída | `9dc7827`, docs `91ea89e`, deploy `dpl_8FnNJ22Za6efpojF5gNqP5vxentp` |
| Logout global | Concluído | migration `20261118170000_session_close_all_devices.sql`, `119e1e1`, deploy `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` |
| Parecer de multitenancy | Concluído, sem implementação | `f89ba67` — `docs/PARECER-TENANT-INOVEJURIS.md` |
| Parecer de impacto | Concluído | `878fd03` — `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md` |
| F0 — backup | PITR `2026-11-18 18:01:02.49299+00`, tag `pre-security-fix-f0-20261118`, 58 tabelas/3.806 linhas, rollback de 261 policies e 930 grants | `47828fe` |
| F1 — segredos | Só preparação do código; chaves **não** rotacionadas | `107fe98` |
| F2 — rotas administrativas | Protegidas por sessão/admin no servidor | `e4f902e` |
| F3 — `exec_sql` | Revogado de `PUBLIC`/`anon`/`authenticated`; 17 funções `http` pendentes (Supabase Support) | `c616b25`, pacote `5cdde92` |
| F4a — grants | 67 `REVOKE TRUNCATE, REFERENCES, TRIGGER`; 402 → 0 linhas sensíveis; CRUD inalterado | `b1d5687` |
| F5 — views | 9 views com `security_invoker=on`; 9/4 → 0/13; 48 medições de KPI idênticas | `b8d7ba9` |
| F6 — parecer | Escrito, sem alteração de banco | `27c2c49` |
| F6a — código | Rotas servidor de storage + ajuste de 4 consumidores | `eec6d1f`, `7e881b0` |
| F6a — docs do preview | Registro do deploy e da chave | `6e752f5`, `7aa540e` |
| F6a — validação positiva | Testes A/B/C no preview e em produção | seção 12.9 do parecer |
| F6b — virada do storage | Chave em Production, deploy, buckets privados e 0 policies | `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i`, seção 12.10 do parecer |
| Ponto 2 — unificar chaves | Publishable + secreta em Preview e Production, com redeploy e validação | `dpl_DVUkHA4hhKzni8ENe62i8wvsM65w`, `dpl_7PA9Yead2KsQSNhjAf1dhULMap7s`, seção 12.11 do parecer |
| Desativação das legadas + chave fixa | Legadas desativadas; `defaultKeyProd` passou a ler env; A/B/C revalidados com cookie fresco | `dpl_5qvCZ4fmEzYkcjrXugZRBFSJBEUo`, `dpl_HoAt2kNRiBweZS9itN7kUipzBYor`, seções 12.12/12.13 |
| Cache/chave custom legada | Chaves legadas no `localStorage` ignoradas e removidas; hard reload necessário no navegador | `dpl_2vB2eVQRtA4Qm5YrhR2Uz1MaNLU2`, `dpl_4f7xJnTzyjcQu8k7TLvgzhMRRGAP`, seção 12.14 |
| Views do dashboard (42703) | Proxy isenta views sem `environment`; select de `vw_process_velocity` corrigido | `dpl_2i4To1n9zycciTw2cuVLuB6yjwvL`, `dpl_HeKYexkBYyaELZR2DN46femm2YHK`, seção 12.15 |
| F7-VIEWS — separação por ambiente | `environment` acrescentado às 5 views; fim da exceção no Proxy | `dpl_DykQeTzCcRQ3yhhYQ8G3qooATE4Y`, `dpl_GFvFohoh2piXQqNVTYLeNzVMPkFR`, seção 12.16 |
| Limpeza do console | Logs de debug, consultas duplicadas, 19 gráficos e fontes tratados | `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj`, `dpl_AWWbfXvcZNSJaqQcz1bygGfZ5otY`, seção 12.17 |

## 3. Preview da F6a

- Deploy: `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU`
- URL: `https://inove-juris-9nni894w2-alcantarus-projects.vercel.app`
- Protegido por `vercel_authentication` — usar `npx vercel curl`
- **Não promovido a produção**
- `SUPABASE_SERVICE_ROLE_KEY` adicionada como **Secret somente no Preview**, usando a chave `service_role` atual. Production e Development continuam sem ela.
- Chave validada localmente: URL assinada gerada com sucesso para `templates/1772776048729_clients.docx` (`signed_url_ok=true`).
- Validação negativa no preview: as três rotas retornam `307 → /login` sem cookie.

## 4. Validação positiva — concluída em 2026-11-18

Os três testes foram executados com cookie de sessão de teste, primeiro no preview e depois em produção (já com buckets privados). Resultado: A e C devolveram JSON com `signedUrl` e `expiresIn: 3600`; B devolveu `302` com `Location` para a URL assinada. Os comandos abaixo ficam apenas como referência — `app_env` vale `production` e `session_id` é o UUID da sessão. **Os deploys de referência atuais são `dpl_4HU25Fp4t6oJYo9vj5UsoJsECC6h` (preview) e `dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC` (produção).**

**Atenção ao `vercel curl`:** os parâmetros do curl precisam vir depois de `--`; sem isso, o CLI cria arquivos espúrios (`-w`, `--max-time`).

**Atenção ao cookie:** a sessão de teste expira após **90 segundos** sem heartbeat. Um cookie obtido para a validação anterior já expirou; A/B/C com o cookie velho retornam `401`, o que **não** indica regressão. Obter cookie fresco no Firefox (`F12 → Storage → Cookies → inove-juris.vercel.app`) e executar A/B/C em sequência.

### Teste A — assinatura em `templates`

```powershell
npx vercel curl "/api/storage/signed-url?bucket=templates&path=1772776048729_clients.docx" --deployment dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC -- --cookie "session_id=SESSION_ID; app_env=APP_ENV" --silent --show-error
```

Esperado: JSON com `signedUrl` e `expiresIn: 3600`. `503` = service role não visível no deploy; `307`/`401` = sessão inválida.

### Teste B — redirecionamento

```powershell
npx vercel curl "/api/storage/signed-url?bucket=templates&path=1772776048729_clients.docx&redirect=1" --deployment dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC -- --cookie "session_id=SESSION_ID; app_env=APP_ENV" --silent --show-error --include
```

Esperado: `HTTP/2 302` com `location: https://.../storage/v1/object/sign/templates/...`

### Teste C — assinatura em `marketing`

```powershell
npx vercel curl "/api/storage/signed-url?bucket=marketing&path=templates%2F0.025508762559267928.png" --deployment dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC -- --cookie "session_id=SESSION_ID; app_env=APP_ENV" --silent --show-error
```

Esperado: mesmo JSON do Teste A.

Outras opções que estavam na mesa caso o usuário mude de ideia: passar os cookies para o agente, fornecer credenciais de conta de teste (não real) ou autorizar criação de sessão temporária via service_role com rollback.

## 5. Decisões pendentes

1. **F6b — concluída.** Secret replicada em Production (chave nova `sb_secret_...`), código publicado em `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i` e `forward_f6.sql` aplicado pelo SQL Editor do Supabase. Estado: 0 buckets públicos, 0 policies. Falta a validação manual dos fluxos de upload/remoção e das telas. Rollback: `rollback_f6.sql` + `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` + `vercel env rm SUPABASE_SERVICE_ROLE_KEY production`.
2. **F6c (aftercare)** — backfill de `storage_path` e limpeza de órfãos; URLs antigas `/object/public/...` continuam gravadas em `client_documents.file_url`, `document_templates.file_url` e `birthday_templates.image_url`. A leitura passa pelo proxy assinado e, com os buckets já privados, **não há mais fallback**: qualquer falha da rota afeta imediatamente imagens e DOCX.
3. **F3** — 17 funções `http`/`urlencode` ainda executáveis por `anon`/`authenticated`; são de `supabase_admin` e `postgres` não é superuser. Usuário escolheu Supabase Support. Pacote em `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\SUPPORT-REQUEST.md` + `support_http_revoke.sql`. Chamado ainda não aberto.
4. **F1 rotação — em andamento.** O Ponto 2 já substituiu o anon key e a service role nos dois ambientes (12.11) e as chaves legadas foram **desativadas** (12.12). Também foi removida a chave legada fixa em `lib/supabase.ts` (12.13). Falta: fornecer `GEMINI_API_KEY`, chave DataJud, token do `pg_cron`, nova senha do pooler, revogar o token antigo da Vercel e limpar os scripts avulsos com chave fixa.
5. **F2 validação positiva** com administrador real em staging/preview.
6. **F4b** — depende de decidir identidade no banco (JWT Supabase Auth, RPCs `SECURITY DEFINER` ou GUC derivado da sessão) e modelo de tenant. Pré-requisito: parecer `docs/PARECER-TENANT-INOVEJURIS.md`.
7. **F7 (headers/CSP)** — headers/CSP em report-only. **F8** — confirmar em staging se a correção do Next cabe em 15.x ou exige 16.x. Sem MFA nesta rodada. Obs.: a fatia de views concluída foi registrada como `F7-VIEWS-20261118` no diretório de backups e é **distinta** deste F7 de headers.
8. **Monitoramento do `pg_cron`:** verificar o job 5 no próximo disparo (~`03:00 UTC`). Baseline: `succeeded` em `2026-11-18 03:00 UTC`. O token usado é da API DataJud, não chave do Supabase.

## 6. Restrições que permanecem

- Nome obrigatório **Publicações**, nunca “Intimações”.
- Parecer técnico antes de qualquer modificação.
- Sistema não pode ficar parado; correção gradual, backup antes, validação entre fatias.
- Nenhuma implementação de tenant autorizada — apenas parecer.
- Correções de segurança já em produção: F3 (`exec_sql` revogado), F4a, F5, F6a/F6b, chaves novas do Supabase (Ponto 2), remoção da chave legada fixa do código, bloqueio de chaves legadas no `localStorage`, correção dos erros `42703`, **F7-VIEWS (separação por `environment`) e limpeza do console**. Chaves legadas desativadas. Deploy atual: `dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC` (Fase 1A).
- Não usar sessão de usuário real nem criar sessão artificial sem autorização.
- Usuários reais preservados: `1`, `2`, `23`, `65`, `73`. Usuário `73` (`marcos@gmail.com`) não deve ser removido.
- `public.users` possui `canAccessReceivables` e `canaccessreceivables` (diferem só por caixa).
- `role_name` continua `null`; superadmin com flags forçadas para `true`.

## 7. Rollbacks disponíveis

| Item | Comando / artefato |
|---|---|
| Chave no Preview | `npx vercel env rm SUPABASE_SERVICE_ROLE_KEY preview` |
| Deploy do preview | descartar `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU` |
| F6b (aplicada) | `C:\InoveTecnologia\InoveJuris-Backups\F6-20261118\rollback_f6.sql` + promover `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` + `npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production` |
| Ponto 2 (aplicado) | Promover `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i` (Production) e `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU` (Preview); variáveis não voltam automaticamente, mas as chaves novas estão validadas |
| F5 | `C:\InoveTecnologia\InoveJuris-Backups\F5-20261118\` |
| F7-VIEWS | `C:\InoveTecnologia\InoveJuris-Backups\F7-VIEWS-20261118\rollback_f7.sql` + promover `dpl_2i4To1n9zycciTw2cuVLuB6yjwvL` (Production) / `dpl_HeKYexkBYyaELZR2DN46femm2YHK` (Preview) |
| Limpeza do console | Promover `dpl_DykQeTzCcRQ3yhhYQ8G3qooATE4Y` (Production) / `dpl_GFvFohoh2piXQqNVTYLeNzVMPkFR` (Preview) |
| F4a | `C:\InoveTecnologia\InoveJuris-Backups\F4-20261118\` |
| F3 | `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\` |
| F0 | PITR `2026-11-18 18:01:02.49299+00` |

## 8. Retomada em resumo

1. Abrir este documento, `docs/STATUS-INOVEJURIS.md` e as seções 12.16/12.17 do parecer de impacto.
2. Confirmar que a produção está em `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj`, que os buckets estão privados e que as 5 views expõem `environment`.
3. Obter cookie de teste **fresco** e repetir A/B/C (o anterior expirou pela regra de 90 s).
4. Fazer a validação manual dos fluxos de upload/remoção e das telas (DOCX, marketing, cartões de aniversário) e conferir o console no navegador com `Ctrl+Shift+R`.
5. Concluir a rotação F1 restante (novas credenciais, token antigo da Vercel e scripts avulsos com chave fixa).
6. Registrar novas entregas nos documentos e comitar/push (Git já instalado em `C:\Program Files\Git\cmd\git.exe`).
7. Seguir a fila da seção 5, começando pela F6c e pelo chamado F3.

## 9. F7-VIEWS e limpeza do console — detalhes

- **F7-VIEWS:** `create or replace view` nas 5 views do dashboard, acrescentando `environment` como última coluna e mantendo `security_invoker=on`. `vw_area_efficiency` passou a agrupar por área **e** ambiente; `vw_client_process_summary` passou a exigir o mesmo `environment` no join. SQL aplicado pelo usuário no SQL Editor (a `service_role` não é owner das views).
- Contagens production/test: `process_sync_status` 19/2, `vw_area_efficiency` 4/3, `vw_cash_flow_forecast` 10/0, `vw_client_process_summary` 107/6, `vw_process_velocity` 19/2.
- `lib/supabase.ts`: lista `VIEWS_SEM_ENVIRONMENT` removida — uma regra única para todas as tabelas/views.
- **Console:** logs de debug removidos; 3 consultas duplicadas em `app/page.tsx` eliminadas; `minWidth={0} minHeight={0}` nos 19 `ResponsiveContainer`; `Inter` removido e `JetBrains_Mono`/`Playfair_Display` sem preload.
- `npm run build`: **OK** (25 páginas). `.next/static`: 0 arquivos com chave legada e 0 com os textos de debug.
- `__cf_bm` (Cloudflare) e a falha de websocket (Supabase Realtime) são externos ao código do app e não afetam dados.

Nada precisa ser feito antes de desligar o computador: código, documentação e deploys já estão salvos no GitHub e no Vercel.

> **Atualização 19/11:** o banco voltou (`select 1` → `1`); REST, RPC de login e rota `/api/auth/session` respondendo. Restam: login com conta de teste no navegador, A/B/C com cookie fresco e conferência visual do console. Ver seção 13.8 do parecer de impacto.
>
> **Levantamento de I/O (seção 13.9):** `check_database_orphans()` via REST retornou 0 órfãos em 8 FKs; `get_db_size` via anon deu 404. Script **somente leitura** pronto em `C:\InoveTecnologia\InoveJuris-Backups\AUDITORIA-IO-20261119\diagnostico_readonly.sql` — executar no SQL Editor e enviar o resultado antes de qualquer mudança. Não mexer no heartbeat de 20 s nem criar acesso alternativo.

## 10. Incidente de acesso e decisão de banco (2026-11-19)

### Passo 0 — antes de retomar qualquer item desta retomada

1. Parar tentativas de login e **manter o app fechado por algumas horas** — 10–15 min servem só como primeiro teste. O saldo de I/O se reconstrói continuamente enquanto a demanda fica em ou abaixo de 5 MB/s; o prazo real depende de quanto foi consumido (seção 13.7 do parecer de impacto).
2. Rodar `select 1;` em https://supabase.com/dashboard/project/jhlxzqsgmudkbjkynqdl/sql/new
3. Se responder: repetir REST simples, rota de login, testes A/B/C com **cookie fresco** e conferência visual do console (`Ctrl+Shift+R`).
4. Se não responder: **upgrade de compute** no Supabase ou **Help → Support** com o erro do SQL Editor, `57014`, `504`, o project ref e a mensagem de esgotamento de burst. Não há token de gestão do Supabase neste ambiente para reiniciar o projeto por API.

### O que foi apurado

- O fluxo de login (`app/login/page.tsx` → `lib/auth.ts` → `POST /api/auth/session` → RPC `app_authenticate`) **não foi tocado** na F7-VIEWS nem na limpeza do console.
- Teste A/B controlado: deploy anterior e deploy atual falham **identicamente** na rota de login (`TIMEOUT`). O alias voltou para `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj`; **nenhum rollback foi mantido**.
- Erros: `504 upstream request timeout` (RPC de login), `57014 canceling statement due to statement timeout` (settings), timeout em REST/SQL Editor, `Connection terminated due to connection timeout` (SQL Editor). Chave inválida de propósito retorna `401` em 0 s — a chave correta está válida; o Postgres é que não responde.
- Causa: mensagem do Supabase confirmando esgotamento do orçamento de I/O e queda para o baseline de 5 MB/s. Réplicas/replicação externa são Pro/Team/Enterprise.
- Não foi criado login emergencial, backdoor nem alterado o heartbeat de 20 s (tolerância de 90 s faz parte do controle de sessão).

### Decisão de banco (parecer registrado, sem implementação)

| Opção | Veredito |
|---|---|
| Otimizar dentro do Supabase (14 consultas da dashboard, 5+ canais Realtime, settings no mount, views F7, índices; heartbeat 20 s → 60 s **somente com autorização**) | **Recomendado agora — free e zero migração** |
| Upgrade de compute no Supabase | Plano B pago (a partir de US$ 25/mês — Micro exige Pro), minutos, sem risco de migração |
| Nhost Free (Postgres + Hasura GraphQL + Auth + Storage; 1 GB DB/1 GB storage/5 GB egress) | Substituto gerenciado mais fiel; exige reescrever ~40 pontos de `supabase-js` e o Proxy de `environment` |
| Appwrite Free (MariaDB) | Descartado — funções plpgsql/views/RLS não portam |
| Neon Free (1 GB, 100 CU-h, 2 CU, 10 branches) | Melhor "só Postgres", mas sem PostgREST/Storage/Realtime; heartbeat de 20 s esgotaria os CU-hours em ~4 dias |
| Supabase self-host em Oracle Always Free (2 OCPU/12 GB, região São Paulo) | Paridade total e disco próprio; custo é operar backup/TLS/upgrades/disponibilidade |
| Firebase / PlanetScale / Cockroach | Descartados (NoSQL / sem free / sem plpgsql-RLS equivalente) |

**Posição:** trocar de provedor sem corrigir o padrão de acesso só troca o formato do limite. Seguir Fase 1 (otimização) → Fase 2 (compute) → Fase 3 (só então POC de migração em paralelo, sem cortar produção). Documentação completa: seções 13 e 14 de `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md` e seção "Incidente de acesso e decisão de banco" de `docs/STATUS-INOVEJURIS.md`.

Backup dos documentos antes desta atualização: `C:\InoveTecnologia\InoveJuris-Backups\DOCS-20261119\`.

## 11. Fase 1A — autorizada e em execução (2026-11-19)

**Usuário autorizou os itens 1 a 5, um de cada vez, com backup e rollback. Optou por não mexer na Fase 1B** — heartbeat de 20 s, `app_validate_session` e a tolerância de 90 s seguem intactos. Nenhuma chave, cookie, sessão artificial ou acesso alternativo foi criado.

### Já feito

- Itens 1–3 no commit `8cdf51e` (pushed): `lib/birthdays.ts` com cache de 5 min e dedupe (6 → 3 consultas de aniversariantes); 5 canais Realtime do dashboard → 1 canal com 5 listeners; dedupe de `fetchSettings` no `SettingsProvider` (com `force=true` no Realtime e no rollback).
- `npx tsc --noEmit` e `npm run build`: **OK**. Ponto de restauração: `5014dee`; rollback: `git revert 8cdf51e`.
- Scripts prontos para os itens 4–5 em `C:\InoveTecnologia\InoveJuris-Backups\AUDITORIA-IO-20261119\`: `forward_otim1_index_audit_logs.sql`, `rollback_otim1_index_audit_logs.sql`, `forward_otim2_analyze.sql`.

### Item 4 concluído (2026-11-19)

- Usuário executou `forward_otim1_index_audit_logs.sql` no SQL Editor: `Index Scan using idx_audit_logs_env_performed_at`, `Index Cond: (environment = 'production')`, 4 buffers, **Execution Time: 0,766 ms** (linha de base: 133,32 ms). Rollback: `rollback_otim1_index_audit_logs.sql`.

### Item 5 concluído (2026-11-19)

- Usuário executou o bloco `DO $$` de `forward_otim2_analyze.sql`: `last_analyze = 2026-11-19 09:38:11 UTC`; `n_live_tup`: `audit_logs` 2.248, `clients` 113, `publications` 56, `system_settings` 11 (antes 57/0/0/0). Nenhum dado alterado, sem rollback.

### Próximo passo (nesta ordem)

1. ~~Medição limpa~~ **concluída:** `stats_reset = 09:57:07.940908`, ~10 min de uso, `queries_app.sql` recebido e comparado na seção 13.16. Resultado: `audit_logs` 9,76 ms (era 133,32), cache 99,979%, `app_validate_session` 59,48 ms e `realtime.list_changes` 8,28 s agregados seguem como alvos reais. A medição anterior (13.14) ficou contaminada com `stats_reset` 03:32.
2. Publicar o código (deploy de Preview e Production), testar login com **conta de teste**, repetir A/B/C com **cookie fresco** e conferir o console com `Ctrl+Shift+R`.
3. **Parecer `audit_logs` (seção 13.15):** usuário pediu otimização/avaliação. Nada implementado. Executar `analise_audit_logs.sql` (read-only) e enviar as saídas para confirmar se `user_sessions` gera ruído de heartbeat e de onde vêm as linhas. Só depois propor mudança com forward/rollback e autorização explícita. Script reescrito em **UM único SELECT** (coluna `secao`) porque o SQL Editor do Supabase devolve só o último resultado de um script com vários comandos — a 1ª versão entregou apenas a seção 5 (`production` 2.278 / `test` 119 / total 2.397).
4. Observar `Disk IO Balance` nas horas seguintes e atualizar os três documentos com os resultados.

Se qualquer passo falhar: `rollback_otim1_index_audit_logs.sql` para o índice e `git revert 8cdf51e` para o código. Nenhum desses passos altera autenticação.
