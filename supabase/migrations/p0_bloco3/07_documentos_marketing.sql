-- Lote 07 — documentos, marketing, leads e notificações

do $$
begin
  perform public._p0_drop_permissive(array[
    'document_templates', 'template_variables', 'birthday_templates',
    'birthday_messages', 'marketing_logs', 'leads', 'notifications'
  ]);
  perform public._p0_apply_isolation(array[
    'document_templates', 'template_variables', 'birthday_templates',
    'birthday_messages', 'marketing_logs', 'leads', 'notifications'
  ]);
end $$;
