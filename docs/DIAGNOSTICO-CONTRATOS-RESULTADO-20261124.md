# Diagnóstico do módulo Contratos — resultado confirmado (24/11/2026)

Fonte: célula `diagnostico_contratos` de `docs/DIAGNOSTICO-CONTRATOS-20261124.sql`, executada em produção (PG 17.6, database `postgres`). Somente leitura. Nenhuma alteração foi feita.

Este documento **atualiza** o relatório estático `Relatório técnico — Módulo Contratos`: o que era hipótese passa a fato confirmado, e o que foi derrubado é marcado como resolvido.

---

## 1. Confirmações estruturais

| Item | Resultado | Impacto |
|---|---|---|
| `schema_migrations` | **não existe** | Confirma: não há versionamento de schema no banco; a ordem das migrações manuais continua não rastreável |
| `payments.id` | **uuid** | Confirma divergência com o baseline do repo (BIGINT) |
| `payments.payment_date` | **timestamptz** | Confirma divergência com o repo (DATE) |
| `payments.financial_transaction_id` | **existe**, com FK `ON DELETE SET NULL` | Hipótese “coluna fantasma” derrubada em produção |
| `payments.reverses_payment_id` | **existe**, self-FK `ON DELETE SET NULL` | Estorno tem vínculo explícito em produção |
| `payments.user_id` e `created_by` | **ambos existem** | Duplicidade de autoria convive no schema |
| `contracts.base_comissao` | **existe** | View de comissão é válida em produção |
| `contracts.contractNumber` / `contract_number` | **não existe** | Confirma: `ContractNumberBadge` nunca pode exibir número; formulário não tem campo |
| `contract_diseases.environment` | **não existe** | Confirma isolamento mais fraco (depende só de `contract_id`) |
| `installments.dueDate` = `date`, `original_due_date` = `timestamptz` | confirmado | Divergência de tipos mantida |
| `sales`, `financial_records` | **não existem** | Confirma tabelas fantasma em backup/RLS |
| `organizations` / `organization_id` | **existe em várias tabelas** | Correção importante: o relatório estático dizia que não havia tenant; em produção há `organization_id` em contracts, clients, payments etc. |

---

## 2. Hipóteses derrubadas (já corrigidas em produção)

| Achado anterior | Situação confirmada |
|---|---|
| CHECK de `contracts.status` omitia `Prorrogado` | **Falso em produção**: CHECK aceita `Aberto, Parcial, Quitado, Cancelado, Estornado, Prorrogado` |
| CHECK de `installments` seria restritivo demais | **Falso em produção**: aceita `Aberto, Parcial, Quitado, Cancelado, Cancelada, Prorrogada, Atrasada, Estornado` |
| `process_contract_cancellation` cancelava com pagamento | **Falso em produção**: versão v2 valida `v_paid > 0` e lança exceção |
| `log_audit_event()` era `SECURITY INVOKER` | **Falso em produção**: é `SECURITY DEFINER`, `search_path=public`; escrita de auditoria funciona |
| `exec_sql` tinha EXECUTE implícito a PUBLIC | **Falso em produção**: `anon=false`, `authenticated=false`, `public=false` |
| Gatilho duplicado de proteção de status | **Falso em produção**: existe apenas `trg_protect_contracts_status` |
| Views sem `security_invoker` | **Falso em produção**: as views relevantes estão com `security_invoker=on` |
| `audit_hardening.sql` com coluna errada | **Falso em produção**: índice correto em `performed_by` existe |
| `get_future_receivables_projection` somava valor bruto | **Falso em produção**: versão aplicada usa saldo, inclui `prorrogada`, exclui cancelados e filtra ambiente |
| Totais sempre confiáveis | **Falso**: há 17 contratos inconsistentes (ver §4) |

---

## 3. Achados confirmados que permanecem

### Crítico / alto

1. **Policies do portal do indicador sem filtro de ambiente**
   - `contracts` e `commission_payments` têm policy permissiva:
     ```sql
     using (indicator_id = _rls_portal_indicator_id())
     ```
   - Não há `_rls_can_access(environment)` combinada.
   - Como são permissivas, fazem OR com a policy de sessão — risco real de leitura cross-environment quando o `indicator_id` coincide.
   - Correção: recreate policies com `using (_rls_can_access(environment) AND indicator_id = _rls_portal_indicator_id())`.

2. **Views de dashboard não excluem `Estornado`**
   - `vw_dashboard_receivables_forecast`, `vw_dashboard_receivables_metrics` e `vw_dashboard_top_defaulters` usam:
     ```sql
     status <> ALL (ARRAY['Quitado','Cancelada'])
     ```
   - `Estornado` continua entrando em atraso, vencimento hoje e previsão.
   - Correção: incluir `estornado`/`estornada` na lista de exclusão (com `lower()` para robustez).

