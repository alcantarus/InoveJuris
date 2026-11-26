-- VERIFY — pós-forward do isolamento da view `contract_receivables_summary`
-- 26/11/2026
--
-- Somente leitura, uma única célula (`verificacao_pos_forward_20261126`),
-- termina em ROLLBACK. Rodar logo após docs/FORWARD-ISOLAMENTO-VIEW-20261126.sql,
-- com o app aberto no ambiente a medir (heartbeat de 20 s; limite de 90 s).
-- O cookie app_env é único por navegador: meça production, troque para test,
-- aguarde o heartbeat e rode de novo.
--
-- Banco único: production e test são valores da coluna `environment`.
-- Ver docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Esperado após o forward, em ambos os ambientes:
--   security_invoker_on = true
--   view_total = contracts_via_rls
--   view_de_outro_ambiente = 0

begin;

-- 1. Estrutura e privilégios.
do $$
begin
  perform set_config('vch.reloptions', coalesce((
    select array_to_string(c.reloptions, ',')
      from pg_class c
     where c.oid = 'public.contract_receivables_summary'::regclass
  ), ''), true);

  perform set_config('vch.security_invoker', coalesce((
    select array_to_string(c.reloptions, ',') ilike '%security_invoker=on%'
      from pg_class c
     where c.oid = 'public.contract_receivables_summary'::regclass
  ), false)::text, true);

  perform set_config('vch.grants', jsonb_build_object(
    'contracts',   has_table_privilege('authenticated', 'public.contracts', 'SELECT'),
    'clients',     has_table_privilege('authenticated', 'public.clients', 'SELECT'),
    'installments',has_table_privilege('authenticated', 'public.installments', 'SELECT')
  )::text, true);
end $$;

-- 2. Contagens por ambiente, com claims JWT da sessão real e role authenticated.
do $$
declare
  v_env     text;
  v_prefix  text;
  v_sid     text;
  v_uid     text;
  v_ok      boolean;
  v_total   bigint;
  v_proprio bigint;
  v_fora    bigint;
  v_base    bigint;
begin
  foreach v_env in array array['production','test']::text[]
  loop
    v_prefix := case when v_env = 'production' then 'vch.p' else 'vch.t' end;

    select s.id::text, s.user_id::text
      into v_sid, v_uid
      from public.user_sessions s
     where s.environment = v_env
       and s.logout_at is null
       and s.last_seen_at >= now() - interval '90 seconds'
       and (s.login_at is null or s.login_at >= now() - interval '12 hours')
     order by s.last_seen_at desc
     limit 1;

    perform set_config(v_prefix || '.sessao_encontrada', (v_sid is not null)::text, true);

    if v_sid is not null then
      perform set_config('request.jwt.claims', jsonb_build_object(
        'role',          'authenticated',
        'session_id',    v_sid,
        'environment',   v_env,
        'sub',           v_uid,
        'is_superadmin', false
      )::text, true);

      -- authenticated não tem EXECUTE nesta função: chamar antes do set role.
      select public._rls_session_valid() into v_ok;
      perform set_config(v_prefix || '.sessao_valida', coalesce(v_ok, false)::text, true);

      perform set_config('role', 'authenticated', true);

      execute 'select count(*) from public.contract_receivables_summary' into v_total;
      execute format('select count(*) from public.contract_receivables_summary where environment = %L', v_env) into v_proprio;
      execute format('select count(*) from public.contract_receivables_summary where environment <> %L', v_env) into v_fora;
      execute 'select count(*) from public.contracts' into v_base;

      perform set_config(v_prefix || '.view_total', v_total::text, true);
      perform set_config(v_prefix || '.view_proprio', v_proprio::text, true);
      perform set_config(v_prefix || '.view_fora', v_fora::text, true);
      perform set_config(v_prefix || '.base_contracts', v_base::text, true);

      reset role;
    end if;
  end loop;
end $$;

-- 3. Única célula de resultado.
select jsonb_pretty(jsonb_build_object(

  'verificado_em', now(),
  'pg_version', current_setting('server_version'),
  'banco_unico', 'production e test são valores da coluna environment, não bancos separados.',
  'aviso', 'Somente leitura; nenhuma linha de negócio alterada. Termina em ROLLBACK.',

  'estrutura', jsonb_build_object(
    'reloptions', coalesce(current_setting('vch.reloptions', true), ''),
    'security_invoker_on', case
      when current_setting('vch.security_invoker', true) is null then null
      else current_setting('vch.security_invoker')::boolean end,
    'select_do_autenticado_nas_base', case
      when current_setting('vch.grants', true) is null then null
      else current_setting('vch.grants')::jsonb end
  ),

  'por_ambiente', jsonb_build_object(

    'production', jsonb_build_object(
      'sessao_encontrada', coalesce(current_setting('vch.p.sessao_encontrada', true), 'false')::boolean,
      'sessao_valida', case
        when current_setting('vch.p.sessao_valida', true) is null then null
        else current_setting('vch.p.sessao_valida')::boolean end,
      'view_total', case
        when current_setting('vch.p.view_total', true) is null then null
        else current_setting('vch.p.view_total')::bigint end,
      'view_do_ambiente', case
        when current_setting('vch.p.view_proprio', true) is null then null
        else current_setting('vch.p.view_proprio')::bigint end,
      'view_de_outro_ambiente', case
        when current_setting('vch.p.view_fora', true) is null then null
        else current_setting('vch.p.view_fora')::bigint end,
      'contracts_via_rls', case
        when current_setting('vch.p.base_contracts', true) is null then null
        else current_setting('vch.p.base_contracts')::bigint end
    ),

    'test', jsonb_build_object(
      'sessao_encontrada', coalesce(current_setting('vch.t.sessao_encontrada', true), 'false')::boolean,
      'sessao_valida', case
        when current_setting('vch.t.sessao_valida', true) is null then null
        else current_setting('vch.t.sessao_valida')::boolean end,
      'view_total', case
        when current_setting('vch.t.view_total', true) is null then null
        else current_setting('vch.t.view_total')::bigint end,
      'view_do_ambiente', case
        when current_setting('vch.t.view_proprio', true) is null then null
        else current_setting('vch.t.view_proprio')::bigint end,
      'view_de_outro_ambiente', case
        when current_setting('vch.t.view_fora', true) is null then null
        else current_setting('vch.t.view_fora')::bigint end,
      'contracts_via_rls', case
        when current_setting('vch.t.base_contracts', true) is null then null
        else current_setting('vch.t.base_contracts')::bigint end
    )
  ),

  'criterio_de_sucesso', jsonb_build_object(
    'estrutura', 'security_invoker_on = true e SELECT concedido nas três tabelas-base.',
    'por_ambiente', 'view_de_outro_ambiente = 0 e view_total = contracts_via_rls, em production e em test.',
    'se_faltar_sessao', 'Repetir com o app aberto no ambiente ausente; o cookie app_env é único por navegador.'
  )

)) as verificacao_pos_forward_20261126;

rollback;
