# Handoff — scripts estruturais P0/P1 de Contratos (24/11/2026)

> **Estado: PREPARADO, NÃO APLICADO.**
> Nenhum comando foi executado no banco. Nenhum UPDATE/DELETE foi escrito.
> Nenhuma credencial foi tratada no chat.

## 1. Escopo decidido

Auditoria de dados fechada em `docs/VALIDACAO-CONTRATOS-RESULTADO-20261124.md`.
Os itens 26 / 17 / 9 **não** entram neste escopo. Também foi **retirado** o
`CHECK (amountPaid <= amount)` do roadmap antigo: ele contradiz a conclusão de
que os 26 excessos são entrada real em `payments` e rejeitaria pagamentos
válidos com acréscimo embutido.

Escopo restante:

| Fase | Item | Ação |
|---|---|---|
| P0.1 | Policies do portal | `contracts` e `commission_payments` passam a exigir `_rls_can_access(environment) AND (predicado original)` |
| P0.2 | Views de dashboard | `Estornado`/`Estornada` saem de `_receivables_forecast`, `_receivables_metrics` e `_top_defaulters` |
| P0.3 | `search_all(text,text)` | Removido somente o predicado de `contractNumber`, que não existe em produção |
| P1 | Unicidade | `UNIQUE(contract_id, "installmentNumber")` em `installments` |
| P1 | Índices | `payments`, `installments` e `commission_payments` |

Decisão sobre `search_all`: **opção A** — remover apenas o termo quebrado,
mantendo o ramo de contratos. Acesso a colunas não confirmadas
(`processNumber`, `clientId`/`client_id`) feito via `to_jsonb(c)`, sem risco de
erro de coluna inexistente. Não foi usado `id::text` como “número do contrato”.

## 2. Arquivos preparados

| Arquivo | Função |
|---|---|
| `docs/MEDICAO-P0-P1-CONTRATOS-20261124.sql` | Célula única `medicao_previa_contratos`: policies, views, `search_all`, colunas, índices, duplicatas e contagens |
| `docs/FORWARD-P0-CONTRATOS-20261124.sql` | Aplicação P0 (DDL) |
| `docs/VERIFY-P0-CONTRATOS-20261124.sql` | Célula única `verify_p0_contratos` |
| `docs/ROLLBACK-P0-CONTRATOS-20261124.sql` | Reversão P0 |
| `docs/FORWARD-P1-CONTRATOS-20261124.sql` | Aplicação P1 (`CREATE INDEX CONCURRENTLY`) |
| `docs/VERIFY-P1-CONTRATOS-20261124.sql` | Célula única `verify_p1_contratos` |
| `docs/ROLLBACK-P1-CONTRATOS-20261124.sql` | Reversão P1 |

## 3. Pode danificar alguma coisa?

**Preparar os arquivos: não.** São apenas texto no Git.

**Aplicar o DDL: riscos conhecidos e controlados:**

| Risco | Como é mitigado |
|---|---|
| Portal perder leitura se o JWT/sessão do indicador não carregar `_rls_can_access` | Medir contagens por `environment` antes; `verify_p0` compara depois; rollback restaura o predicado original |
| KPIs do dashboard mudarem (Estornado deixa de contar como atraso) | É o efeito desejado; o delta é documentado na medição/verificação |
| `search_all` ainda falhar se outra coluna referenciada não existir | Uso de `to_jsonb(c)` elimina referências estáticas a colunas não confirmadas |
| `CREATE UNIQUE INDEX CONCURRENTLY` falhar e deixar índice inválido | `verify_p1` lista `indices_invalidos`; rollback remove o índice |
| Duplicata aparecer entre medição e aplicação | Medição prévia exige `duplicatas_parcelas = 0`; se mudar, **não aplicar** |
| Bloqueio de escrita | Todos os índices usam `CONCURRENTLY`, em statements isolados |

Nenhum script apaga ou altera dado de negócio. O rollback P0 restaura
deliberadamente o `search_all` antigo (com o predicado quebrado), porque esse
era o estado anterior.

## 4. Ordem obrigatória

1. Usuário autoriza explicitamente a execução da célula de medição (somente leitura).
2. Usuário roda `MEDICAO-P0-P1-CONTRATOS-20261124.sql` e cola o JSON.
3. Conferir `duplicatas_parcelas = 0` e conferir as definições reais de views/policies.
4. Usuário autoriza explicitamente a aplicação de P0.
5. Aplicar `FORWARD-P0` → rodar `VERIFY-P0` → comparar com a medição.
6. Usuário autoriza explicitamente a aplicação de P1.
7. Aplicar `FORWARD-P1` → rodar `VERIFY-P1`.
8. Se qualquer verificação divergir: aplicar o `ROLLBACK` correspondente.
9. Atualizar `STATUS-INOVEJURIS.md`, `HANDOFF-CONTRATOS-20261124.md` e dar commit/push.

## 5. Limites

- Sem autorização explícita: **nada é executado no banco**.
- Sem medição prévia: **nada é aplicado**.
- Sem escrita em `UPDATE`/`DELETE` de dados em nenhuma hipótese.
- A aplicação é feita pelo usuário no SQL Editor do Supabase, não por deploy.
