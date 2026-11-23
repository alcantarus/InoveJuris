-- Lote 06 — processos, prazos, Publicações e logs de integração

do $$
begin
  perform public._p0_drop_permissive(array[
    'processes', 'process_deadlines', 'process_deadline_history',
    'process_sync_log', 'publications', 'publication_sync_log',
    'integration_logs', 'geo_cache'
  ]);
  perform public._p0_apply_isolation(array[
    'processes', 'process_deadlines', 'process_deadline_history',
    'process_sync_log', 'publications', 'publication_sync_log',
    'integration_logs', 'geo_cache'
  ]);
end $$;
