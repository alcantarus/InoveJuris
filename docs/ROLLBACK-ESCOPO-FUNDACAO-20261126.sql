-- ROLLBACK — fundação do Escopo de Ambiente (T3/T4a)
-- 26/11/2026
--
-- Desfaz somente o que docs/FORWARD-ESCOPO-FUNDACAO-20261126.sql criou:
--   - remove os dois helpers;
--   - remove a configuração tenant_test_scope APENAS se o valor for o exato
--     valor criado pelo forward (se você tiver mudado para 'dedicated', fica).
-- Não toca organizations, policies, views nem dado de negócio.
--
-- REGRA: banco único; production/test são valores de environment.

begin;

drop function if exists public._rls_organization_id();
drop function if exists public._rls_test_shared();

delete from public.system_settings s
 where s.key = 'tenant_test_scope'
   and s.environment = 'production'
   and s.value = '{"mode":"shared"}'::jsonb;

raise notice 'Rollback da fundação concluído (helpers e configuração padrão).';

commit;
