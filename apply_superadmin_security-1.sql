-- 1. Adicionar a coluna is_superadmin se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_superadmin') THEN
      ALTER TABLE users ADD COLUMN is_superadmin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Definir os usuários fundadores como Super Administradores
-- IMPORTANTE: Substitua os e-mails abaixo pelos e-mails reais dos donos do sistema
UPDATE users SET is_superadmin = TRUE WHERE email IN ('alcantarus@gmail.com', 'admin@admin.com');

-- 3. Atualizar as Políticas de Segurança (RLS) para a tabela users
-- Habilitar RLS se ainda não estiver
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Remover a política permissiva geral se existir
DROP POLICY IF EXISTS "Allow all access to users" ON users;

-- Criar política de SELECT (todos autenticados podem ler)
CREATE POLICY "Users can read users" ON users
FOR SELECT
USING (true);

-- Criar política de INSERT
-- Um usuário pode ser criado SE:
-- 1. O usuário logado é um superadmin
-- OU
-- 2. O novo usuário NÃO é um superadmin
CREATE POLICY "Users can insert users" ON users
FOR INSERT
WITH CHECK (
  (SELECT is_superadmin FROM users WHERE email = auth.jwt()->>'email') = TRUE
  OR 
  is_superadmin IS NOT TRUE
);

-- Criar nova política de UPDATE:
-- Um usuário pode ser atualizado SE:
-- 1. O usuário logado é um superadmin
-- OU
-- 2. O usuário alvo NÃO é um superadmin (ou seja, admins comuns podem editar outros admins comuns/usuários)
CREATE POLICY "Superadmin protected update" ON users
FOR UPDATE
USING (
  (SELECT is_superadmin FROM users WHERE email = auth.jwt()->>'email') = TRUE
  OR 
  is_superadmin IS NOT TRUE
);

-- Criar nova política de DELETE:
-- Um usuário pode ser excluído SE:
-- 1. O usuário logado é um superadmin
-- OU
-- 2. O usuário alvo NÃO é um superadmin
CREATE POLICY "Superadmin protected delete" ON users
FOR DELETE
USING (
  (SELECT is_superadmin FROM users WHERE email = auth.jwt()->>'email') = TRUE
  OR 
  is_superadmin IS NOT TRUE
);
