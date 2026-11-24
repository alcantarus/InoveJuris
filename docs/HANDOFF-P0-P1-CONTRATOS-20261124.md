# Handoff — scripts estruturais P0/P1 de Contratos (24/11/2026)

> **Estado: P0 e P1 APLICADOS E VALIDADOS (18:24:54 e 18:29:06 UTC).**
> Nenhum UPDATE/DELETE foi escrito. Nenhum rollback aplicado.
> Nenhuma credencial foi tratada no chat.
> Frente aberta: percepção de lentidão relatada após as mudanças — medição
> preparada em `docs/BENCHMARK-POS-P0-P1-20261124.sql`, ainda não executada.

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
| P0.3 | `search_all(text,text)` | Reparadas 3 colunas inexistentes: `contractNumber`, `clientId`, `processes.processNumber` |
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
| `docs/FIX-P0-SEARCH-ALL-20261124.sql` | Correção somente de `search_all` após o `VERIFY` revelar `processes.processNumber` inexistente |
| `docs/ROLLBACK-P0-CONTRATOS-20261124.sql` | Reversão P0 |
| `docs/FORWARD-P1-CONTRATOS-20261124.sql` | Aplicação P1 (`CREATE INDEX` normal, compatível com o SQL Editor) |
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
- **`FORWARD-P0` aplicado com sucesso** (sem linhas retornadas). O `VERIFY-P0`
  falhou ao chamar `search_all`: `processes.processNumber` também não existe.
  A versão canônica da função já trazia essa referência, além de
  `contractNumber` e `clientId`. Criado
  `docs/FIX-P0-SEARCH-ALL-20261124.sql`, que recria somente a função usando
  `to_jsonb(p)` para todas as colunas de `processes`. `FORWARD-P0` e
  `VERIFY-P0` foram atualizados com a mesma correção.
- Baseline das views capturado em 18:18:20 UTC: production
  `count_overdue=18`, `total_overdue=77931.60`, `total_installments=117`; test
  `count_overdue=7`, `total_overdue=19000.00`, `total_installments=64`;
  `receivables_forecast` 7 linhas / `24044.20`; `top_defaulters` 22 linhas /
  `96931.60`. Há **3** parcelas `Estornado`; o delta exato será medido no
  `verify_p0`.
- `idx_installments_contract_id` **já existe**; o `FORWARD-P1` usa
  `IF NOT EXISTS` e não vai recriá-lo.

## 4. P0 aplicado e validado (18:24:54 UTC)

`FORWARD-P0` rodado com sucesso (DDL não retorna linhas). O primeiro `VERIFY`
revelou `processes.processNumber` inexistente; aplicado `FIX-P0-SEARCH-ALL` e
revalidado. Resultado final:

- policies `P0 portal indicador` em `contracts` e `commission_payments`:
  `(_rls_can_access(environment) AND (indicator_id = _rls_portal_indicator_id()))`,
  `ok=true` nas duas;
- 3 views com `exclui_estornado=true` e `security_invoker` preservado;
- `search_all_sem_colunas_inexistentes=true`; chamada real
  `search_all('ana','production')` retornou 5 clientes e 5 contratos, sem erro;
- contagens inalteradas: `contracts=125`, `installments=181`, `payments=177`,
  `commission_payments=15`;
- production inalterado: 18 inadimplentes / R$ 77.931,60;
- test: 7 → **5** inadimplentes e R$ 19.000,00 → **14.000,00** (−2 parcelas,
  −R$ 5.000);
- `top_defaulters`: 22 → **21** linhas e R$ 96.931,60 → **91.931,60**;
- forecast inalterado: 7 linhas / R$ 24.044,20;
- `installments_estornado=3` (as parcelas continuam no banco; duas saíram dos
  KPIs por estarem em atraso no teste).

**Rollback do P0 não aplicado. P1 autorizado, mas a 1ª tentativa falhou com erro
25001 (`CREATE INDEX CONCURRENTLY` dentro de transação do SQL Editor); nada foi
aplicado. Scripts P1 ajustados para índice normal.**

## 5. P1 aplicado e validado (18:29:06 UTC)

Primeira tentativa falhou com erro `25001` (`CONCURRENTLY` em transação do SQL
Editor); nada foi aplicado. Após ajuste para `CREATE INDEX` normal:

- `FORWARD-P1` executado com sucesso;
- `constraint_unica_parcelas = true`, `UNIQUE(contract_id, "installmentNumber")` ativa;
- 8 índices presentes: `uq_installments_contract_number`,
  `idx_payments_installment_id`, `idx_payments_environment`,
  `idx_payments_type_payment_date`, `idx_installments_due_date_status`,
  `idx_installments_contract_id` (já existia),
  `idx_commission_payments_contract_id`, `idx_commission_payments_indicator_id`;
- `indices_invalidos = []`;
- `duplicatas_parcelas = 0`;
- contagens inalteradas: `contracts=125`, `installments=181`, `payments=177`,
  `commission_payments=15`;
