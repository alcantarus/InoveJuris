# Aplicação, verificação e rollback — P0 Bloco 2 (23/11/2026)

## Status

- Código publicado em `main`: commit `2de4cdb`.
- **Nenhum SQL foi executado pelo agente.** Nenhuma policy permissiva foi removida.
- O SQL abaixo deve ser aplicado por você no **SQL Editor do Supabase**, como owner do schema
  (`postgres`), não pelos scripts `run_sql*.js` com a service role da aplicação.

## Ordem de aplicação

1. `supabase/migrations/20261123000000_p0_rbac_rpc.sql`
   - Cria `_auth_require_superadmin`, `app_get_rbac`, `app_admin_save_role`,
     `app_admin_delete_role` e `app_admin_set_role_permission`.
   - `EXECUTE` concedido somente a `service_role`; `public`/`anon`/`authenticated` revogados.
2. `supabase/migrations/20261123000001_p0_storage_versioning.sql`
   - Garante `client_documents`, `templates` e `marketing` como privados.
   - Em produção é **no-op**: F6b já aplicou isso em 18/11/2026 (0 buckets públicos, 0 policies).

> Não reexecutar `forward_f6.sql`. Não recriar policies de Storage: todo acesso passa por
> `/api/storage/upload`, `/api/storage/signed-url` e `/api/storage/remove`.

A ordem importa: o front já usa `/api/settings/rbac`, que só funciona depois das RPCs existirem.

## Verificação no banco

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    '_auth_require_superadmin', 'app_get_rbac', 'app_admin_save_role',
    'app_admin_delete_role', 'app_admin_set_role_permission'
  )
order by p.proname;
-- Esperado: 5 linhas.

select
  has_function_privilege('service_role', 'public.app_get_rbac(uuid)', 'execute') as service_ok,
  has_function_privilege('anon', 'public.app_get_rbac(uuid)', 'execute') as anon_ok,
  has_function_privilege('authenticated', 'public.app_admin_save_role(uuid,bigint,text,text)', 'execute') as auth_ok;
-- Esperado: service_ok = true; anon_ok = false; auth_ok = false.

select id, public
from storage.buckets
where id in ('client_documents', 'templates', 'marketing')
order by id;
-- Esperado: public = false nos três.

-- storage.policies não existe nas versões recentes do Supabase;
-- as policies ficam em pg_policies (storage.objects).
select policyname, qual
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and coalesce(qual, '') ilike any(array['%client_documents%','%templates%','%marketing%']);
-- Esperado: 0 linhas.
```

## Verificação funcional

1. Entre como **superadministrador** → Configurações → aba de perfis.
2. Crie um perfil temporário, altere descrição, vincule/desvincule uma permissão e exclua o perfil.
   - O perfil `Administrador` deve aparecer como não editável.
3. Entre como usuário **não superadministrador** com `canAccessUsers`:
   - A aba deve mostrar `Acesso restrito`.
   - `POST /api/settings/rbac` deve responder `403` com `Acesso restrito a superadministradores.`
4. Confirme que upload e preview de documentos/modelos/marketing continuam funcionando via
   `/api/storage/signed-url`.

## Rollback

### Código

Promova o deployment anterior (`bc8bcb2`) ou reverta o commit `2de4cdb`.

Atenção: isso devolve a escrita de RBAC direto para o navegador, que hoje depende das policies
permissivas. Use apenas em conjunto com o rollback SQL abaixo ou como medida emergencial.

### SQL

```sql
drop function if exists public.app_admin_set_role_permission(uuid, bigint, text, boolean);
drop function if exists public.app_admin_delete_role(uuid, bigint);
drop function if exists public.app_admin_save_role(uuid, bigint, text, text);
drop function if exists public.app_get_rbac(uuid);
drop function if exists public._auth_require_superadmin(uuid);
```

Não restaurar buckets públicos nem recriar policies — isso reabriria o vetor que o P0 fecha.

## Próximo bloco

O Bloco 3 (substituir o bootstrap `USING (true)` e remover as policies permissivas restantes)
só deve ser aplicado depois que esta verificação passar em produção.
