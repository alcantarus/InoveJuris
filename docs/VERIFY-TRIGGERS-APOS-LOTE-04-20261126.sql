-- VERIFY - estado das triggers apos o backfill do LOTE 4
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Esperado:
--   trigger_parcela_quitada.habilitada = true
--   trigger_parcela_quitada.estado = 'O'
--   parcelas_quitadas_sem_org = 0

begin;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'trigger_parcela_quitada', (
    select coalesce(jsonb_build_object(
             'existe', true,
             'tabela', 'public.installments',
             'estado', t.tgenabled::text,
             'habilitada', t.tgenabled = 'O'
           ), '{"existe": false}'::jsonb)
      from pg_trigger t
     where t.tgrelid = 'public.installments'::regclass
       and t.tgname = 'prevent_update_delete_paid_installment_trigger'
       and not t.tgisinternal
  ),
  'parcelas_quitadas_sem_org', (
    select count(*) from public.installments
     where status = 'Quitado' and organization_id is null
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
  )
)) as resumo;

rollback;
