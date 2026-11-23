-- P0 / Bloco 2 — versionamento do estado de Storage já aplicado em produção
--
-- A F6b (18/11/2026) já deixou os buckets privados e removeu as 17 policies
-- permissivas em produção. Este arquivo apenas deixa o repositório coerente
-- com esse estado e garante que o bucket `marketing` exista como privado.
--
-- Nada aqui é executado pelo agente. Aplicar no SQL Editor do Supabase:
-- a service_role da aplicação não é dona de storage.objects (42501).

-- Buckets de domínio: privados. Operação idempotente (no-op em produção).
update storage.buckets
   set public = false
 where id in ('client_documents', 'templates', 'marketing');

-- O bucket `marketing` foi criado fora do código (painel). Versionamos a
-- criação como privado para que um ambiente novo não herde bucket público.
insert into storage.buckets (id, name, public)
values ('marketing', 'marketing', false)
on conflict (id) do update set public = false;

-- Não recriar policies de leitura/escrita: todo acesso a arquivos passa por
-- /api/storage/upload, /api/storage/signed-url e /api/storage/remove, que
-- validam sessão/permissão no servidor e usam a service_role.
--
-- Verificação pós-aplicação:
--   select id, public from storage.buckets
--    where id in ('client_documents','templates','marketing');
--   select count(*) as policies from storage.policies
--    where bucket_id in ('client_documents','templates','marketing');
-- Esperado: public = false nos três e policies = 0.