3. **`search_all(text,text)` quebrado no schema atual**
   - A function tem marcador `contractNumber = true`.
   - A coluna `contractNumber` **não existe** em produção.
   - Qualquer chamada que entre na CTE de contratos deve falhar em runtime.
   - Correção: trocar por coluna existente ou remover o ramo de contratos.

4. **Ausência de unicidade em parcelas**
   - `installments` tem só PK; não há `UNIQUE(contract_id, "installmentNumber")`.
   - O diagnóstico atual diz `parcelas_duplicadas = 0`, mas a proteção é apenas de dados, não de schema — pode voltar a acontecer.

5. **Índices ausentes**
   - `payments`: só `organization_id` e PK — falta `installment_id`, `environment`, `(type, payment_date)`.
   - `installments`: não há índice em `dueDate`, `status` ou `(contract_id, installmentNumber)`.
   - `commission_payments`: só `organization_id` e PK — falta `contract_id` e `indicator_id`.

### Médio

6. **`contract_diseases` sem `environment`** — confirmado; hoje há 0 linhas, mas o risco estrutural permanece.
7. **`contratos_sem_numero` = “sem coluna de número”** — o badge de número do contrato é uma feature incompleta.
8. **`log_audit_event()` EXECUTE público/anon** — é trigger function e não chamável diretamente com efeito útil, mas o grant público é desnecessário.
9. **Sem `schema_migrations`** — reforça a necessidade de consolidar a fonte de verdade das migrações.

---

## 4. Consistência de dados medidas

| Verificação | Resultado | Interpretação |
|---|---:|---|
| Parcelas duplicadas por contrato/número | 0 | OK hoje, mas sem UNIQUE no schema |
| Pagamento acima do valor da parcela | **26** | Requer investigação e correção pontual + CHECK/`amountPaid <= amount` |
| Contratos `Quitado` com parcelas abertas | 0 | OK |
| Contratos `Cancelado` com parcelas vivas | 0 | OK |
| Comissão não zerada em cancelados | 0 | OK |
| Pro bono com saldo | 0 | OK |
| Pagamentos `type='payment'` sem conta | **9** | Requer revisão — pode ser legado ou dado órfão |
| Totais denormalizados inconsistentes | **17** | Requer recálculo controlado e trigger/rotina única de conserto |
| Linhas em `contract_diseases` sem environment | 0 | Sem dado exposto hoje |

Prioridade de dados: **26 pagamentos acima do saldo → 17 totais inconsistentes → 9 pagamentos sem conta**.

---

## 5. Roadmap revisado

### P0 — security/isolamento

1. Corrigir policies do portal (`contracts`, `commission_payments`) para exigir `_rls_can_access(environment)`.
2. Corrigir as 3 views de dashboard para excluir `Estornado`.
3. Corrigir `search_all` para o schema real.

### P1 — integridade

4. `UNIQUE(contract_id, "installmentNumber")` e `CHECK (amountPaid <= amount)` / valores não negativos.
5. Índices em `payments(installment_id)`, `payments(environment)`, `payments(type, payment_date)` e `installments(dueDate, status, contract_id)`.
6. Investigar e corrigir os 26 pagamentos acima do saldo, os 17 totais e os 9 pagamentos sem conta — com autorização explícita e plano de rollback.

### P2 — produto/UX

7. Decidir o destino de `contractNumber` (incluir coluna ou remover badge).
8. Avaliar inclusão de `environment` em `contract_diseases`.
9. Consolidar migrações e remover scripts duplicados `-1`.
10. Refatorar o monoarquivo `app/contratos/page.tsx` (2.651 linhas), paginação, realtime, loading/error e padronização de `toast`.

---

## 6. Conclusão revisada

O módulo está **melhor do que o relatório estático indicava** em vários pontos críticos — cancelamento, auditoria, CHECK de status, `exec_sql` e `security_invoker` estão corretos em produção.

Os riscos que **realmente permanecem** são:

- **isolamento do portal** (cross-environment);
- **views contaminadas por `Estornado`**;
- **`search_all` quebrado**;
- **ausência de unicidade/índices**;
- **35 registros com inconsistência financeira** (26 + 9, além de 17 contratos com totais divergentes);
- **dívida de UX/código** no monoarquivo.

Nenhuma correção foi executada. Todas dependem de autorização explícita, plano de rollback e, para os dados, medição prévia.
