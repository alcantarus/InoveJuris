# Recebimento em lote com conta e forma de pagamento por parcela (22/11/2026)

## Objetivo

Permitir que cada parcela de um recebimento em lote seja baixada com **conta de destino** e
**forma de pagamento** próprias, sem aplicar uma única conta/categoria a todas.

Decisões confirmadas:

- Formato escolhido: **assistente passo a passo** (uma parcela por etapa, com “1 de N”).
- Cartão de crédito: **apenas rótulo**; o valor entra integralmente na conta escolhida no mesmo dia.
  Não há taxa, prazo de liquidação nem conta de adquirente nesta fase.

## O que mudou

### 1. Modal individual “Receber Parcela”

`app/contas-a-receber/page.tsx`

- Novo campo **Forma de Pagamento**, entre Conta e Categoria.
- Validação de conta, categoria, forma e valor antes de chamar a RPC.
- Passa a chamar `rpc_receber_parcela_com_metodo`, que preserva a lógica canônica de baixa
  integral e de desdobramento parcial.
- Proteção contra duplo clique (`receiveProcessingRef`).

### 2. Recebimento em lote — assistente

`app/contas-a-receber/page.tsx`

- “Receber Selecionados (N)” abre o assistente na primeira parcela elegível.
- Cada etapa mostra parcela, vencimento, valor original e saldo.
- Campos por parcela: valor, conta, forma de pagamento, categoria e descrição.
- Conta/categoria/forma da etapa anterior são pré-preenchidas na próxima, mas podem ser alteradas.
- Falha em uma parcela mantém o modal aberto e a parcela atual disponível para correção.
- Ao final, mostra o total de sucessos e recarrega parcelas, contratos e KPIs.
- Cancelar no meio pede confirmação se alguma parcela já foi recebida.
- Proteção contra duplo clique (`batchProcessingRef`).

### 3. Extrato de Recebimentos

`components/contas-a-receber/ContractStatementModal.tsx`

- Nova coluna **Forma** na tabela desktop.
- Novo campo **Forma** no card mobile.
- Pagamentos antigos sem método aparecem como `-`.
- Fallback de parcelas quitadas sem `payments` corrigido: lia `paid_amount`/`value`/`due_date`
  (não existem no schema) e exibia valor/data inválidos. Agora usa `amountPaid`/`amount`/`dueDate`.

### 4. Banco

Script: `supabase_recebimento_metodo_pagamento.sql`

- Adiciona `payment_method` (anulável) em `payments` e `financial_transactions`.
- Cria constraints com a lista controlada:
  `Dinheiro`, `PIX`, `Cartão de Crédito`, `Cartão de Débito`, `Transferência`, `Boleto`,
  `Cheque`, `Outro`.
- Cria `rpc_receber_parcela_com_metodo(...)`, que:
  - bloqueia a parcela com `FOR UPDATE`;
  - valida valor, conta, categoria e forma;
  - chama `process_installment_payment(...)` para baixa integral;
  - chama `rpc_recebimento_com_desdobramento(...)` para pagamento parcial;
  - grava a forma no `payments` e na `financial_transactions` recém-criados.
- **v2 20261122 — histórico do pagamento parcial:** a função canônica de desdobramento
  cria apenas `financial_transactions`. O wrapper agora insere o `payments`
  correspondente quando ele não existe, de forma idempotente, para que o Extrato de
  Recebimentos liste a parcial. A função canônica **não** foi alterada.
- **Correção de tipo (22/11/2026):** o baseline do repositório declara `payments.id` como
  `BIGINT`, mas o banco em uso tem **UUID**. A primeira versão do wrapper fazia
  `SELECT id INTO v_payment_id BIGINT` e falhava em toda baixa integral (“2 tentativas
  falharam”). O wrapper não captura mais o id em variável tipada; usa subconsulta com o
  tipo nativo da coluna e funciona nos dois formatos.
- **Não reescreve** as funções canônicas v4/v7.
- Registros antigos ficam com `payment_method = NULL`.

## Ordem de aplicação

O projeto usa **um único banco Supabase**. A separação produção × testes é **lógica**
(coluna `environment` + `set_app_environment`). Por isso o script é DDL global: uma vez
aplicado, vale para os dois ambientes. **Não existe um segundo SQL "de produção".**

1. Rodar `supabase_recebimento_metodo_pagamento.sql` no SQL Editor do projeto usado pela
   aplicação. A primeira versão foi aplicada em 22/11/2026; a **v2 20261122** (histórico de
   parcial) exige **reexecutar o mesmo script** — ele é idempotente.
2. Conferir a verificação: os quatro itens devem retornar `true`, incluindo
   `rpc_grava_pagamento_parcial`.
3. Testar o recebimento individual e o assistente em lote com a aplicação no **ambiente de
   testes** (cookie `app_env = test`).
4. Publicar o front-end depois dos testes.

Se o script for rodado em um projeto Supabase diferente do usado pela aplicação, é preciso
repeti-lo no projeto correto. O agente não executa SQL.

## Roteiro de teste em homologação

Sugestão: contrato **#135** (Anderson Jose da Silva), que já tem parcelas em aberto.

