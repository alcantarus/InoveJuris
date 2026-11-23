-- Diagnóstico de IO do Supabase — SOMENTE leitura de estatísticas
-- 23/11/2026
--
-- Não executa EXPLAIN ANALYZE, não roda count(*) nas tabelas e não faz DDL/DML.
-- Apenas lê pg_stat_io / pg_stat_statements / pg_stat_database / pg_stat_user_tables,
-- que são visões de estatísticas já mantidas pelo Postgres. Seguro para rodar
-- mesmo com o orçamento de IO no limite. Termina em ROLLBACK.
--
-- Objetivo: identificar de onde vem o consumo de IO antes de repetir medições
-- ou decidir rollback do P1.1. Devolve UMA célula JSON (`io`).

begin;

do $$
declare
  v_top        jsonb;
  v_io         jsonb;
  v_tables     jsonb;
begin
  -- 1) Queries com mais leitura de blocos (pg_stat_statements).
  --    Constants já vêm normalizadas como $1; o texto é truncado.
  begin
    select jsonb_agg(jsonb_build_object(
             'queryid',        q.queryid,
             'query',          left(q.query, 220),
             'calls',          q.calls,
             'total_ms',       round(q.total_exec_time::numeric, 2),
             'mean_ms',        round(q.mean_exec_time::numeric, 2),
             'blks_read_total', q.blks_read_total,
             'shared_hit',     q.shared_blks_hit,
             'shared_read',    q.shared_blks_read,
             'temp_read',      q.temp_blks_read,
             -- PG17 renomeou blk_read_time -> shared_blk_read_time.
             -- to_jsonb aceita as duas versões da extensão sem quebrar.
             'blk_read_ms',    round(q.blk_read_ms, 2),
             'blk_write_ms',   round(q.blk_write_ms, 2)
           ) order by q.blks_read_total desc, q.total_exec_time desc)
      into v_top
      from (
        select s.*,
               (s.shared_blks_read + s.local_blks_read + s.temp_blks_read) as blks_read_total,
               coalesce(to_jsonb(s)->>'shared_blk_read_time',
                        to_jsonb(s)->>'blk_read_time', '0')::numeric as blk_read_ms,
               coalesce(to_jsonb(s)->>'shared_blk_write_time',
                        to_jsonb(s)->>'blk_write_time', '0')::numeric as blk_write_ms
          from pg_stat_statements s
         order by (s.shared_blks_read + s.local_blks_read + s.temp_blks_read) desc
         limit 15
      ) q;
  exception when undefined_table then
    v_top := '[]'::jsonb;
  end;

  -- 2) IO agregado por backend/contexto (PG 16+; PG 17.6 em produção).
  begin
    select jsonb_agg(jsonb_build_object(
             'backend',    i.backend_type,
             'object',     i.object,
             'context',    i.context,
             'reads',      i.reads,
             'read_ms',    round(i.read_time::numeric, 2),
             'writes',     i.writes,
             'write_ms',   round(i.write_time::numeric, 2),
             'hits',       i.hits,
             'evictions',  i.evictions,
             'fsyncs',     i.fsyncs
           ) order by (i.reads + i.writes) desc)
      into v_io
      from (
        select * from pg_stat_io
       where (reads + writes + evictions + hits) > 0
       order by (reads + writes) desc
       limit 25
      ) i;
  exception when undefined_table then
    v_io := '[]'::jsonb;
  end;

  -- 3) Tabelas com mais leitura de blocos desde o último stats_reset.
  begin
    select jsonb_agg(jsonb_build_object(
             'tabela',       t.schemaname || '.' || t.relname,
             'heap_read',    t.heap_blks_read,
             'heap_hit',     t.heap_blks_hit,
             'idx_read',     t.idx_blks_read,
             'idx_hit',      t.idx_blks_hit,
             'read_total',   (t.heap_blks_read + t.idx_blks_read)
           ) order by (t.heap_blks_read + t.idx_blks_read) desc)
      into v_tables
      from (
        select * from pg_stat_user_tables
       order by (heap_blks_read + idx_blks_read) desc
       limit 15
      ) t;
  exception when others then
    v_tables := '[]'::jsonb;
  end;

  perform set_config('io.top',    coalesce(v_top, '[]'::jsonb)::text, true);
  perform set_config('io.pg',     coalesce(v_io, '[]'::jsonb)::text, true);
  perform set_config('io.tables', coalesce(v_tables, '[]'::jsonb)::text, true);
end $$;

select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'database',    current_database(),
  'pg_version',  current_setting('server_version'),

  'aviso', 'Este script nao executa queries de usuario: apenas le estatisticas ja acumuladas.',

  'database_stats', (
    select jsonb_build_object(
             'blks_read',  d.blks_read,
             'blks_hit',   d.blks_hit,
             'hit_ratio_pct', round(
               100.0 * d.blks_hit / nullif(d.blks_hit + d.blks_read, 0), 2
             ),
             'stats_reset', d.stats_reset
           )
      from pg_stat_database d
     where d.datname = current_database()
  ),

  'top_queries_por_blocos_lidos', current_setting('io.top')::jsonb,
  'io_por_backend_e_contexto',    current_setting('io.pg')::jsonb,
  'top_tabelas_por_blocos_lidos', current_setting('io.tables')::jsonb
)) as io;

rollback;
