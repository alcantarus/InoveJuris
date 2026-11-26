-- PRÉ-CHECAGEM — correção do isolamento da view `contract_receivables_summary`
-- 26/11/2026
--
-- Somente leitura, uma única célula (`precheck_isolamento_view_20261126`),
-- termina em ROLLBACK. Rode antes do FORWARD para confirmar que os pré-
-- requisitos estão presentes.
--
-- REGRA PERMANENTE: banco único; `production` e `test` são valores da coluna
-- `environment`, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.

begin;

select jsonb_pretty(jsonb_build_object(

  'coletado_em', now(),
  'pg_version', current_setting('server_version'),
  'banco_unico', 'production e test são valores da coluna environment, não bancos separados.',
  'aviso', 'Somente leitura; nenhuma linha de negócio alterada. Termina em ROLLBACK.',

  'view', jsonb_build_object(
    'existe', to_regclass('public.contract_receivables_summary') is not null,
    'reloptions', coalesce((
      select array_to_string(c.reloptions, ',')
        from pg_class c
       where c.oid = to_regclass('public.contract_receivables_summary')
    ), ''),
    'security_invoker_on', coalesce((
      select array_to_string(c.reloptions, ',') ilike '%security_invoker=on%'
        from pg_class c
       where c.oid = to_regclass('public.contract_receivables_summary')
    ), false)
  ),

  'privilegio_select_do_autenticado', jsonb_build_object(
    'contracts',   has_table_privilege('authenticated', 'public.contracts', 'SELECT'),
    'clients',     has_table_privilege('authenticated', 'public.clients', 'SELECT'),
    'installments',has_table_privilege('authenticated', 'public.installments', 'SELECT')
  ),

  'pronto_para_forward', (
    to_regclass('public.contract_receivables_summary') is not null
    and not coalesce((
      select array_to_string(c.reloptions, ',') ilike '%security_invoker=on%'
        from pg_class c
       where c.oid = to_regclass('public.contract_receivables_summary')
    ), false)
    and has_table_privilege('authenticated', 'public.contracts', 'SELECT')
    and has_table_privilege('authenticated', 'public.clients', 'SELECT')
    and has_table_privilege('authenticated', 'public.installments', 'SELECT')
  ),

  'se_pronto', 'Rodar docs/FORWARD-ISOLAMENTO-VIEW-20261126.sql e depois docs/VERIFY-ISOLAMENTO-VIEW-20261126.sql nos dois ambientes.',
  'se_nao_pronto', 'Não aplicar o FORWARD. Conferir os privilégios acima antes de qualquer mudança estrutural.'

)) as precheck_isolamento_view_20261126;

rollback;
