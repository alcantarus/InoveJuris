-- ==============================================================================
-- SCRIPT DE INTEGRAÇÃO RLS + SUPABASE AUTH
-- ==============================================================================

-- 1. Função para obter a organização atual validada pelo Auth
CREATE OR REPLACE FUNCTION public.get_auth_organization()
RETURNS uuid AS $$
DECLARE
  v_org_id_text text;
  v_org_id uuid;
BEGIN
  -- Obtém o ID da organização do contexto da sessão (definido pelo app)
  v_org_id_text := current_setting('custom.organization_id', true);
  
  IF v_org_id_text IS NULL OR v_org_id_text = '' THEN
    RETURN NULL;
  END IF;

  v_org_id := v_org_id_text::uuid;
  
  -- VALIDAÇÃO: Verifica se o usuário autenticado (via Supabase Auth) 
  -- tem vínculo com esta organização na tabela user_organizations
  IF EXISTS (
    SELECT 1 FROM public.user_organizations uo
    JOIN public.users u ON u.id = uo.user_id
    WHERE u.supabase_uid = auth.uid() 
    AND uo.organization_id = v_org_id
  ) THEN
    RETURN v_org_id;
  END IF;
  
  -- Se for Superadmin, permite acesso a qualquer organização (opcional)
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE supabase_uid = auth.uid() AND is_superadmin = true
  ) THEN
    RETURN v_org_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Aplicar RLS em tabelas principais

-- TABELA: clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento por Organização em clients" ON public.clients;
CREATE POLICY "Isolamento por Organização em clients" ON public.clients
FOR ALL USING (organization_id = get_auth_organization())
WITH CHECK (organization_id = get_auth_organization());

-- TABELA: processes
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento por Organização em processes" ON public.processes;
CREATE POLICY "Isolamento por Organização em processes" ON public.processes
FOR ALL USING (organization_id = get_auth_organization())
WITH CHECK (organization_id = get_auth_organization());

-- TABELA: kanban_boards
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento por Organização em kanban_boards" ON public.kanban_boards;
CREATE POLICY "Isolamento por Organização em kanban_boards" ON public.kanban_boards
FOR ALL USING (organization_id = get_auth_organization())
WITH CHECK (organization_id = get_auth_organization());

-- TABELA: contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento por Organização em contracts" ON public.contracts;
CREATE POLICY "Isolamento por Organização em contracts" ON public.contracts
FOR ALL USING (organization_id = get_auth_organization())
WITH CHECK (organization_id = get_auth_organization());

-- TABELA: installments
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento por Organização em installments" ON public.installments;
CREATE POLICY "Isolamento por Organização em installments" ON public.installments
FOR ALL USING (organization_id = get_auth_organization())
WITH CHECK (organization_id = get_auth_organization());

-- 3. Notificar o PostgREST para recarregar as configurações
NOTIFY pgrst, 'reload config';
