-- FORWARD - corrigir environment dos 24 registros em conflito
-- 26/11/2026
--
-- Autorizado pelo usuario apos a consulta tabular
-- docs/VERIFY-REGISTROS-24-AMBIENTE-20261126.sql.
--
-- So atualiza environment: production -> test em:
--   1 pagamento    (c2c02242-89a9-4e63-8655-cde4878a4dcc)
--   23 permissoes  (role_permissions das roles 104/105)
--
-- organization_id NAO e alterado em nenhuma linha.
-- Nenhuma linha e apagada.
--
-- Guardas: se nao encontrar exatamente 1 + 23, o script aborta
-- e nao altera nada.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  v_pag bigint;
  v_perm bigint;
  v_total_prod_demo bigint;
  v_tem_backup boolean;
begin
  if not exists (
    select 1 from public.organizations
     where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
       and name = 'Alcântara Advocacia'
       and slug = 'alcantara-advocacia'
       and is_demo is false
  ) then
    raise exception 'Abortando: organizacao de production nao confere';
  end if;

  if not exists (
    select 1 from public.organizations
     where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
       and name = 'InoveJuris Demonstração'
       and slug = 'inovejuris-demo-homologacao'
       and is_demo is true
  ) then
    raise exception 'Abortando: organizacao de test nao confere';
  end if;

  if to_regclass('public._correcao_ambiente_24_20261126') is not null then
    execute 'select exists (select 1 from public._correcao_ambiente_24_20261126)'
      into v_tem_backup;
    if v_tem_backup then
      raise exception 'Abortando: backup anterior existe; rode o rollback primeiro';
    end if;
  end if;

  select count(*) into v_pag
    from public.payments p
    join public.installments i on i.id = p.installment_id
    join public.contracts c on c.id = i.contract_id
   where p.environment = 'production'
     and p.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
     and i.environment = 'test'
     and c.environment = 'test';

  select count(*) into v_perm
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
   where rp.environment = 'production'
     and rp.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
     and r.environment = 'test'
     and r.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid;

  if v_pag <> 1 then
    raise exception 'Abortando: esperado 1 pagamento, encontrado %', v_pag;
  end if;

  if v_perm <> 23 then
    raise exception 'Abortando: esperado 23 permissoes, encontrado %', v_perm;
  end if;

  select (select count(*) from public.payments
           where environment = 'production'
             and organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)
       + (select count(*) from public.role_permissions
           where environment = 'production'
             and organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)
    into v_total_prod_demo;

  if v_total_prod_demo <> 24 then
    raise exception 'Abortando: total production/Demonstracao e %, esperado 24', v_total_prod_demo;
  end if;
end $$;

drop table if exists public._correcao_ambiente_24_20261126;

create table public._correcao_ambiente_24_20261126 (
  id bigserial primary key,
  tabela text not null,
  pk jsonb not null,
  environment_anterior text not null,
  alterado_em timestamptz not null default now(),
  unique (tabela, pk)
);

insert into public._correcao_ambiente_24_20261126 (tabela, pk, environment_anterior)
select 'payments',
       jsonb_build_object('id', p.id),
       p.environment::text
  from public.payments p
  join public.installments i on i.id = p.installment_id
  join public.contracts c on c.id = i.contract_id
 where p.environment = 'production'
   and p.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
   and i.environment = 'test'
   and c.environment = 'test';

insert into public._correcao_ambiente_24_20261126 (tabela, pk, environment_anterior)
select 'role_permissions',
       jsonb_build_object('id', rp.id),
       rp.environment::text
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
 where rp.environment = 'production'
   and rp.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
   and r.environment = 'test'
   and r.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid;

do $$
declare
  v_n bigint;
  v_total bigint := 0;
  v_backup bigint;
begin
  select count(*) into v_backup
    from public._correcao_ambiente_24_20261126;

  if v_backup <> 24 then
    raise exception 'Abortando: backup capturou % linhas, esperado 24', v_backup;
  end if;

  update public.payments p
     set environment = 'test'
    from public.installments i
    join public.contracts c on c.id = i.contract_id
   where i.id = p.installment_id
     and p.environment = 'production'
     and p.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
     and i.environment = 'test'
     and c.environment = 'test';
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  update public.role_permissions rp
     set environment = 'test'
    from public.roles r
   where r.id = rp.role_id
     and rp.environment = 'production'
     and rp.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
     and r.environment = 'test'
     and r.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  if v_total <> 24 then
    raise exception 'Abortando: atualizou % linhas, esperado 24', v_total;
  end if;

  raise notice 'Correcao concluida: % linhas ajustadas', v_total;
end $$;

commit;
