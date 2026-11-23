# P1 — remoção de privilégios do papel anon

## Status

- Lotes 01 e 02 **aplicados e verificados** (ver `../STATUS_SEGURANCA.md`).
- Lote 03 é só inventário (SELECT), não altera nada.
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

## Teste funcional obrigatório após aplicar

- [ ] Onboarding novo em `test`: salva os dados e marca o token como usado.
- [ ] Portal do indicador em `test`: abre, mostra valores e registra último acesso.
- [ ] Usuário logado continua criando/editando normalmente (role `authenticated`).

## Próximos lotes

- Lote 04: revogar `EXECUTE` desnecessário de `anon` (candidata principal:
  `search_all`), preservando helpers `_rls_*`, `set_app_environment`,
  `app_touch_indicator_token` e `app_mark_onboarding_used`.
- Revogar funções `http` e rotacionar a chave de assinatura (escopo P2).
