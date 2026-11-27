-- VERIFY - estado das triggers apos o backfill do LOTE 6
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Esperado:
--   todas as triggers de financial_transactions com estado = 'O'
--   triggers_publicas_desabilitadas = []
--   nulos_em_financial_transactions = 0

begin;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'triggers_de_financial_transactions', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'trigger', t.tgname,
             'estado', t.tgenabled::text,
             'habilitada', t.tgenabled = 'O',
             'evento_update', (t.tgtype & 8) <> 0
           ) order by t.tgname), '[]'::jsonb)
      from pg_trigger t
     where t.tgrelid = 'public.financial_transactions'::regclass
       and not t.tgisinternal
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
  'nulos_em_financial_transactions', (
    select count(*) from public.financial_transactions
     where organization_id is null and environment in ('production', 'test')
  )
)) as resumo;

rollback;
