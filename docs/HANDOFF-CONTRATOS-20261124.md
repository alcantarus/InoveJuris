# Handoff — Módulo Contratos (24/11/2026)

> Documento de continuidade para retomar a auditoria do módulo Contratos.
> Nenhuma alteração de código, schema, policy, grant ou dado foi executada.
> Nenhuma credencial foi tratada no chat.
> `main` e `origin/main` em **`83925dd`**.

---

## 1. Estado atual

A auditoria do módulo Contratos passou por quatro etapas:

| Etapa | Situação |
|---|---|
| Relatório técnico estático (código/UI, regras, banco) | Entregue ao usuário |
| Diagnóstico estrutural somente leitura | Executado; resultado colado e documentado |
| Forense dos 26 / 17 / 9 candidatos | Executado; resultado colado e analisado |
| Validação final para confirmar falsos positivos | **Script pronto, aguardando execução/retorno** |

A leitura da forense indicou que **26 e 17 muito provavelmente são falsos positivos** do diagnóstico inicial. A validação final foi escrita exatamente para confirmar isso antes de escrever qualquer UPDATE/DELETE.

---

## 2. Arquivos criados nesta rodada

| Arquivo | Função |
|---|---|
| `docs/DIAGNOSTICO-CONTRATOS-20261124.sql` | Diagnóstico estrutural: tabelas, colunas, constraints, índices, functions, triggers, policies, views, grants e contagens de consistência. Uma célula `diagnostico_contratos`. |
| `docs/DIAGNOSTICO-CONTRATOS-RESULTADO-20261124.md` | Resultado confirmado do diagnóstico, com hipóteses derrubadas e confirmadas. |
| `docs/FORENSE-CONTRATOS-20261124.sql` | Forense somente leitura dos 26 / 17 / 9: colunas completas, funções completas, pagamentos vinculados e amostras. Uma célula `forense_contratos`. |
| `docs/VALIDACAO-CONTRATOS-20261124.sql` | Validação final: `excesso ≈ interest + fine`, `amountReceivable` pela fórmula real do trigger e conta recuperável nos 9 pagamentos. Uma célula `validacao_contratos`. **Aguardando retorno.** |
| `docs/HANDOFF-CONTRATOS-20261124.md` | Este documento. |

---

## 3. Confirmações do diagnóstico estrutural

### Divergências confirmadas

- `payments.id` = **uuid** no banco (repo diz BIGINT).
- `payments.payment_date` = **timestamptz** (repo diz DATE).
- `payments` tem **user_id e created_by**, `financial_transaction_id`, `reverses_payment_id` e `payment_method`.
- `contracts.base_comissao` existe em produção.
- `contracts.contractNumber` / `contract_number` **não existe**.
- `contract_diseases` **não tem coluna `environment`**.
- `sales` e `financial_records` **não existem**.
- `schema_migrations` **não existe** — nenhum versionamento de schema no banco.
- `organizations` / `organization_id` **existem** em várias tabelas (correção ao relatório estático).

### Hipóteses derrubadas — já estão corretas em produção

- CHECK de `contracts.status` aceita `Prorrogado`.
- CHECK de `installments` aceita `Atrasada`, `Estornado`, `Prorrogada`, `Cancelada`/`Cancelado`.
- `process_contract_cancellation` valida pagamentos antes de cancelar.
- `log_audit_event()` é `SECURITY DEFINER` com `search_path=public`.
- `exec_sql` não tem EXECUTE para `anon`, `authenticated` ou `PUBLIC`.
- Views relevantes estão com `security_invoker=on`.
- `get_future_receivables_projection` já usa saldo, inclui `prorrogada`, exclui cancelados e filtra ambiente.
- Não há gatilho duplicado de proteção de status.

---

## 4. Achados que permanecem

### Crítico / alto

