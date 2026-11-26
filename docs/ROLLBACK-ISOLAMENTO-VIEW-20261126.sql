-- ROLLBACK — isolamento da view `contract_receivables_summary`
-- 26/11/2026
--
-- REGRA PERMANENTE: banco único; `production` e `test` são valores da coluna
-- `environment`, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Desfaz somente a opção aplicada por
-- docs/FORWARD-ISOLAMENTO-VIEW-20261126.sql, devolvendo a view ao estado
-- original medido em 26/11 (sem `security_invoker`). A definição SQL e os
-- dados de negócio não são alterados.
--
-- Idempotente: se a opção já estiver desligada, não faz nada.
-- Para confirmar o estado após o rollback, rodar
-- docs/VERIFICACAO-ISOLAMENTO-VIEW-20261126.sql (deve voltar a mostrar
-- `security_invoker=nao` e 19/106 linhas cruzadas).

begin;

do $$
declare
  v_reloptions text;
begin
  select coalesce(array_to_string(c.reloptions, ','), '')
    into v_reloptions
    from pg_class c
   where c.oid = 'public.contract_receivables_summary'::regclass;

  if v_reloptions ilike '%security_invoker=on%' then
    execute 'alter view public.contract_receivables_summary reset (security_invoker)';
    raise notice 'security_invoker desligado; view voltou ao estado original.';
  else
    raise notice 'security_invoker já estava desligado; nada a desfazer.';
  end if;
end $$;

commit;
