# Isolamento da view `contract_receivables_summary` — resultado (26/11/2026)

> **Regra permanente:** existe **um único banco** (PostgreSQL 17.6). `production`
> e `test` (homologação) são **valores da coluna `environment`**, não bancos
> separados. Ver `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

## 1. Como foi medido

Script: `docs/VERIFICACAO-ISOLAMENTO-VIEW-20261126.sql`, rodado pelo usuário no
SQL Editor, em uma única célula (`verificacao_isolamento_view_20261126`), com
sessão ativa do app em cada ambiente e `role=authenticated` dentro da transação.
Terminou em `rollback`; **nenhuma linha de negócio foi alterada**.

Como o cookie `app_env` é único por navegador, a medição foi feita em dois
momentos:

| Ambiente da sessão | Coletado em (UTC) | Sessão válida |
|---|---|---|
| `production` | 2026-11-26 12:06:38.627435 | sim |
| `test` | 2026-11-26 12:09:37.534593 | sim |

## 2. Resultado

| Métrica | Sessão `production` | Sessão `test` |
|---|---:|---:|
| Linhas na view (`view_total`) | 125 | 125 |
| Linhas do próprio ambiente | 106 | 19 |
| Linhas do outro ambiente | **19** | **106** |
| Contratos visíveis via RLS | 106 | 19 |

A soma é simétrica: **125 = 106 + 19** nos dois sentidos.

## 3. Conclusão

- **No banco, a view não isola os ambientes.** Ela devolve as 125 linhas
  independentemente do ambiente da sessão.
- O motivo está na estrutura lida do catálogo: `rls_na_view=false`,
  `security_invoker=nao`, `reloptions=""`. A view lê `contracts`, `clients` e
  `installments` com os privilégios do dono e não aplica o RLS dessas tabelas.
- **Na tela, as linhas de outro ambiente não aparecem.** A página
  `app/contas-a-receber/page.tsx` consulta a view pelo cliente de
  `lib/supabase.ts`, que injeta `.eq('environment', ambiente_atual)` em toda
  consulta, inclusive views. O isolamento hoje é **no cliente**, não no banco.
- Isso não é erro de dado e não significa que a tela tenha mostrado informação
  cruzada. É uma **fragilidade estrutural**: qualquer consulta direta à view
  sem esse filtro — outro cliente, relatório, acesso SQL — vê os dois ambientes.
- A definição da view confirma também o item 1: `prorrogada`/`prorrogado` estão
  fora de `next_due_date`, `overdue_amount`, `overdue_installments` e
  `is_overdue`, como decidido pelo usuário.

## 4. Correção aplicada e verificada

A correção foi marcar a view com `security_invoker = on`, para que ela passe a
respeitar o RLS das tabelas-base — o mesmo padrão já usado em outras views do
projeto (F5/F7). A definição SQL e os dados não foram alterados.

| Arquivo | Função | Estado |
|---|---|---|
| `docs/PRECHECK-ISOLAMENTO-VIEW-20261126.sql` | confirma privilégios e estado inicial | executado em 12:20:58 UTC |
| `docs/FORWARD-ISOLAMENTO-VIEW-20261126.sql` | aplica `security_invoker = on` com checagem de privilégios | **aplicado pelo usuário em 26/11** |
| `docs/VERIFY-ISOLAMENTO-VIEW-20261126.sql` | repete as contagens por ambiente | medições feitas com o script de verificação original |
| `docs/ROLLBACK-ISOLAMENTO-VIEW-20261126.sql` | volta a `RESET (security_invoker)` | **não aplicado** |

Pré-checagem: view existe, `reloptions=""`, `security_invoker_on=false`,
`SELECT` de `authenticated` concedido em `contracts`, `clients` e
`installments`, e `pronto_para_forward=true`.

### Medição pós-forward

| Ambiente da sessão | Coletado em (UTC) | View total | Próprias | De outro | RLS | Resultado |
|---|---|---:|---:|---:|---:|---|
| `test` | 2026-11-26 12:22:26 | 19 | 19 | 0 | 19 | isolado |
| `production` | 2026-11-26 12:25:02 | 106 | 106 | 0 | 106 | isolado |

Estrutura confirmada no catálogo: `reloptions=security_invoker=on`, sem
alteração na definição da view. **Item 2 encerrado com sucesso.** O rollback
não foi acionado e nenhuma linha de negócio foi alterada.

## 5. Limitações

- Contagens iguais provam que a view não trouxe linhas do outro ambiente na
  sessão medida; não provam, isoladamente, que todas as colunas estejam corretas.
- As medições dependem de sessão recente (heartbeat de 20 s; limite de 90 s).
- Nenhum `UPDATE`/`DELETE` em dados de negócio foi executado. Nenhum rollback
  anterior foi acionado.
