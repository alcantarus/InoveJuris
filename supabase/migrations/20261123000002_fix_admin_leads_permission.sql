-- Correção de dado: perfil Administrador sem o vínculo `access_leads`.
--
-- O card "Administrador" na tela Perfis é exibido como "acesso total", mas o
-- vínculo com a permissão `access_leads` não existia em `role_permissions`.
-- Isso também fazia com que usuários salvos pela tela Usuários com esse perfil
-- recebessem canAccessLeads = false (o formulário deriva do slug).
--
-- Idempotente: ON CONFLICT (role_id, permission_id) DO NOTHING.

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador'
  and p.slug = 'access_leads'
on conflict (role_id, permission_id) do nothing;

-- Verificação (esperado: 1 linha por ambiente em que exista Administrador).
select r.name, r.environment, p.slug
from public.roles r
join public.role_permissions rp on rp.role_id = r.id
join public.permissions p on p.id = rp.permission_id
where r.name = 'Administrador' and p.slug = 'access_leads'
order by r.environment;
