-- FORWARD — isolamento da view `contract_receivables_summary`
-- 26/11/2026
--
-- REGRA PERMANENTE: banco único; `production` e `test` são valores da coluna
-- `environment`, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Medição prévia (obrigatória, já feita):
--   produção -> view_total=125, próprias=106, de outro=19, RLS=106
--   test     -> view_total=125, próprias=19,  de outro=106, RLS=19
-- Resultado em docs/ISOLAMENTO-VIEW-RESULTADO-20261126.md.
--
-- O que muda: somente a opção `security_invoker` da view. A definição SQL e
-- todos os dados de negócio permanecem idênticos. Com a opção ligada, a view
-- passa a avaliar o RLS de contracts/clients/installments como o usuário
-- chamador, em vez de ler com os privilégios do dono.
--
-- PRÉ-CHECAGEM: `authenticated` precisa de SELECT nas três tabelas-base. Se
-- faltar algum, o bloco aborta antes de alterar a view.
--
-- NÃO EXECUTAR SEM AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO.
-- Depois: rodar docs/VERIFY-ISOLAMENTO-VIEW-20261126.sql.
-- Para desfazer: docs/ROLLBACK-ISOLAMENTO-VIEW-20261126.sql.

begin;

do $$
declare
  v_reloptions text;
  v_faltando   text[] := array[]::text[];
begin
  select coalesce(array_to_string(c.reloptions, ','), '')
    into v_reloptions
    from pg_class c
   where c.oid = 'public.contract_receivables_summary'::regclass;

  -- Idempotente: se já estiver aplicado, não faz nada.
  if v_reloptions ilike '%security_invoker=on%' then
    raise notice 'security_invoker já está ligado na view; nada a alterar.';
  else
    if not has_table_privilege('authenticated', 'public.contracts', 'SELECT') then
      v_faltando := array_append(v_faltando, 'contracts');
    end if;
    if not has_table_privilege('authenticated', 'public.clients', 'SELECT') then
      v_faltando := array_append(v_faltando, 'clients');
    end if;
    if not has_table_privilege('authenticated', 'public.installments', 'SELECT') then
      v_faltando := array_append(v_faltando, 'installments');
    end if;

    if coalesce(array_length(v_faltando, 1), 0) > 0 then
      raise exception
        'Pré-requisito faltando: authenticated sem SELECT em %. Nada foi alterado.',
        array_to_string(v_faltando, ', ');
    end if;

    execute 'alter view public.contract_receivables_summary set (security_invoker = on)';
    raise notice 'security_invoker ligado na view contract_receivables_summary.';
  end if;
end $$;

commit;
