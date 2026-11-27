-- ROLLBACK - chave tenant de system_settings
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Volta a PK antiga (key, environment) e remove a UNIQUE tenant.
-- Aborta se existirem duplicatas em (key, environment), para nao perder
-- linhas silenciosamente. Se a PK ja estiver presente, nao repete.

begin;

do $$
declare
  v_duplicatas integer;
  v_tem_pk     boolean;
  v_tem_unique boolean;
begin
  select count(*) into v_duplicatas
    from (
      select key, environment
        from public.system_settings
       group by key, environment
      having count(*) > 1
    ) d;

  if v_duplicatas > 0 then
    raise exception 'Abortado: % duplicata(s) em (key, environment). Ajuste antes do rollback.', v_duplicatas;
  end if;

  select exists (
    select 1 from pg_constraint
     where conrelid = 'public.system_settings'::regclass
       and conname = 'uq_system_settings_key_environment_organization'
       and contype = 'u'
  ) into v_tem_unique;

  select exists (
    select 1 from pg_constraint
     where conrelid = 'public.system_settings'::regclass
       and conname = 'system_settings_pkey'
       and contype = 'p'
  ) into v_tem_pk;

  if v_tem_unique then
    execute 'alter table public.system_settings drop constraint uq_system_settings_key_environment_organization';
  end if;

  if not v_tem_pk then
    execute 'alter table public.system_settings add constraint system_settings_pkey primary key (key, environment)';
  else
    raise notice 'PK antiga ja presente; nada a recriar.';
  end if;
end $$;

commit;
