-- FORWARD — braço `test` compartilhado (T4b)
-- 26/11/2026
--
-- REGRA PERMANENTE: banco único; `production` e `test` são valores de
-- `environment`, não bancos separados.
--
-- PRÉ-REQUISITO: docs/FORWARD-ESCOPO-FUNDACAO-20261126.sql aplicado e verificado.
--
-- O que muda:
--   - cria, em TODA tabela public que tenha `organization_id` e `environment`,
--     a policy permissiva `P0 tenant teste compartilhado`:
--       *Cmd ALL* nas tabelas que já têm policy ALL (mantém leitura/escrita);
--       *Cmd SELECT* nas tabelas somente leitura (ex.: audit_logs).
--
-- Efeito: em `test`, qualquer sessão válida pode ver e editar registros de
-- qualquer organização. `production` NÃO é alterado: a policy exige
-- environment = 'test'.
--
-- A autoria continua rastreável por performed_by/created_by. Nenhuma linha é
-- atualizada, nenhuma organization_id é reescrita.
--
-- NÃO EXECUTAR SEM AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO.
-- Depois: rodar docs/VERIFY-ESCOPO-RLS-TESTE-20261126.sql.
-- Para desfazer: docs/ROLLBACK-ESCOPO-RLS-TESTE-20261126.sql.

begin;

do $$
declare
  r record;
  v_policy text := 'P0 tenant teste compartilhado';
  v_expr   text := $e$public._rls_can_access(environment) and environment = 'test' and public._rls_test_shared()$e$;
  v_all    boolean;
  v_total  integer := 0;
begin
  -- Pré-requisito: helpers e configuração precisam existir.
  if to_regprocedure('public._rls_organization_id()') is null
     or to_regprocedure('public._rls_test_shared()') is null then
    raise exception 'Fundação não aplicada: helpers ausentes. Nada foi alterado.';
  end if;

  if not coalesce(public._rls_test_shared(), false) then
    raise exception 'tenant_test_scope não está shared em production. Nada foi alterado.';
  end if;

  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid
                and a.attname = 'organization_id'
                and not a.attisdropped
           )
       and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid
                and a.attname = 'environment'
                and not a.attisdropped
           )
     order by c.relname
  loop
    execute format('drop policy if exists %I on public.%I', v_policy, r.relname);

    select exists (
             select 1
               from pg_policies p
              where p.schemaname = 'public'
                and p.tablename = r.relname
                and p.cmd = 'ALL'
           )
      into v_all;

    if v_all then
      execute format(
        'create policy %I on public.%I for all to anon, authenticated using (%s) with check (%s)',
        v_policy, r.relname, v_expr, v_expr
      );
    else
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (%s)',
        v_policy, r.relname, v_expr
      );
    end if;

    v_total := v_total + 1;
    raise notice 'Policy de teste compartilhado aplicada em % (%).',
      r.relname,
      case when v_all then 'ALL' else 'SELECT' end;
  end loop;

  raise notice 'Total de tabelas com policy de teste compartilhado: %.', v_total;
end $$;

commit;
