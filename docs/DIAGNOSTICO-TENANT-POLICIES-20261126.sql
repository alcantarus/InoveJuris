-- Diagnóstico focado — organizations e policies com `true` literal
-- 26/11/2026
--
-- Complemento de docs/DIAGNOSTICO-TENANT-CRITICO-20261126.sql.
-- O resumo anterior mediu 63 policies e apontou 50 com `true` literal, mas o
-- detector era um regex excessivamente amplo: ele capturava o `true` de
-- current_setting('request.jwt.claims'::text, true), não um USING (true).
-- Este arquivo usa expressão inteira igual a 'true' e lista apenas policies
-- realmente permissivas, além das linhas de user_organizations. Nada é alterado.
--
-- Como usar:
--   1) Execute o arquivo INTEIRO em uma única célula do SQL Editor.
--   2) Copie o JSON devolvido e cole na resposta.
--   3) A transação termina em ROLLBACK.
--
-- Ambiente declarado: 'production' e 'test' (banco único, dois rótulos).

begin;

select jsonb_pretty(jsonb_build_object(
  'medido_em', now(),
  'ambiente_declarado', 'production + test',

  'organizations_linhas', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'id', o.id,
                 'name', o.name,
                 'slug', o.slug,
                 'is_demo', o.is_demo,
                 'created_at', o.created_at
               )
               order by o.created_at nulls last, o.slug
             ),
             '[]'::jsonb
           )
      from public.organizations o
  ),

  'user_organizations', jsonb_build_object(
    'colunas', (
      select coalesce(jsonb_agg(column_name order by ordinal_position), '[]'::jsonb)
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'user_organizations'
    ),
    'linhas', (
      select coalesce(jsonb_agg(row_to_json(uo)), '[]'::jsonb)
        from public.user_organizations uo
    )
  ),

  'policies_com_true_literal', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'schemaname', p.schemaname,
                 'tablename', p.tablename,
                 'policyname', p.policyname,
                 'permissive', p.permissive,
                 'cmd', p.cmd,
                 'roles', p.roles,
                 'qual', p.qual,
                 'with_check', p.with_check
               )
               order by p.tablename, p.policyname
             ),
             '[]'::jsonb
           )
      from pg_policies p
     where p.schemaname = 'public'
       and (
         lower(btrim(coalesce(p.qual, ''))) = 'true'
         or lower(btrim(coalesce(p.with_check, ''))) = 'true'
       )
  ),

  'policies_por_tabela', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', x.tablename,
                 'total', x.total,
                 'com_true', x.com_true
               )
               order by x.tablename
             ),
             '[]'::jsonb
           )
      from (
        select p.tablename,
               count(*) as total,
               count(*) filter (
                 where lower(btrim(coalesce(p.qual, ''))) = 'true'
                    or lower(btrim(coalesce(p.with_check, ''))) = 'true'
               ) as com_true
          from pg_policies p
         where p.schemaname = 'public'
         group by p.tablename
      ) x
  )
)) as resumo;

-- Nada é commitado.
rollback;
