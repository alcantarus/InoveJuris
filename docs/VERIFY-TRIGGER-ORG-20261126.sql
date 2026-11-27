-- VERIFY - situacao do trigger de preenchimento de organization_id
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Funciona antes e depois do FORWARD-TRIGGER-ORG.
-- Antes: funcao/trigger ausentes.
-- Depois: funcao presente e trigger em todas as tabelas alvo.

begin;

with alvos as (
  select c.relname as tabela
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and exists (
           select 1 from pg_attribute a
            where a.attrelid = c.oid
              and a.attname = 'organization_id'
              and a.attnum > 0
              and not a.attisdropped
     )
     and exists (
           select 1 from pg_attribute a
            where a.attrelid = c.oid
              and a.attname = 'environment'
              and a.attnum > 0
              and not a.attisdropped
     )
     and c.relname not like 'backup\_%'
     and c.relname <> 'birthday_templates_backup'
),
com_trigger as (
  select distinct c.relname as tabela
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and t.tgname = 'trg_fill_organization_id'
     and not t.tgisinternal
),
funcao as (
  select exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'fn_fill_organization_id_on_insert'
  ) as existe
),
resumo as (
  select
    (select existe from funcao) as funcao_existe,
    (select count(*) from alvos) as tabelas_alvo,
    (select count(*) from com_trigger) as tabelas_com_trigger,
    (select coalesce(jsonb_agg(a.tabela order by a.tabela), '[]'::jsonb)
       from alvos a
      where a.tabela not in (select tabela from com_trigger)) as tabelas_sem_trigger
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'regra', jsonb_build_object(
    'production', 'eaf29983-1998-40a4-bd07-03ea09b4adfa',
    'test', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'
  ),
  'funcao_existe', funcao_existe,
  'tabelas_alvo', tabelas_alvo,
  'tabelas_com_trigger', tabelas_com_trigger,
  'tabelas_sem_trigger', tabelas_sem_trigger,
  'gatilho_ativo', (
        funcao_existe
    and tabelas_alvo > 0
    and jsonb_array_length(tabelas_sem_trigger) = 0
  )
)) as resumo
from resumo;

rollback;
