-- ROLLBACK — `Estornado` como título a receber (parte estrutural)
-- 26/11/2026
--
-- REGRA PERMANENTE: um único banco; production e test são valores da coluna
-- environment, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Desfaz somente o FORWARD estrutural, restaurando as definições originais
-- guardadas em public.backup_estornado_recebivel_20261126. Não altera dados de
-- negócio. Idempotente: se o backup não existir (forward nunca aplicado),
-- avisa e não faz nada.
--
-- Após o rollback, rodar docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql: a
-- estrutura deve voltar a mostrar 'estornado' na view e nas views de dashboard.
-- A tabela de backup é mantida para auditoria.

begin;

do $rb$
declare
  r      record;
  v_with text;
  v_def  text;
  v_ok   int := 0;
begin
  if to_regclass('public.backup_estornado_recebivel_20261126') is null then
    raise notice 'Backup inexistente: o forward não foi aplicado. Nada a desfazer.';
    return;
  end if;

  for r in
    select objeto, nome, definicao, reloptions
      from public.backup_estornado_recebivel_20261126
     order by objeto
  loop
    if r.objeto like 'view:%' then
      v_with := case
        when coalesce(r.reloptions, '') ilike '%security_invoker=on%' then ' with (security_invoker = on)'
        else ''
      end;
      v_def := regexp_replace(coalesce(r.definicao, ''), ';\s*$', '');
      execute format('create or replace view public.%I%s as %s', r.nome, v_with, v_def);
      v_ok := v_ok + 1;

    elsif r.objeto like 'function:%' then
      execute r.definicao;
      v_ok := v_ok + 1;
    end if;
  end loop;

  if v_ok = 0 then
    raise notice 'Backup vazio. Nada a desfazer.';
  else
    raise notice 'Restaurados % objetos a partir do backup de 26/11/2026.', v_ok;
  end if;
end
$rb$;

commit;
