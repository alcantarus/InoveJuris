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
| `docs/MEDICAO-COMPLEMENTAR-P0-20261124.sql` | Célula única `medicao_complementar_p0`: funções `search_all` e baseline numérico das views |
| `docs/FORWARD-P0-CONTRATOS-20261124.sql` | Aplicação P0 (DDL) |
| `docs/VERIFY-P0-CONTRATOS-20261124.sql` | Célula única `verify_p0_contratos` |
| `docs/ROLLBACK-P0-CONTRATOS-20261124.sql` | Reversão P0 |
| `docs/FORWARD-P1-CONTRATOS-20261124.sql` | Aplicação P1 (`CREATE INDEX CONCURRENTLY`) |
| `docs/VERIFY-P1-CONTRATOS-20261124.sql` | Célula única `verify_p1_contratos` |
| `docs/ROLLBACK-P1-CONTRATOS-20261124.sql` | Reversão P1 |

## 3. Medição prévia recebida (18:15:48 UTC)

- PG 17.6. Contagens: `contracts=125`, `installments=181`, `payments=177`,
  `commission_payments=15`.
- `duplicatas_parcelas = 0` → `UNIQUE` é segura.
- Policies confirmadas: `P0 portal indicador` (`SELECT`, `anon`/`authenticated`)
  em `contracts` e `commission_payments`, com
  `using (indicator_id = _rls_portal_indicator_id())`.
- Views confirmadas com `security_invoker=on` e filtro
  `status <> ALL (ARRAY['Quitado'::text,'Cancelada'::text])` — compatível com o
  regex do `FORWARD-P0`.
- `contracts` tem `client_id` e `processNumber`; **não** tem `contractNumber`.
  Os scripts passaram a usar `c.client_id` e `c."processNumber"` diretamente.
- `search_all` existe em `public`, com assinatura
  `p_term text, p_environment text DEFAULT NULL`. O `null` anterior foi erro de
  consulta: `pg_get_function_identity_arguments` devolve os **nomes** dos
  argumentos, não só os tipos.
- A definição real continha **duas** colunas inexistentes: `contractNumber` e
  `clientId`. O `FORWARD-P0` corrige as duas, usando `client_id` e
  `processNumber`, confirmados na medição. `ROLLBACK-P0` restaura fielmente o
  estado anterior (com as duas colunas quebradas).
- Baseline das views capturado em 18:18:20 UTC: production
  `count_overdue=18`, `total_overdue=77931.60`, `total_installments=117`; test
  `count_overdue=7`, `total_overdue=19000.00`, `total_installments=64`;
  `receivables_forecast` 7 linhas / `24044.20`; `top_defaulters` 22 linhas /
  `96931.60`. Há **3** parcelas `Estornado`; o delta exato será medido no
  `verify_p0`.
- `idx_installments_contract_id` **já existe**; o `FORWARD-P1` usa
  `IF NOT EXISTS` e não vai recriá-lo.

## 4. Pode danificar alguma coisa?

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

## 5. Ordem obrigatória

1. Usuário autoriza explicitamente a execução da célula de medição (somente leitura).
2. Usuário roda `MEDICAO-P0-P1-CONTRATOS-20261124.sql` e cola o JSON. **Feito em 18:15:48 UTC.**
3. Usuário roda `MEDICAO-COMPLEMENTAR-P0-20261124.sql` e cola o JSON, para resolver `search_all` e capturar o baseline das views.
4. Conferir `duplicatas_parcelas = 0` e conferir as definições reais de views/policies.
5. Usuário autoriza explicitamente a aplicação de P0.
6. Aplicar `FORWARD-P0` → rodar `VERIFY-P0` → comparar com a medição.
7. Usuário autoriza explicitamente a aplicação de P1.
8. Aplicar `FORWARD-P1` → rodar `VERIFY-P1`.
9. Se qualquer verificação divergir: aplicar o `ROLLBACK` correspondente.
10. Atualizar `STATUS-INOVEJURIS.md`, `HANDOFF-CONTRATOS-20261124.md` e dar commit/push.

## 6. Limites

- Sem autorização explícita: **nada é executado no banco**.
- Sem medição prévia: **nada é aplicado**.
- Sem escrita em `UPDATE`/`DELETE` de dados em nenhuma hipótese.
- A aplicação é feita pelo usuário no SQL Editor do Supabase, não por deploy.
