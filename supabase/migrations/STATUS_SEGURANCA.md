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

### Ainda não confirmado explicitamente

- [ ] Usuário não superadmin tentando alterar RBAC (deve ser negado).

## P1 — em andamento

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

## Próximos itens de P1/P2

- Inventariar funções com `EXECUTE` para `anon` (ex.: `search_all`, que é
  `SECURITY INVOKER` e lê várias tabelas).
- Revogar funções `http` (chamado no Supabase Support).
- Rotação da chave ECC/ES256.
- `organization_id` / multitenancy real.
