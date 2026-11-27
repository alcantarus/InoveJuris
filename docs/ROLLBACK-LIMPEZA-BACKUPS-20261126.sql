-- ROLLBACK - limpeza das tabelas historicas de backup
-- 26/11/2026
--
-- Recria as 17 tabelas removidas por docs/FORWARD-LIMPEZA-BACKUPS-20261126.sql,
-- com a definicao e as linhas capturadas antes da limpeza.
-- Nao toca public.backup_logs nem dado de negocio.
--
-- Fonte local: C:\Users\ALCANTARUS\Backups\InoveJuris\pre-tenant-20261126\rollback-17-tabelas-backup-20261126.sql
-- Arquivo completo, pronto para colar em uma unica celula do SQL Editor.

begin;

drop table if exists public._auth_hardening_policy_backup_20261118;
drop table if exists public.backup_b11_projecao_20261121;
drop table if exists public.backup_contracts_20261121;
drop table if exists public.backup_contracts_status_endurecimento_20261121;
drop table if exists public.backup_contratos_protecao_20261125;
drop table if exists public.backup_estornado_recebivel_20261126;
drop table if exists public.backup_estornado_recebivel_dados_20261126;
drop table if exists public.backup_installments_20261121;
drop table if exists public.backup_payments_20261121;
drop table if exists public.backup_recebimento_desdobramento_20261125;
drop table if exists public.backup_test_ajuste_final_20261121;
drop table if exists public.backup_test_ajuste_final_pagamentos_20261121;
drop table if exists public.backup_test_contracts_conciliacao_20261121;
drop table if exists public.backup_test_installments_conciliacao_20261121;
drop table if exists public.backup_test_pagamentos_conciliacao_20261121;
drop table if exists public.backup_view_receivables_20261121;
drop table if exists public.birthday_templates_backup;

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3



--
-- Name: _auth_hardening_policy_backup_20261118; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._auth_hardening_policy_backup_20261118 (
    captured_at timestamp with time zone,
    schemaname name,
    tablename name,
    policyname name,
    cmd text,
    roles text COLLATE pg_catalog."C",
    qual text COLLATE pg_catalog."C",
    with_check text COLLATE pg_catalog."C"
);


--
-- Name: backup_b11_projecao_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_b11_projecao_20261121 (
    objeto text NOT NULL,
    definicao text,
    capturado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: backup_contracts_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_contracts_20261121 (
    id bigint,
    client_id bigint,
    product_id bigint,
    product text,
    "lawArea" text,
    status text,
    "launchDate" date,
    "contractDate" date,
    "processNumber" text,
    "contractValue" numeric(12,2),
    "paymentMethod" text,
    "installmentsCount" integer,
    "isProBono" boolean,
    "isFinanced" boolean,
    "contractSigned" boolean,
    "proxySigned" boolean,
    "inssProtocol" text,
    "gpsGenerated" boolean,
    "gpsPaid" boolean,
    "inssDeferred" boolean,
    "childbirthDate" date,
    indicator_id bigint,
    "commissionPercent" numeric(5,2),
    "commissionValue" numeric(12,2),
    "commissionPaid" boolean,
    "amountReceivable" numeric(12,2),
    "amountReceived" numeric(12,2),
    observations text,
    environment text,
    created_by bigint,
    updated_by bigint,
    created_at timestamp with time zone,
    lawyer_id bigint,
    base_comissao numeric(12,2),
    gps_forecast_date date,
    gps_payment_date date,
    gps_value numeric(10,2),
    has_gps_control boolean,
    rn_birth_date date,
    rn_name character varying(255),
    rn_sex character varying(50),
    gps_paid_value numeric,
    gps_generated_status boolean,
    organization_id uuid,
    "inssNB" text
);


--
-- Name: backup_contracts_status_endurecimento_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_contracts_status_endurecimento_20261121 (
    objeto text NOT NULL,
    definicao text,
    capturado_em timestamp with time zone DEFAULT now() CONSTRAINT backup_contracts_status_endurecimento_202_capturado_em_not_null NOT NULL
);


--
-- Name: backup_contratos_protecao_20261125; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_contratos_protecao_20261125 (
    objeto text NOT NULL,
    definicao text,
    capturado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: backup_estornado_recebivel_20261126; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_estornado_recebivel_20261126 (
    objeto text NOT NULL,
    nome text NOT NULL,
    definicao text,
    reloptions text,
    capturado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: backup_estornado_recebivel_dados_20261126; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_estornado_recebivel_dados_20261126 (
    contract_id bigint NOT NULL,
    environment text NOT NULL,
    amount_receivable_antes numeric(12,2),
    capturado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: backup_installments_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_installments_20261121 (
    id bigint,
    contract_id bigint,
    "installmentNumber" integer,
    "dueDate" date,
    amount numeric(12,2),
    "amountPaid" numeric(12,2),
    status text,
    interest numeric(12,2),
    fine numeric(12,2),
    environment text,
    created_by bigint,
    updated_by bigint,
    created_at timestamp with time zone,
    original_due_date date,
    organization_id uuid,
    due_date_reason text,
    due_date_adjusted_at timestamp with time zone,
    due_date_adjusted_by bigint
);


--
-- Name: backup_payments_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_payments_20261121 (
    id uuid,
    installment_id bigint,
    amount numeric(12,2),
    payment_date timestamp with time zone,
    account_id bigint,
    category_id bigint,
    description text,
    user_id uuid,
    created_at timestamp with time zone,
    environment text,
    type text,
    created_by bigint,
    updated_by bigint,
    organization_id uuid
);


--
-- Name: backup_recebimento_desdobramento_20261125; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_recebimento_desdobramento_20261125 (
    objeto text NOT NULL,
    definicao text,
    capturado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: backup_test_ajuste_final_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_test_ajuste_final_20261121 (
    id bigint,
    contract_id bigint,
    "installmentNumber" integer,
    "dueDate" date,
    amount numeric(12,2),
    "amountPaid" numeric(12,2),
    status text,
    interest numeric(12,2),
    fine numeric(12,2),
    environment text,
    created_by bigint,
    updated_by bigint,
    created_at timestamp with time zone,
    original_due_date date,
    organization_id uuid,
    due_date_reason text,
    due_date_adjusted_at timestamp with time zone,
    due_date_adjusted_by bigint
);


--
-- Name: backup_test_ajuste_final_pagamentos_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_test_ajuste_final_pagamentos_20261121 (
    id uuid,
    installment_id bigint,
    amount numeric(12,2),
    payment_date timestamp with time zone,
    account_id bigint,
    category_id bigint,
    description text,
    user_id uuid,
    created_at timestamp with time zone,
    environment text,
    type text,
    created_by bigint,
    updated_by bigint,
    organization_id uuid,
    financial_transaction_id bigint,
    reverses_payment_id uuid
);


--
-- Name: backup_test_contracts_conciliacao_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_test_contracts_conciliacao_20261121 (
    id bigint,
    client_id bigint,
    product_id bigint,
    product text,
    "lawArea" text,
    status text,
    "launchDate" date,
    "contractDate" date,
    "processNumber" text,
    "contractValue" numeric(12,2),
    "paymentMethod" text,
    "installmentsCount" integer,
    "isProBono" boolean,
    "isFinanced" boolean,
    "contractSigned" boolean,
    "proxySigned" boolean,
    "inssProtocol" text,
    "gpsGenerated" boolean,
    "gpsPaid" boolean,
    "inssDeferred" boolean,
    "childbirthDate" date,
    indicator_id bigint,
    "commissionPercent" numeric(5,2),
    "commissionValue" numeric(12,2),
    "commissionPaid" boolean,
    "amountReceivable" numeric(12,2),
    "amountReceived" numeric(12,2),
    observations text,
    environment text,
    created_by bigint,
    updated_by bigint,
    created_at timestamp with time zone,
    lawyer_id bigint,
    base_comissao numeric(12,2),
    gps_forecast_date date,
    gps_payment_date date,
    gps_value numeric(10,2),
    has_gps_control boolean,
    rn_birth_date date,
    rn_name character varying(255),
    rn_sex character varying(50),
    gps_paid_value numeric,
    gps_generated_status boolean,
    organization_id uuid,
    "inssNB" text
);


--
-- Name: backup_test_installments_conciliacao_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_test_installments_conciliacao_20261121 (
    id bigint,
    contract_id bigint,
    "installmentNumber" integer,
    "dueDate" date,
    amount numeric(12,2),
    "amountPaid" numeric(12,2),
    status text,
    interest numeric(12,2),
    fine numeric(12,2),
    environment text,
    created_by bigint,
    updated_by bigint,
    created_at timestamp with time zone,
    original_due_date date,
    organization_id uuid,
    due_date_reason text,
    due_date_adjusted_at timestamp with time zone,
    due_date_adjusted_by bigint
);


--
-- Name: backup_test_pagamentos_conciliacao_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_test_pagamentos_conciliacao_20261121 (
    id uuid,
    installment_id bigint,
    amount numeric(12,2),
    payment_date timestamp with time zone,
    account_id bigint,
    category_id bigint,
    description text,
    user_id uuid,
    created_at timestamp with time zone,
    environment text,
    type text,
    created_by bigint,
    updated_by bigint,
    organization_id uuid,
    financial_transaction_id bigint,
    reverses_payment_id uuid
);


--
-- Name: backup_view_receivables_20261121; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_view_receivables_20261121 (
    definicao text
);


--
-- Name: birthday_templates_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.birthday_templates_backup (
    id uuid,
    name text,
    image_url text,
    text_color text,
    is_active boolean,
    name_y text,
    name_x text,
    name_size text,
    msg_y text,
    msg_x text,
    msg_size text,
    text_align text,
    created_at timestamp with time zone,
    environment text,
    line_height text,
    name_max_width text,
    msg_max_width text,
    photo_shape text,
    show_client_photo boolean,
    photo_size text,
    photo_x text,
    photo_y text,
    organization_id uuid
);


--
-- Data for Name: _auth_hardening_policy_backup_20261118; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'audit_logs', 'Authenticated read access to audit_logs', 'SELECT', '{public}', '(auth.role() = ''authenticated''::text)', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'audit_logs', 'Permissive policy for audit_logs', 'ALL', '{anon}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'audit_logs', 'Allow all access to audit_logs', 'ALL', '{public}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'login_attempts', 'Authenticated read access to login_attempts', 'SELECT', '{public}', '(auth.role() = ''authenticated''::text)', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'login_attempts', 'Isolamento_Definitivo_Tenant', 'ALL', '{public}', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'login_attempts', 'Isolamento por Tenant em login_attempts', 'ALL', '{public}', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'login_attempts', 'Public access for login_attempts', 'ALL', '{public}', 'true', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'login_attempts', 'Allow all access to login_attempts', 'ALL', '{public}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'login_attempts', 'Permissive policy for login_attempts', 'ALL', '{anon}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'login_attempts', 'Filter by organization', 'ALL', '{public}', '(organization_id = (NULLIF(current_setting(''app.current_organization_id''::text, true), ''''::text))::uuid)', '(organization_id = (NULLIF(current_setting(''app.current_organization_id''::text, true), ''''::text))::uuid)');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'login_attempts', 'Admin access for login_attempts', 'SELECT', '{public}', '(( SELECT users."canAccessAudit"
   FROM users
  WHERE (users.email = (auth.jwt() ->> ''email''::text))) = true)', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'Authenticated read access to trusted_devices', 'SELECT', '{public}', '(auth.role() = ''authenticated''::text)', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'Permissive policy for trusted_devices', 'ALL', '{anon}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'Isolamento_Definitivo_Tenant', 'ALL', '{public}', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'Public access for trusted_devices', 'ALL', '{public}', 'true', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'Isolamento por Tenant em trusted_devices', 'ALL', '{public}', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'Allow all access to trusted_devices', 'ALL', '{public}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'Filter by organization', 'ALL', '{public}', '(organization_id = (NULLIF(current_setting(''app.current_organization_id''::text, true), ''''::text))::uuid)', '(organization_id = (NULLIF(current_setting(''app.current_organization_id''::text, true), ''''::text))::uuid)');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'Admin access for trusted_devices', 'ALL', '{public}', '(( SELECT users."canAccessAudit"
   FROM users
  WHERE (users.email = (auth.jwt() ->> ''email''::text))) = true)', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'trusted_devices', 'User access for trusted_devices', 'SELECT', '{public}', '(user_id = ( SELECT users.id
   FROM users
  WHERE (users.email = (auth.jwt() ->> ''email''::text))))', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Authenticated read access to user_sessions', 'SELECT', '{public}', '(auth.role() = ''authenticated''::text)', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Enable delete for all users', 'DELETE', '{public}', 'true', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Enable insert for all users', 'INSERT', '{public}', NULL, 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Enable read access for all users', 'SELECT', '{public}', 'true', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Isolamento_Definitivo_Tenant', 'ALL', '{public}', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Enable update for all users', 'UPDATE', '{public}', 'true', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Enable insert for server-side auth', 'INSERT', '{public}', NULL, 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Enable read/update for server-side auth', 'SELECT', '{public}', 'true', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Enable update for server-side auth', 'UPDATE', '{public}', 'true', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Isolamento por Tenant em user_sessions', 'ALL', '{public}', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))', '((organization_id)::text = current_setting(''custom.organization_id''::text, true))');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Permissive policy for user_sessions', 'ALL', '{anon}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Allow all access to user_sessions', 'ALL', '{public}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'user_sessions', 'Filter by organization', 'ALL', '{public}', '(organization_id = (NULLIF(current_setting(''app.current_organization_id''::text, true), ''''::text))::uuid)', '(organization_id = (NULLIF(current_setting(''app.current_organization_id''::text, true), ''''::text))::uuid)');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Authenticated read access to users', 'SELECT', '{public}', '(auth.role() = ''authenticated''::text)', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Permissive policy for users', 'ALL', '{anon}', 'true', 'true');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Users can read users', 'SELECT', '{public}', 'true', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Users can insert users', 'INSERT', '{public}', NULL, '((( SELECT users_1.is_superadmin
   FROM users users_1
  WHERE (users_1.email = (auth.jwt() ->> ''email''::text))) = true) OR (is_superadmin IS NOT TRUE))');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Superadmin protected update', 'UPDATE', '{public}', '((( SELECT users_1.is_superadmin
   FROM users users_1
  WHERE (users_1.email = (auth.jwt() ->> ''email''::text))) = true) OR (is_superadmin IS NOT TRUE))', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Superadmin protected delete', 'DELETE', '{public}', '((( SELECT users_1.is_superadmin
   FROM users users_1
  WHERE (users_1.email = (auth.jwt() ->> ''email''::text))) = true) OR (is_superadmin IS NOT TRUE))', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Isolamento por OrganizaÃ§Ã£o em users', 'SELECT', '{public}', '((organization_id = get_auth_organization()) OR (is_superadmin = true))', NULL);
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Administradores podem atualizar usuÃ¡rios', 'UPDATE', '{public}', '((organization_id = get_auth_organization()) OR (is_superadmin = true))', '((organization_id = get_auth_organization()) OR (is_superadmin = true))');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Superadmins podem criar usuÃ¡rios', 'INSERT', '{public}', NULL, '(is_superadmin = true)');
INSERT INTO public._auth_hardening_policy_backup_20261118 VALUES ('2026-11-18 11:12:45.421851-03', 'public', 'users', 'Allow all access', 'ALL', '{public}', 'true', 'true');


