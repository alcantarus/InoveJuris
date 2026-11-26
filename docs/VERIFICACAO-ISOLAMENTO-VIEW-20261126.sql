-- Verificação de isolamento da view `contract_receivables_summary`
-- 26/11/2026
--
-- REGRA PERMANENTE: existe um único banco de dados (PostgreSQL 17.6). Os
-- ambientes `production` e `test` (homologação) são valores da coluna
-- `environment`, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Objetivo: descobrir se a view mostra somente linhas do ambiente da sessão.
-- A view não tem `security_invoker`, então pode ler com privilégios do dono e
-- ignorar o RLS das tabelas base. Este script compara, para cada ambiente com
-- sessão ativa recente, as contagens da view com as de `contracts` via RLS.
--
-- PRÉ-CONDIÇÃO: manter o app aberto no ambiente a testar. O heartbeat atualiza
-- `user_sessions.last_seen_at` a cada 20 s; a função aceita até 90 s.
-- Se não houver sessão recente em algum ambiente, o campo correspondente virá
-- nulo e o aviso indicará a necessidade de repetir com o app aberto.
--
-- Somente leitura em dados de negócio: nenhum INSERT/UPDATE/DELETE. Termina em
-- ROLLBACK. Como usar: rodar o arquivo inteiro no SQL Editor e copiar a ÚNICA
-- célula `verificacao_isolamento_view_20261126`.

begin;

-- 1. Estrutura da view — informação de catálogo, sem gravar nada.
do $$
declare
  v_reloptions text;
begin
  select coalesce(array_to_string(c.reloptions, ','), '')
    into v_reloptions
    from pg_class c
   where c.oid = 'public.contract_receivables_summary'::regclass;

  perform set_config('iso.viewdef',
    pg_get_viewdef('public.contract_receivables_summary'::regclass, true), true);
  perform set_config('iso.reloptions', v_reloptions, true);
  perform set_config('iso.rls_view', (select c.relrowsecurity::text
    from pg_class c where c.oid = 'public.contract_receivables_summary'::regclass), true);
  perform set_config('iso.tem_coluna_environment', (exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'contract_receivables_summary'
       and column_name = 'environment'
  ))::text, true);
end $$;

-- 2. Teste por ambiente, com a sessão ativa mais recente de cada um.
do $$
declare
  v_env     text;
  v_prefix  text;
  v_sid     uuid;
  v_uid     uuid;
  v_ok      boolean;
  v_tem_env boolean;
  v_total   bigint;
  v_proprio bigint;
  v_fora    bigint;
  v_base    bigint;
begin
  foreach v_env in array array['production','test']::text[]
  loop
    v_prefix := case when v_env = 'production' then 'iso.p' else 'iso.t' end;

    select s.id, s.user_id
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
        'session_id',    v_sid::text,
        'environment',   v_env,
        'sub',           v_uid::text,
        'is_superadmin', false
      )::text, true);
      perform set_config('role', 'authenticated', true);

      select public._rls_session_valid() into v_ok;
      perform set_config(v_prefix || '.sessao_valida', coalesce(v_ok, false)::text, true);

      execute 'select count(*) from public.contract_receivables_summary' into v_total;
      execute 'select count(*) from public.contracts' into v_base;

      -- Se a view não expõe `environment`, não há como separar as contagens;
      -- registra a limitação em vez de abortar o script.
      select exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'contract_receivables_summary'
           and column_name = 'environment'
      ) into v_tem_env;

      if v_tem_env then
        execute format('select count(*) from public.contract_receivables_summary where environment = %L', v_env) into v_proprio;
        execute format('select count(*) from public.contract_receivables_summary where environment <> %L', v_env) into v_fora;
      else
        v_proprio := null;
        v_fora := null;
      end if;

      perform set_config(v_prefix || '.view_total', v_total::text, true);
      perform set_config(v_prefix || '.view_proprio', coalesce(v_proprio::text, ''), true);
      perform set_config(v_prefix || '.view_fora', coalesce(v_fora::text, ''), true);
      perform set_config(v_prefix || '.base_contracts', v_base::text, true);

      reset role;
    end if;
  end loop;
