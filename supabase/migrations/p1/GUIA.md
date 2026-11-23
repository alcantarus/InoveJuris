# P1 — remoção de privilégios do papel anon

## Status

- Lotes 01, 02, 04 e 04b **aplicados e verificados** (ver `../STATUS_SEGURANCA.md`).
- Lote 03 (inventário) **rodado**; resultado classificado nos lotes 04/04b.
- **P1 concluído.** Pendências restantes são escopo P2.
- Aplicar no SQL Editor do Supabase, como `postgres`, um arquivo por vez.
- Não usar `run_sql*.js` com service role.
- Validações já confirmadas pelo usuário estão registradas em
  `../STATUS_SEGURANCA.md`. Não repetir testes marcados como OK.

## Ordem

| Ordem | Arquivo | Objetivo | Validação |
|---|---|---|---|
| 1 | `01_anon_sem_escrita.sql` | Remove INSERT/UPDATE/DELETE/TRUNCATE de `anon` em todas as tabelas/views; mantém UPDATE em `clients` para o onboarding | Query de verificação abaixo + onboarding e portal |
| 2 | `02_anon_select_minimo.sql` | Mantém SELECT de `anon` só nas 7 tabelas/views dos links públicos | Lista de 7 tabelas + onboarding e portal |
| 3 | `03_inventario_funcoes_anon.sql` | Inventário (só leitura) das funções executáveis por `anon` | Colar o resultado para classificar antes de revogar |
| 4 | `04_anon_funcoes_minimas.sql` | Revoga `EXECUTE` de `anon` nas funções de negócio (busca, financeiro, prazos, etc.); mantém auth/sessão/admin, helpers de RLS e links públicos | 0 funções de negócio + 6 funções públicas ainda liberadas |
| 4b | `04b_anon_sem_public_execute.sql` | Correção: revoga `EXECUTE` de `PUBLIC`+`anon` e regrant a `authenticated`/`service_role` (16 funções herdavam de `PUBLIC`) | Consulta 1 do lote 04 volta a dar 0 linhas |

## Verificação do lote 01

```sql
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privs
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
group by table_name
order by table_name;
```

Esperado: **apenas uma linha**, `clients` com `UPDATE`.

## Verificação do lote 02

```sql
select table_name
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type = 'SELECT'
order by table_name;
```

Esperado: exatamente **7 linhas** — `clients`, `client_onboarding_tokens`,
`commission_payments`, `contracts`, `indicator_tokens`, `indicators` e
`vw_portal_commission_details`.

## Verificação do lote 04

Negócio deve sumir do `anon` (esperado: **0 linhas**):

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'search_all','search_clients','search_clients_accent_insensitive',
    'search_clients_basic','get_clients_with_process_summary',
    'get_financial_chart_data','get_financial_summary',
    'get_future_receivables_projection','confirm_process_deadline',
    'create_process_deadline','delete_process_deadline',
    'process_contract_cancellation','process_installment_estorno',
    'process_installment_payment','reverse_installment_payment',
    'rpc_receber_parcela_com_metodo','rpc_recebimento_com_desdobramento',
    'save_client_guardians','check_database_orphans','djen_fetch',
    'normalize_deadline_at'
  )
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by 1;
```

Fluxos públicos/auth devem continuar liberados (esperado: **6 linhas**):

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'app_touch_indicator_token','app_mark_onboarding_used','set_app_environment',
    'app_authenticate','app_validate_session','app_heartbeat'
  )
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by 1;
```

**Sem reteste funcional:** o lote 04 só retira de `anon` funções que nenhum fluxo
público ou de servidor usa. Logados (`authenticated`) e links públicos não mudam.
As validações já confirmadas estão em `../STATUS_SEGURANCA.md`.

> Nota: 16 funções de negócio eram concedidas a `PUBLIC` na criação; o lote 04
> (revogar só de `anon`) não as removeu. O lote **04b** revoga de `PUBLIC`+`anon`
> e regrant a `authenticated`/`service_role`. Depois do 04b, a consulta 1 acima
> deve retornar **0 linhas**.

## Teste funcional obrigatório após aplicar

- [ ] Onboarding novo em `test`: salva os dados e marca o token como usado.
- [ ] Portal do indicador em `test`: abre, mostra valores e registra último acesso.
- [ ] Usuário logado continua criando/editando normalmente (role `authenticated`).

## Próximos lotes

- P2: revogar funções `http_*` de `PUBLIC` (SSRF) e regrant só a quem precisa;
  rotacionar a chave de assinatura ECC/ES256.
- P2: mover rotas de servidor que usam chave anon para `service_role`, permitindo
  então revogar as funções `app_*` de auth/admin do `anon`.
- `organization_id` / multitenancy real.