1. Selecionar duas parcelas com saldo.
2. Abrir o assistente e confirmar a primeira com:
   - conta A, forma **PIX**, categoria de receita;
   - conferir saldo da conta A, `payments.payment_method = 'PIX'` e transação com o mesmo método.
3. Na segunda etapa, trocar para:
   - conta B, forma **Dinheiro**;
   - conferir saldo da conta B e método na transação.
4. Repetir com **Cartão de Crédito** em uma parcela e conferir que o valor entrou integral na
   conta escolhida.
5. Testar falha proposital (conta inválida ou valor acima do saldo) e confirmar que o modal
   permanece aberto e a parcela não foi baixada.
6. Testar “Cancelar” após uma parcela recebida e confirmar o aviso.
7. Abrir o Extrato de Recebimentos e conferir a coluna “Forma”.
8. Testar **pagamento parcial** (valor menor que o saldo):
   - a parcela original fica `Quitado` e uma parcela residual `Aberto` é criada;
   - o Extrato deve listar a parcial com valor e forma, sem linha duplicada;
   - `payments` deve ter uma linha `type = 'payment'` para a parcela original.
9. Conferir que “Total Recebido” e “Parcelas Pagas” do Extrato continuam coerentes.
10. Rodar as verificações financeiras já conhecidas do projeto em `test`.
11. Nenhum teste financeiro em produção.

### Conferência no banco (somente leitura)

```sql
SELECT
  p.id,
  p.environment,
  p.installment_id,
  p.payment_date,
  p.amount,
  p.payment_method,
  p.financial_transaction_id,
  ft.id AS tx_id,
  ft.payment_method AS tx_payment_method
FROM public.payments p
LEFT JOIN public.financial_transactions ft
  ON ft.id = p.financial_transaction_id
WHERE p.payment_method IS NOT NULL
ORDER BY p.id DESC
LIMIT 10;
```

O vínculo `payments.financial_transaction_id` pode vir `NULL` (as funções canônicas não o
preenchem). Confira a transação pela conta/categoria/data/valor:

```sql
SELECT id, environment, date, amount, type, account_id, category_id, payment_method
FROM public.financial_transactions
WHERE environment = 'test'
  AND payment_method IS NOT NULL
ORDER BY id DESC
LIMIT 10;
```

Para o pagamento parcial, confira o histórico e a parcela residual:

```sql
SELECT
  p.id,
  p.installment_id,
  p.amount            AS valor_pago,
  p.payment_method,
  i.status,
  i."installmentNumber",
  i.amount            AS valor_parcela,
  i."amountPaid"
FROM public.payments p
JOIN public.installments i ON i.id = p.installment_id
WHERE p.environment = 'test'
  AND p.type = 'payment'
ORDER BY p.id DESC
LIMIT 10;
```

Esperado no parcial: uma linha em `payments` para a parcela original
(`status = 'Quitado'`, `amountPaid = valor pago`) e uma parcela residual `Aberto`
com o saldo restante.

## Aceite do teste (22/11/2026)

Ambiente: **testes**. Contrato: **#135 (Anderson Jose da Silva)**.

| Cenário | Resultado |
|---|---|
| Integral — parcela 11, R$ 1.000,00, Cartão de Débito | `payments` e transação com a forma; saldo atualizado |
| Parcial — parcela 10, R$ 1.500,00 de R$ 2.000,00, Dinheiro | `payments` criado pelo wrapper; original `Quitado` com `amountPaid = 1.500`; residual **#13** de R$ 500,00 em 21/09/2027 |
| Residual anterior — parcela 3 | parcela residual **#12** de R$ 500,00 em 21/02/2027 |
| Extrato de Recebimentos | parcial listada uma única vez, com Forma “Dinheiro”; Total Recebido R$ 19.000,00 sem duplicar |
| Multi-conta no lote | contas e formas independentes por etapa, com pré-preenchimento |

Observações confirmadas:

- A residual é criada com `MAX(installmentNumber)+1` (por isso 12 e 13), mantendo a
  data de vencimento da parcela de origem.
- Pagamentos anteriores ao deploy de 22/11/2026 16:59 (BRT) têm `payment_method = NULL`
  e aparecem como `—` no extrato. Não há como preencher a forma retroativamente;
  a limitação é histórica e não afeta o fluxo novo.

## Rollback

O script traz o bloco comentado no final:

```sql
DROP FUNCTION IF EXISTS public.rpc_receber_parcela_com_metodo(...);
ALTER TABLE public.payments DROP COLUMN IF EXISTS payment_method;
ALTER TABLE public.financial_transactions DROP COLUMN IF EXISTS payment_method;
```

Atenção: o rollback apaga as formas de pagamento já gravadas.

## Pendências / próximos passos

- Exibir/filtrar forma de pagamento no Fluxo de Caixa e relatórios (fase posterior).
- Incluir as colunas e a RPC no bootstrap do Setup para instalações novas.
- Se algum dia o cartão passar a ter taxa/prazo, criar o fluxo de adquirente separadamente.
- Não alterar autenticação/permissões nem o fluxo de estorno.

## Validação técnica executada

- `npx tsc --noEmit --pretty false` — sem erros.
- `npm run build` — compilou com sucesso.
- RPC verificada em execução: com `p_installment_id = -1` retorna
  “Parcela -1 não encontrada”, sem gravar nada.
- Nenhum SQL foi executado pelo agente.
