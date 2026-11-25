-- ============================================================================
-- DIAGNÓSTICO — erro "Não é possível reabrir um contrato quitado."
-- Data: 25/11/2026
--
-- Contexto:
--   O usuário tentou um RECEBIMENTO PARCIAL (rpc_receber_parcela_com_metodo)
--   e o PostgREST devolveu P0001 "Não é possível reabrir um contrato quitado."
--   A mensagem vem do gatilho de proteção de contratos quitados.
--
-- Hipótese principal (a confirmar):
--   O desdobramento faz UPDATE na parcela original (que passa a 'Quitado')
--   ANTES de inserir a parcela residual. O gatilho de recálculo roda a cada
--   statement: no intervalo, o contrato fica momentaneamente 'Quitado'
--   quando aquela é a última parcela em aberto. Ao inserir a residual, o
--   recálculo tenta 'Quitado' -> 'Parcial' e a proteção bloqueia.
--
-- Este script é SOMENTE LEITURA. Termina em ROLLBACK. Nada é alterado.
--
-- Devolve uma única célula: diagnostico_recebimento_parcial
-- ============================================================================

begin;

select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'pg_version', current_setting('server_version'),

  -- 1) Gatilhos de proteção/recálculo (nome e ordem de disparo)
  'gatilhos_contratos', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nome', t.tgname,
             'definicao', pg_get_triggerdef(t.oid)
           ) order by t.tgname), '[]'::jsonb)
      from pg_trigger t
     where t.tgrelid = 'public.contracts'::regclass
       and not t.tgisinternal
  ),

  'gatilhos_parcelas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nome', t.tgname,
             'definicao', pg_get_triggerdef(t.oid)
           ) order by t.tgname), '[]'::jsonb)
      from pg_trigger t
     where t.tgrelid = 'public.installments'::regclass
       and not t.tgisinternal
  ),

  -- 2) Definições completas das funções envolvidas (todas as sobrecargas)
  'funcoes', (
    select coalesce(jsonb_object_agg(x.proname, x.defs), '{}'::jsonb)
      from (
        select p.proname,
               jsonb_agg(pg_get_functiondef(p.oid) order by p.oid) as defs
          from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname in (
             'prevent_update_delete_paid_contract',
             'prevent_update_delete_paid_installment',
             'fn_protect_contracts_status',
             'fn_recalculate_contract_totals',
             'rpc_recebimento_com_desdobramento',
             'rpc_receber_parcela_com_metodo'
           )
         group by p.proname
      ) x
  ),

  -- 3) População sob risco: parcelas em que o pagamento parcial deixaria o
  --    contrato momentaneamente 'Quitado' (é a única parcela em aberto).
  'parcelas_ultima_em_aberto', (
    with base as (
      select i.id,
             i.contract_id,
             i.environment,
             i."installmentNumber" as numero,
             i."dueDate" as vencimento,
             i.amount,
             coalesce(i."amountPaid", 0) as amount_paid,
             i.status,
             greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0) as saldo,
             (lower(coalesce(i.status, '')) not in
               ('quitado', 'cancelado', 'cancelada', 'estornado')) as entra_no_aberto
        from public.installments i
    ),
    aberto_por_contrato as (
      select b.contract_id,
             sum(b.saldo) filter (where b.entra_no_aberto) as aberto
        from base b
       group by b.contract_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'contract_id', b.contract_id,
             'ambiente', b.environment,
             'cliente', cl.name,
             'contrato_status', c.status,
             'contrato_valor', c."contractValue",
             'contrato_recebido', c."amountReceived",
             'contrato_a_receber', c."amountReceivable",
             'installment_id', b.id,
             'numero', b.numero,
             'vencimento', b.vencimento,
             'amount', b.amount,
             'amount_paid', b.amount_paid,
             'saldo', b.saldo,
             'status_parcela', b.status,
             'outras_parcelas_em_aberto', (a.aberto - b.saldo)
           ) order by b.vencimento nulls last, b.id), '[]'::jsonb)
      from base b
      join aberto_por_contrato a on a.contract_id = b.contract_id
      join public.contracts c on c.id = b.contract_id
      left join public.clients cl on cl.id = c.client_id
     where b.entra_no_aberto
       and b.saldo > 0.01
       and (a.aberto - b.saldo) <= 0.01
  ),

  -- 4) Caminho alternativo: contrato já gravado como 'Quitado' com saldo aberto
  'contratos_quitados_com_saldo_aberto', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'contract_id', c.id,
             'ambiente', c.environment,
             'status', c.status,
             'amount_receivable', c."amountReceivable",
             'parcelas_com_saldo', x.parcelas,
             'saldo_aberto', x.saldo
           ) order by c.id), '[]'::jsonb)
      from public.contracts c
      join (
        select i.contract_id,
               count(*) as parcelas,
               sum(greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0)) as saldo
          from public.installments i
         where lower(coalesce(i.status, '')) not in
               ('quitado', 'cancelado', 'cancelada', 'estornado')
         group by i.contract_id
        having sum(greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0)) > 0.01
      ) x on x.contract_id = c.id
     where lower(coalesce(c.status, '')) = 'quitado'
  )
)) as diagnostico_recebimento_parcial;

rollback;
