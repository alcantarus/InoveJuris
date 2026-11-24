# Handoff — Módulo Contratos (24/11/2026)

> Documento de continuidade para retomar a auditoria do módulo Contratos.
> Nenhuma alteração de código, schema, policy, grant ou dado foi executada.
> Nenhuma credencial foi tratada no chat.
> `main` e `origin/main` alinhados; ver `git log -1` para o hash corrente.

---

## 1. Estado atual

A auditoria do módulo Contratos passou por quatro etapas:

| Etapa | Situação |
|---|---|
| Relatório técnico estático (código/UI, regras, banco) | Entregue ao usuário |
| Diagnóstico estrutural somente leitura | Executado; resultado colado e documentado |
| Forense dos 26 / 17 / 9 candidatos | Executado; resultado colado e analisado |
| Validação final para confirmar falsos positivos | **Executada; resultado colado e documentado** |
| Investigação dos 26 que sobraram | **Executada em célula única; resultado colado e documentado** |
| Auditoria consolidada (uma célula) | **Executada e interpretada — auditoria fechada** |

A validação confirmou que os **totais (44/44)** e os **9 pagamentos sem conta** não exigem correção. A hipótese de que os **26** seriam juros/multa foi **refutada**: `interest=0` e `fine=0` em toda a amostra. A auditoria consolidada provou que **`pago == SUM(payments)` nos 26**: o excesso é entrada real registrada em `payments`, não erro de `amountPaid`. Nenhuma escrita em banco. Resultado em `docs/VALIDACAO-CONTRATOS-RESULTADO-20261124.md`.

---

## 2. Arquivos criados nesta rodada

| Arquivo | Função |
|---|---|
| `docs/DIAGNOSTICO-CONTRATOS-20261124.sql` | Diagnóstico estrutural: tabelas, colunas, constraints, índices, functions, triggers, policies, views, grants e contagens de consistência. Uma célula `diagnostico_contratos`. |
| `docs/DIAGNOSTICO-CONTRATOS-RESULTADO-20261124.md` | Resultado confirmado do diagnóstico, com hipóteses derrubadas e confirmadas. |
| `docs/FORENSE-CONTRATOS-20261124.sql` | Forense somente leitura dos 26 / 17 / 9: colunas completas, funções completas, pagamentos vinculados e amostras. Uma célula `forense_contratos`. |
| `docs/VALIDACAO-CONTRATOS-20261124.sql` | Validação final executada: `excesso ≈ interest + fine`, `amountReceivable` pela fórmula real do trigger e conta recuperável nos 9 pagamentos. Uma célula `validacao_contratos`. |
| `docs/VALIDACAO-CONTRATOS-RESULTADO-20261124.md` | Resultado colado e interpretação: 26 não explicados, 44/44 totais explicados, 0 contas recuperáveis. |
| `docs/INVESTIGACAO-EXCESSO-26-20261124.sql` | Investigação somente leitura dos 26: `amountPaid` × soma de `payments` × transações. Células `investigacao_excesso_26` e `candidatos_conta_9`. **Célula `candidatos_conta_9` recebida; a outra foi absorvida pela auditoria consolidada.** |
| `docs/AUDITORIA-CONTRATOS-COMPLETA-20261124.sql` | **Script consolidado, uma única célula `auditoria_contratos_completa`**: 26 com detalhe de payments/transações, totais pela fórmula do trigger e 9 sem conta. Executado em `2026-11-24T18:01:50.243675+00:00`; commit `de19564`. |
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

| Lote | Situação final | Evidência |
|---|---|---|
| **26 pagamentos acima do valor** | **Fechado — entrada real; não corrigir** | Auditoria consolidada: `pago_igual_soma_pagamentos=26`, `pago_maior_que_soma_pagamentos=0`, `pago_menor_que_soma_pagamentos=0`, `sem_pagamentos_vinculados=0`, `com_transacao_vinculada=0`. `diferenca_pago_vs_pagamentos=0.00` nos 26. A lacuna é separação em `interest`/`fine` e ausência de `financial_transaction_id` no legado. |
| **17 totais inconsistentes** | **Fechado — falso positivo** | `totais_formula_trigger`: 44 candidatos pela fórmula ingênua, **44 explicados**, 0 não explicados. Ex.: contrato 134 `Estornado` com `amountReceivable=0` está correto. |
| **9 pagamentos sem conta** | **Fechado — irrecuperável** | 5 têm transação, mas `transaction_account_id=null`; 4 não têm transação; `com_conta_na_transacao=0`, `sem_conta_na_transacao=9`. Candidatas por valor/data ambíguas, em `test` e com descrições de outras parcelas. |

**Decisão final:** não escrever UPDATE/DELETE. Os três lotes estão fechados. O excesso dos 26 não é erro de `amountPaid`; reduzi-lo quebraria a reconciliação com `payments`.

---

## 6. Próximo passo ao retomar

1. ~~Rodar `docs/VALIDACAO-CONTRATOS-20261124.sql` e colar `validacao_contratos`.~~ **Feito**.
2. ~~Rodar `docs/INVESTIGACAO-EXCESSO-26-20261124.sql` e colar as células.~~ **Absorvido** pela auditoria consolidada.
3. ~~Rodar `docs/AUDITORIA-CONTRATOS-COMPLETA-20261124.sql` e colar `auditoria_contratos_completa`.~~ **Feito** em `2026-11-24T18:01:50.243675+00:00`; interpretado em `docs/VALIDACAO-CONTRATOS-RESULTADO-20261124.md`.
4. **Único passo em aberto:** com autorização explícita e medição prévia, preparar/aplicar os scripts estruturais:
   - **P0** — policies do portal com `_rls_can_access(environment)`, views excluindo `Estornado`, `search_all(text,text)` corrigido;
   - **P1** — `UNIQUE(contract_id, "installmentNumber")` e índices em `payments`/`installments`/`commission_payments`.
5. Nenhuma escrita em dados de Contratos está autorizada ou necessária.

---

## 7. Restrições e convenções

- Nunca executar banco sem autorização explícita e medição prévia.
- Nunca pedir ou colar credenciais no chat.
- PowerShell sem `&&`; separar comandos com `;`.
- `tsconfig.tsbuildinfo` precisa ser restaurado com `git checkout -- tsconfig.tsbuildinfo` após builds.
- Editar arquivos com `edit` para mudanças pontuais e `write` para arquivos novos/completos.
- Preferir `C:\Users\ALCANTARUS\AppData\Local\Temp\opencode` como temporário (conforme ambiente atual).

---

## 8. Resumo de uma linha

> Auditoria de Contratos fechada em 24/11/2026: 44/44 totais corretos, 26 excessos confirmados como entrada real em `payments` (`pago == SUM(payments)`), 9 pagamentos sem conta recuperável; nenhuma escrita em banco — correções estruturais (policies, views, `search_all`, índices) só com autorização explícita e medição prévia.
