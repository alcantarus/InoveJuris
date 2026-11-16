-- Script para remover as tabelas legadas do módulo legal_
-- Este script deve ser executado no SQL Editor do Supabase

DROP TABLE IF EXISTS legal_contratos_receipts CASCADE;
DROP TABLE IF EXISTS legal_contratos_honorarios_split CASCADE;
DROP TABLE IF EXISTS legal_contratos_commission_payments CASCADE;
DROP TABLE IF EXISTS legal_contratos_commissions CASCADE;
DROP TABLE IF EXISTS legal_contratos_installments CASCADE;
DROP TABLE IF EXISTS legal_contratos_products CASCADE;
DROP TABLE IF EXISTS legal_contratos_main CASCADE;
DROP TABLE IF EXISTS legal_contract_types CASCADE;

-- Remover colunas legadas da tabela de usuários
ALTER TABLE users DROP COLUMN IF EXISTS "canAccessContracts";
ALTER TABLE users DROP COLUMN IF EXISTS "canAccessContractsWizard";

-- Remover permissões legadas da tabela de permissões
DELETE FROM permissions WHERE slug IN ('access_contracts', 'access_contracts_wizard');
