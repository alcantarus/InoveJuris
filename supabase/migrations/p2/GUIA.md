# P2 — endurecimento além do anon

## Status

- Aplicar no SQL Editor do Supabase, como `postgres`, um arquivo por vez.
- Não usar `run_sql*.js` com service role.
- Validações já confirmadas estão em `../STATUS_SEGURANCA.md`. Não repetir testes OK.
- **Lote 01 BLOQUEADO:** as funções `http_*` pertencem a `supabase_admin`. O
  `postgres` não pode revogar grants desse dono nem assumir o papel (`SET ROLE`
  -> 42501). Requer **Supabase Support**. Não adianta rodar como postgres.

## Ordem

| Ordem | Arquivo | Objetivo | Validação |
|---|---|---|---|
| 1 | `01_http_sem_public.sql` | Revoga `EXECUTE` das funções `http_*` de `PUBLIC`/`anon`/`authenticated` (SSRF); mantém `service_role`, `postgres` e o dono da `djen_fetch` | 0 funções http p/ anon + postgres ainda executa http_get + sync DJEN |
| 2 | (código) migração anon → service_role | Rotas de servidor deixam de usar a chave anon | Login + página logada + ação admin OK após deploy |
| 3 | `03_anon_sem_app_auth.sql` | Revoga `EXECUTE` das `app_*` de auth/sessão/admin do `anon` | 0 funções auth/admin executáveis por anon; login/portal/onboarding OK |

## Lote 02 — migração anon → service_role (código)

Arquivos alterados (todos RPC para funções `SECURITY DEFINER`, não dependem de RLS):

- `lib/server-auth.ts` (`requireSessionContext`) — usado por quase todas as rotas.
- `lib/supabase-server.ts` (`getSupabaseServer`) — só `auth/session`.
- `app/api/ai/generate/route.ts` — validação de sessão.
- `lib/djen.ts` — `fetchViaSupabaseRpc`.

Pré-requisito: `SUPABASE_SERVICE_ROLE_KEY` na Vercel (confirmado). Typecheck limpo.

Validação do lote 02 (após deploy, 23/11/2026): login e navegação logada OK;
`POST /api/ai/generate` com `kind: dashboard_insight` retornou **503** ("Chave do
Gemini não configurada") — ou seja, não deu 401: a validação de sessão via
service_role (`app_validate_session`) funcionou. Lote 03 liberado.

A chave anon do cliente (`NEXT_PUBLIC_*`) fica.

## Verificação do lote 03

Funções `app_*` ainda executáveis pelo anon (esperado: **apenas 2 linhas** —
`app_mark_onboarding_used` e `app_touch_indicator_token`):

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'app\_%'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by 1;
```

Servidor ainda executa a validação de sessão (esperado: **true**):

```sql
select has_function_privilege(
  'service_role', 'public.app_validate_session(uuid, text)', 'EXECUTE'
) as service_role_executa;
```

Testes funcionais após o lote 03 (só o que pode ser afetado pela revogação):

- [ ] Login (usa `app_authenticate` / `app_complete_login` via service_role).
- [ ] Link público de onboarding ainda marca "já utilizado".
- [ ] Portal do indicador ainda registra último acesso.

## Contexto do lote 01

- Único consumidor de `http_*` é `public.djen_fetch(text)`, `SECURITY DEFINER`
  (roda como `postgres`), host/caminho fixos no DJEN. O `http_get` interno executa
  como `postgres`. (`lib/djen.ts` agora usa service_role; ver lote 02.)
- Nenhum código chama `http_*` diretamente.

## Verificação do lote 01

Anon não pode mais executar nenhuma função http (esperado: **0 linhas**):

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname = 'http' or p.proname like 'http\_%')
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by 1;
```

Dono da djen_fetch (postgres) ainda executa http_get (esperado: **true**):

```sql
select has_function_privilege('postgres', 'public.http_get(character varying)', 'EXECUTE') as postgres_executa;
```

## Teste funcional (único fluxo afetado)

- [ ] Em `test`: Publicações → Sincronizar (SyncModal) → rodar uma sincronização
  DJEN e confirmar que ainda traz comunicações.

## Próximos itens de P2

- Lote 03: aplicar/verificar `03_anon_sem_app_auth.sql` (lote 02 validado).
- Rotação da chave ECC/ES256.
- `organization_id` / multitenancy real.