1. **Policies do portal do indicador sem filtro de ambiente**
   - `contracts` e `commission_payments` usam apenas `indicator_id = _rls_portal_indicator_id()`.
   - São permissivas; fazem OR com a policy de sessão.
   - Risco real de leitura cross-environment.
   - Correção futura: combinar com `_rls_can_access(environment)`.

2. **Views de dashboard não excluem `Estornado`**
   - `vw_dashboard_receivables_forecast`, `vw_dashboard_receivables_metrics`, `vw_dashboard_top_defaulters`.
   - Filtram só `Quitado`/`Cancelada`.

3. **`search_all(text,text)` quebrado**
   - Referencia `contractNumber`, que não existe em produção.

4. **Unicidade/índices ausentes**
   - `installments` sem `UNIQUE(contract_id, "installmentNumber")`.
   - `payments` sem índice em `installment_id`, `environment`, `(type, payment_date)`.
   - `commission_payments` sem índice em `contract_id` / `indicator_id`.

### Médio

5. `contract_diseases` sem `environment` — 0 linhas hoje, mas risco estrutural.
6. Badge de número do contrato é feature incompleta — não há coluna.
7. `log_audit_event()` com EXECUTE público/anon — trigger function, risco baixo.
8. Sem `schema_migrations`.

---

## 5. Os 26 / 17 / 9 — leitura da forense

| Lote | Situação provável | Evidência |
|---|---|---|
| **26 pagamentos acima do valor** | **Falso positivo** | Existe `installments.interest` e `fine`. `process_installment_payment` 9args soma `p_amount_paid` (que inclui juros/multa) em `amountPaid` e também acumula `interest`/`fine`. |
| **17 totais inconsistentes** | **Falso positivo meu** | O trigger `fn_recalculate_contract_totals()` v4 calcula `amountReceivable` com `SUM(GREATEST(amount - amountPaid,0)) FILTER (...)` e overrides para Cancelado/Estornado/Pro bono. Ex.: contrato 134 `Estornado` com `amountReceivable=0` está correto. |
| **9 pagamentos sem conta** | **Provavelmente legado intencional** | Todos com `payment_method=null`. A sobrecarga de 5 args da própria RPC diz que sem conta o registro fica “sem impacto de saldo”. Alguns têm `financial_transaction_id`, outros não. |

**Decisão até aqui:** não escrever UPDATE/DELETE. A validação final confirmará se sobra algo real.

---

## 6. Próximo passo ao retomar

1. Rodar **`docs/VALIDACAO-CONTRATOS-20261124.sql`** no SQL Editor.
2. Colar a célula **`validacao_contratos`**.
3. Interpretar:
   - se `nao_explicados = 0` nos dois primeiros blocos e `sem_conta_na_transacao` não oferece conta recuperável → **não há correção de dados a fazer**; apenas documentar os falsos positivos;
   - se sobrar algum `nao_explicados`, escrever UPDATE pontual com `WHERE id = ...`, backup dos valores anteriores e rollback.
4. Só depois, e com autorização explícita, preparar os scripts estruturais P0 (policies do portal, views com `Estornado`, `search_all`) e P1 (índices/unicidade).

---

## 7. Restrições e convenções

- Nunca executar banco sem autorização explícita e medição prévia.
- Nunca pedir ou colar credenciais no chat.
- PowerShell sem `&&`; separar comandos com `;`.
- `tsconfig.tsbuildinfo` precisa ser restaurado com `git checkout -- tsconfig.tsbuildinfo` após builds.
- Editar arquivos com `edit` para mudanças pontuais e `write` para arquivos novos/completos.
- Preferir `C:\Users\MARILIA\AppData\Local\Temp\opencode` como temporário.

---

## 8. Resumo de uma linha

> Auditoria do módulo Contratos concluída na parte estrutural; 26 e 17 são quase certamente falsos positivos explicados por juros/multa e pela fórmula do trigger; 9 pagamentos sem conta parecem legado intencional; aguardando `validacao_contratos` para fechar sem mexer em dados — e, depois, corrigir somente policies, views e `search_all` com autorização.
