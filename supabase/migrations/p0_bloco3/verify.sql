-- Verificação pós-lote (somente leitura; pode ser rodada após cada lote).
-- Ajuste a lista de tabelas ao lote aplicado, ou deixe a lista completa.

-- 1) Nenhuma policy permissiva nas tabelas de domínio.
--    Esperado: 0 linhas.
select schemaname, tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'users','user_sessions','login_challenges','trusted_devices',
    'roles','permissions','role_permissions','user_roles',
    'law_areas','lawyers','diseases','products','indicators',
    'bank_accounts','financial_categories','product_diseases','contract_diseases',
    'clients','client_tags','client_relationships','client_interactions',
    'client_documents','client_onboarding_tokens',
    'contracts','installments','installment_history','payments',
    'commission_payments','financial_transactions','sales','financial_records',
    'processes','process_deadlines','process_deadline_history','process_sync_log',
    'publications','publication_sync_log','integration_logs','geo_cache',
    'document_templates','template_variables','birthday_templates',
    'birthday_messages','marketing_logs','leads','notifications',
    'tasks','task_history','kanban_boards','kanban_columns',
    'system_settings','audit_logs','indicator_tokens'
  )
  and (
       qual is null or btrim(qual) = 'true'
    or with_check is null or btrim(with_check) = 'true'
  )
order by tablename, policyname;

-- 2) Policies P0 por tabela.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and policyname like 'P0 %'
order by tablename, policyname;

-- 3) Helpers instalados e executáveis apenas pelos papéis certos.
select p.proname,
       has_function_privilege('anon', p.oid::regprocedure, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid::regprocedure, 'execute') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like any(array['\_rls\_%', '\_p0\_%'])
order by p.proname;

-- 4) View pública do portal: descubra as tabelas de base antes do lote 10.
--    pg_rewrite registra as relações lidas pela regra de seleção da view.
select distinct c.relname as tabela_de_base, c.relkind
from pg_rewrite rw
join pg_class v on v.oid = rw.ev_class
join pg_depend d
  on d.classid = 'pg_rewrite'::regclass
 and d.objid = rw.oid
 and d.refclassid = 'pg_class'::regclass
join pg_class c on c.oid = d.refobjid
where v.relname = 'vw_portal_commission_details'
  and rw.ev_type = '1'
  and c.relkind in ('r','v','m','p')
order by c.relname;

-- 5) Storage continua privado (F6b).
--    Versões recentes do Supabase não expõem storage.policies: as policies
--    ficam em pg_policies (schemaname = 'storage', tablename = 'objects').
select id, public from storage.buckets
where id in ('client_documents','templates','marketing')
order by id;

-- Esperado: nenhuma policy mencionando client_documents, templates ou marketing.
select policyname, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
       coalesce(qual, '') ilike '%client_documents%'
    or coalesce(qual, '') ilike '%templates%'
    or coalesce(qual, '') ilike '%marketing%'
    or coalesce(with_check, '') ilike '%client_documents%'
    or coalesce(with_check, '') ilike '%templates%'
    or coalesce(with_check, '') ilike '%marketing%'
  )
order by policyname;
