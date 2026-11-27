-- VERIFY - estado das triggers apos o backfill do LOTE 5
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Esperado:
--   as 4 triggers abaixo com estado = 'O' e habilitada = true
--   triggers_publicas_desabilitadas = []
--   nulos_nas_tabelas_do_lote = 0

begin;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'triggers_do_lote', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', x.tabela,
             'trigger', x.trigger,
             'existe', (select count(*) > 0
                          from pg_trigger t
                         where t.tgrelid = ('public.' || quote_ident(x.tabela))::regclass
                           and t.tgname = x.trigger
                           and not t.tgisinternal),
             'estado', (select t.tgenabled::text
                          from pg_trigger t
                         where t.tgrelid = ('public.' || quote_ident(x.tabela))::regclass
                           and t.tgname = x.trigger
                           and not t.tgisinternal),
             'habilitada', (select t.tgenabled = 'O'
                              from pg_trigger t
                             where t.tgrelid = ('public.' || quote_ident(x.tabela))::regclass
                               and t.tgname = x.trigger
                               and not t.tgisinternal)
           ) order by x.tabela, x.trigger), '[]'::jsonb)
      from (values
        ('payments',      'audit_payments'),
        ('payments',      'trg_recalculate_contract_on_payment'),
        ('notifications', 'audit_notifications'),
        ('user_sessions', 'audit_user_sessions')
      ) as x(tabela, trigger)
  ),
  'triggers_publicas_desabilitadas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', c.relname,
             'trigger', t.tgname,
             'estado', t.tgenabled::text
           ) order by c.relname, t.tgname), '[]'::jsonb)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where not t.tgisinternal
       and c.relnamespace = 'public'::regnamespace
       and t.tgenabled <> 'O'
  ),
  'nulos_nas_tabelas_do_lote', (
    select (select count(*) from public.payments
             where organization_id is null and environment in ('production', 'test'))
         + (select count(*) from public.notifications
             where organization_id is null and environment in ('production', 'test'))
         + (select count(*) from public.user_sessions
             where organization_id is null and environment in ('production', 'test'))
  )
)) as resumo;

rollback;
