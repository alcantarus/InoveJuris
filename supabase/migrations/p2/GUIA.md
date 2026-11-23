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

## Contexto do lote 01

- Único consumidor de `http_*` é `public.djen_fetch(text)`, `SECURITY DEFINER`
  (roda como `postgres`), host/caminho fixos no DJEN. Chamada via chave anon em
  `lib/djen.ts`, mas o `http_get` interno executa como `postgres`.
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

- Mover rotas de servidor da chave anon para `service_role` (depois revogar
  `app_*` de auth/admin do `anon`).
- Rotação da chave ECC/ES256.
- `organization_id` / multitenancy real.
