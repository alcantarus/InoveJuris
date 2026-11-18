# Retomada da sessão — 2026-11-18

Documento único para retomar o trabalho após desligar o computador. Tudo o que é relevante está também em `docs/STATUS-INOVEJURIS.md`, `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md` e `docs/PLANO-MELHORIAS-INOVEJURIS.md`.

## 1. Situação atual — produção íntegra

| Item | Estado |
|---|---|
| Deploy de produção | `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i` — `target: production`, status **Ready**, alias `https://inove-juris.vercel.app` |
| Verificação HTTP em produção | `/`, `/documentos` e `/publicacoes` retornaram `200` com sessão de teste |
| Código da F6a em produção? | **Sim.** Publicado no deploy `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i` |
| `SUPABASE_SERVICE_ROLE_KEY` em Production? | **Sim.** Secret com a chave nova `sb_secret_...` (Preview segue com a legada) |
| Alteração em buckets/policies/objetos do Storage? | **Sim (F6b):** 3 buckets passaram a privados e as 17 policies foram removidas. Nenhum objeto foi apagado |
| Git | `7aa540e`, branch `trabalho-com-claude`. Os documentos atualizados nesta sessão ainda não foram comitados — o `git` não está disponível no PATH deste ambiente |

**Conclusão operacional:** o sistema de produção pode ser usado normalmente — lançar contratos, receber títulos, acessar Publicações, etc. Os downloads passam pelo proxy assinado no servidor; a leitura em `/`, `/documentos` e `/publicacoes` foi confirmada. Falta apenas a validação manual dos fluxos de upload/remoção e das telas que exibem DOCX/imagens.

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

## 3. Preview da F6a

- Deploy: `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU`
- URL: `https://inove-juris-9nni894w2-alcantarus-projects.vercel.app`
- Protegido por `vercel_authentication` — usar `npx vercel curl`
- **Não promovido a produção**
- `SUPABASE_SERVICE_ROLE_KEY` adicionada como **Secret somente no Preview**, usando a chave `service_role` atual. Production e Development continuam sem ela.
- Chave validada localmente: URL assinada gerada com sucesso para `templates/1772776048729_clients.docx` (`signed_url_ok=true`).
- Validação negativa no preview: as três rotas retornam `307 → /login` sem cookie.

## 4. Validação positiva — concluída em 2026-11-18

Os três testes foram executados com cookie de sessão de teste, primeiro no preview e depois em produção (já com buckets privados). Resultado: A e C devolveram JSON com `signedUrl` e `expiresIn: 3600`; B devolveu `302` com `Location` para a URL assinada. Os comandos abaixo ficam apenas como referência — `app_env` vale `production` e `session_id` é o UUID da sessão. O deploy de produção a ser usado como referência é `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i`.

**Atenção ao `vercel curl`:** os parâmetros do curl precisam vir depois de `--`; sem isso, o CLI cria arquivos espúrios (`-w`, `--max-time`).

### Teste A — assinatura em `templates`

```powershell
npx vercel curl "/api/storage/signed-url?bucket=templates&path=1772776048729_clients.docx" --deployment dpl_DhMwQBT242d2HNL6eEcAPLCioAbU -- --cookie "session_id=SESSION_ID; app_env=APP_ENV" --silent --show-error
```

Esperado: JSON com `signedUrl` e `expiresIn: 3600`. `503` = service role não visível no deploy; `307`/`401` = sessão inválida.

### Teste B — redirecionamento

```powershell
npx vercel curl "/api/storage/signed-url?bucket=templates&path=1772776048729_clients.docx&redirect=1" --deployment dpl_DhMwQBT242d2HNL6eEcAPLCioAbU -- --cookie "session_id=SESSION_ID; app_env=APP_ENV" --silent --show-error --include
```

Esperado: `HTTP/2 302` com `location: https://.../storage/v1/object/sign/templates/...`

### Teste C — assinatura em `marketing`