--
-- Data for Name: backup_b11_projecao_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_b11_projecao_20261121 VALUES ('funcao:get_future_receivables_projection', 'CREATE OR REPLACE FUNCTION public.get_future_receivables_projection(p_environment text DEFAULT ''production''::text)
 RETURNS TABLE(due_month text, total_amount numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(installments."dueDate"::DATE, ''YYYY-MM'') as due_month,
        SUM(installments.amount) as total_amount
    FROM 
        installments
    WHERE 
        installments.status IN (''Aberto'', ''Atrasada'')
        AND installments."dueDate"::DATE >= CURRENT_DATE
        AND installments.environment = p_environment
    GROUP BY 
        TO_CHAR(installments."dueDate"::DATE, ''YYYY-MM'')
    ORDER BY 
        due_month;
END;
$function$
', '2026-11-21 21:43:17.994516-03');
INSERT INTO public.backup_b11_projecao_20261121 VALUES ('resultado_antes:test', '{"2027-02": 500.00, "2027-03": 1000.00, "2027-08": 2000.00, "2027-09": 2000.00}', '2026-11-21 21:43:17.994516-03');
INSERT INTO public.backup_b11_projecao_20261121 VALUES ('resultado_antes:production', '{}', '2026-11-21 21:43:17.994516-03');


--
-- Data for Name: backup_contracts_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_contracts_20261121 VALUES (5, 6, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-28', '2026-01-28', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '1993650939', true, true, true, '2026-02-06', NULL, 0.00, 0.00, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-10 12:08:38.653189-03', 1, 0.00, '2026-02-18', '2026-02-06', 178.31, true, NULL, 'Isis', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (86, 76, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Parcial', '2026-07-04', '2026-04-07', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '3636620393809', true, true, false, '2026-08-25', NULL, 0.00, 0.00, false, 1000.00, 2000.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-04-07 18:33:04.425713-03', 1, 0.00, '2026-07-15', '2026-07-15', 178.31, false, '2026-08-19', 'Ana Liz', 'Feminino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (25, 32, 18, 'Autismo', 'PrevidenciÃ¡rio', 'Aberto', '2025-12-17', '2025-12-17', '1000311-80.2026.4.01.3303', 9000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 9000.00, 0.00, NULL, 'production', 2, 2, '2026-03-10 15:13:54.707685-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (76, 2, 24, 'InventÃ¡rio', 'FamÃ­lia', 'Quitado', '2026-03-25', '2026-03-25', NULL, 3000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 3000.00, NULL, 'test', 2, 2, '2026-03-25 10:52:36.93544-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (128, 91, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-11-16', '2026-11-16', NULL, 2800.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2026-07-16', NULL, 0.00, 0.00, false, 2800.00, 0.00, NULL, 'production', 2, 2, '2026-11-16 16:50:13.256319-03', 1, 0.00, NULL, NULL, NULL, false, '2026-07-24', 'Gael', 'Masculino', NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (13, 25, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-02-02', '2026-02-02', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, '114598717', true, true, true, '2026-02-19', NULL, 0.00, 0.00, false, 0.00, 2500.00, NULL, 'production', 2, 2, '2026-03-10 13:04:45.70041-03', 1, 0.00, '2026-02-18', '2026-02-02', 178.31, true, '2026-03-30', 'Levi Bernardo', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (92, 61, 19, 'AuxÃ­lio por Incapacidade TemporÃ¡ria', 'PrevidenciÃ¡rio', 'Quitado', '2026-04-11', '2026-04-11', NULL, 1000.00, 'Parcelado', 2, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 1000.00, NULL, 'test', 23, 23, '2026-04-11 01:15:47.236273-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (105, 88, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-06-03', '2026-06-03', NULL, 4000.00, 'Ã€ Vista', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 4000.00, NULL, 'production', 2, 2, '2026-06-04 07:28:49.163183-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (16, 34, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-11-25', '2025-11-25', '1002030-97.2026.4.01.3303', 2125.00, 'Ã€ Prazo', 1, false, false, true, true, '1361583846', false, false, false, '2025-09-09', 1, 10.00, 182.16, false, 0.00, 3239.44, NULL, 'production', 2, 2, '2026-03-10 13:15:31.839772-03', 1, 1821.60, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (110, 88, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-06-30', '2026-06-30', NULL, 550.00, 'Ã€ Vista', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 550.00, NULL, 'production', 2, 2, '2026-06-30 15:51:23.741457-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (12, 15, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-10-17', '2025-10-17', '1010400-02.2025.4.01.3303', 1518.00, 'Ã€ Prazo', 1, false, false, true, true, '1261633679', false, false, false, '2025-10-29', NULL, 0.00, 0.00, false, 0.00, 2121.89, NULL, 'production', 2, 2, '2026-03-10 12:57:41.711007-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (3, 21, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-10-14', '2025-10-14', '1011491-91.2025.4.01.3315', 1821.60, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2025-06-26', NULL, 0.00, 0.00, false, 0.00, 2450.40, NULL, 'production', 2, 2, '2026-03-10 12:03:21.325021-03', 1, 0.00, NULL, NULL, NULL, false, NULL, 'Dani', NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (116, 99, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-08-06', '2026-08-06', NULL, 2460.00, 'Ã€ Prazo', 1, false, false, true, true, '5246482909576', true, true, false, '2026-08-12', NULL, 0.00, 0.00, false, 0.00, 2500.00, NULL, 'production', 2, 2, '2026-08-06 10:53:48.359593-03', 1, 0.00, '2026-08-17', '2026-08-06', 178.31, false, '2026-08-12', 'Hannah', 'Feminino', 178.31, true, NULL, '213.650.857-6');
INSERT INTO public.backup_contracts_20261121 VALUES (99, 84, 28, 'BPC/LOAS GenÃ©rico', 'PrevidenciÃ¡rio', 'Aberto', '2026-05-19', '2026-05-19', NULL, 12968.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 12968.00, 0.00, NULL, 'production', 2, 2, '2026-05-19 14:15:05.589036-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (21, 29, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-07', '2026-03-07', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '1776792901', true, true, true, '2026-07-02', 4, 10.00, 194.52, false, 0.00, 2800.00, 'FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-10 13:58:58.65907-03', 1, 1945.20, '2026-07-15', '2026-06-01', 178.31, false, '2026-07-05', 'Elisa', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (125, 107, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-10-27', '2026-10-27', NULL, 1621.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, '2026-12-23', NULL, 0.00, 0.00, false, 1621.00, 0.00, NULL, 'production', 2, 2, '2026-10-27 15:02:52.918777-03', 1, 0.00, '2026-11-16', '2026-11-13', 178.31, false, NULL, 'JoÃ£o Henrique', 'Masculino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (37, 42, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-02-10', '2026-02-10', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '2129370084', true, true, false, '2026-05-02', 6, 10.00, 194.52, false, 2800.00, 0.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 10:09:11.305285-03', 1, 1945.20, '2026-05-15', '2026-05-04', 178.31, false, '2026-04-28', 'Heloisa', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (115, 98, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-07-21', '2026-07-21', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, NULL, true, true, false, '2026-11-26', NULL, 0.00, 0.00, false, 3000.00, 0.00, 'FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-07-21 13:26:59.702664-03', 1, 0.00, '2026-10-15', '2026-10-07', 178.31, false, NULL, 'Luiz Emanuel', 'Masculino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (1, 22, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-02-21', '2026-02-21', '1001641-76.2026.4.01.3315', 2800.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2023-07-24', NULL, 0.00, 0.00, false, 2800.00, 0.00, NULL, 'production', 2, 2, '2026-03-10 11:55:36.75155-03', 1, 0.00, NULL, NULL, NULL, false, '2023-07-24', 'Davi', 'Masculino', NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (4, 8, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-10', '2026-01-07', NULL, 1945.20, 'Ã€ Vista', 1, true, false, false, true, '298842549', true, true, true, '2026-02-06', NULL, 0.00, 0.00, false, 0.00, 0.00, 'PROBONO', 'production', 2, 2, '2026-03-10 12:06:00.302142-03', 1, 0.00, '2026-01-15', '2026-01-13', 166.98, true, '2026-02-06', 'KauÃª', 'Masculino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (19, 17, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-10-08', '2025-10-08', NULL, 1821.60, 'Ã€ Prazo', 1, false, false, true, true, '2068836536', true, true, true, '2025-11-18', 1, 10.00, 182.16, true, 0.00, 2000.04, NULL, 'production', 2, 2, '2026-03-10 13:41:10.941452-03', 1, 1821.60, '2025-10-17', '2025-10-17', 166.98, true, '2025-11-18', 'Rebeca', 'Feminino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (7, 11, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-12-15', '2025-10-29', NULL, 1821.60, 'Ã€ Prazo', 1, false, false, true, true, '2042728958', true, true, true, '2025-12-15', NULL, 0.00, 0.00, false, 0.00, 2000.00, 'Manuela', 'production', 2, 2, '2026-03-10 12:30:27.949491-03', 1, 0.00, '2025-12-15', '2025-12-06', 166.98, true, '2025-12-15', 'Ariela', 'Feminino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (83, 2, 23, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Quitado', '2026-04-02', '2026-04-02', NULL, 0.00, 'Ã€ Vista', 1, true, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 0.00, 'PROBONO', 'test', 2, 2, '2026-04-02 00:07:58.70402-03', 7, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (66, 16, 21, 'DivÃ³rcio Consensual', 'FamÃ­lia', 'Cancelado', '2026-03-16', '2026-03-16', NULL, 5000.00, 'Parcelado', 2, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 5000.00, 0.00, NULL, 'test', 2, 2, '2026-03-16 09:52:32.100274-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (54, 59, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Cancelado', '2026-02-20', '2026-02-20', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2026-06-28', NULL, 0.00, 0.00, false, 2269.40, 0.00, '[CANCELAMENTO]: DESISTÃŠNCIA', 'production', 2, 2, '2026-03-12 15:25:20.177005-03', 1, 2269.40, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (93, 62, 23, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Quitado', '2026-04-11', '2026-04-11', NULL, 2000.00, 'Parcelado', 3, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 2000.00, NULL, 'test', 23, 23, '2026-04-11 02:35:50.090801-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (67, 1, 23, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Parcial', '2026-03-16', '2026-03-16', NULL, 10000.00, 'Parcelado', 2, false, false, false, false, NULL, true, true, false, NULL, NULL, 0.00, 0.00, false, 3000.00, 7000.00, NULL, 'test', 2, 2, '2026-03-16 10:02:45.965162-03', NULL, 0.00, '2026-03-31', '2026-03-28', 178.31, false, NULL, NULL, NULL, 178.31, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (100, 86, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-05-19', '2026-05-19', NULL, 4000.00, 'Ã€ Prazo', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 4000.00, NULL, 'production', 2, 2, '2026-05-19 15:36:54.204631-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (50, 55, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-29', '2026-01-29', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '1303708310', true, true, false, '2026-06-26', 18, 10.00, 194.52, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 14:50:39.159664-03', 1, 1945.20, '2026-06-15', '2026-06-01', 178.31, false, '2026-06-22', 'Rayla', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (129, 110, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-11-16', '2026-11-16', NULL, 2120.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2026-02-16', 26, 35.00, 742.00, false, 2120.00, 0.00, NULL, 'production', 2, 2, '2026-11-16 16:57:36.322352-03', 1, 2120.00, NULL, NULL, NULL, false, '2026-02-24', 'Andryel Rhavy', 'Masculino', NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (117, 100, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Parcial', '2026-08-13', '2026-08-13', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '4314123217129', true, true, true, '2026-10-30', NULL, 0.00, 0.00, false, 1500.00, 1500.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-08-13 10:59:09.223362-03', 1, 0.00, '2026-09-15', '2026-09-14', 178.31, false, '2026-09-14', 'Yslla Maria', 'Feminino', 178.31, true, NULL, '246.758.624-8');
INSERT INTO public.backup_contracts_20261121 VALUES (106, 90, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-06-04', '2026-06-04', NULL, 700.00, 'Ã€ Vista', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 700.00, NULL, 'production', 2, 2, '2026-06-04 18:33:08.682351-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (26, 10, 13, 'RegularizaÃ§Ã£o de ImÃ³veis', 'ImobiliÃ¡rio', 'Quitado', '2026-01-27', '2026-01-27', NULL, 3500.00, 'Parcelado', 7, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 3500.00, NULL, 'production', 2, 2, '2026-03-10 15:17:11.76098-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (41, 46, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-31', '2026-01-31', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '1840390426', true, true, false, '2026-05-09', 15, 10.00, 194.52, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 11:24:31.789357-03', 1, 1945.20, '2026-05-15', '2026-05-12', 178.31, false, '2026-05-09', 'Miguel', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (49, 54, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-02-16', '2026-02-16', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '1929775699', true, true, false, '2026-06-19', 17, 10.00, 194.52, false, 0.00, 2800.00, 'FINANCIADO - FINANCIADO - FINANCIADO ', 'production', 2, 2, '2026-03-12 14:44:41.723833-03', 1, 1945.20, '2026-06-15', '2026-06-01', 178.31, false, '2026-06-06', 'Aurora ', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (45, 50, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-30', '2026-01-30', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '932866477', true, true, true, '2026-07-15', 16, 10.00, 194.52, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 12:07:59.801231-03', 1, 1945.20, '2026-07-15', '2026-06-01', 178.31, false, NULL, 'Maria HeloÃ­sa', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (51, 56, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-02-04', '2026-03-04', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '235591767', true, true, true, '2026-07-13', NULL, 0.00, 0.00, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 14:58:43.449609-03', 1, 0.00, '2026-08-17', '2026-06-02', 178.31, false, '2026-07-13', 'Ravy Matteo', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (126, 108, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-11-03', '2026-11-03', NULL, 2800.00, 'Ã€ Prazo', 1, false, false, true, true, '6481365268103', false, false, false, '2026-09-03', 25, 20.00, 560.00, false, 2800.00, 0.00, NULL, 'production', 2, 2, '2026-11-03 13:48:58.235912-03', 1, 2800.00, NULL, NULL, NULL, false, '2026-09-13', 'Thaemilly', 'Feminino', NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (87, 77, 28, 'BPC/LOAS GenÃ©rico', 'PrevidenciÃ¡rio', 'Aberto', '2026-04-01', '2026-04-01', NULL, 12968.00, 'Ã€ Prazo', 1, false, false, true, true, '1531587195', false, false, false, NULL, NULL, 0.00, 0.00, false, 12968.00, 0.00, NULL, 'production', 2, 2, '2026-04-07 18:35:35.343857-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (47, 52, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-02-07', '2026-02-07', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '513077463', true, true, false, '2026-05-28', NULL, 0.00, 0.00, false, 2800.00, 0.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 14:33:17.719696-03', 1, 0.00, '2026-06-15', '2026-06-01', 178.31, false, '2026-05-28', 'Henry Gabriel', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (94, 60, 20, 'AuxÃ­lio por Incapacidade Permanente', 'PrevidenciÃ¡rio', 'Aberto', '2026-05-08', '2026-05-08', NULL, 2000.00, 'Ã€ Prazo', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 2000.00, 0.00, NULL, 'test', 2, 2, '2026-05-08 12:11:53.645051-03', NULL, 1800.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (122, 105, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-09-09', '2026-09-09', NULL, 2800.00, 'Ã€ Prazo', 1, false, false, true, true, '1230254045', false, false, false, '2025-11-29', 1, 10.00, 194.52, false, 2800.00, 0.00, NULL, 'production', 2, 2, '2026-09-09 12:40:26.892425-03', 1, 1945.20, NULL, NULL, NULL, false, NULL, NULL, 'Masculino', NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (59, 63, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-10-28', '2025-10-28', NULL, 1821.60, 'Ã€ Prazo', 1, false, false, true, true, '331870818', true, true, true, '2022-06-17', NULL, 0.00, 0.00, false, 0.00, 2025.22, NULL, 'production', 2, 2, '2026-03-13 08:58:37.361534-03', 1, 0.00, '2025-11-28', '2025-11-05', 166.98, true, '2022-06-17', 'Gael', 'Masculino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (65, 16, 19, 'AuxÃ­lio por Incapacidade TemporÃ¡ria', 'PrevidenciÃ¡rio', 'Parcial', '2026-03-15', '2026-03-15', NULL, 10000.00, 'Parcelado', 4, false, false, false, false, NULL, true, true, false, NULL, NULL, 0.00, 0.00, false, 4000.00, 6000.00, '
[ESTORNO]: DevoluÃ§Ã£o ', 'test', 2, 2, '2026-03-15 20:07:37.107977-03', NULL, 0.00, '2026-03-31', '2026-03-28', 178.31, false, NULL, NULL, NULL, 178.31, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (68, 60, 25, 'Habeas Corpus', 'Penal', 'Cancelado', '2026-03-16', '2026-03-16', NULL, 10000.00, 'Parcelado', 4, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 10000.00, 0.00, '

[CANCELAMENTO]: Teste de Cancelamento', 'test', 2, 2, '2026-03-16 10:03:08.092861-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (69, 1, 19, 'AuxÃ­lio por Incapacidade TemporÃ¡ria', 'PrevidenciÃ¡rio', 'Cancelado', '2026-03-16', '2026-03-16', NULL, 3500.00, 'Ã€ Vista', 1, false, true, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 3500.00, 0.00, 'FINANCIADO

[CANCELAMENTO]: Teste', 'test', 2, 2, '2026-03-16 11:43:26.343278-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (74, 2, 23, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-25', '2026-03-25', NULL, 2000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 2000.00, NULL, 'test', 2, 2, '2026-03-25 08:06:44.514636-03', NULL, 0.00, '2026-04-09', NULL, 178.31, false, NULL, NULL, NULL, NULL, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (15, 5, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-10-16', '2025-10-10', NULL, 1746.94, 'Ã€ Prazo', 1, false, false, true, true, '1371655564', true, true, true, '2025-11-16', 1, 10.00, 151.80, false, 0.00, 1747.00, '
[ESTORNO]: estorno', 'production', 2, 2, '2026-03-10 13:08:38.99336-03', 1, 1518.00, NULL, NULL, NULL, true, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (8, 27, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Prorrogado', '2026-01-07', '2026-01-07', '1001865-50.2026.4.01.3303', 2250.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, '2025-12-23', NULL, 0.00, 0.00, false, 2250.00, 0.00, NULL, 'production', 2, 2, '2026-03-10 12:34:56.689958-03', 1, 0.00, '2026-01-15', '2026-01-14', 166.98, true, NULL, NULL, NULL, 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (9, 24, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-12-11', '2025-12-11', NULL, 2499.09, 'Ã€ Prazo', 1, false, false, true, true, '1482204733', true, true, false, '2026-02-17', 1, 10.00, 194.52, false, 0.00, 2499.09, NULL, 'production', 2, 2, '2026-03-10 12:39:06.527269-03', 1, 1945.20, '2026-01-15', '2025-12-15', 166.98, true, '2026-02-17', 'Henry Gael', 'Masculino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (75, 60, 9, 'AuxÃ­lio-ReclusÃ£o', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-25', '2026-03-25', NULL, 5000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, NULL, NULL, 0.00, 0.00, false, 0.00, 10000.00, NULL, 'test', 2, 2, '2026-03-25 09:22:33.838425-03', 7, 0.00, '2026-04-06', '2026-03-30', 178.31, false, NULL, NULL, NULL, 178.31, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (70, 61, 21, 'DivÃ³rcio Consensual', 'FamÃ­lia', 'Quitado', '2026-03-16', '2026-03-16', NULL, 1000.00, 'Parcelado', 2, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 1000.00, '
[ESTORNO]: SSGFSFD', 'test', 2, 2, '2026-03-16 11:44:49.545113-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (22, 36, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-12-23', '2025-12-23', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, '55640490', true, true, false, '2026-03-22', 7, 10.00, 194.52, false, 0.00, 2458.76, 'Debora', 'production', 2, 2, '2026-03-10 14:49:18.121779-03', 1, 1945.20, '2026-01-15', '2025-12-29', 166.98, true, '2026-03-22', 'Aylla', 'Feminino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (48, 53, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-02-10', '2026-02-10', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '1300803160', true, true, false, '2026-06-15', NULL, 0.00, 0.00, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 14:37:57.275995-03', 1, 0.00, '2026-06-15', '2026-06-01', 178.31, true, '2026-06-08', 'Lorenzo', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (130, 111, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-11-16', '2026-11-16', NULL, 2400.00, 'Ã€ Prazo', 1, false, true, true, true, NULL, true, false, false, '2027-02-20', 26, 35.00, 777.00, false, 2400.00, 0.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-11-16 17:03:03.583682-03', 1, 2220.00, '2026-12-15', NULL, 178.31, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (104, 22, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-06-01', '2026-06-01', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '1312099626', true, true, true, '2026-07-16', NULL, 0.00, 0.00, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-06-01 21:05:25.916886-03', 1, 0.00, '2026-06-15', '2026-06-02', 178.31, false, NULL, 'Ravi', 'Masculino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (35, 40, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-02-04', '2026-02-04', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '1537000419', true, true, false, '2026-04-17', NULL, 10.00, 194.52, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 09:46:40.263629-03', 1, 1945.20, '2026-04-15', '2026-04-15', 178.31, true, '2026-04-17', 'Merlya', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (78, 70, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-26', '2026-03-26', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '1033755866', true, true, true, '2026-06-23', NULL, 0.00, 0.00, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-27 20:05:05.023202-03', 1, 0.00, '2026-07-15', '2026-06-01', 178.31, false, '2026-06-23', 'Levi', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (84, 75, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Cancelado', '2026-04-02', '2026-04-02', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, NULL, true, false, false, '2026-11-02', 22, 10.00, 194.52, false, 3000.00, 0.00, 'FINANCIADO

[CANCELAMENTO]: CANCELAR', 'production', 2, 2, '2026-04-02 12:03:25.024969-03', 1, 1945.20, '2026-11-16', NULL, 178.31, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (77, 69, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-03-26', '2026-03-26', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '228983765', true, true, false, '2026-03-19', NULL, 0.00, 0.00, false, 3000.00, 0.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-27 14:27:17.591577-03', 1, 0.00, '2026-04-15', '2026-04-08', 178.31, true, '2026-03-19', 'Alice', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (123, 104, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-09-11', '2026-09-11', NULL, 2500.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, '2026-10-21', 24, 50.00, 1250.00, false, 2500.00, 0.00, NULL, 'production', 2, 2, '2026-09-11 13:38:56.661629-03', 1, 2500.00, '2026-09-15', '2026-09-15', 178.31, false, NULL, NULL, NULL, 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (80, 72, 28, 'BPC/LOAS GenÃ©rico', 'PrevidenciÃ¡rio', 'Aberto', '2026-03-26', '2026-03-26', NULL, 9726.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, 20, 40.00, 2593.60, false, 9726.00, 0.00, NULL, 'production', 2, 2, '2026-03-27 20:35:14.080935-03', 1, 6484.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (11, 3, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2025-12-27', '2025-12-27', '1000936-17.2026.4.01.3303', 2125.00, 'Ã€ Prazo', 1, false, false, true, true, '1859714622', true, true, false, '2025-11-10', 3, 10.00, 182.16, false, 2125.00, 0.00, NULL, 'production', 2, 2, '2026-03-10 12:52:46.683706-03', 1, 1821.60, '2026-01-15', '2025-12-29', 500.98, true, '2025-11-10', 'AntÃ´nio', 'Masculino', 500.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (107, 92, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-06-23', '2026-06-23', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '8771537241921', true, true, true, '2026-10-03', NULL, 0.00, 0.00, false, 3000.00, 0.00, 'FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-06-23 12:10:28.653389-03', 1, 0.00, '2026-08-17', '2026-08-17', 178.31, false, '2026-09-18', 'Heitor', 'Masculino', 178.31, true, NULL, '249.091.620-8');
INSERT INTO public.backup_contracts_20261121 VALUES (96, 81, 28, 'BPC/LOAS GenÃ©rico', 'PrevidenciÃ¡rio', 'Cancelado', '2026-05-13', '2026-05-13', NULL, 9726.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 9726.00, 0.00, '[CANCELAMENTO]: DESISTÃŠNCIA', 'production', 2, 2, '2026-05-14 14:15:47.866529-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (131, 112, 8, 'AuxÃ­lio por Incapacidade Permanente', 'PrevidenciÃ¡rio', 'Aberto', '2026-11-16', '2026-11-16', NULL, 9000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 9000.00, 0.00, NULL, 'production', 2, 2, '2026-11-16 17:18:10.929489-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (14, 33, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-09', '2026-03-09', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '700419544', true, true, true, '2026-02-28', 5, 10.00, 194.52, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-10 13:06:23.8424-03', 1, 1945.20, '2026-03-16', '2026-03-16', 178.31, true, '2026-02-28', NULL, 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (32, 37, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-12-05', '2025-12-05', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, '1675457322', true, true, true, '2026-06-28', 4, 10.00, 194.52, false, 0.00, 2440.86, NULL, 'production', 2, 2, '2026-03-11 14:15:45.97477-03', 1, 1945.20, '2026-01-15', '2025-12-22', 166.98, true, '2026-06-28', 'Angelina', 'Feminino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (33, 38, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-23', '2026-01-23', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, '696075751', true, true, true, '2026-03-31', NULL, 0.00, 0.00, false, 0.00, 2477.88, NULL, 'production', 2, 2, '2026-03-12 09:18:44.839364-03', 1, 0.00, '2026-02-18', '2026-02-09', 178.31, true, '2026-03-31', 'Ravi', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (40, 45, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-16', '2026-01-16', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, '6482578853', true, true, false, '2026-05-14', 6, 10.00, 194.52, false, 0.00, 2460.00, NULL, 'production', 2, 2, '2026-03-12 10:47:27.939384-03', 1, 1945.20, NULL, NULL, NULL, true, NULL, 'Hannara', 'Feminino', NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (81, 1, 20, 'AuxÃ­lio por Incapacidade Permanente', 'PrevidenciÃ¡rio', 'Parcial', '2026-03-28', '2026-03-28', NULL, 12000.00, 'Parcelado', 3, false, false, true, true, NULL, true, true, false, NULL, NULL, 0.00, 0.00, false, 8000.00, 4000.00, '
[ESTORNO]: teste', 'test', 2, 2, '2026-03-28 10:15:13.915278-03', 7, 0.00, '2026-04-09', '2026-03-29', 178.31, false, NULL, NULL, NULL, 178.31, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (34, 39, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-23', '2026-01-23', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, '1109523486', true, true, true, '2026-04-27', 11, 10.00, 194.52, false, 0.00, 2477.73, NULL, 'production', 2, 2, '2026-03-12 09:28:38.968824-03', 1, 1945.20, '2026-02-18', '2026-02-03', 178.31, true, '2026-04-27', 'ThÃ©o', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (101, 87, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-05-21', '2026-05-21', NULL, 5000.00, 'Ã€ Prazo', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 5000.00, NULL, 'production', 2, 2, '2026-05-21 02:11:31.375259-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (23, 35, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-16', '2026-01-16', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, '1702527868', true, true, true, '2026-03-29', 6, 10.00, 194.52, false, 0.00, 2458.84, 'Ana Clara - Keila Agente', 'production', 2, 2, '2026-03-10 15:06:21.285047-03', 1, 1945.20, '2026-02-18', '2026-02-18', 178.31, true, '2026-03-29', 'Nathan', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (43, 48, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-27', '2026-01-27', NULL, 1945.20, 'Ã€ Prazo', 1, false, false, true, true, '1881800403', true, true, false, '2026-06-01', 6, 10.00, 194.52, false, 0.00, 2458.52, NULL, 'production', 2, 2, '2026-03-12 11:35:16.13784-03', 1, 1945.20, '2026-02-18', '2026-02-18', 178.31, true, '2026-05-26', 'Laura', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (89, 78, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-04-10', '2026-04-10', NULL, 2100.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2026-01-18', NULL, 0.00, 0.00, false, 2100.00, 0.00, NULL, 'production', 2, 2, '2026-04-10 15:53:02.179636-03', 1, 0.00, NULL, NULL, NULL, false, '2026-01-18', 'Ailla', 'Feminino', NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (85, 8, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-04-02', '2026-04-02', NULL, 9000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 9000.00, NULL, 'production', 2, 2, '2026-04-02 19:55:28.945391-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (112, 95, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-07-09', '2026-07-09', NULL, 3010.00, 'Ã€ Prazo', 1, false, true, true, true, NULL, true, true, false, '2026-10-30', 13, 10.00, 194.52, false, 3010.00, 0.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-07-09 15:08:55.22725-03', 1, 1945.20, '2026-09-15', '2026-09-14', 178.31, false, '2026-11-02', 'Esther Annelisse', 'Feminino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (44, 49, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-01-12', '2026-01-12', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, '958862535', true, true, false, '2026-05-26', 7, 10.00, 194.52, false, 0.00, 2458.52, NULL, 'production', 2, 2, '2026-03-12 11:40:06.389257-03', 1, 1945.20, '2026-01-15', '2026-01-14', 166.98, true, '2026-05-26', 'Isis MaitÃª', 'Masculino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (119, 102, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-08-21', '2026-08-21', NULL, 2800.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, false, false, '2027-02-19', 23, 10.00, 194.52, false, 2800.00, 0.00, NULL, 'production', 2, 2, '2026-08-21 17:08:13.812985-03', 1, 1945.20, '2026-12-15', NULL, 178.31, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (124, 106, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-09-24', '2026-09-24', NULL, 2800.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, false, false, '2027-03-27', 23, 10.00, 194.52, false, 2800.00, 0.00, NULL, 'production', 2, 2, '2026-09-24 12:06:05.670613-03', 1, 1945.20, '2027-01-15', NULL, 178.31, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (10, 18, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2025-12-25', '2025-12-25', '1000934-47.2026.4.01.3303', 2125.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, '2025-09-21', 3, 10.00, 182.16, false, 2125.00, 0.00, 'Yanna - Mari', 'production', 2, 2, '2026-03-10 12:45:38.819888-03', 1, 1821.60, '2025-10-15', '2025-09-17', 166.98, true, '2025-09-21', 'Maria JÃºlia', 'Feminino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (90, 60, 10, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-04-10', '2026-04-10', NULL, 2600.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, '2026-06-10', 8, 10.00, 194.56, false, 0.00, 2600.00, '
[ESTORNO]: estorno
[ESTORNO]: este', 'test', 23, 23, '2026-04-10 16:05:14.76762-03', 7, 1945.60, '2026-05-15', '2026-04-10', 178.31, false, NULL, 'Mila Regina', 'Feminino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (113, 96, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-07-09', '2026-07-09', NULL, 2593.60, 'Ã€ Prazo', 1, false, false, true, true, '1233117780', true, true, false, '2026-06-22', 7, 10.00, 194.52, false, 2593.60, 0.00, NULL, 'production', 2, 2, '2026-07-09 15:59:36.303879-03', 1, 1945.20, '2026-07-15', '2026-07-14', 178.31, false, '2026-06-26', 'Artur', 'Masculino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (127, 109, 16, 'Aposentadoria por Idade Rural', 'PrevidenciÃ¡rio', 'Aberto', '2026-11-03', '2026-11-03', NULL, 9726.00, 'Ã€ Prazo', 1, false, false, true, true, '3265686483593', false, false, false, NULL, NULL, 0.00, 0.00, false, 9726.00, 0.00, NULL, 'production', 2, 2, '2026-11-03 14:54:56.719815-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (97, 82, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Cancelado', '2026-05-14', '2026-05-14', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2026-04-11', NULL, 0.00, 0.00, false, 2269.40, 0.00, '[CANCELAMENTO]: CANCELAR

[CANCELAMENTO]: CANCELAR

[CANCELAMENTO]: CANCELAR

[CANCELAMENTO]: CANCELAR', 'production', 2, 2, '2026-05-14 14:56:58.758377-03', 1, 0.00, NULL, NULL, NULL, false, '2026-04-11', 'Asafe Lohan', 'Masculino', NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (102, 88, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-05-27', '2026-05-27', NULL, 1000.00, 'Ã€ Prazo', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 1000.00, NULL, 'production', 2, 2, '2026-05-27 17:35:41.073806-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (114, 97, 28, 'BPC/LOAS GenÃ©rico', 'PrevidenciÃ¡rio', 'Aberto', '2026-06-29', '2026-06-29', NULL, 12968.00, 'Ã€ Prazo', 1, false, false, true, true, '789612233', false, false, false, NULL, NULL, 0.00, 0.00, false, 12968.00, 0.00, NULL, 'production', 2, 2, '2026-07-17 08:57:14.887051-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (108, 88, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-06-23', '2026-06-23', NULL, 4000.00, 'Ã€ Prazo', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 4000.00, NULL, 'production', 2, 2, '2026-06-24 00:17:19.061481-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (79, 71, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-03-27', '2026-03-27', '1003350-85.2026.4.01.3303', 3000.00, 'Ã€ Prazo', 1, false, false, true, true, '1504939835', false, false, false, '2025-08-05', NULL, 0.00, 0.00, false, 3000.00, 0.00, NULL, 'production', 2, 2, '2026-03-27 20:15:09.607663-03', 1, 0.00, NULL, NULL, NULL, false, '2025-08-05', 'MoisÃ©s', 'Masculino', NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (36, 41, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-02-25', '2026-02-25', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '9377337015', true, true, false, '2026-05-03', 13, 10.00, 194.52, false, 2800.00, 0.00, 'FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 10:00:53.996551-03', 1, 1945.20, '2026-05-15', '2026-05-04', 178.31, false, NULL, 'LÃ­via', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (111, 93, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-07-08', '2026-07-08', NULL, 2593.60, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, '2026-11-10', 7, 10.00, 194.52, false, 2593.60, 0.00, NULL, 'production', 2, 2, '2026-07-08 16:14:13.770182-03', 1, 1945.20, '2026-09-15', '2026-09-08', 178.31, false, '2026-11-08', 'Luana Sofhia', 'Feminino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (52, 57, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-02-06', '2026-02-06', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '155299330', true, true, true, '2026-07-18', NULL, 0.00, 0.00, false, 0.00, 2800.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 15:04:12.884085-03', 1, 0.00, '2026-07-15', '2026-07-02', 178.31, false, '2026-07-18', 'Gael', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (120, 103, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-08-22', '2026-08-22', NULL, 1621.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, '2026-10-07', NULL, 0.00, 0.00, false, 1621.00, 0.00, NULL, 'production', 2, 2, '2026-08-22 17:47:22.031205-03', 1, 0.00, '2026-09-04', '2026-09-04', 178.31, false, '2026-09-28', 'Samuel', 'Masculino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (121, 86, 29, 'Defesa Criminal', 'Penal', 'Parcial', '2026-09-02', '2026-09-02', NULL, 3500.00, 'Parcelado', 7, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 2000.00, 1500.00, NULL, 'production', 2, 2, '2026-09-02 17:04:21.217146-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (118, 101, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-08-18', '2026-08-18', NULL, 2800.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, true, false, '2026-12-18', 23, 10.00, 194.52, false, 2800.00, 0.00, NULL, 'production', 2, 2, '2026-08-18 17:54:01.220506-03', 1, 1945.20, '2026-10-15', '2026-10-15', 178.31, false, NULL, 'Lorenzo', 'Masculino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (88, 79, 28, 'BPC/LOAS GenÃ©rico', 'PrevidenciÃ¡rio', 'Aberto', '2026-04-09', '2026-04-09', '1002986-16.2026.4.01.3303', 9726.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, 6, 10.00, 648.40, false, 9726.00, 0.00, NULL, 'production', 2, 2, '2026-04-10 15:38:40.655143-03', 1, 6484.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (95, 80, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Cancelado', '2026-05-09', '2026-05-09', NULL, 2269.40, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2025-11-15', NULL, 0.00, 0.00, false, 2269.40, 0.00, '[CANCELAMENTO]: DESISTÃŠNCIA DO CLIENTE', 'production', 2, 2, '2026-05-09 11:27:23.960637-03', 1, 0.00, NULL, NULL, NULL, false, '2025-11-15', 'Antonela', 'Feminino', NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (132, 113, 22, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Aberto', '2026-07-10', '2026-07-10', NULL, 9726.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 9726.00, 0.00, NULL, 'production', 2, 2, '2026-11-16 18:20:19.0064-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (6, 9, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-10', '2025-10-08', NULL, 1821.60, 'Ã€ Prazo', 1, false, false, true, true, '713455980', true, true, true, '2025-12-08', NULL, 0.00, 0.00, false, 0.00, 2000.00, NULL, 'production', 2, 2, '2026-03-10 12:20:02.175486-03', 1, 0.00, '2025-11-17', '2025-10-24', 166.98, true, '2025-12-08', 'Bryan Thomas', 'Masculino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (71, 66, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-03-18', '2026-03-18', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, NULL, true, true, false, '2026-10-12', NULL, 0.00, 0.00, false, 3000.00, 0.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-18 15:13:16.048202-03', 1, 0.00, '2026-08-17', '2026-08-17', 178.31, false, '2026-10-16', 'ThÃ©o', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (28, 20, 15, 'Aposentadoria por Idade Urbana', 'PrevidenciÃ¡rio', 'Quitado', '2026-02-27', '2026-02-27', NULL, 9000.00, 'Ã€ Vista', 1, true, false, false, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 0.00, 'PROBONO', 'production', 2, 2, '2026-03-10 15:25:46.010778-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (18, 4, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-10-08', '2025-10-08', NULL, 1821.60, 'Ã€ Prazo', 1, false, false, true, true, '1082539299', true, true, true, '2025-12-03', NULL, 0.00, 0.00, false, 0.00, 1987.00, NULL, 'production', 2, 2, '2026-03-10 13:24:30.841534-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (2, 23, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Prorrogado', '2025-10-14', '2025-10-14', '1009720-17.2025.4.01.3303', 1821.60, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, '2024-10-29', NULL, 0.00, 0.00, false, 1821.60, 0.00, NULL, 'production', 2, 2, '2026-03-10 11:59:47.662564-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (46, 51, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-11', '2026-03-11', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '9638219585533', true, true, false, '2026-08-04', NULL, 0.00, 0.00, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 12:18:59.888692-03', 1, 0.00, '2026-07-15', '2026-07-02', 178.31, false, '2026-08-03', 'Gustavo', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (133, 114, 27, 'PensÃ£o por Morte', 'PrevidenciÃ¡rio', 'Aberto', '2026-11-16', '2026-11-16', NULL, 98000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 98000.00, 0.00, NULL, 'production', 2, 2, '2026-11-16 18:40:02.476771-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (60, 64, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-10-06', '2025-10-06', NULL, 1518.00, 'Ã€ Prazo', 1, false, false, true, true, '121747762', true, true, false, '2025-10-17', NULL, 0.00, 0.00, false, 0.00, 1612.87, NULL, 'production', 2, 2, '2026-03-13 09:06:26.395163-03', 1, 0.00, '2025-10-15', '2025-10-08', 75.90, true, '2025-10-17', 'Hinny Sophya', 'Feminino', 75.90, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (62, 65, 2, 'Lei Seca', 'TrÃ¢nsito', 'Quitado', '2026-02-26', '2026-02-26', NULL, 3000.00, 'Ã€ Vista', 1, true, false, false, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 0.00, 'PROBONO', 'production', 2, 2, '2026-03-15 05:36:36.193328-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (53, 58, 22, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Aberto', '2026-01-07', '2026-01-07', '1001978-04.2026.4.01.3303', 16210.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 16210.00, 0.00, NULL, 'production', 2, 2, '2026-03-12 15:15:49.248056-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (73, 67, 26, 'Deficiente Surdo/Mudo - BPC/LOAS', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-20', '2026-03-20', NULL, 9726.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 9744.00, NULL, 'production', 2, 2, '2026-03-20 17:00:43.454938-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (42, 47, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-02-26', '2026-02-26', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '9221965483491', true, true, false, '2026-07-15', 6, 10.00, 194.52, false, 0.00, 2800.00, 'FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 11:31:21.259715-03', 1, 1945.20, '2026-08-17', '2026-06-02', 178.31, false, '2026-08-05', 'Helena', 'Feminino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (20, 12, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-02-10', '2026-03-10', NULL, 2800.00, 'Ã€ Prazo', 1, false, true, true, true, '1877321685', true, true, false, '2026-04-17', NULL, 0.00, 0.00, false, 2800.00, 0.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-10 13:55:36.469946-03', 1, 0.00, '2026-04-15', '2026-04-10', 178.31, true, '2026-04-17', 'Davi Lucas', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (72, 68, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-03-20', '2026-03-20', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '1471037309', true, true, false, '2026-04-16', NULL, 0.00, 0.00, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-20 16:52:57.364005-03', 1, 0.00, '2026-04-15', '2026-04-15', 178.31, true, '2026-04-16', 'JoÃ£o Vitor ', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (103, 89, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2026-05-28', '2026-05-28', NULL, 3000.00, 'Ã€ Prazo', 1, false, true, true, true, '561447419', true, true, false, '2026-07-20', 1, 10.00, 194.52, false, 0.00, 3000.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-05-28 08:28:37.221653-03', 1, 1945.20, '2026-06-15', '2026-06-02', 178.31, false, NULL, 'Noah', 'Masculino', 178.31, true, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (27, 14, 6, 'AuxÃ­lio-ReclusÃ£o', 'PrevidenciÃ¡rio', 'Aberto', '2026-02-16', '2026-02-16', '1003046-86.2026.4.01.3303', 9000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 9000.00, 0.00, NULL, 'production', 2, 2, '2026-03-10 15:24:27.720988-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (82, 73, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Aberto', '2026-03-31', '2026-03-31', '1003705-95.2026.4.01.3303', 2800.00, 'Ã€ Prazo', 1, false, false, true, true, '1239513262', false, false, false, '2025-12-05', 21, 10.00, 194.52, false, 2800.00, 0.00, NULL, 'production', 2, 2, '2026-03-31 13:17:47.937035-03', 1, 1945.20, NULL, NULL, NULL, false, '2025-12-05', 'Maria CecÃ­lia', 'Feminino', NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (91, 62, 23, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Parcial', '2026-04-10', '2026-04-10', NULL, 1000.00, 'Parcelado', 2, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 600.00, 400.00, '
[ESTORNO]: estorno', 'test', 23, 23, '2026-04-10 20:31:42.281031-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (109, 87, 29, 'Defesa Criminal', 'Penal', 'Quitado', '2026-06-25', '2026-06-25', NULL, 5000.00, 'Ã€ Prazo', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 5000.00, NULL, 'production', 2, 2, '2026-06-25 19:01:19.684064-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (98, 83, 28, 'BPC/LOAS GenÃ©rico', 'PrevidenciÃ¡rio', 'Aberto', '2026-05-19', '2026-05-19', NULL, 12968.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, 20, 40.00, 2593.60, false, 12968.00, 0.00, NULL, 'production', 2, 2, '2026-05-19 14:01:16.935297-03', NULL, 6484.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (24, 19, 8, 'AuxÃ­lio por Incapacidade Permanente', 'PrevidenciÃ¡rio', 'Aberto', '2025-12-15', '2025-12-15', '1004669-88.2026.4.01.3303', 9000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 9000.00, 0.00, NULL, 'production', 2, 2, '2026-03-10 15:12:26.849291-03', 1, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (39, 44, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Cancelado', '2026-03-12', '2026-03-12', NULL, 2500.00, 'Ã€ Prazo', 1, false, true, true, true, NULL, true, true, false, '2026-05-10', NULL, 0.00, 0.00, false, 2500.00, 0.00, 'FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO - FINANCIADO', 'production', 2, 2, '2026-03-12 10:40:42.123135-03', 1, 0.00, '2026-05-15', '2026-05-09', 178.31, false, '2026-05-27', 'Thales', 'Masculino', 178.31, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);
INSERT INTO public.backup_contracts_20261121 VALUES (38, 43, 1, 'SalÃ¡rio-Maternidade', 'PrevidenciÃ¡rio', 'Quitado', '2025-10-29', '2025-10-29', NULL, 1821.60, 'Ã€ Prazo', 1, false, false, true, true, '1626976754', true, true, false, '2026-05-07', 14, 10.00, 182.16, false, 0.00, 2458.59, NULL, 'production', 2, 2, '2026-03-12 10:26:38.436309-03', 1, 1821.60, '2026-01-15', '2026-01-08', 166.98, true, '2026-05-07', 'Lara', 'Feminino', 166.98, true, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL);


--
-- Data for Name: backup_contracts_status_endurecimento_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('trigger:prevent_update_delete_paid_contract_trigger', 'CREATE TRIGGER prevent_update_delete_paid_contract_trigger BEFORE DELETE OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION prevent_update_delete_paid_contract()', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('trigger:trg_contracts_status_protection', 'CREATE TRIGGER trg_contracts_status_protection BEFORE DELETE OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION fn_protect_contracts_status()', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('trigger:trg_protect_contracts_status', 'CREATE TRIGGER trg_protect_contracts_status BEFORE UPDATE OF status ON public.contracts FOR EACH ROW EXECUTE FUNCTION fn_protect_contracts_status()', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:test:Parcial', '3', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:production:Parcial', '3', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:test:Quitado', '8', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:test:Cancelado', '4', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:production:Cancelado', '6', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:test:Estornado', '3', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:production:Quitado', '53', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:test:Aberto', '1', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:production:Prorrogado', '33', '2026-11-21 21:27:31.212427-03');
INSERT INTO public.backup_contracts_status_endurecimento_20261121 VALUES ('status_count:production:Aberto', '11', '2026-11-21 21:27:31.212427-03');


--
-- Data for Name: backup_contratos_protecao_20261125; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_contratos_protecao_20261125 VALUES ('function:fn_protect_contracts_status()', 'CREATE OR REPLACE FUNCTION public.fn_protect_contracts_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_old text := lower(btrim(coalesce(OLD.status, '''')));
  v_new text := lower(btrim(coalesce(NEW.status, '''')));
BEGIN
  -- v2 20261121

  -- 1) Status de encerramento sempre podem ser gravados
  IF v_new IN (''cancelado'', ''cancelada'', ''estornado'') THEN
    RETURN NEW;
  END IF;

  -- 2) Regravar o mesmo status Ã© sempre permitido (idempotÃªncia)
  IF v_new = v_old THEN
    RETURN NEW;
  END IF;

  -- 3) Estornado pode ser reaberto por um novo pagamento
  IF v_old = ''estornado'' THEN
    RETURN NEW;
  END IF;

  -- 4) Quitado e Cancelado nÃ£o podem ser reabertos silenciosamente
  IF v_old IN (''quitado'', ''cancelado'', ''cancelada'') THEN
    RAISE EXCEPTION
      ''BLOQUEADO: OLD=% , NEW=% . NÃ£o Ã© possÃ­vel reabrir um contrato quitado ou cancelado.'',
      OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$function$
', '2026-11-25 04:36:30.555987-03');
INSERT INTO public.backup_contratos_protecao_20261125 VALUES ('function:prevent_update_delete_paid_contract()', 'CREATE OR REPLACE FUNCTION public.prevent_update_delete_paid_contract()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- v2 20261121

  IF TG_OP = ''DELETE'' THEN
    IF lower(coalesce(OLD.status, '''')) = ''quitado'' THEN
      RAISE EXCEPTION ''NÃ£o Ã© possÃ­vel excluir um contrato quitado.'';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  -- Estados de encerramento: permitidos a partir de Quitado / Prorrogado / Estornado
  IF lower(coalesce(OLD.status, '''')) IN (''quitado'', ''prorrogado'', ''estornado'')
     AND lower(coalesce(NEW.status, '''')) IN (''quitado'', ''cancelado'', ''estornado'') THEN

    -- Se o status nÃ£o muda, protege os dados estruturais do contrato quitado
    IF lower(NEW.status) = lower(OLD.status)
       AND ( OLD."contractValue"     IS DISTINCT FROM NEW."contractValue"
          OR OLD."installmentsCount" IS DISTINCT FROM NEW."installmentsCount"
          OR COALESCE(OLD."paymentMethod", '''') <> COALESCE(NEW."paymentMethod", '''') ) THEN
      RAISE EXCEPTION ''NÃ£o Ã© possÃ­vel alterar dados financeiros de um contrato quitado.'';
    END IF;

    RETURN NEW;
  END IF;

  -- Quitado nÃ£o pode voltar para Aberto / Parcial / Prorrogado
  IF lower(coalesce(OLD.status, '''')) = ''quitado'' THEN
    RAISE EXCEPTION ''NÃ£o Ã© possÃ­vel reabrir um contrato quitado.'';
  END IF;

  RETURN NEW;
END;
$function$
', '2026-11-25 04:36:30.555987-03');
INSERT INTO public.backup_contratos_protecao_20261125 VALUES ('trigger:prevent_update_delete_paid_contract_trigger', 'CREATE TRIGGER prevent_update_delete_paid_contract_trigger BEFORE DELETE OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION prevent_update_delete_paid_contract()', '2026-11-25 04:36:30.555987-03');
INSERT INTO public.backup_contratos_protecao_20261125 VALUES ('trigger:trg_protect_contracts_status', 'CREATE TRIGGER trg_protect_contracts_status BEFORE UPDATE OF status ON public.contracts FOR EACH ROW EXECUTE FUNCTION fn_protect_contracts_status()', '2026-11-25 04:36:30.555987-03');


--
-- Data for Name: backup_estornado_recebivel_20261126; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_estornado_recebivel_20261126 VALUES ('view:vw_dashboard_receivables_metrics', 'vw_dashboard_receivables_metrics', ' SELECT environment,
    count(id) AS total_installments,
    sum(amount) AS total_expected,
    sum(COALESCE("amountPaid", 0::numeric)) AS total_received,
    sum(amount - COALESCE("amountPaid", 0::numeric)) AS total_pending,
    sum(
        CASE
            WHEN "dueDate" < CURRENT_DATE AND (status <> ALL (ARRAY[''Quitado''::text, ''Cancelada''::text, ''Estornado''::text, ''Estornada''::text])) THEN amount - COALESCE("amountPaid", 0::numeric)
            ELSE 0::numeric
        END) AS total_overdue,
    count(
        CASE
            WHEN "dueDate" < CURRENT_DATE AND (status <> ALL (ARRAY[''Quitado''::text, ''Cancelada''::text, ''Estornado''::text, ''Estornada''::text])) THEN 1
            ELSE NULL::integer
        END) AS count_overdue,
    sum(
        CASE
            WHEN "dueDate" = CURRENT_DATE AND (status <> ALL (ARRAY[''Quitado''::text, ''Cancelada''::text, ''Estornado''::text, ''Estornada''::text])) THEN amount - COALESCE("amountPaid", 0::numeric)
            ELSE 0::numeric
        END) AS total_due_today,
    count(
        CASE
            WHEN "dueDate" = CURRENT_DATE AND (status <> ALL (ARRAY[''Quitado''::text, ''Cancelada''::text, ''Estornado''::text, ''Estornada''::text])) THEN 1
            ELSE NULL::integer
        END) AS count_due_today,
    sum(
        CASE
            WHEN "dueDate" > CURRENT_DATE AND "dueDate" <= (CURRENT_DATE + ''15 days''::interval) AND (status <> ALL (ARRAY[''Quitado''::text, ''Cancelada''::text, ''Estornado''::text, ''Estornada''::text])) THEN amount - COALESCE("amountPaid", 0::numeric)
            ELSE 0::numeric
        END) AS total_due_15_days
   FROM installments
  GROUP BY environment;', 'security_invoker=on', '2026-11-26 09:43:48.458815-03');
INSERT INTO public.backup_estornado_recebivel_20261126 VALUES ('view:vw_dashboard_receivables_forecast', 'vw_dashboard_receivables_forecast', ' SELECT environment,
    "dueDate" AS due_date,
    sum(amount - COALESCE("amountPaid", 0::numeric)) AS expected_amount
   FROM installments
  WHERE "dueDate" >= CURRENT_DATE AND "dueDate" <= (CURRENT_DATE + ''15 days''::interval) AND (status <> ALL (ARRAY[''Quitado''::text, ''Cancelada''::text, ''Estornado''::text, ''Estornada''::text]))
  GROUP BY environment, "dueDate"
  ORDER BY "dueDate";', 'security_invoker=on', '2026-11-26 09:43:48.458815-03');
INSERT INTO public.backup_estornado_recebivel_20261126 VALUES ('view:vw_dashboard_top_defaulters', 'vw_dashboard_top_defaulters', ' SELECT i.environment,
    c.client_id,
    cl.name AS client_name,
    sum(i.amount - COALESCE(i."amountPaid", 0::numeric)) AS total_overdue_amount,
    count(i.id) AS overdue_installments_count
   FROM installments i
     JOIN contracts c ON i.contract_id = c.id
     JOIN clients cl ON c.client_id = cl.id
  WHERE i."dueDate" < CURRENT_DATE AND (i.status <> ALL (ARRAY[''Quitado''::text, ''Cancelada''::text, ''Estornado''::text, ''Estornada''::text]))
  GROUP BY i.environment, c.client_id, cl.name
  ORDER BY (sum(i.amount - COALESCE(i."amountPaid", 0::numeric))) DESC;', 'security_invoker=on', '2026-11-26 09:43:48.458815-03');
INSERT INTO public.backup_estornado_recebivel_20261126 VALUES ('view:contract_receivables_summary', 'contract_receivables_summary', ' SELECT c.id AS contract_id,
    cl.name AS client_name,
    c."processNumber",
    c."contractValue" AS contract_value,
    c."amountReceived" AS amount_received,
        CASE
            WHEN lower(c.status) = ANY (ARRAY[''cancelado''::text, ''cancelada''::text]) THEN 0::numeric
            ELSE COALESCE(agg.open_amount, 0::numeric)
        END::numeric(12,2) AS amount_to_receive,
        CASE
            WHEN lower(c.status) = ANY (ARRAY[''cancelado''::text, ''cancelada''::text]) THEN NULL::date
            ELSE agg.next_due_date
        END AS next_due_date,
    c.status AS contract_status,
    c.environment,
        CASE
            WHEN lower(c.status) = ANY (ARRAY[''cancelado''::text, ''cancelada''::text]) THEN 0::numeric
            ELSE COALESCE(agg.overdue_amount, 0::numeric)
        END::numeric(12,2) AS overdue_amount,
    COALESCE(agg.overdue_installments, 0::bigint)::integer AS overdue_installments,
        CASE
            WHEN lower(c.status) = ANY (ARRAY[''cancelado''::text, ''cancelada''::text]) THEN 0::numeric
            ELSE COALESCE(agg.overdue_amount, 0::numeric)
        END > 0::numeric AS is_overdue
   FROM contracts c
     JOIN clients cl ON cl.id = c.client_id
     LEFT JOIN LATERAL ( SELECT sum(GREATEST(i.amount - COALESCE(i."amountPaid", 0::numeric), 0::numeric)) FILTER (WHERE lower(i.status) <> ALL (ARRAY[''quitado''::text, ''cancelado''::text, ''cancelada''::text, ''estornado''::text])) AS open_amount,
            min(i."dueDate") FILTER (WHERE lower(i.status) <> ALL (ARRAY[''quitado''::text, ''cancelado''::text, ''cancelada''::text, ''estornado''::text, ''prorrogada''::text, ''prorrogado''::text])) AS next_due_date,
            sum(GREATEST(i.amount - COALESCE(i."amountPaid", 0::numeric), 0::numeric)) FILTER (WHERE (lower(i.status) <> ALL (ARRAY[''quitado''::text, ''cancelado''::text, ''cancelada''::text, ''estornado''::text, ''prorrogada''::text, ''prorrogado''::text])) AND i."dueDate" < CURRENT_DATE) AS overdue_amount,
            count(i.id) FILTER (WHERE (lower(i.status) <> ALL (ARRAY[''quitado''::text, ''cancelado''::text, ''cancelada''::text, ''estornado''::text, ''prorrogada''::text, ''prorrogado''::text])) AND i."dueDate" < CURRENT_DATE) AS overdue_installments
           FROM installments i
          WHERE i.contract_id = c.id) agg ON true;', 'security_invoker=on', '2026-11-26 09:43:48.458815-03');
INSERT INTO public.backup_estornado_recebivel_20261126 VALUES ('function:fn_recalculate_contract_totals()', 'fn_recalculate_contract_totals', 'CREATE OR REPLACE FUNCTION public.fn_recalculate_contract_totals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_contract_id    BIGINT;
  v_received       NUMERIC(12,2);
  v_open           NUMERIC(12,2);
  v_current        TEXT;
  v_is_pro_bono    BOOLEAN;
  v_new_status     TEXT;
  v_all_cancelled  BOOLEAN;
  v_has_estornado  BOOLEAN;
  v_has_prorrogada BOOLEAN;
BEGIN
  -- v4 20261121

  IF TG_OP = ''DELETE'' THEN
      IF to_jsonb(OLD) ? ''contract_id'' THEN
          v_contract_id := OLD.contract_id;
      ELSIF to_jsonb(OLD) ? ''installment_id'' THEN
          SELECT contract_id INTO v_contract_id
            FROM installments
           WHERE id = OLD.installment_id;
      END IF;
  ELSE
      IF to_jsonb(NEW) ? ''contract_id'' THEN
          v_contract_id := NEW.contract_id;
      ELSIF to_jsonb(NEW) ? ''installment_id'' THEN
          SELECT contract_id INTO v_contract_id
            FROM installments
           WHERE id = NEW.installment_id;
      END IF;
  END IF;

  IF v_contract_id IS NULL THEN
      RETURN NULL;
  END IF;

  SELECT status, "isProBono"
    INTO v_current, v_is_pro_bono
    FROM contracts
   WHERE id = v_contract_id
     FOR UPDATE;

  SELECT
      COALESCE(SUM("amountPaid"), 0),
      COALESCE(SUM(GREATEST(amount - COALESCE("amountPaid", 0), 0)) FILTER (
          WHERE lower(status) NOT IN (''quitado'',''cancelado'',''cancelada'',''estornado'')
      ), 0),
      COALESCE(COUNT(*) > 0 AND bool_and(lower(status) IN (''cancelado'',''cancelada'')), false),
      COALESCE(bool_or(lower(status) = ''estornado''), false),
      COALESCE(bool_or(lower(status) IN (''prorrogada'',''prorrogado'')), false)
  INTO v_received, v_open, v_all_cancelled, v_has_estornado, v_has_prorrogada
  FROM installments
  WHERE contract_id = v_contract_id;

  IF lower(COALESCE(v_current, '''')) IN (''cancelado'', ''cancelada'') OR v_all_cancelled THEN
      v_new_status := ''Cancelado'';
      v_open := 0;
  ELSIF v_has_estornado THEN
      v_new_status := ''Estornado'';
  ELSIF COALESCE(v_is_pro_bono, false) AND v_open <= 0.01 THEN
      v_new_status := ''Quitado'';
      v_open := 0;
  ELSIF v_open <= 0.01 AND v_received > 0 THEN
      v_new_status := ''Quitado'';
  ELSIF v_received > 0 THEN
      v_new_status := ''Parcial'';
  ELSIF v_has_prorrogada THEN
      v_new_status := ''Prorrogado'';
  ELSE
      v_new_status := ''Aberto'';
  END IF;

  UPDATE contracts
     SET "amountReceived"   = v_received,
         "amountReceivable" = v_open,
         status             = v_new_status
   WHERE id = v_contract_id
     AND (status IS DISTINCT FROM v_new_status
          OR "amountReceived" IS DISTINCT FROM v_received
          OR "amountReceivable" IS DISTINCT FROM v_open);

  RETURN NULL;
END;
$function$
', NULL, '2026-11-26 09:43:48.458815-03');


--
-- Data for Name: backup_estornado_recebivel_dados_20261126; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_estornado_recebivel_dados_20261126 VALUES (76, 'test', 0.00, '2026-11-26 09:50:01.655136-03');
INSERT INTO public.backup_estornado_recebivel_dados_20261126 VALUES (134, 'test', 0.00, '2026-11-26 09:50:01.655136-03');
INSERT INTO public.backup_estornado_recebivel_dados_20261126 VALUES (74, 'test', 0.00, '2026-11-26 09:50:01.655136-03');


--
-- Data for Name: backup_installments_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_installments_20261121 VALUES (3, 3, 1, '2026-05-15', 1821.60, 2450.40, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 12:03:21.46203-03', '2026-04-10', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (122, 76, 1, '2026-04-25', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 2, '2026-03-25 10:52:37.325394-03', NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (144, 75, 1, '2026-04-25', 2000.00, 2000.00, 'Quitado', 0.00, 0.00, 'test', 2, 23, '2026-04-08 11:50:41.303672-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (148, 91, 1, '2026-05-10', 300.00, 300.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-10 20:31:47.666535-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (149, 91, 2, '2026-06-10', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-10 20:31:47.666535-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (154, 92, 3, '2026-05-11', 250.00, 250.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:16:54.069428-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (158, 70, 4, '2026-05-16', 90.00, 90.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:22:05.781256-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (113, 74, 1, '2026-04-25', 2000.00, 2000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 23, '2026-03-25 08:06:45.084941-03', NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (162, 90, 2, '2026-05-10', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:41:20.280204-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (116, 75, 1, '2026-04-25', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 23, '2026-03-25 09:22:34.11817-03', NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (164, 75, 2, '2026-04-25', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:23:23.758925-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (170, 93, 4, '2026-05-11', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:36:22.73276-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (189, 102, 1, '2026-05-28', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-05-27 17:35:41.56915-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (206, 119, 1, '2027-04-21', 2800.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-08-21 17:08:14.434994-03', '2027-04-21', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (136, 82, 1, '2026-08-06', 2800.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-04-01 20:18:53.316849-03', '2026-08-06', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (109, 73, 1, '2026-12-20', 9726.00, 9744.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-20 17:00:43.783439-03', '2026-12-20', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (5, 5, 1, '2026-04-30', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 12:08:38.857422-03', '2026-04-01', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (89, 65, 3, '2026-08-15', 2500.00, 2500.00, 'Quitado', 0.00, 0.00, 'test', 2, 2, '2026-03-15 20:07:37.374211-03', '2026-08-15', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (93, 65, 4, '2026-07-15', 2500.00, 500.00, 'Parcial', 0.00, 0.00, 'test', NULL, 2, '2026-03-15 21:04:29.141527-03', '2026-07-15', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (94, 66, 1, '2026-04-16', 2500.00, 0.00, 'Aberto', 0.00, 0.00, 'test', 2, 2, '2026-03-16 09:52:32.32798-03', '2026-04-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (185, 98, 1, '2027-01-19', 12968.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-05-19 14:01:17.366236-03', '2027-01-19', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (133, 42, 1, '2026-10-26', 2800.00, 2800.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-31 09:56:09.033301-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (216, 123, 1, '2026-12-11', 2500.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-09-11 13:38:59.422971-03', '2026-12-11', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (193, 106, 1, '2026-06-04', 700.00, 700.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-06-04 18:33:09.459902-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (128, 80, 1, '2026-11-26', 9726.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-03-27 20:35:14.525334-03', '2026-11-26', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (23, 22, 1, '2026-06-25', 2269.40, 2458.76, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 14:49:18.299648-03', '2026-06-25', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (41, 33, 1, '2026-05-23', 2269.40, 2477.88, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-06-01 00:27:07.995761-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (219, 126, 1, '2027-03-03', 2800.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-11-03 13:49:01.366251-03', '2027-03-03', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (198, 111, 1, '2026-12-08', 2593.60, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-07-08 16:14:14.314088-03', '2026-12-08', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (196, 109, 1, '2026-06-26', 5000.00, 5000.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-06-25 19:01:20.428752-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (59, 51, 1, '2026-10-04', 2800.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-08-18 11:49:38.056912-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (140, 86, 1, '2026-11-30', 3000.00, 2000.00, 'Parcial', 0.00, 0.00, 'production', NULL, 2, '2026-04-07 18:33:05.035164-03', '2026-07-07', NULL, 'PrevisÃ£o administrativa/financeira - Conforme extrato do INSS.', '2026-11-16 11:42:56.529-03', 2);
INSERT INTO public.backup_installments_20261121 VALUES (125, 44, 1, '2026-09-12', 2269.40, 2458.52, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-27 16:20:26.97591-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (221, 128, 1, '2027-03-16', 2800.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-11-16 16:50:14.377096-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (225, 132, 1, '2027-05-10', 9726.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-11-16 18:20:22.577965-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (204, 117, 1, '2026-11-17', 3000.00, 1500.00, 'Parcial', 0.00, 0.00, 'production', NULL, 2, '2026-08-13 10:59:09.862687-03', '2026-12-14', NULL, 'PrevisÃ£o administrativa/financeira - De acordo extrato do INSS', '2026-11-16 11:49:25.057-03', 2);
INSERT INTO public.backup_installments_20261121 VALUES (35, 28, 1, '2026-02-27', 0.00, 0.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-03-10 15:25:46.290572-03', '2026-02-27', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (4, 4, 1, '2026-02-07', 0.00, 0.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-03-10 12:06:00.587114-03', '2026-02-07', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (6, 6, 1, '2026-03-05', 1821.60, 2000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 12:20:02.390065-03', '2026-03-05', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (56, 7, 1, '2026-03-17', 1821.60, 2000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-12 14:37:57.406036-03', '2026-03-17', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (2, 2, 1, '2026-06-10', 1821.60, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 11:59:47.879498-03', '2026-06-10', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (139, 85, 1, '2026-04-14', 9000.00, 9000.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-04-02 19:55:29.552701-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (197, 110, 1, '2026-06-30', 550.00, 550.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-06-30 15:51:24.311057-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (12, 12, 1, '2026-05-17', 1518.00, 2121.89, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 12:57:41.946722-03', '2026-04-17', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (163, 90, 3, '2026-05-10', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:41:34.134805-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (165, 75, 3, '2026-04-25', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:23:37.34409-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (95, 66, 2, '2026-05-16', 2500.00, 0.00, 'Aberto', 0.00, 0.00, 'test', 2, 2, '2026-03-16 09:52:32.32798-03', '2026-05-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (137, 83, 1, '2026-04-02', 0.00, 0.00, 'Quitado', 0.00, 0.00, 'test', 2, 2, '2026-04-02 00:07:59.279776-03', NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (171, 93, 5, '2026-06-11', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:36:38.674016-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (87, 65, 1, '2026-04-15', 2500.00, 500.00, 'Parcial', 0.00, 0.00, 'test', 2, 2, '2026-03-15 20:07:37.374211-03', '2026-04-15', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (88, 65, 2, '2026-05-15', 2500.00, 2500.00, 'Quitado', 0.00, 0.00, 'test', 2, 2, '2026-03-15 20:07:37.374211-03', '2026-05-15', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (199, 112, 1, '2026-12-09', 3010.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-07-09 15:08:55.740106-03', '2026-12-09', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (25, 24, 1, '2026-11-15', 9000.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-05-28 20:18:44.759262-03', '2026-11-15', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (183, 96, 1, '2027-02-13', 9726.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-05-14 14:15:50.872023-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (120, 15, 1, '2026-04-07', 1746.94, 1747.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-03-25 09:40:20.889802-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (26, 25, 1, '2026-09-17', 9000.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:13:54.895136-03', '2026-09-17', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (97, 67, 2, '2026-05-16', 5000.00, 5000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 2, '2026-03-16 10:02:46.120363-03', '2026-05-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (150, 91, 3, '2026-05-10', 100.00, 100.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-10 20:50:32.282411-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (186, 99, 1, '2027-01-19', 12968.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-05-19 14:15:06.032933-03', '2027-01-19', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (155, 92, 4, '2026-06-11', 200.00, 200.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:17:18.472216-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (103, 70, 1, '2026-04-16', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'test', 2, 23, '2026-03-16 11:44:49.677246-03', '2026-04-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (61, 53, 1, '2026-09-30', 16210.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-03-12 15:15:49.67242-03', '2026-09-30', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (17, 18, 1, '2026-03-03', 1821.60, 1987.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 13:24:31.153189-03', '2026-03-03', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (104, 70, 2, '2026-05-16', 230.00, 230.00, 'Quitado', 0.00, 0.00, 'test', 2, 23, '2026-03-16 11:44:49.677246-03', '2026-05-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (159, 70, 5, '2026-05-16', 60.00, 60.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:22:25.062506-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (182, 95, 1, '2027-03-09', 2269.40, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-05-09 11:27:24.612407-03', '2027-03-09', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (220, 127, 1, '2027-04-03', 9726.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-11-03 14:54:57.187173-03', '2027-04-03', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (131, 81, 3, '2026-06-28', 4000.00, 0.00, 'Aberto', 0.00, 0.00, 'test', NULL, 2, '2026-03-28 10:15:14.299885-03', '2026-06-28', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (130, 81, 2, '2026-05-28', 4000.00, 0.00, 'Aberto', 0.00, 0.00, 'test', NULL, 2, '2026-03-28 10:15:14.299885-03', '2026-05-28', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (49, 41, 1, '2026-08-04', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-06-15 10:53:25.632367-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (51, 43, 1, '2026-08-27', 1945.20, 2458.52, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-06-27 11:15:30.577938-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (202, 115, 1, '2027-01-21', 3000.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-07-21 13:27:00.386219-03', '2027-01-21', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (141, 87, 1, '2027-03-17', 12968.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-04-07 18:35:36.051371-03', '2027-03-17', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (145, 88, 1, '2027-02-09', 9726.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-04-10 15:38:41.425683-03', '2027-02-09', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (207, 120, 1, '2026-11-24', 1621.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-08-22 17:47:22.536231-03', '2026-12-10', NULL, 'PrevisÃ£o administrativa/financeira - De acordo extrato do INSS', '2026-11-16 11:51:39.665-03', 2);
INSERT INTO public.backup_installments_20261121 VALUES (22, 21, 1, '2026-10-07', 2800.00, 2800.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-08-08 09:39:58.847906-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (222, 129, 1, '2027-03-16', 2120.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-11-16 16:57:37.062271-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (58, 50, 1, '2026-09-30', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-07-07 15:59:02.100714-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (226, 133, 1, '2028-05-16', 98000.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-11-16 18:40:03.448509-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (54, 46, 1, '2026-11-06', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-09-14 15:18:43.979571-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (129, 81, 1, '2026-04-28', 4000.00, 4000.00, 'Quitado', 0.00, 0.00, 'test', 2, 2, '2026-03-28 10:15:14.299885-03', '2026-04-28', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (20, 19, 1, '2026-02-19', 1821.60, 2000.04, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 13:41:11.215513-03', '2026-02-19', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (27, 26, 1, '2026-02-01', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:17:12.164274-03', '2026-02-01', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (166, 75, 4, '2026-04-25', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:23:54.077312-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (172, 93, 6, '2026-07-11', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:36:48.717004-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (194, 107, 1, '2026-11-24', 3000.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-06-23 12:10:29.956187-03', '2026-12-28', NULL, 'PrevisÃ£o administrativa/financeira - De acordo extrato do INSS', '2026-11-16 11:51:07.825-03', 2);
INSERT INTO public.backup_installments_20261121 VALUES (32, 26, 6, '2026-07-01', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:17:12.164274-03', '2026-07-01', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (121, 13, 1, '2026-05-01', 2269.40, 2500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-25 09:41:43.713735-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (208, 121, 1, '2026-09-02', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-09-02 17:04:21.698715-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (98, 68, 1, '2026-04-16', 2500.00, 0.00, 'Cancelada', 0.00, 0.00, 'test', 2, 2, '2026-03-16 10:03:08.261296-03', '2026-04-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (99, 68, 2, '2026-05-16', 2500.00, 0.00, 'Cancelada', 0.00, 0.00, 'test', 2, 2, '2026-03-16 10:03:08.261296-03', '2026-05-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (100, 68, 3, '2026-06-16', 2500.00, 0.00, 'Cancelada', 0.00, 0.00, 'test', 2, 2, '2026-03-16 10:03:08.261296-03', '2026-06-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (101, 68, 4, '2026-07-16', 2500.00, 0.00, 'Cancelada', 0.00, 0.00, 'test', 2, 2, '2026-03-16 10:03:08.261296-03', '2026-07-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (30, 26, 4, '2026-05-01', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:17:12.164274-03', '2026-05-01', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (21, 20, 1, '2026-07-10', 2800.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-07-23 08:34:48.778468-03', '2026-07-10', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (151, 91, 4, '2026-05-10', 100.00, 100.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-10 20:59:31.331817-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (156, 92, 5, '2026-06-11', 200.00, 200.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:17:31.67921-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (160, 70, 6, '2026-05-16', 50.00, 50.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:22:36.426642-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (96, 67, 1, '2026-04-16', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 23, '2026-03-16 10:02:46.120363-03', '2026-04-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (138, 84, 1, '2027-02-17', 3000.00, 0.00, 'Cancelada', 0.00, 0.00, 'production', 2, 2, '2026-04-02 12:03:25.517264-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (34, 27, 1, '2026-06-16', 9000.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:24:28.118583-03', '2026-06-16', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (184, 97, 1, '2026-07-14', 2269.40, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-05-14 14:56:59.35777-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (146, 89, 1, '2026-09-10', 2100.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-04-10 15:53:02.593241-03', '2026-09-10', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (210, 121, 3, '2026-11-02', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-09-02 17:04:21.698715-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (45, 37, 1, '2026-08-10', 2800.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-06-01 00:26:35.234081-03', '2026-08-10', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (200, 113, 1, '2026-11-25', 2593.60, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-07-09 15:59:36.696019-03', '2026-11-25', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (33, 26, 7, '2026-08-01', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:17:12.164274-03', '2026-08-01', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (134, 16, 1, '2026-09-25', 2125.00, 3239.44, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-03-31 09:58:06.861496-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (28, 26, 2, '2026-03-01', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:17:12.164274-03', '2026-03-01', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (201, 114, 1, '2026-12-29', 12968.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-07-17 08:57:15.299562-03', '2026-12-29', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (72, 59, 1, '2025-11-28', 1821.60, 2025.22, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-13 08:58:37.710795-03', '2025-11-28', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (73, 60, 1, '2026-01-05', 1518.00, 1612.87, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-13 09:06:26.662855-03', '2026-01-05', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (76, 62, 1, '2026-02-26', 0.00, 0.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-03-15 05:36:36.800408-03', '2026-02-26', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (127, 79, 1, '2026-07-27', 3000.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-03-27 20:15:10.032289-03', '2026-07-27', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (44, 36, 1, '2026-07-25', 2800.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-06-15 10:55:09.581956-03', '2026-07-25', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (217, 124, 1, '2027-05-24', 2800.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-09-24 12:06:06.696107-03', '2027-05-24', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (223, 130, 1, '2027-04-16', 2400.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-11-16 17:03:04.224645-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (62, 54, 1, '2026-09-21', 2269.40, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-03-12 15:25:20.450328-03', '2026-09-21', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (187, 100, 1, '2026-05-20', 4000.00, 4000.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-05-19 15:36:54.735129-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (31, 26, 5, '2026-06-01', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:17:12.164274-03', '2026-06-01', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (214, 121, 7, '2027-03-02', 500.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-09-02 17:04:21.698715-03', '2027-03-02', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (213, 121, 6, '2027-02-02', 500.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-09-02 17:04:21.698715-03', '2027-02-02', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (212, 121, 5, '2027-01-02', 500.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-09-02 17:04:21.698715-03', '2027-01-02', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (211, 121, 4, '2026-12-02', 500.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-09-02 17:04:21.698715-03', '2026-12-02', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (124, 48, 1, '2026-09-10', 2800.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-27 16:17:56.12557-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (43, 35, 1, '2026-07-04', 2800.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-05-11 15:30:57.864467-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (205, 118, 1, '2027-01-18', 2800.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-08-18 17:54:01.680167-03', '2027-01-18', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (53, 45, 1, '2026-09-23', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-08-08 09:40:10.729093-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (209, 121, 2, '2026-10-02', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-09-02 17:04:21.698715-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (29, 26, 3, '2026-04-01', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:17:12.164274-03', '2026-04-01', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (11, 11, 1, '2026-06-24', 2125.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 12:52:47.008238-03', '2026-06-24', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (10, 10, 1, '2026-05-25', 2125.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 12:45:39.120279-03', '2026-05-25', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (55, 47, 1, '2026-09-23', 2800.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-06-27 13:58:44.379619-03', '2026-09-23', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (46, 38, 1, '2026-08-28', 1821.60, 2458.59, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-06-09 10:29:18.603118-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (8, 8, 1, '2026-07-07', 2250.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 12:34:57.362166-03', '2026-05-07', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (192, 105, 1, '2026-06-03', 4000.00, 4000.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-06-04 07:28:49.752581-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (167, 93, 1, '2026-05-11', 166.66, 166.66, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:35:50.801241-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (168, 93, 2, '2026-06-11', 166.66, 166.66, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:35:50.801241-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (169, 93, 3, '2026-07-11', 166.68, 166.68, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:35:50.801241-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (152, 92, 1, '2026-05-11', 250.00, 250.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:15:48.471694-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (153, 92, 2, '2026-06-11', 100.00, 100.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:15:48.471694-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (157, 70, 3, '2026-05-16', 70.00, 70.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:21:53.173601-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (161, 67, 3, '2026-04-16', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 01:32:23.451977-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (218, 125, 1, '2027-02-27', 1621.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-10-27 15:02:53.502912-03', '2027-02-27', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (147, 90, 1, '2026-05-10', 600.00, 600.00, 'Quitado', 0.00, 0.00, 'test', NULL, 23, '2026-04-10 16:05:15.238433-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (123, 77, 1, '2026-06-26', 3000.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-03-27 14:27:18.006723-03', '2026-06-26', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (108, 72, 1, '2026-08-20', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-20 16:52:58.16822-03', '2026-08-20', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (60, 52, 1, '2026-11-06', 2800.00, 2800.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-08-20 13:44:20.744297-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (195, 108, 1, '2026-07-23', 4000.00, 4000.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-06-24 00:17:19.737628-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (126, 78, 1, '2026-11-26', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-27 20:05:05.64793-03', NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (42, 34, 1, '2026-07-23', 2269.40, 2477.73, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-06-01 00:26:52.398271-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (181, 94, 1, '2026-06-08', 2000.00, 0.00, 'Aberto', 0.00, 0.00, 'test', 2, 2, '2026-05-08 15:05:44.271413-03', '2026-06-08', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (215, 122, 1, '2027-01-09', 2800.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-09-09 12:40:27.450499-03', '2027-01-09', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (1, 1, 1, '2026-09-10', 2800.00, 0.00, 'Aberto', 0.00, 0.00, 'production', NULL, 2, '2026-08-18 11:45:27.832595-03', '2026-09-10', NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (224, 131, 1, '2027-11-16', 9000.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', 2, 2, '2026-11-16 17:18:11.476417-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (173, 9, 1, '2026-05-19', 2499.09, 2499.09, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-05-07 12:54:33.055278-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (188, 101, 1, '2026-05-21', 5000.00, 5000.00, 'Quitado', 0.00, 0.00, 'production', 2, 2, '2026-05-21 02:11:31.896437-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (24, 23, 1, '2026-06-16', 2269.40, 2458.84, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 15:06:21.755776-03', '2026-06-16', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (107, 71, 1, '2027-01-06', 3000.00, 0.00, 'Prorrogada', 0.00, 0.00, 'production', NULL, 2, '2026-03-18 15:13:16.711695-03', '2027-01-06', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (13, 14, 1, '2026-05-05', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-03-10 13:06:24.062699-03', '2026-07-09', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (191, 104, 1, '2026-09-16', 2800.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-06-01 21:05:26.56288-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (203, 116, 1, '2026-10-06', 2460.00, 2500.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-08-06 10:53:49.055206-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (48, 40, 1, '2026-08-16', 2269.40, 2460.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-06-15 11:11:52.561083-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (57, 49, 1, '2026-10-14', 2800.00, 2800.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-07-08 09:48:32.763814-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (40, 32, 1, '2026-11-05', 2269.40, 2440.86, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-08-08 09:40:25.837336-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_installments_20261121 VALUES (190, 103, 1, '2026-09-28', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'production', NULL, 2, '2026-05-28 08:29:06.305795-03', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: backup_payments_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_payments_20261121 VALUES ('638c2592-38aa-4e57-9230-b0cd9926f691', 139, 700.00, '2026-04-27 21:00:00-03', 6, 6, 'Recebimento Luanna EdimÃ© Douglas Criminal', NULL, '2026-04-28 07:42:23.879751-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('ba58e2cc-1d6b-4646-9a02-ac21631b162b', 148, 300.00, '2026-04-09 21:00:00-03', 14, NULL, 'Estorno: estorno', NULL, '2026-04-10 20:41:57.160266-03', 'production', 'reversal', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('12d264b3-9eac-4931-9ac6-85dbc35d97bf', 5, 1300.00, '2026-04-28 21:00:00-03', 5, 7, 'Recebimento restante Rinara', NULL, '2026-04-29 15:10:09.180428-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('c87bd3e4-253e-41c7-a4f2-359ef0fe8572', 120, 1747.00, '2026-04-06 21:00:00-03', 6, NULL, 'Pagto SalÃ¡rio Maternidade Gislane', NULL, '2026-04-07 17:20:34.933139-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('a5c72781-cf9a-4a1d-98b0-2814277f01ce', 149, 500.00, '2026-04-10 21:00:00-03', 14, 1, 'Dona Maria', NULL, '2026-04-11 00:40:29.373257-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('e80d47fa-754b-4538-9189-98ef58289740', 154, 250.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:17:05.975225-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('6f0ee524-9ba2-4e6b-9626-a8189b7d8a11', 155, 200.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:17:31.67921-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('566e614c-4ad5-407f-9ed0-7516ff585e5d', 103, 400.00, '2026-04-10 21:00:00-03', 9, 21, '', NULL, '2026-04-11 01:21:29.47061-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('92742c59-8ab2-4f75-ad20-2faacf7e1c43', 157, 70.00, '2026-04-10 21:00:00-03', 9, 21, '', NULL, '2026-04-11 01:22:05.781256-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('2c5aeddb-211a-48d1-ac85-25de59a86dbb', 159, 60.00, '2026-04-10 21:00:00-03', 9, 21, '', NULL, '2026-04-11 01:22:36.426642-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('f5244bd8-52bb-4471-b968-aba04c6fa821', 113, 2000.00, '2026-04-10 21:00:00-03', 1, 1, '', NULL, '2026-04-11 01:23:18.96695-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('194f829e-3624-49fe-b759-ac7678025230', 161, 1000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:32:32.990637-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('23e2c37a-888f-47aa-bf5d-b6d614bd2dbd', 147, 600.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:41:20.280204-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('b42945e0-99bf-41df-a2e2-57d05c120592', 144, 2000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 02:23:23.758925-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('92e17def-6151-4c48-835f-345cc0a4775e', 164, 3000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 02:23:42.837154-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('71621f9e-be3e-4209-91be-7053082c2984', 166, 1000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 02:23:59.762185-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('6e1ddbfa-1db8-42fb-8616-cd2a4f538160', 168, 166.66, '2026-04-10 21:00:00-03', 1, 1, '', NULL, '2026-04-11 02:36:38.674016-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('63155408-6134-4b06-91e5-ed8fd0f8573f', 170, 500.00, '2026-04-10 21:00:00-03', 1, 1, '', NULL, '2026-04-11 02:36:56.968608-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('04803863-8c8b-4890-9aec-698a45cd91f4', 172, 500.00, '2026-04-10 21:00:00-03', 1, 1, '', NULL, '2026-04-11 02:37:07.244297-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('8ab89d87-ed24-4324-9104-125da3885c65', 139, 50.00, '2026-04-14 21:00:00-03', 6, 6, 'Recto Parcial Luanna EdimÃ© Defesa Criminal do Esposo', NULL, '2026-04-15 11:18:58.303683-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('1b533bb8-9b1d-48c8-8f3f-790133c2e827', 30, 140.00, '2026-05-03 21:00:00-03', 6, 6, 'Recebimento D. Maria MÃ£e de Kelly', NULL, '2026-05-04 11:15:13.545169-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('d8391b6e-8c90-4519-a6b9-12fdc3aedebf', 13, 1000.00, '2026-05-04 21:00:00-03', 3, 6, 'Recebimento Rhyana Brunna Parcela 02/03', NULL, '2026-05-05 18:46:35.636484-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('665a2cbc-dfaf-4560-a0cf-a28be2b65fb7', 27, 500.00, '2026-02-01 21:00:00-03', 7, 7, 'Recebimento D. Maria MÃ£e de Kelly', NULL, '2026-04-10 20:59:31.331817-03', 'production', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('beba8aa8-d5fe-4ca9-aac9-816f7e1ad7ae', 187, 3000.00, '2026-05-18 21:00:00-03', 5, 7, 'Recebimento Diego Dona Aldeni Defesa Criminal', NULL, '2026-05-19 15:39:08.835311-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('033f5885-ab46-442b-b38a-bff90c61434a', 23, 1458.76, '2026-05-18 21:00:00-03', 6, 6, 'Recebimento Parcial 01/02', NULL, '2026-05-19 17:55:14.106712-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('db60b4ce-6e89-4fbb-8a83-fb574e381b6c', 188, 5000.00, '2026-05-20 21:00:00-03', 4, 7, 'Recebimento UrsÃ£o', NULL, '2026-05-21 02:12:25.200274-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('aeeebec8-d5d1-407b-9209-8b23df4d6eaf', 189, 1000.00, '2026-05-26 21:00:00-03', 6, 6, 'Defesa Criminal', NULL, '2026-05-27 17:36:14.088426-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('c2c02242-89a9-4e63-8655-cde4878a4dcc', 103, 100.00, '2026-03-15 21:00:00-03', 1, 1, '', NULL, '2026-03-16 11:46:30.014747-03', 'production
', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('2583577a-413b-43cb-a425-5e0bf6b96f77', 56, 2000.00, '2026-03-16 21:00:00-03', 3, 6, 'Recebimento SalÃ¡rio-Maternidade', NULL, '2026-03-17 15:08:18.055121-03', 'production', 'payment', 2, NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa');
INSERT INTO public.backup_payments_20261121 VALUES ('27d2645c-8bda-4292-8f30-e8a937a0d109', 29, 500.00, '2026-03-29 21:00:00-03', 4, 7, 'Pagto Dona Maria Kelly ', NULL, '2026-03-30 09:11:10.860697-03', 'production', 'payment', 2, NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa');
INSERT INTO public.backup_payments_20261121 VALUES ('1924fa93-c576-463d-97c3-e9e875f359ba', 5, 1700.00, '2026-03-30 21:00:00-03', 4, 7, 'Pagto parcial SalÃ¡rio-maternidade', NULL, '2026-03-31 09:35:28.15719-03', 'production', 'payment', 2, NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa');
INSERT INTO public.backup_payments_20261121 VALUES ('6296e941-b072-4417-b780-2a52d90b99f3', 121, 1500.00, '2026-03-31 21:00:00-03', 4, 7, 'Recto SalÃ¡rio-Maternidade Elane', NULL, '2026-04-01 10:45:39.366909-03', 'production', 'payment', 2, NULL, 'eaf29983-1998-40a4-bd07-03ea09b4adfa');
INSERT INTO public.backup_payments_20261121 VALUES ('43991f38-83a7-4122-804f-f58a803ec60d', 87, 2500.00, '2026-03-14 21:00:00-03', 8, 21, 'Pgto honorÃ¡rios', NULL, '2026-03-15 20:19:02.251535-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('b3896267-c77f-48e2-b20a-54b2e65645ff', 88, 2500.00, '2026-03-14 21:00:00-03', 9, 22, 'Pgto HonorÃ¡rios', NULL, '2026-03-15 20:19:38.739451-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('0e107f28-53f5-402a-a95e-24d8d0f3dbee', 89, 1000.00, '2026-03-14 21:00:00-03', 8, 21, 'Rectos de honorÃ¡rios', NULL, '2026-03-15 20:30:22.539169-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('cd6c40a2-de38-4ac2-a6eb-ef042bb657fa', 89, 500.00, '2026-03-14 21:00:00-03', 8, 21, 'Rectos de honorÃ¡rios', NULL, '2026-03-15 20:33:11.630129-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('5c1e59fc-0b99-49a7-a6db-182f7684d321', 93, 500.00, '2026-03-15 21:00:00-03', 8, 21, 'Entrou 500,00', NULL, '2026-03-15 21:07:26.320655-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('0732b8fc-3e95-4903-a35c-7a7e3ab9377d', 89, 1000.00, '2026-03-15 21:00:00-03', 8, 21, '1000,00', NULL, '2026-03-15 21:09:37.70936-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('e03ac76d-aba1-497f-93de-82841c34e9f7', 87, 2500.00, '2026-03-15 21:00:00-03', 9, NULL, 'Estorno: DevoluÃ§Ã£o ', NULL, '2026-03-15 23:09:17.814574-03', 'test', 'reversal', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('7300f497-c206-40e4-a22e-1b3195a13523', 87, 500.00, '2026-03-15 21:00:00-03', 1, 21, '', NULL, '2026-03-15 23:10:09.532689-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('b180b214-b38a-45d3-bf52-eab03df5a437', 89, 1000.00, '2026-03-15 21:00:00-03', 11, 22, 'Recebimento Via PIX', NULL, '2026-03-16 02:46:40.962745-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('7daa0375-19fa-4fbb-ad12-b523e93280ec', 96, 3000.00, '2026-03-15 21:00:00-03', 8, 1, 'Em dinheiro', NULL, '2026-03-16 11:34:04.77383-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('776d67f8-f428-47a9-80c2-58f36847595f', 103, 400.00, '2026-03-15 21:00:00-03', 1, 1, '', NULL, '2026-03-16 11:45:13.874921-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('e672c672-e53a-4a32-91de-2f57a9990380', 103, 400.00, '2026-03-15 21:00:00-03', 1, NULL, 'Estorno: SSGFSFD', NULL, '2026-03-16 11:45:26.04858-03', 'test', 'reversal', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('8d6a479c-e7c3-4128-8538-7eb8a7d20bc1', 139, 500.00, '2026-05-26 21:00:00-03', 6, 6, 'Recto Parcial Luanna EdimÃ© Defesa Criminal do Esposo', NULL, '2026-05-27 10:41:30.093947-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('5f549cc4-40ca-4007-9a13-096d707cad06', 122, 1000.00, '2026-03-24 21:00:00-03', 11, 22, 'Parcial', NULL, '2026-03-25 10:53:06.073945-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('f5265f51-a99a-4822-96c8-b91c939b43a3', 129, 4000.00, '2026-03-27 21:00:00-03', 8, 21, 'Em dinheiro', NULL, '2026-03-28 10:15:49.536131-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('be0ba0cd-e5c8-45e3-8851-b067d6c948dd', 31, 500.00, '2026-05-31 21:00:00-03', 4, 7, 'Recebimento Dona Maria mÃ£e de Kelly Parcela 05/07', NULL, '2026-06-01 10:59:12.38928-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('a9863507-44f0-4b1b-b158-d9b69f2eeb9b', 192, 4000.00, '2026-06-03 21:00:00-03', 6, 6, 'Defesa Criminal', NULL, '2026-06-04 07:29:31.599156-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('2c45c008-40e4-48aa-b40e-76db724213a4', 23, 1000.00, '2026-06-04 21:00:00-03', 6, 6, 'Recebimento Parcial 02/02', NULL, '2026-06-05 13:29:37.59301-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('331eb53b-e4b0-41db-9a46-4ff9fa047ee6', 43, 2000.00, '2026-06-15 21:00:00-03', 6, 6, 'Recebimento Parcela 01/02', NULL, '2026-06-16 22:11:23.113403-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('2279408a-5bbb-4bc9-939d-4383cdd0751d', 129, 2000.00, '2026-11-18 21:00:00-03', 9, 1, 'teste', NULL, '2026-11-19 21:55:19.198476-03', 'test', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('543ce837-a774-4beb-b096-0fe856fe66f5', 129, 4000.00, '2026-04-01 21:00:00-03', 11, NULL, 'Estorno: teste', NULL, '2026-04-02 06:39:09.295176-03', 'test', 'reversal', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('7dcc9691-841e-4063-8cd6-090d44d9d32b', 129, 2000.00, '2026-04-01 21:00:00-03', 11, 1, 'teste', NULL, '2026-04-02 06:39:39.383609-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd');
INSERT INTO public.backup_payments_20261121 VALUES ('fbf7f49b-3811-48e4-878b-6ec0ee711e3a', 147, 1600.00, '2026-04-09 21:00:00-03', 9, NULL, 'Estorno: estorno', NULL, '2026-04-10 16:11:00.516374-03', 'production', 'reversal', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('3872027b-1ddb-49f9-bce9-8903955d9b84', 148, 300.00, '2026-04-09 21:00:00-03', 14, 22, 'Recebimento Dona Maria', NULL, '2026-04-10 20:50:32.282411-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('30028471-5b94-4e1f-b9c2-dc371026dff5', 152, 250.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:16:54.069428-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('3de022be-f88f-4e48-9520-1c440fe3edc2', 156, 200.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:18:38.895366-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('e42f80d8-b2e9-41e3-9ba4-098fe7f56959', 104, 230.00, '2026-04-10 21:00:00-03', 9, 21, '', NULL, '2026-04-11 01:21:53.173601-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('40d39f8f-64e1-4bf3-bbfb-571a1fb74e86', 158, 90.00, '2026-04-10 21:00:00-03', 9, 21, '', NULL, '2026-04-11 01:22:25.062506-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('83cefed0-4d96-47dd-9f1a-a010491e8bbd', 160, 50.00, '2026-04-10 21:00:00-03', 9, 21, '', NULL, '2026-04-11 01:22:41.42227-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('bff6b118-2d90-4cc5-ab2c-62a4db0574d5', 96, 1000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:32:23.451977-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('b02ef217-5694-4aca-8fac-cce3e14a3b0c', 147, 2000.00, '2026-04-10 21:00:00-03', 14, NULL, 'Estorno: este', NULL, '2026-04-11 01:33:27.913506-03', 'production', 'reversal', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('b26f1289-b9dc-4c69-999c-051d55cb12f8', 162, 1000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:41:34.134805-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('88ddab42-72b2-4308-8716-a5f09cfc0c77', 163, 1000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 02:22:33.180611-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('274de3bf-922b-49d4-b48e-23a4d87d920f', 116, 3000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 02:23:37.34409-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('b5243d8f-9043-4050-9024-bdee52b0289f', 165, 1000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 02:23:54.077312-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('036720f7-f75e-4481-ae62-d08761174680', 167, 166.66, '2026-04-10 21:00:00-03', 1, 1, '', NULL, '2026-04-11 02:36:22.73276-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('792dd0f8-8ebe-4c26-ba5e-8291dfd91de9', 169, 166.68, '2026-04-10 21:00:00-03', 1, 1, '', NULL, '2026-04-11 02:36:48.717004-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('30311b8d-38c6-43d2-bac1-8fca7cb5aac0', 171, 500.00, '2026-04-10 21:00:00-03', 1, 1, '', NULL, '2026-04-11 02:37:02.38057-03', 'test', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('7a0b22ae-80f7-44a5-b572-d82a5cf54005', 139, 2750.00, '2026-04-13 21:00:00-03', 6, 6, 'Recto Parcial Luanna EdimÃ© Defesa Criminal do Esposo', NULL, '2026-04-14 15:53:18.95768-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('f3b06518-01a5-4302-b7ff-b9c0bfab3ca8', 139, 1240.00, '2026-04-26 21:00:00-03', 6, 6, 'Recebimento Luanna EdimÃ© Douglas Criminal', NULL, '2026-04-27 10:50:16.742571-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('7f70ebc3-4621-4c0d-a344-b7818cf3a52e', 13, 1497.00, '2026-04-27 21:00:00-03', 3, 6, 'Recebimento Rhyana Brunna Parcela 01/03', NULL, '2026-04-28 18:10:27.218135-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('5bb3856d-1737-45b7-a979-03b93043b3ba', 121, 1000.00, '2026-05-03 21:00:00-03', 4, 7, 'Recebimento Elane 02/02', NULL, '2026-05-04 11:14:16.200641-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('776db8da-905e-4479-9510-b205ef372dc6', 30, 360.00, '2026-05-03 21:00:00-03', 4, 7, 'Recebimento D. Maria MÃ£e de Kelly', NULL, '2026-05-04 11:15:30.594061-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('4429eb96-e992-4f44-aae8-334c461f1da5', 42, 1477.73, '2026-06-22 21:00:00-03', 6, 6, 'Recebimento Dona Sirleide 01/02', NULL, '2026-06-23 17:56:42.883785-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('c7bdd308-6e73-4d38-8327-9cf337cc3038', 108, 2000.00, '2026-06-22 21:00:00-03', 6, 6, 'Recebimento Emylle Jeidson 01/02', NULL, '2026-06-23 17:57:48.557536-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('ccd6e528-323f-4f7f-a0cd-73b46d55b2f1', 195, 2390.00, '2026-06-23 21:00:00-03', 6, 6, 'Recebimento Elefante ', NULL, '2026-06-24 00:18:38.12113-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('d4af5467-6496-423a-82c1-3b39169f4818', 139, 800.00, '2026-06-24 21:00:00-03', 6, 6, 'Recto Parcial Luanna EdimÃ© Defesa Criminal do Esposo', NULL, '2026-06-25 13:38:47.632366-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('576f8fc8-88dc-4191-9018-65d18ba3f972', 108, 1000.00, '2026-06-24 21:00:00-03', 6, 6, 'Recebimento Emylle Jeidson 02/02', NULL, '2026-06-25 16:05:28.651801-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('d0b34053-7a9b-4641-9ea6-27ef8aef939c', 153, 100.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:17:18.472216-03', 'production', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('e7d31e6b-a941-4ece-8cdc-dbc5e4541687', 28, 500.00, '2026-03-01 21:00:00-03', 7, 7, 'Recebimento D. Maria MÃ£e de Kelly', NULL, '2026-04-10 23:48:39.251096-03', 'production', 'payment', 23, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('5ba80998-e9dc-4988-9a59-bc2636acee8a', 139, 350.00, '2026-05-14 21:00:00-03', 6, 6, ' Recto Parcial Luanna EdimÃ© Defesa Criminal do Esposo', NULL, '2026-05-15 18:53:11.353937-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('c123645c-377a-4921-806f-5f1553a9f816', 173, 2499.09, '2026-05-18 21:00:00-03', 6, 6, 'Recebimento Andressa Via Pix ', NULL, '2026-05-19 17:50:59.213819-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('e16d4f46-000e-4dd0-b3cb-e5ae05881535', 187, 1000.00, '2026-05-20 21:00:00-03', 5, 7, 'Recebimento Diego Dona Aldeni Defesa Criminal', NULL, '2026-05-21 02:05:23.940031-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('6af331f1-a5fd-455a-be50-1f5d43ad3a4b', 139, 150.00, '2026-05-21 21:00:00-03', 6, 6, 'Recto Parcial Luanna EdimÃ© Defesa Criminal do Esposo', NULL, '2026-05-22 19:33:29.608158-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('c7740ccb-7ead-417d-b831-086e8321094b', 139, 1440.00, '2026-05-26 21:00:00-03', 6, 6, 'Recto Parcial Luanna EdimÃ© Defesa Criminal do Esposo', NULL, '2026-05-27 10:41:46.158327-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('adfdd39d-05d8-417e-8104-e6727bac1d39', 24, 2458.84, '2026-05-27 21:00:00-03', 6, 6, 'Recebimento Ana Clara de Moura Spinola ', NULL, '2026-05-28 13:35:17.441624-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('824198c1-f3db-4d6b-a8b2-810494eee9e2', 13, 503.00, '2026-06-01 21:00:00-03', 6, 6, 'Recebimento Rhyana Brunna Parcela 03/03', NULL, '2026-06-02 09:00:32.273308-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('355c44da-f735-4e3b-ba70-45fbcf50bce5', 193, 700.00, '2026-06-03 21:00:00-03', 3, 6, 'Defesa Criminal', NULL, '2026-06-04 18:33:38.153966-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('570abeec-ea83-4bce-b85c-90f3d24a2ca0', 41, 2477.88, '2026-06-04 21:00:00-03', 6, 6, 'Recebimento via PIX', NULL, '2026-06-05 13:30:50.121111-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('91610dff-3bd2-4102-8016-d440ea648f4b', 43, 1000.00, '2026-06-24 21:00:00-03', 6, 6, 'Recebimento Parcela 02/02', NULL, '2026-06-25 16:06:13.699033-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('2b17f3e8-dd02-4658-a80d-ef15969ea432', 196, 5000.00, '2026-06-24 21:00:00-03', 6, 6, 'Recebimento via BB ', NULL, '2026-06-25 19:06:23.927951-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('308ac2a1-0670-4cb6-90a2-d4e7ec76f6da', 139, 300.00, '2026-06-25 21:00:00-03', 6, 6, 'Recto Parcial Luanna EdimÃ© Defesa Criminal do Esposo', NULL, '2026-06-26 12:27:07.154977-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('3c672673-f9ef-42bf-9179-b3cc439f8915', 195, 1610.00, '2026-06-26 21:00:00-03', 6, 6, 'Recebimento Elefante', NULL, '2026-06-27 17:36:12.338883-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('c29dfbf3-8b15-48b3-92e1-216ca6a0efde', 46, 1258.59, '2026-06-29 21:00:00-03', 6, 6, 'Recebimento Ana Carolina Gomes Lima 01/02', NULL, '2026-06-30 15:50:08.04651-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('1e5d2d44-4599-4e82-aee1-ebe522a37a80', 197, 550.00, '2026-06-29 21:00:00-03', 2, 13, 'DepÃ³sito Elefante', NULL, '2026-06-30 15:52:00.255179-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('5b3e6662-be98-40ca-8e2b-3b658dbcb07a', 12, 2121.89, '2026-06-30 21:00:00-03', 2, 6, 'Recebimento Charlene Reforma AgrÃ¡ria', NULL, '2026-07-01 12:10:56.444625-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('18dd1a0d-f05c-4141-bf20-cabc7e4ab958', 42, 1000.00, '2026-06-30 21:00:00-03', 6, 6, 'Recebimento Dona Sirleide 02/02', NULL, '2026-07-01 16:04:58.554184-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('33802945-653e-4c0f-9aa7-39c8b085f448', 32, 500.00, '2026-07-05 21:00:00-03', 4, 7, 'Recebimento Dona Maria 06/07', NULL, '2026-07-06 12:29:58.358006-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('d46e467a-9965-4009-bf53-ebcaecd28a99', 49, 2000.00, '2026-07-07 21:00:00-03', 6, 6, 'Recebimento Maiana 01/02', NULL, '2026-07-08 09:01:06.023304-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('e89d8dae-24db-4ef3-829f-9ae8dea316f0', 48, 2000.00, '2026-07-07 21:00:00-03', 6, 6, 'Recebimento Janine 01/02', NULL, '2026-07-08 09:02:27.762828-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('cd054b48-3bd1-4a7c-9a94-dcbfb08cd2c6', 46, 1200.00, '2026-07-07 21:00:00-03', 6, 6, 'Recebimento Ana Carolina Gomes Lima 02/02', NULL, '2026-07-08 09:05:39.896703-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('4d90e54f-9426-44eb-8daa-4279f1867468', 109, 5000.00, '2026-07-13 21:00:00-03', 5, 7, 'Recebimento ClÃ¡udia Surda Muda 01/06', NULL, '2026-07-14 14:13:50.969418-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('b2e41739-abaf-4c35-97f3-160e4f1bb6c8', 109, 2000.00, '2026-07-13 21:00:00-03', 6, 13, 'Recebimento ClÃ¡udia Surda Muda 02/06', NULL, '2026-07-14 14:14:32.543175-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('f973aa4e-d36f-4407-be27-f165ae3823b3', 51, 1229.26, '2026-07-20 21:00:00-03', 6, 6, 'Recebimento Raquel 01/02', NULL, '2026-07-21 17:58:15.910425-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('cc0c8e13-c941-43c5-8d10-74b9137c0a93', 125, 1229.26, '2026-07-21 21:00:00-03', 6, 6, 'Recebimento Michele 01/02', NULL, '2026-07-22 12:21:10.39124-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('f35cf45b-41fc-4c03-a928-ee80507314fb', 58, 800.00, '2026-07-27 21:00:00-03', 6, 6, 'Recebimento Iliane 01/03', NULL, '2026-07-28 07:43:26.861029-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('f7baa96c-7910-4db8-8fcc-709f67624d5f', 124, 1000.00, '2026-07-27 21:00:00-03', 6, 6, 'Recebimento Milena 01/03', NULL, '2026-07-28 07:44:26.417344-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('d5c2533c-f230-42cd-8c5c-8d4848a5ad67', 49, 1000.00, '2026-07-30 21:00:00-03', 3, 6, 'Recebimento Maiana', NULL, '2026-07-31 17:03:53.730736-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('37fe9158-c9b8-4442-9917-6316baaf18a9', 51, 1229.26, '2026-07-30 21:00:00-03', 3, 6, 'Recebimento Raquel ', NULL, '2026-07-31 17:04:59.107883-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('538b528a-cbab-47c4-9eaa-8019b8c1002b', 139, 620.00, '2026-07-31 21:00:00-03', 6, 6, 'Recebimento Luanna EdimÃ© Douglas Criminal', NULL, '2026-08-01 11:42:40.276921-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('aca2a68a-eb24-4ad8-aab3-364ec67e55e4', 57, 1800.00, '2026-08-03 21:00:00-03', 3, 6, 'Recebimento Camila Morada da Lua 01/02', NULL, '2026-08-04 06:42:24.888614-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('16a07c6f-0377-4e54-9e0a-f5c346641098', 124, 1000.00, '2026-08-04 21:00:00-03', 3, 6, 'Recebimento Milena 02/03', NULL, '2026-08-05 07:15:36.42215-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('6f6f50c2-b612-4e1a-8ced-ca2ebd7e7893', 109, 682.00, '2026-08-04 21:00:00-03', 3, 6, 'Recebimento ClÃ¡udia Surda Muda 03/06', NULL, '2026-08-05 23:08:43.022158-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('5a273338-3bb2-4be0-8620-f81f697eab75', 58, 1200.00, '2026-08-05 21:00:00-03', 3, 6, 'Recebimento Iliane 02/03', NULL, '2026-08-06 08:46:25.603048-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('691e40d7-6098-4d7e-bd5c-a4ffdef9932f', 125, 1229.26, '2026-08-05 21:00:00-03', 3, 6, 'Recebimento Michele 02/02', NULL, '2026-08-06 08:49:06.50498-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('372f7b78-55e0-49bc-9ca8-557f439d8773', 33, 500.00, '2026-08-09 21:00:00-03', 4, 7, 'Recebimento Dona Maria QuitaÃ§Ã£o Total', NULL, '2026-08-10 12:30:28.224533-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('13a33d56-1cd9-412c-bc9f-ee6bf6567e60', 126, 1000.00, '2026-08-18 21:00:00-03', 3, 6, 'Recebimento Cida Vila Amorim 01/03', NULL, '2026-08-19 17:04:50.408224-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('10660586-a633-45b1-83b4-7670bd91133f', 40, 1220.43, '2026-08-24 21:00:00-03', 3, 6, 'Recebimento Grasiele MissÃ£o 01/02', NULL, '2026-08-25 10:58:03.406403-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('075959e8-4e7f-46bf-9502-48a6f6f4cb25', 126, 1000.00, '2026-08-25 21:00:00-03', 3, 6, 'Recebimento Cida Vila Amorim 02/03', NULL, '2026-08-26 05:25:53.307277-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('76abd795-d528-4c70-a47e-df78c1f24dc8', 22, 1000.00, '2026-08-26 21:00:00-03', 3, 6, 'Recebimento Tainara 01/03', NULL, '2026-08-27 16:38:40.094857-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('51d85a23-3406-4c54-920b-f74ba6e4b938', 53, 1000.00, '2026-08-26 21:00:00-03', 3, 6, 'Recebimento Thamires 01/03', NULL, '2026-08-27 16:39:18.904928-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('1beda295-20f1-48ba-a094-3189c7dac047', 53, 1000.00, '2026-08-26 21:00:00-03', 3, 6, 'Recebimento Thamires 02/03', NULL, '2026-08-27 17:29:27.968456-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('55478ad8-70c4-47fa-bb24-a6aacdb9a6b3', 48, 460.00, '2026-08-27 21:00:00-03', 3, 6, 'Recebimento Janine 02/02', NULL, '2026-08-28 07:23:38.008748-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('0f391350-2c75-4b02-9d0f-363718783695', 22, 1000.00, '2026-08-28 21:00:00-03', 3, 6, 'Recebimento Tainara 02/03', NULL, '2026-08-29 10:45:00.149883-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('261c566a-d2e8-4799-8874-8041630ee4ee', 57, 1000.00, '2026-08-31 21:00:00-03', 3, 6, 'Recebimento Camila Morada da Lua 02/02', NULL, '2026-09-01 05:04:01.90998-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('6c655a11-41b6-46d0-a584-6647d4d28f2c', 3, 2450.40, '2026-08-31 21:00:00-03', 3, 6, 'Recebimento JonÃ¡ria ', NULL, '2026-09-01 10:05:30.378551-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('9723053b-9700-4932-aaf3-7a2ecb3c15b3', 208, 500.00, '2026-09-01 21:00:00-03', 3, 6, 'Dona Aldeni 01/07', NULL, '2026-09-02 17:05:04.489431-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('69328e58-9e18-4356-baf5-dc72bbe6c99e', 109, 682.00, '2026-09-01 21:00:00-03', 3, 6, 'Recebimento ClÃ¡udia Surda Muda 04/07', NULL, '2026-09-02 17:49:55.003183-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('b2e74669-d9fe-4fe9-8ebc-62c10f97a463', 124, 1000.00, '2026-09-02 21:00:00-03', 3, 6, 'Recebimento Milena 03/03', NULL, '2026-09-03 07:18:18.060993-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('1571056b-f910-4dbe-84ac-719215d3b714', 58, 1000.00, '2026-09-03 21:00:00-03', 3, 6, 'Recebimento Iliane 03/03', NULL, '2026-09-04 05:41:18.346062-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('2b9c28db-50b2-49db-bfc5-e8db9b45bbde', 40, 1220.43, '2026-09-03 21:00:00-03', 3, 6, 'Recebimento Grasiele MissÃ£o 02/02', NULL, '2026-09-04 10:47:45.591588-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('e512c1a2-d675-427c-805a-3bf09cbe9978', 60, 1800.00, '2026-09-07 21:00:00-03', 3, 6, 'Sara UmburuÃ§u 01/02', NULL, '2026-09-08 11:48:03.761756-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('16958d35-68d8-4357-a311-48712a63507a', 59, 2000.00, '2026-09-07 21:00:00-03', 3, 6, 'Priscila Bruno 01/02', NULL, '2026-09-08 11:50:09.079721-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('7158a6b7-c1d5-44c5-91b1-a2d2362de028', 60, 1000.00, '2026-09-23 21:00:00-03', 3, 6, 'Sara UmburuÃ§u 02/02', NULL, '2026-09-24 17:02:49.264949-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('cda6e4ae-bb58-4e65-85cb-46a42d8eb7ff', 126, 1000.00, '2026-09-24 21:00:00-03', 3, 6, 'Recebimento Cida Vila Amorim 03/03', NULL, '2026-09-25 17:30:37.611358-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('44495a3a-2fce-4ea3-95c8-425b71586d6d', 53, 1000.00, '2026-09-27 21:00:00-03', 3, 6, 'Recebimento Thamires 03/03', NULL, '2026-09-28 16:38:45.246072-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('4b3ef95d-778d-4ea9-9591-04c0478cc02b', 59, 1000.00, '2026-09-28 21:00:00-03', 16, 6, 'Priscila Bruno 02/02', NULL, '2026-09-29 07:26:38.887065-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('14a3e2d6-c23e-4cfa-a25e-d2e794e3de68', 190, 1000.00, '2026-09-28 21:00:00-03', 16, 6, 'Vaninha Maama 01/03', NULL, '2026-09-29 07:27:27.863457-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('03be6153-70f9-4f80-9746-3fe371486efc', 22, 800.00, '2026-09-29 21:00:00-03', 16, 6, 'Recebimento Tainara 03/03', NULL, '2026-09-30 09:43:02.867592-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('e3f94f01-a997-4888-b704-1190256e3724', 191, 2000.00, '2026-09-30 21:00:00-03', 3, 6, 'Recebimento Iolane Ravi 01/02', NULL, '2026-10-01 10:40:06.323987-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('951d2742-893a-4e49-8bbe-f7b3b2206346', 209, 500.00, '2026-10-01 21:00:00-03', 3, 6, 'Recebimento Diego 02/07', NULL, '2026-10-02 16:17:04.776551-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('8e0fab25-7d98-44eb-9f57-758672b2f088', 109, 690.00, '2026-10-01 21:00:00-03', 3, 6, 'Recebimento ClÃ¡udia Surda Muda 06/07', NULL, '2026-10-02 16:51:06.26992-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('40931434-9869-4294-9596-da6cc980dc22', 133, 2000.00, '2026-10-05 21:00:00-03', 3, 6, 'Recebimento Indyna Esteticista 01/02', NULL, '2026-10-06 04:41:56.408218-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('54d6c7d5-4d25-47d2-b4bc-cdf397ef4798', 190, 1000.00, '2026-10-05 21:00:00-03', 16, 6, 'Vaninha Maama 02/03', NULL, '2026-10-06 04:43:40.553519-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('b90527e5-8ea0-4a55-9309-ab746473ec03', 140, 1000.00, '2026-10-11 21:00:00-03', 16, 6, 'DÃ©bora IrmÃ£ de Amanda 01/03', NULL, '2026-10-12 22:34:41.832867-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('8fe5c5fb-14f3-4831-b1c8-e65c5b7917bd', 54, 2000.00, '2026-10-11 21:00:00-03', 16, 6, 'Vanessa Cabeleireira 01/02', NULL, '2026-10-12 22:36:41.821084-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('f41932e7-456d-4f95-a7d7-0cf4dbe9c93c', 139, 100.00, '2026-10-13 21:00:00-03', 3, 6, 'Recebimento Luanna EdimÃ© Douglas Criminal', NULL, '2026-10-14 10:23:14.147116-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('9788ee97-3fab-4d2a-9fbc-596f64489240', 203, 1250.00, '2026-10-15 21:00:00-03', 3, 6, 'Recebimento Luciana SÃ£o Pedro 01/02', NULL, '2026-10-16 14:16:42.561239-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('554d6d00-7e9d-4f3a-adcd-e50fd2615790', 54, 1000.00, '2026-10-27 21:00:00-03', 16, 6, 'Vanessa Cabeleireira 02/02', NULL, '2026-10-28 05:04:53.221394-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('a0fe1859-308b-4513-80bb-2565d09041f2', 140, 1000.00, '2026-10-29 21:00:00-03', 16, 13, 'DÃ©bora IrmÃ£ de Amanda 02/03', NULL, '2026-10-30 14:51:58.676037-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('c68c47c4-4086-431a-8d59-3b816cfb5f47', 210, 500.00, '2026-10-30 21:00:00-03', 3, 6, 'Recebimento Diego Dona Aldeni ', NULL, '2026-10-31 11:19:30.420888-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('f15beb2b-b082-4891-8b2d-daa482ff8827', 191, 1000.00, '2026-10-30 21:00:00-03', 3, 6, 'Recebimento Iolane Ravi 02/02', NULL, '2026-10-31 22:53:13.883031-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('7739ee60-1678-4214-99b2-f75dc5d2a411', 203, 1250.00, '2026-11-03 21:00:00-03', 16, 6, 'Recebimento Luciana SÃ£o Pedro 02/02', NULL, '2026-11-04 11:51:49.919719-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('f848a5f4-40a8-469e-bc46-d97425508e55', 109, 690.00, '2026-11-04 21:00:00-03', 3, 6, 'Recebimento ClÃ¡udia Surda Muda 07/07', NULL, '2026-11-05 03:47:06.93059-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('6101cff6-3d05-4c8a-83ac-019972c2a6f1', 134, 3239.44, '2026-11-04 21:00:00-03', 6, 6, 'Recebimento Luana Barra do Riacho', NULL, '2026-11-05 04:07:37.491903-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('9b61e22d-5454-41b6-8c88-bc837e71431b', 133, 800.00, '2026-11-05 21:00:00-03', 16, 6, 'Recebimento Indyna Esteticista 02/02', NULL, '2026-11-06 09:16:51.872149-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('6a69aebc-b5ca-479d-8535-63e4daebc48c', 190, 1000.00, '2026-11-05 21:00:00-03', 16, 6, 'Vaninha Maama 03/03', NULL, '2026-11-06 09:17:25.678597-03', 'production', 'payment', 2, NULL, NULL);
INSERT INTO public.backup_payments_20261121 VALUES ('69a4554b-0b76-4ab7-a3b9-f577b71a654d', 204, 1500.00, '2026-11-16 21:00:00-03', 3, 6, 'Recebimento LaÃ­sa Vila Amorim 01/03', NULL, '2026-11-17 02:29:38.985812-03', 'production', 'payment', 2, NULL, NULL);


--
-- Data for Name: backup_recebimento_desdobramento_20261125; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_recebimento_desdobramento_20261125 VALUES ('function:rpc_recebimento_com_desdobramento(p_installment_id bigint, p_valor_principal_pago numeric, p_valor_juros numeric, p_valor_multa numeric, p_account_id bigint, p_category_id bigint, p_date date, p_description text, p_user_id bigint)', 'CREATE OR REPLACE FUNCTION public.rpc_recebimento_com_desdobramento(p_installment_id bigint, p_valor_principal_pago numeric, p_valor_juros numeric, p_valor_multa numeric, p_account_id bigint, p_category_id bigint, p_date date, p_description text, p_user_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_installment RECORD;
  v_saldo_atual NUMERIC(12,2);
  v_novo_saldo NUMERIC(12,2);
  v_total_pago NUMERIC(12,2);
  v_total_acumulado NUMERIC(12,2);
  v_nova_parcela_id BIGINT;
  v_pagamento_id UUID;
  v_tx_id BIGINT;
  v_numero_novo INTEGER;
  v_status TEXT;
BEGIN
  -- v7 20261121 â€” correÃ§Ã£o: acumula amountPaid e calcula residual sobre o saldo
  -- (mantÃ©m a marcaÃ§Ã£o v7 para o SQL de aceite)

  IF p_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    p_user_id := NULL;
  END IF;

  SELECT * INTO v_installment
    FROM installments
   WHERE id = p_installment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Parcela % nÃ£o encontrada.'', p_installment_id;
  END IF;

  v_status := lower(btrim(COALESCE(v_installment.status, '''')));

  IF v_status IN (''quitado'', ''cancelado'', ''cancelada'', ''estornado'', ''estornada'') THEN
    RAISE EXCEPTION ''A parcela % nÃ£o possui saldo para desdobramento (status: %).'',
      p_installment_id, v_installment.status;
  END IF;

  IF p_valor_principal_pago IS NULL OR p_valor_principal_pago <= 0 THEN
    RAISE EXCEPTION ''O valor principal pago deve ser maior que zero.'';
  END IF;

  -- saldo realmente devido, descontando pagamento anterior
  v_saldo_atual := COALESCE(v_installment.amount, 0)
                 - COALESCE(v_installment."amountPaid", 0);

  IF v_saldo_atual <= 0 THEN
    RAISE EXCEPTION ''A parcela % nÃ£o possui saldo em aberto.'', p_installment_id;
  END IF;

  IF p_valor_principal_pago >= v_saldo_atual THEN
    RAISE EXCEPTION ''O valor principal pago (%) deve ser estritamente menor que o saldo devedor da parcela (%). Para pagamentos integrais, utilize a baixa total.'',
      p_valor_principal_pago, v_saldo_atual;
  END IF;

  v_novo_saldo := v_saldo_atual - p_valor_principal_pago;
  v_total_pago := p_valor_principal_pago
                + COALESCE(p_valor_juros, 0)
                + COALESCE(p_valor_multa, 0);
  v_total_acumulado := COALESCE(v_installment."amountPaid", 0) + v_total_pago;

  -- nÃºmero novo, sem colidir com parcelas jÃ¡ existentes do contrato
  SELECT COALESCE(MAX("installmentNumber"), 0) + 1
    INTO v_numero_novo
    FROM installments
   WHERE contract_id = v_installment.contract_id;

  -- parcela original: preserva amount e ACUMULA o total pago
  UPDATE installments
     SET "amountPaid" = v_total_acumulado,
         interest = COALESCE(interest, 0) + COALESCE(p_valor_juros, 0),
         fine = COALESCE(fine, 0) + COALESCE(p_valor_multa, 0),
         status = ''Quitado'',
         updated_by = p_user_id
   WHERE id = p_installment_id;

  -- residual com numeraÃ§Ã£o nova, sobre o saldo devedor
  INSERT INTO installments (
      contract_id, "installmentNumber", "dueDate", amount, "amountPaid",
      status, interest, fine, environment, created_by, updated_by
  ) VALUES (
      v_installment.contract_id, v_numero_novo, v_installment."dueDate",
      v_novo_saldo, 0, ''Aberto'', 0, 0, v_installment.environment, p_user_id, p_user_id
  ) RETURNING id INTO v_nova_parcela_id;

  -- caixa (exatamente um lanÃ§amento)
  INSERT INTO financial_transactions (
      date, amount, type, account_id, category_id, description, environment, created_by
  ) VALUES (
      p_date, v_total_pago, ''income'', p_account_id, p_category_id,
      p_description, v_installment.environment, p_user_id
  ) RETURNING id INTO v_tx_id;

  -- histÃ³rico de pagamento, vinculado Ã  transaÃ§Ã£o (o gatilho v4 recalcula o contrato)
  INSERT INTO payments (
      installment_id, amount, payment_date, account_id, category_id,
      description, environment, type, created_by, financial_transaction_id
  ) VALUES (
      p_installment_id, v_total_pago, p_date, p_account_id, p_category_id,
      p_description, v_installment.environment, ''payment'', p_user_id, v_tx_id
  ) RETURNING id INTO v_pagamento_id;

  RETURN jsonb_build_object(
    ''sucesso'', true,
    ''mensagem'', ''Desdobramento realizado com sucesso.'',
    ''parcela_original_id'', p_installment_id,
    ''nova_parcela_id'', v_nova_parcela_id,
    ''pagamento_id'', v_pagamento_id::text,
    ''transacao_id'', v_tx_id,
    ''valor_remanescente'', v_novo_saldo,
    ''numero_novo'', v_numero_novo,
    ''saldo_anterior'', v_saldo_atual,
    ''total_pago_acumulado'', v_total_acumulado
  );
END;
$function$
', '2026-11-25 04:47:19.083097-03');


--
-- Data for Name: backup_test_ajuste_final_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_test_ajuste_final_20261121 VALUES (144, 75, 1, '2026-04-25', 2000.00, 2000.00, 'Quitado', 0.00, 0.00, 'test', 2, 23, '2026-04-08 11:50:41.303672-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_test_ajuste_final_20261121 VALUES (116, 75, 1, '2026-04-25', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 23, '2026-03-25 09:22:34.11817-03', NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_test_ajuste_final_20261121 VALUES (164, 75, 2, '2026-04-25', 3000.00, 3000.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-11 02:23:23.758925-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_test_ajuste_final_20261121 VALUES (96, 67, 1, '2026-04-16', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 23, '2026-03-16 10:02:46.120363-03', '2026-04-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);


--
-- Data for Name: backup_test_ajuste_final_pagamentos_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_test_ajuste_final_pagamentos_20261121 VALUES ('7daa0375-19fa-4fbb-ad12-b523e93280ec', 96, 3000.00, '2026-03-15 21:00:00-03', 8, 1, 'Em dinheiro', NULL, '2026-03-16 11:34:04.77383-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL);


--
-- Data for Name: backup_test_contracts_conciliacao_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_test_contracts_conciliacao_20261121 VALUES (76, 2, 24, 'InventÃ¡rio', 'FamÃ­lia', 'Estornado', '2026-03-25', '2026-03-25', NULL, 3000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 0.00, '
[ESTORNO] erro no recebimento', 'test', 2, 2, '2026-03-25 10:52:36.93544-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_test_contracts_conciliacao_20261121 VALUES (67, 1, 23, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Parcial', '2026-03-16', '2026-03-16', NULL, 10000.00, 'Parcelado', 2, false, false, false, false, NULL, true, true, false, NULL, NULL, 0.00, 0.00, false, 3000.00, 7000.00, NULL, 'test', 2, 2, '2026-03-16 10:02:45.965162-03', NULL, 0.00, '2026-03-31', '2026-03-28', 178.31, false, NULL, NULL, NULL, 178.31, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_test_contracts_conciliacao_20261121 VALUES (65, 16, 19, 'AuxÃ­lio por Incapacidade TemporÃ¡ria', 'PrevidenciÃ¡rio', 'Parcial', '2026-03-15', '2026-03-15', NULL, 10000.00, 'Parcelado', 4, false, false, false, false, NULL, true, true, false, NULL, NULL, 0.00, 0.00, false, 4000.00, 6000.00, '
[ESTORNO]: DevoluÃ§Ã£o ', 'test', 2, 2, '2026-03-15 20:07:37.107977-03', NULL, 0.00, '2026-03-31', '2026-03-28', 178.31, false, NULL, NULL, NULL, 178.31, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_test_contracts_conciliacao_20261121 VALUES (70, 61, 21, 'DivÃ³rcio Consensual', 'FamÃ­lia', 'Quitado', '2026-03-16', '2026-03-16', NULL, 1000.00, 'Parcelado', 2, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 1000.00, '
[ESTORNO]: SSGFSFD', 'test', 2, 2, '2026-03-16 11:44:49.545113-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, 0, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_test_contracts_conciliacao_20261121 VALUES (134, 62, 20, 'AuxÃ­lio por Incapacidade Permanente', 'PrevidenciÃ¡rio', 'Estornado', '2026-11-21', '2026-11-21', NULL, 10000.00, 'Ã€ Prazo', 1, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 0.00, '
[ESTORNO] erro no sistema', 'test', 2, 2, '2026-11-21 19:06:19.50541-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.backup_test_contracts_conciliacao_20261121 VALUES (74, 2, 23, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Estornado', '2026-03-25', '2026-03-25', NULL, 2000.00, 'Ã€ Prazo', 1, false, false, true, true, NULL, true, false, false, NULL, NULL, 0.00, 0.00, false, 0.00, 0.00, '
[ESTORNO] erro no recebimento', 'test', 2, 2, '2026-03-25 08:06:44.514636-03', NULL, 0.00, '2026-04-09', NULL, 178.31, false, NULL, NULL, NULL, NULL, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_test_contracts_conciliacao_20261121 VALUES (81, 1, 20, 'AuxÃ­lio por Incapacidade Permanente', 'PrevidenciÃ¡rio', 'Parcial', '2026-03-28', '2026-03-28', NULL, 12000.00, 'Parcelado', 3, false, false, true, true, NULL, true, true, false, NULL, NULL, 0.00, 0.00, false, 8000.00, 4000.00, '
[ESTORNO]: teste', 'test', 2, 2, '2026-03-28 10:15:13.915278-03', 7, 0.00, '2026-04-09', '2026-03-29', 178.31, false, NULL, NULL, NULL, 178.31, false, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL);
INSERT INTO public.backup_test_contracts_conciliacao_20261121 VALUES (91, 62, 23, 'AuxÃ­lio-Acidente', 'PrevidenciÃ¡rio', 'Parcial', '2026-04-10', '2026-04-10', NULL, 1000.00, 'Parcelado', 2, false, false, false, false, NULL, false, false, false, NULL, NULL, 0.00, 0.00, false, 600.00, 400.00, '
[ESTORNO]: estorno', 'test', 23, 23, '2026-04-10 20:31:42.281031-03', NULL, 0.00, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, false, NULL, NULL);


--
-- Data for Name: backup_test_installments_conciliacao_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (89, 65, 3, '2026-08-15', 2500.00, 2500.00, 'Quitado', 0.00, 0.00, 'test', 2, 2, '2026-03-15 20:07:37.374211-03', '2026-08-15', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (227, 134, 1, '2026-12-21', 10000.00, 0.00, 'Estornado', 0.00, 0.00, 'test', 2, 2, '2026-11-21 19:06:20.14623-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (122, 76, 1, '2026-04-25', 3000.00, 0.00, 'Estornado', 0.00, 0.00, 'test', NULL, 2, '2026-03-25 10:52:37.325394-03', NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (113, 74, 1, '2026-04-25', 2000.00, 0.00, 'Estornado', 0.00, 0.00, 'test', NULL, 2, '2026-03-25 08:06:45.084941-03', NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (87, 65, 1, '2026-04-15', 2500.00, 500.00, 'Parcial', 0.00, 0.00, 'test', 2, 2, '2026-03-15 20:07:37.374211-03', '2026-04-15', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (97, 67, 2, '2026-05-16', 5000.00, 5000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 2, '2026-03-16 10:02:46.120363-03', '2026-05-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (150, 91, 3, '2026-05-10', 100.00, 100.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-10 20:50:32.282411-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (103, 70, 1, '2026-04-16', 500.00, 500.00, 'Quitado', 0.00, 0.00, 'test', 2, 23, '2026-03-16 11:44:49.677246-03', '2026-04-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (129, 81, 1, '2026-04-28', 4000.00, 4000.00, 'Quitado', 0.00, 0.00, 'test', 2, 2, '2026-03-28 10:15:14.299885-03', '2026-04-28', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (151, 91, 4, '2026-05-10', 100.00, 100.00, 'Quitado', 0.00, 0.00, 'test', 23, 23, '2026-04-10 20:59:31.331817-03', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_test_installments_conciliacao_20261121 VALUES (96, 67, 1, '2026-04-16', 1000.00, 1000.00, 'Quitado', 0.00, 0.00, 'test', NULL, 23, '2026-03-16 10:02:46.120363-03', '2026-04-16', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL, NULL);


--
-- Data for Name: backup_test_pagamentos_conciliacao_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('f5244bd8-52bb-4471-b968-aba04c6fa821', 113, 2000.00, '2026-04-10 21:00:00-03', 1, 1, '', NULL, '2026-04-11 01:23:18.96695-03', 'test', 'payment', 23, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('43991f38-83a7-4122-804f-f58a803ec60d', 87, 2500.00, '2026-03-14 21:00:00-03', 8, 21, 'Pgto honorÃ¡rios', NULL, '2026-03-15 20:19:02.251535-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('0e107f28-53f5-402a-a95e-24d8d0f3dbee', 89, 1000.00, '2026-03-14 21:00:00-03', 8, 21, 'Rectos de honorÃ¡rios', NULL, '2026-03-15 20:30:22.539169-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('7daa0375-19fa-4fbb-ad12-b523e93280ec', 96, 3000.00, '2026-03-15 21:00:00-03', 8, 1, 'Em dinheiro', NULL, '2026-03-16 11:34:04.77383-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('776d67f8-f428-47a9-80c2-58f36847595f', 103, 400.00, '2026-03-15 21:00:00-03', 1, 1, '', NULL, '2026-03-16 11:45:13.874921-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('5f549cc4-40ca-4007-9a13-096d707cad06', 122, 1000.00, '2026-03-24 21:00:00-03', 11, 22, 'Parcial', NULL, '2026-03-25 10:53:06.073945-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('f5265f51-a99a-4822-96c8-b91c939b43a3', 129, 4000.00, '2026-03-27 21:00:00-03', 8, 21, 'Em dinheiro', NULL, '2026-03-28 10:15:49.536131-03', 'test', 'payment', 2, NULL, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd', NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('bff6b118-2d90-4cc5-ab2c-62a4db0574d5', 96, 1000.00, '2026-04-10 21:00:00-03', 14, 1, '', NULL, '2026-04-11 01:32:23.451977-03', 'test', 'payment', 23, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9', 227, 1000.00, '2026-11-20 21:00:00-03', 9, 1, '', NULL, '2026-11-21 19:07:52.202727-03', 'test', 'payment', 2, NULL, NULL, NULL, NULL);
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('60fe1d1b-10ad-47c7-aab0-11a4078297d0', 227, 1000.00, '2026-11-20 21:00:00-03', 11, NULL, 'Estorno: erro no sistema', NULL, '2026-11-21 19:08:14.795187-03', 'test', 'reversal', 2, NULL, NULL, NULL, '3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9');
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('ecda6665-be62-42b7-8c1c-fa3761778b55', 122, 3000.00, '2026-11-20 21:00:00-03', 8, NULL, 'Estorno: erro no recebimento', NULL, '2026-11-21 20:24:02.985817-03', 'test', 'reversal', 2, NULL, NULL, NULL, '5f549cc4-40ca-4007-9a13-096d707cad06');
INSERT INTO public.backup_test_pagamentos_conciliacao_20261121 VALUES ('f7c88427-b0bb-4c3d-99a3-73fc220f4108', 113, 2000.00, '2026-11-20 21:00:00-03', 8, NULL, 'Estorno: erro no recebimento', NULL, '2026-11-21 20:27:33.049542-03', 'test', 'reversal', 2, NULL, NULL, NULL, 'f5244bd8-52bb-4471-b968-aba04c6fa821');


--
-- Data for Name: backup_view_receivables_20261121; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.backup_view_receivables_20261121 VALUES (' SELECT c.id AS contract_id,
    cl.name AS client_name,
    c."processNumber",
    c."contractValue" AS contract_value,
    c."amountReceived" AS amount_received,
    c."amountReceivable" AS amount_to_receive,
    ( SELECT min(installments."dueDate") AS min
           FROM installments
          WHERE installments.contract_id = c.id AND (installments.status <> ALL (ARRAY[''Quitado''::text, ''Cancelada''::text]))) AS next_due_date,
    c.status AS contract_status,
    c.environment
   FROM contracts c
     JOIN clients cl ON c.client_id = cl.id;');


--
-- Data for Name: birthday_templates_backup; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: backup_contratos_protecao_20261125 backup_contratos_protecao_20261125_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_contratos_protecao_20261125
    ADD CONSTRAINT backup_contratos_protecao_20261125_pkey PRIMARY KEY (objeto);


--
-- Name: backup_estornado_recebivel_20261126 backup_estornado_recebivel_20261126_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_estornado_recebivel_20261126
    ADD CONSTRAINT backup_estornado_recebivel_20261126_pkey PRIMARY KEY (objeto);


--
-- Name: backup_estornado_recebivel_dados_20261126 backup_estornado_recebivel_dados_20261126_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_estornado_recebivel_dados_20261126
    ADD CONSTRAINT backup_estornado_recebivel_dados_20261126_pkey PRIMARY KEY (contract_id);


--
-- Name: backup_recebimento_desdobramento_20261125 backup_recebimento_desdobramento_20261125_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_recebimento_desdobramento_20261125
    ADD CONSTRAINT backup_recebimento_desdobramento_20261125_pkey PRIMARY KEY (objeto);


--
-- Name: idx_birthday_templates_backup_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_birthday_templates_backup_organization_id ON public.birthday_templates_backup USING btree (organization_id);


--
-- Name: birthday_templates_backup audit_birthday_templates_backup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_birthday_templates_backup AFTER INSERT OR DELETE OR UPDATE ON public.birthday_templates_backup FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: birthday_templates_backup P0 somente leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "P0 somente leitura" ON public.birthday_templates_backup FOR SELECT TO anon, authenticated USING ((( SELECT public._rls_can_access(NULL::text) AS _rls_can_access) AND ((environment IS NULL) OR (environment = COALESCE(NULLIF(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'environment'::text), ''::text), 'production'::text)))));


--
-- Name: _auth_hardening_policy_backup_20261118; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._auth_hardening_policy_backup_20261118 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_b11_projecao_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_b11_projecao_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_contracts_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_contracts_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_contracts_status_endurecimento_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_contracts_status_endurecimento_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_contratos_protecao_20261125; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_contratos_protecao_20261125 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_estornado_recebivel_20261126; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_estornado_recebivel_20261126 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_estornado_recebivel_dados_20261126; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_estornado_recebivel_dados_20261126 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_installments_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_installments_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_payments_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_payments_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_recebimento_desdobramento_20261125; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_recebimento_desdobramento_20261125 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_test_ajuste_final_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_test_ajuste_final_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_test_ajuste_final_pagamentos_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_test_ajuste_final_pagamentos_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_test_contracts_conciliacao_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_test_contracts_conciliacao_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_test_installments_conciliacao_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_test_installments_conciliacao_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_test_pagamentos_conciliacao_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_test_pagamentos_conciliacao_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_view_receivables_20261121; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_view_receivables_20261121 ENABLE ROW LEVEL SECURITY;

--
-- Name: birthday_templates_backup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.birthday_templates_backup ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



commit;