end $$;

-- 3. Única célula de resultado.
select jsonb_pretty(jsonb_build_object(

  'coletado_em', now(),
  'pg_version', current_setting('server_version'),
  'ambiente_dos_dados', 'Banco único: production e test são valores da coluna environment, não bancos separados.',
  'aviso', 'Somente leitura. Nenhuma linha de negócio foi alterada; o script termina em ROLLBACK.',
  'pre_condicao', 'App aberto no ambiente a testar (heartbeat de 20 s; limite de 90 s na sessão).',

  'estrutura_da_view', jsonb_build_object(
    'coluna_environment', coalesce(current_setting('iso.tem_coluna_environment', true), 'desconhecido'),
    'rls_na_view', coalesce(current_setting('iso.rls_view', true), 'desconhecido'),
    'reloptions', coalesce(current_setting('iso.reloptions', true), ''),
    'security_invoker', case
      when coalesce(current_setting('iso.reloptions', true), '') ilike '%security_invoker%'
        then 'sim' else 'nao' end,
    'definicao', coalesce(current_setting('iso.viewdef', true), '')
  ),

  'por_ambiente', jsonb_build_object(

    'production', jsonb_build_object(
      'sessao_encontrada', coalesce(current_setting('iso.p.sessao_encontrada', true), 'false')::boolean,
      'sessao_valida', case
        when current_setting('iso.p.sessao_valida', true) is null then null
        else current_setting('iso.p.sessao_valida')::boolean end,
      'view_total', case
        when current_setting('iso.p.view_total', true) is null then null
        else current_setting('iso.p.view_total')::bigint end,
      'view_do_ambiente', case
        when current_setting('iso.p.view_proprio', true) is null then null
        else nullif(current_setting('iso.p.view_proprio'), '')::bigint end,
      'view_de_outro_ambiente', case
        when current_setting('iso.p.view_fora', true) is null then null
        else nullif(current_setting('iso.p.view_fora'), '')::bigint end,
      'contracts_via_rls', case
        when current_setting('iso.p.base_contracts', true) is null then null
        else current_setting('iso.p.base_contracts')::bigint end
    ),

    'test', jsonb_build_object(
      'sessao_encontrada', coalesce(current_setting('iso.t.sessao_encontrada', true), 'false')::boolean,
      'sessao_valida', case
        when current_setting('iso.t.sessao_valida', true) is null then null
        else current_setting('iso.t.sessao_valida')::boolean end,
      'view_total', case
        when current_setting('iso.t.view_total', true) is null then null
        else current_setting('iso.t.view_total')::bigint end,
      'view_do_ambiente', case
        when current_setting('iso.t.view_proprio', true) is null then null
        else nullif(current_setting('iso.t.view_proprio'), '')::bigint end,
      'view_de_outro_ambiente', case
        when current_setting('iso.t.view_fora', true) is null then null
        else nullif(current_setting('iso.t.view_fora'), '')::bigint end,
      'contracts_via_rls', case
        when current_setting('iso.t.base_contracts', true) is null then null
        else current_setting('iso.t.base_contracts')::bigint end
    )
  ),

  'como_interpretar', jsonb_build_object(
    'isolado', 'view_de_outro_ambiente = 0 e view_total = contracts_via_rls no mesmo ambiente.',
    'possivel_vazamento', 'view_de_outro_ambiente > 0 ou view_total > contracts_via_rls.',
    'limitacao', 'Contagens iguais não provam ausência de vazamento em todas as colunas; provam que a view não trouxe linhas do outro ambiente nesta sessão. Se a view não expõe `environment`, os campos view_do_ambiente/view_de_outro_ambiente ficam nulos e só a comparação com contracts_via_rls é possível.',
    'se_vazar', 'Não corrigir dados: avaliar forward/verify/rollback para security_invoker ou filtro explícito por environment na view.'
  )

)) as verificacao_isolamento_view_20261126;

rollback;