- nenhum UPDATE/DELETE; rollback do P1 não aplicado.

**Auditoria e correções estruturais P0/P1 encerradas.**

## 6. Pode danificar alguma coisa?

**Preparar os arquivos: não.** São apenas texto no Git.

**Aplicar o DDL: riscos conhecidos e controlados:**

| Risco | Como é mitigado |
|---|---|
| Portal perder leitura se o JWT/sessão do indicador não carregar `_rls_can_access` | Medir contagens por `environment` antes; `verify_p0` compara depois; rollback restaura o predicado original |
| KPIs do dashboard mudarem (Estornado deixa de contar como atraso) | É o efeito desejado; o delta é documentado na medição/verificação |
| `search_all` ainda falhar se outra coluna referenciada não existir | Uso de `to_jsonb(c)` elimina referências estáticas a colunas não confirmadas |
| Constraint única falhar por duplicata surgida após a medição | `verify_p1` confere `duplicatas_parcelas` e a constraint; rollback remove o índice |
| Duplicata aparecer entre medição e aplicação | Medição prévia exige `duplicatas_parcelas = 0`; se mudar, **não aplicar** |
| Bloqueio de escrita | `CONCURRENTLY` foi removido (SQL Editor roda em transação: erro 25001). Tabelas com 15–181 linhas; índice normal é seguro |

Nenhum script apaga ou altera dado de negócio. O rollback P0 restaura
deliberadamente o `search_all` antigo (com o predicado quebrado), porque esse
era o estado anterior.

## 7. Ordem obrigatória

1. Usuário autoriza explicitamente a execução da célula de medição (somente leitura).
2. Usuário roda `MEDICAO-P0-P1-CONTRATOS-20261124.sql` e cola o JSON. **Feito em 18:15:48 UTC.**
3. Usuário roda `MEDICAO-COMPLEMENTAR-P0-20261124.sql` e cola o JSON, para resolver `search_all` e capturar o baseline das views.
4. Conferir `duplicatas_parcelas = 0` e conferir as definições reais de views/policies.
5. Usuário autorizou explicitamente a aplicação de P0. **Feito.**
6. Aplicar `FORWARD-P0` → `FIX-P0-SEARCH-ALL` → `VERIFY-P0`. **Feito e validado em 18:24:54 UTC.**
7. Usuário autorizou explicitamente a aplicação de P1. **Feito.**
8. Aplicar `FORWARD-P1` → rodar `VERIFY-P1`. **Feito e validado em 18:29:06 UTC.**
9. Se qualquer verificação divergisse: aplicar o `ROLLBACK` correspondente. **Não necessário.**
10. Atualizar `STATUS-INOVEJURIS.md`, `HANDOFF-CONTRATOS-20261124.md` e dar commit/push. **Feito.**

## 8. Limites

- Sem autorização explícita: **nada é executado no banco**.
- Sem medição prévia: **nada é aplicado**.
- Sem escrita em `UPDATE`/`DELETE` de dados em nenhuma hipótese.
- A aplicação é feita pelo usuário no SQL Editor do Supabase, não por deploy.

## 9. Frente aberta — lentidão percebida após P0/P1

Usuário relatou que o sistema parece mais lento após as mudanças. **Causa ainda
não confirmada**: nenhuma medição de ponta a ponta foi feita depois do P0/P1.

Hipóteses rankingadas pelas evidências já existentes:

1. **RLS por linha** — `_rls_can_access(environment)` é `SECURITY DEFINER` e
   recebe uma coluna, logo não é inlinado e é avaliado linha a linha. Isso já
   havia sido medido em `clients` (165,010 ms de mediana) **antes** do P0/P1.
   O P0.1 acrescentou mais uma ocorrência em `contracts` e
   `commission_payments`. É o candidato mais forte para lentidão geral.
2. **`search_all` com `to_jsonb(p)`** — o ramo de processos materializa a linha
   inteira em JSONB 5× no `WHERE` e 1× no `SELECT`, o que impede o uso de
   índices trigram. Antes a função quebrava com `42703`; agora ela executa.
   É o candidato mais forte para lentidão específica do Ctrl+K.
3. **Views do dashboard** — só entraram dois valores novos no filtro de status;
   efeito esperado desprezível.
4. **P1 (índices/unicidade)** — índice não deixa `SELECT` mais lento; em tabelas
   de 15 a 181 linhas o custo extra de escrita é insignificante. Não explica a
   percepção. Também não houve deploy nesta rodada: o bundle do app é o mesmo
   desde o P2 de 23/11.

Ferramenta preparada: `docs/BENCHMARK-POS-P0-P1-20261124.sql` — uma única
célula, somente leitura, 5 repetições, mediana, role real da aplicação,
comparação com RLS e sem RLS, controles `to_jsonb` × colunas diretas e
`ROLLBACK` final. **Não executado.** Somente com autorização explícita.

Nenhuma mudança de policy, view, função ou índice será aplicada para
performance sem que essa medição aponte a causa.
