# P1 — remoção de privilégios do papel anon

## Status

- Preparado pelo agente, **não executado**.
- Aplicar no SQL Editor do Supabase, como `postgres`, um arquivo por vez.
- Não usar `run_sql*.js` com service role.

## Ordem

| Ordem | Arquivo | Objetivo | Validação |
|---|---|---|---|
| 1 | `01_anon_sem_escrita.sql` | Remove INSERT/UPDATE/DELETE/TRUNCATE de `anon` em todas as tabelas/views; mantém UPDATE em `clients` para o onboarding | Query de verificação abaixo + onboarding e portal |

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

## Teste funcional obrigatório após aplicar

- [ ] Onboarding novo em `test`: salva os dados e marca o token como usado.
- [ ] Portal do indicador em `test`: abre, mostra valores e registra último acesso.
- [ ] Usuário logado continua criando/editando normalmente (role `authenticated`).

## Próximos lotes

- Revisar os `SELECT` restantes de `anon` um a um, preservando somente o necessário aos links públicos.
- Revogar funções `http` e rotacionar a chave de assinatura (escopo P2).
