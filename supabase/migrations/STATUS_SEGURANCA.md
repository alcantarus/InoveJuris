# Status de segurança — registrado em 23/11/2026

Todas as validações abaixo foram **confirmadas pelo usuário**. Não repetir solicitações
já marcadas como OK.

## Bloco 3 — concluído

SQL dos lotes 00 a 15 aplicado no SQL Editor e verificado.

### Validações funcionais confirmadas

- [x] Geração de link no ambiente correto (`environment` enviado no INSERT).
- [x] Portal do indicador troca produção ↔ teste conforme o `environment` do token.
- [x] Pagamento de comissão validado no banco (valor acima do saldo rejeitado).
- [x] "Último acesso" registrado e exibido em horário de Brasília.
- [x] Modal Gerenciar Acessos sem rolagem horizontal.
- [x] Onboarding novo salva os dados e o link passa a dizer "já utilizado".
- [x] Upload e download de documentos/modelos.
- [x] Link revogado mostra a mensagem de revogação.
- [x] Link temporário expirado mostra a mensagem de expiração.
- [x] Login/logout e heartbeat.
- [x] Troca de ambiente produção ↔ teste no painel.
- [x] Usuário logado cria/edita registros normalmente.

### Validações adicionais confirmadas

- [x] Usuário não superadmin tentando alterar RBAC: **negado com 403** na rota
  `/api/settings/rbac` (testado em `test` via console do navegador, 23/11/2026).
  A aba "Perfis e Permissões" também exibe "Acesso restrito" para não superadmin.

**Checklist do Bloco 3: 100% confirmado.**

## P1 — concluído

### Lote 01 — `p1/01_anon_sem_escrita.sql`

- [x] Aplicado.
- [x] Verificação: apenas `clients` com `UPDATE` no `anon`.
- [x] Onboarding, portal e usuário logado OK após a aplicação.

### Lote 02 — `p1/02_anon_select_minimo.sql`

- [x] Aplicado.
- [x] Verificação: exatamente 7 tabelas/views com SELECT no `anon`:
  `clients`, `client_onboarding_tokens`, `commission_payments`, `contracts`,
  `indicator_tokens`, `indicators`, `vw_portal_commission_details`.
- [x] Onboarding, portal e usuário logado OK após a aplicação.

### Lote 03 — `p1/03_inventario_funcoes_anon.sql`

- [x] Inventário rodado: 103 funções executáveis por `anon`.
- [x] Classificação cruzada com o código (ver lote 04).

### Lote 04 — `p1/04_anon_funcoes_minimas.sql` (aplicado)

- Revoga `EXECUTE` de `anon` em 21 nomes de função de negócio (23 contando as
  sobrecargas de `search_clients` e `process_installment_payment`): busca,
  financeiro, prazos, cancelamento/estorno, guardiões, órfãos, `djen_fetch`,
  `normalize_deadline_at`.
- Resultado: 5 funções sumiram (prazos, `djen_fetch`, `normalize_deadline_at`);
  as outras 16 continuaram porque eram concedidas a `PUBLIC` (anon herda).
- **Mantém** para `anon`: helpers `_rls_*`, `_auth_require_superadmin`,
  `get_auth_organization`, `log_audit_event`, `set_app_environment`,
  `app_mark_onboarding_used`, `app_touch_indicator_token` e todas as `app_*` de
  auth/sessão/admin — porque as rotas de servidor usam a **chave anon**.
- Verificação dos fluxos públicos/auth: 6 funções seguem liberadas (OK).
- Funções de extensão (`http_*`, `pg_trgm`, `unaccent`) são grant a `PUBLIC`;
  ficam para o P2 (revogar só de `anon` não tem efeito).
- Sem reteste funcional: nenhum fluxo público/logado muda.

### Lote 04b — `p1/04b_anon_sem_public_execute.sql` (aplicado e verificado)

- Correção do 04: para as 21 funções de negócio, `REVOKE EXECUTE FROM PUBLIC, anon`
  e `GRANT EXECUTE TO authenticated, service_role`. Remove o acesso herdado de
  `PUBLIC` sem afetar logados/servidor. Idempotente.
- [x] Verificação: consulta 1 do lote 04 retornou **0 linhas** (nenhuma função de
  negócio executável por `anon`).
- [x] Consulta 2: 6 funções públicas/auth seguem liberadas.

### Resumo do P1

- `anon` sem INSERT/UPDATE/DELETE/TRUNCATE (só UPDATE em `clients`, onboarding).
- `anon` com SELECT em apenas 7 tabelas/views dos links públicos.
- `anon` sem EXECUTE nas funções de negócio; mantém apenas auth/sessão/admin
  (rotas de servidor usam chave anon), helpers de RLS e links públicos.

## Próximos itens (P2)

- Revogar `http_*` de `PUBLIC` (SSRF) e regrant seletivo.
- Mover rotas de servidor da chave anon para `service_role` (depois revogar
  `app_*` de auth/admin do `anon`).
- Rotação da chave ECC/ES256.
- `organization_id` / multitenancy real.
