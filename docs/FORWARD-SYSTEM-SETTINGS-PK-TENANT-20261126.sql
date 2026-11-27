-- FORWARD - chave tenant de system_settings
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Medicao anterior (20:14Z): Postgres 17.6, NULLS NOT DISTINCT suportado,
-- 12 linhas, 0 com organization_id nula, 0 duplicatas em (key, environment),
-- PK atual = (key, environment).
--
-- Correcao de desenho: NAO usar PRIMARY KEY com organization_id, pois isso
-- tornaria a coluna NOT NULL e quebraria a linha global do callback OAuth.
-- Usamos UNIQUE NULLS NOT DISTINCT: uma linha por
-- (key, environment, organization_id), inclusive com organization_id nulo.
--
-- Aborta sem alterar nada se houver FK entrando, coluna ausente, linha com
-- org nula, duplicata nova ou Postgres < 15. Se ja aplicado, nao repete.

begin;

do $$
declare
  v_fk_entrando integer;
  v_col_org     integer;
  v_nulas       integer;
  v_duplicatas  integer;
  v_versao      integer;
  v_ja_aplicado boolean;
begin
  select count(*) into v_fk_entrando
    from pg_constraint
   where confrelid = 'public.system_settings'::regclass
     and contype = 'f';

  if v_fk_entrando > 0 then
    raise exception 'Abortado: % FK(s) entrando em system_settings', v_fk_entrando;
  end if;

  select count(*) into v_col_org
    from pg_attribute
   where attrelid = 'public.system_settings'::regclass
     and attname = 'organization_id'
     and attnum > 0
     and not attisdropped;

  if v_col_org <> 1 then
    raise exception 'Abortado: organization_id ausente/duplicada (%)', v_col_org;
  end if;

  select count(*) into v_nulas
    from public.system_settings
   where organization_id is null;

  if v_nulas > 0 then
    raise exception 'Abortado: % linha(s) com organization_id nula', v_nulas;
  end if;

  select count(*) into v_duplicatas
    from (
      select key, environment, organization_id
        from public.system_settings
       group by key, environment, organization_id
      having count(*) > 1
    ) d;

  if v_duplicatas > 0 then
    raise exception 'Abortado: % duplicata(s) em (key, environment, organization_id)', v_duplicatas;
  end if;

  v_versao := current_setting('server_version_num')::integer;
  if v_versao < 150000 then
    raise exception 'Abortado: Postgres % sem NULLS NOT DISTINCT', v_versao;
  end if;

  select exists (
    select 1 from pg_constraint
     where conrelid = 'public.system_settings'::regclass
       and conname = 'uq_system_settings_key_environment_organization'
       and contype = 'u'
  ) into v_ja_aplicado;

  if v_ja_aplicado then
    raise notice 'FORWARD ja aplicado; nenhuma alteracao feita.';
  else
    execute 'alter table public.system_settings drop constraint if exists system_settings_pkey';
    execute 'alter table public.system_settings add constraint uq_system_settings_key_environment_organization unique nulls not distinct (key, environment, organization_id)';
  end if;
end $$;

commit;
