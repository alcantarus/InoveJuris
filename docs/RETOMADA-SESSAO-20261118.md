# Retomada da sessão — 2026-11-18

Documento único para retomar o trabalho após desligar o computador. Tudo o que é relevante está também em `docs/STATUS-INOVEJURIS.md`, `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md` e `docs/PLANO-MELHORIAS-INOVEJURIS.md`.

## 1. Situação atual — produção íntegra

| Item | Estado |
|---|---|
| Deploy de produção | `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` — `target: production`, status **Ready**, alias `https://inove-juris.vercel.app` |
| Verificação HTTP em produção | `GET /` sem cookie → `307 → /login` (resposta normal da aplicação) |
| Código da F6a em produção? | **Não.** Está apenas no repositório e em um deploy de **preview** |
| `SUPABASE_SERVICE_ROLE_KEY` em Production? | **Não.** Existe somente no Preview, como Secret |
| Alteração em buckets/policies/objetos do Storage? | **Nenhuma** |
| Git | `7aa540e`, branch `trabalho-com-claude`, árvore limpa, pushed no GitHub |

**Conclusão operacional:** o sistema de produção pode ser usado normalmente agora — lançar contratos, receber títulos, acessar Publicações, etc. Nenhuma funcionalidade foi desligada ou bloqueada. A F6a não alterou nenhuma tela usada em produção.

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

## 3. Preview da F6a

- Deploy: `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU`
- URL: `https://inove-juris-9nni894w2-alcantarus-projects.vercel.app`
- Protegido por `vercel_authentication` — usar `npx vercel curl`
- **Não promovido a produção**
- `SUPABASE_SERVICE_ROLE_KEY` adicionada como **Secret somente no Preview**, usando a chave `service_role` atual. Production e Development continuam sem ela.
- Chave validada localmente: URL assinada gerada com sucesso para `templates/1772776048729_clients.docx` (`signed_url_ok=true`).
- Validação negativa no preview: as três rotas retornam `307 → /login` sem cookie.

## 4. Validação positiva pendente — como retomar

O usuário escolheu **executar os comandos por conta própria** e escopo **somente leitura**. Os comandos abaixo devem ser rodados na pasta `C:\InoveTecnologia\InoveJuris`, substituindo `SESSION_ID` e `APP_ENV` pelos cookies copiados do navegador (F12 → Application → Storage → Cookies, após login no preview com conta de teste).

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

1. **F6b** — depende da validação positiva acima. Na mesma janela: replicar `SUPABASE_SERVICE_ROLE_KEY` em Production, publicar o código e aplicar `forward_f6.sql`. Rollback: `rollback_f6.sql` + deploy anterior + `vercel env rm SUPABASE_SERVICE_ROLE_KEY production`.
2. **F6c (aftercare)** — backfill de `storage_path` e limpeza de órfãos; URLs antigas `/object/public/...` continuam gravadas em `client_documents.file_url`, `document_templates.file_url` e `birthday_templates.image_url`. A leitura já passa pelo proxy assinado; não há fallback automático se a rota falhar enquanto os buckets ainda estiverem públicos.
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
- Nenhum deploy de correção de segurança em produção até agora (o deploy atual é o do logout global, anterior à F6a).
- Não usar sessão de usuário real nem criar sessão artificial sem autorização.
- Usuários reais preservados: `1`, `2`, `23`, `65`, `73`. Usuário `73` (`marcos@gmail.com`) não deve ser removido.
- `public.users` possui `canAccessReceivables` e `canaccessreceivables` (diferem só por caixa).
- `role_name` continua `null`; superadmin com flags forçadas para `true`.

## 7. Rollbacks disponíveis

| Item | Comando / artefato |
|---|---|
| Chave no Preview | `npx vercel env rm SUPABASE_SERVICE_ROLE_KEY preview` |
| Deploy do preview | descartar `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU` |
| F6b (quando aplicada) | `C:\InoveTecnologia\InoveJuris-Backups\F6-20261118\rollback_f6.sql` + deploy anterior + remover a variável de Production |
| F5 | `C:\InoveTecnologia\InoveJuris-Backups\F5-20261118\` |
| F4a | `C:\InoveTecnologia\InoveJuris-Backups\F4-20261118\` |
| F3 | `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\` |
| F0 | PITR `2026-11-18 18:01:02.49299+00` |

## 8. Retomada em resumo

1. Abrir este documento e `docs/STATUS-INOVEJURIS.md`.
2. Confirmar que a produção continua em `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`.
3. Rodar os três comandos da seção 4 (ou escolher outra forma de sessão de teste).
4. Com o resultado, decidir F6b — parecer técnico antes de qualquer alteração, backup e janela de deploy + SQL.
5. Seguir a fila da seção 5.

Nada precisa ser feito antes de desligar o computador: código, documentação e deploy de preview já estão salvos no GitHub e no Vercel.