```powershell
npx vercel curl "/api/storage/signed-url?bucket=marketing&path=templates%2F0.025508762559267928.png" --deployment dpl_DhMwQBT242d2HNL6eEcAPLCioAbU -- --cookie "session_id=SESSION_ID; app_env=APP_ENV" --silent --show-error
```

Esperado: mesmo JSON do Teste A.

Outras opções que estavam na mesa caso o usuário mude de ideia: passar os cookies para o agente, fornecer credenciais de conta de teste (não real) ou autorizar criação de sessão temporária via service_role com rollback.

## 5. Decisões pendentes

1. **F6b — concluída.** Secret replicada em Production (chave nova `sb_secret_...`), código publicado em `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i` e `forward_f6.sql` aplicado pelo SQL Editor do Supabase. Estado: 0 buckets públicos, 0 policies. Falta a validação manual dos fluxos de upload/remoção e das telas. Rollback: `rollback_f6.sql` + `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` + `vercel env rm SUPABASE_SERVICE_ROLE_KEY production`.
2. **F6c (aftercare)** — backfill de `storage_path` e limpeza de órfãos; URLs antigas `/object/public/...` continuam gravadas em `client_documents.file_url`, `document_templates.file_url` e `birthday_templates.image_url`. A leitura passa pelo proxy assinado e, com os buckets já privados, **não há mais fallback**: qualquer falha da rota afeta imediatamente imagens e DOCX.
3. **F3** — 17 funções `http`/`urlencode` ainda executáveis por `anon`/`authenticated`; são de `supabase_admin` e `postgres` não é superuser. Usuário escolheu Supabase Support. Pacote em `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\SUPPORT-REQUEST.md` + `support_http_revoke.sql`. Chamado ainda não aberto.
4. **F1 rotação** — depende de novas chaves: `GEMINI_API_KEY`, chave DataJud, token do `pg_cron`, nova senha do pooler e revogação do token antigo da Vercel. A chave `service_role` legada apareceu no output da CLI do Supabase e deve ser considerada exposta.
5. **F2 validação positiva** com administrador real em staging/preview.
6. **F4b** — depende de decidir identidade no banco (JWT Supabase Auth, RPCs `SECURITY DEFINER` ou GUC derivado da sessão) e modelo de tenant. Pré-requisito: parecer `docs/PARECER-TENANT-INOVEJURIS.md`.
7. **F7** — headers/CSP em report-only. **F8** — confirmar em staging se a correção do Next cabe em 15.x ou exige 16.x. Sem MFA nesta rodada.

## 6. Restrições que permanecem

- Nome obrigatório **Publicações**, nunca “Intimações”.
- Parecer técnico antes de qualquer modificação.
- Sistema não pode ficar parado; correção gradual, backup antes, validação entre fatias.
- Nenhuma implementação de tenant autorizada — apenas parecer.
- Correções de segurança já em produção: F3 (`exec_sql` revogado), F4a, F5 e agora F6a/F6b. Deploy atual: `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i`.
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
| F5 | `C:\InoveTecnologia\InoveJuris-Backups\F5-20261118\` |
| F4a | `C:\InoveTecnologia\InoveJuris-Backups\F4-20261118\` |
| F3 | `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\` |
| F0 | PITR `2026-11-18 18:01:02.49299+00` |

## 8. Retomada em resumo

1. Abrir este documento, `docs/STATUS-INOVEJURIS.md` e as seções 12.9/12.10 do parecer de impacto.
2. Confirmar que a produção está em `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i` e que os buckets estão privados.
3. Fazer a validação manual dos fluxos de upload/remoção e das telas (DOCX, marketing, cartões de aniversário).
4. Comitar os documentos atualizados nesta sessão (o `git` precisa ser disponibilizado no PATH).
5. Seguir a fila da seção 5, começando pela F6c e pelo chamado F3.

Nada precisa ser feito antes de desligar o computador: código, documentação e deploy de preview já estão salvos no GitHub e no Vercel.
