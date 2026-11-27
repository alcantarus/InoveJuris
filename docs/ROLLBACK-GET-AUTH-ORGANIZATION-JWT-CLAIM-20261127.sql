-- ROLLBACK — get_auth_organization() volta a ler custom.organization_id
-- 27/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Restaura EXATAMENTE a definicao capturada pelo FORWARD, inclusive
-- SECURITY DEFINER, search_path original e grants (CREATE OR REPLACE nao
-- altera grants). Nao toca policies, views, RPCs nem dados de negocio.

begin;

do $$
declare
  v_def text;
begin
  select definicao into v_def
    from public._tenant_jwt_org_backup_20261127
   where id = 1;

  if v_def is null then
    raise exception 'Backup da definicao original nao encontrado; rollback abortado.';
  end if;

  execute v_def;
end $$;

select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),
  'restaurado_para_guc_legado',
    pg_get_functiondef('public.get_auth_organization()'::regprocedure)
      like '%custom.organization_id%',
  'backup_preservado', exists (
    select 1 from public._tenant_jwt_org_backup_20261127 where id = 1
  )
)) as resumo;

commit;
