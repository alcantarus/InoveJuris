# Bloco 3 — substituição das policies permissivas (preparado, NÃO executado)

## Status

- Todo o SQL desta pasta foi **preparado pelo agente e não executado**.
- Nenhuma policy foi removida em produção. Nenhuma permissão foi alterada.
- Aplicar no **SQL Editor do Supabase**, como owner (`postgres`), um arquivo por vez.
  Não usar `run_sql*.js` com a service role da aplicação.

## Por que não é preciso trocar o `role` do JWT

O navegador já envia o JWT assinado de sessão no `Authorization` (Fase A). As claims
`session_id`, `environment`, `is_superadmin` e `sub` são suficientes: as policies exigem
que `session_id` corresponda a uma sessão ativa no banco **e** que `environment` da linha
seja igual ao da claim. A chave anon sem token não possui `session_id` e não vê nada.

As policies deste bloco são `FOR ALL TO anon, authenticated`, então funcionam com o
`role` que estiver configurado. Na instalação atual a claim já vem como `authenticated`
(`SUPABASE_JWT_ROLE` no Vercel) — isso não é novidade do Bloco 3: o token de sessão já
era enviado nas requisições antes dele. O que muda é apenas a substituição das policies
`USING (true)`.

## Pré-requisitos de código (deploy antes do lote 01)

1. `lib/jwt.ts` — inclui `is_superadmin` no JWT.
2. `lib/session-token.ts` — mantém o token em `sessionStorage` da aba, evitando a janela
   em que a primeira consulta saía sem token após recarregar a página.
3. `lib/supabase.ts` + páginas de onboarding/portal — enviam `x-inove-access-token`
   nos fluxos públicos.

Após o deploy, faça login e confirme no DevTools que o token de sessão contém as claims.
Se `session_id` não aparecer, **pare**: as policies negarão todo acesso.

## Ordem de aplicação

| Ordem | Arquivo | Objetivo | Validação |
|---|---|---|---|
| 0 | `00_fundacao.sql` | Cria helpers e funções de troca de policies | Nenhuma policy muda |
| 0b | `00_patch_drop_permissive.sql` | Corrige a remoção para não apagar policies restritivas | Aplicar antes do lote 02 |
| 1 | `01_autenticacao_interna.sql` | Remove policies de `user_sessions`, `login_challenges`, `trusted_devices` | Login, logout, heartbeat, 2FA |
| 2 | `02_rbac.sql` | RBAC somente leitura via sessão; escrita já é RPC. `users` fica de fora | Configurações → Perfis; Advogados |
| 2b | `02b_users.sql` | Remove as 2 policies permissivas de `users`, preserva a de organização e adiciona P0 como `AS RESTRICTIVE` | Usuários; Advogados; login |
| 2c | `02c_users_superadmin.sql` | Superadmin vê todos os usuários (a policy de organização olha o flag da linha, não o do chamador) | Lista de Usuários completa |
| 3 | `03_cadastros_base.sql` | Cadastros | Advogados, Doenças, Produtos, Indicadores, Contas |
| 4 | `04_clientes.sql` | Clientes e documentos | Clientes, upload/preview de documentos |
| 5 | `05_contratos_financeiro.sql` | Contratos e financeiro | Contratos, parcelas, pagamentos, fluxo de caixa |
| 6 | `06_processos_prazos.sql` | Processos, prazos, Publicações | Processos, Prazos, Publicações, DataJud |
| 7 | `07_documentos_marketing.sql` | Documentos e marketing | Documentos, modelos, IA, cartões |
| 8 | `08_tarefas_kanban.sql` | Tarefas/Kanban | Tarefas, Kanban |
| 9 | `09_configuracoes_auditoria.sql` | Settings/auditoria somente leitura | Configurações, Auditoria, backup |
| 10 | `10_portais_publicos.sql` | Links sem login | Onboarding e portal do indicador |

Rode `verify.sql` depois de **cada** lote. Salve a saída. Use `rollback.sql` se algum
fluxo quebrar; ele restaura o estado permissivo anterior.

## Antes do lote 10 — dependências da view do portal

`vw_portal_commission_details` está com `security_invoker=on` desde a F7. A query 4 de
`verify.sql` confirmou as tabelas de base: `clients`, `commission_payments` e
`contracts`.

- `commission_payments` e `contracts` têm `indicator_id` → policy direta:
  `using (indicator_id = public._rls_portal_indicator_id())`.
- `clients` **não** tem `indicator_id`. O vínculo é `contracts.client_id = clients.id`
  e `contracts.indicator_id`. O lote 10 cria a policy com `exists(...)`, sem conceder
  acesso amplo:

```sql
create policy "P0 portal indicador" on public.clients
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.contracts c
      where c.client_id = clients.id
        and c.indicator_id = public._rls_portal_indicator_id()
    )
  );
```

Nunca crie policy ampla (`using (true)`) só para "fazer funcionar".

## Verificação funcional obrigatória

- [ ] Login/logout e heartbeat (sessão não cai após 10 min).
- [ ] Troca de ambiente produção/teste.
- [ ] Usuário não superadmin não consegue alterar RBAC (Bloco 2).
- [ ] Upload e download de documentos/modelos/imagens.
- [ ] Fluxo financeiro completo (parcela, pagamento, estorno) **somente em teste**.
- [ ] Link de onboarding novo e já usado.
- [ ] Portal do indicador com token fixo, temporário e revogado.

## Rollback

`rollback.sql` recria policies `Permissivo legado` para todas as tabelas de domínio.
Depois de estabilizar, reaplique apenas o lote que falhou — não toda a sequência às cegas.

## Fora de escopo (P1/P2)

- Revogar `SELECT/INSERT/UPDATE/DELETE` de `anon` e trocar `role` para `authenticated`.
- Rotação da chave ECC própria (ES256) e importação da standby bloqueada.
- Revogação das 17 funções `http` (chamado no Supabase Support).
- `organization_id` / multitenancy real.
