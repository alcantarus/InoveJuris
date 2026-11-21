# Relatório Técnico — Contratos e Contas a Receber

**Cancelamento, quitação, prorrogação, estorno e antecipação**

- **Data:** 21/11/2026
- **Sistema:** InoveJuris
- **Banco:** Supabase `jhlxzqsgmudkbjkynqdl`
- **Método:** análise estática do código + leitura das funções, triggers, constraints e dados reais de produção
- **Natureza:** diagnóstico. **Nenhuma alteração de código, banco ou deploy foi realizada.**
- **Escopo:** `app/contratos`, `app/contas-a-receber`, `lib/supabase.ts`, funções SQL de pagamento/estorno/cancelamento/desdobramento, view `contract_receivables_summary`

---

## 1. Resumo executivo

O bug do cancelamento foi localizado e provado. A causa raiz é a função de gatilho **`fn_recalculate_contract_totals`**, que roda a cada alteração de parcela e:

1. regrava o status do contrato apenas como `Quitado`, `Parcial` ou `Aberto`;
2. calcula `amountReceivable` como `contractValue − amountPaid`, ignorando cancelamento, estorno e prorrogação.

Ao cancelar um contrato, o fluxo grava primeiro `contracts.status = 'Cancelado'` e depois tenta gravar as parcelas como `Cancelada`. Nesse momento o gatilho recalcula o contrato e tenta gravar `Aberto`; a função de proteção **`fn_protect_contracts_status`** bloqueia a transição `Cancelado → Aberto` e lança exceção. Resultado:

- a atualização das parcelas é desfeita;
- o contrato permanece `Cancelado`;
- as parcelas continuam abertas;
- `amountReceivable` continua cheio;
- o retry não corrige, porque retorna sucesso ao ver o contrato já cancelado.

Esse mesmo mecanismo explica a prorrogação que não persiste, o estorno que não deixa estado e o status `Atrasada` que nunca é gravado.

### Números confirmados em produção

| Regra | Ocorrências |
|---|---:|
| Contratos cancelados com valor a receber > 0 | **9** |
| Contratos cancelados com parcelas vivas | **5** |
| Parcelas prorrogadas em contratos não prorrogados | **35** |
| Parcelas em aberto/prorrogadas já vencidas sem status `Atrasada` | **24** |
| `amountPaid` divergente do líquido de `payments` | **13** |
| Contratos com `amountReceivable` divergente do saldo real | **6** |
| Pagamentos sem transação financeira | **6** |
| Número de parcela duplicado | **1** |
| Estornos com inconsistência na parcela | **0** |
| Contratos quitados com parcela aberta | **0** |

---

## 2. Modelo envolvido

### 2.1 Tabelas

| Tabela | Papel |
|---|---|
| `contracts` | Cabeçalho financeiro: `contractValue`, `amountReceived`, `amountReceivable`, `status` |
| `installments` | Títulos: `amount`, `amountPaid`, `dueDate`, `status`, `original_due_date` |
| `payments` | Histórico de pagamentos e estornos (`type = 'payment' | 'reversal'`) |
| `financial_transactions` | Caixa: receita/despesa, saldo de conta |
| `contract_receivables_summary` | View usada por Contas a Receber |

### 2.2 Funções aplicadas em produção

| Função | Papel |
|---|---|
| `process_installment_payment` (9 args) | Baixa total/parcial + caixa + recálculo |
| `process_installment_payment` (7 args, legado) | Versão antiga, sem caixa e sem recálculo |
| `rpc_recebimento_com_desdobramento` | Antecipação com criação de parcela residual |
| `process_installment_estorno` | Estorno de parcela |
| `process_contract_cancellation` | Cancelamento transacional |
| `fn_recalculate_contract_totals` | Gatilho de recálculo do contrato |
| `fn_protect_contracts_status` | Gatilho de proteção de status |
| `prevent_update_delete_paid_contract` | Bloqueio de alteração de contrato quitado |
| `prevent_update_delete_paid_installment` | Bloqueio de alteração de parcela quitada |

### 2.3 Gatilhos ativos

| Tabela | Gatilho | Momento |
|---|---|---|
| `contracts` | `audit_contracts` | AFTER INSERT/DELETE/UPDATE |
| `contracts` | `prevent_update_delete_paid_contract_trigger` | BEFORE DELETE/UPDATE |
| `contracts` | `trg_contracts_status_protection` | BEFORE DELETE/UPDATE |
| `contracts` | `trg_protect_contracts_status` | BEFORE UPDATE OF status |
| `installments` | `audit_installments` | AFTER INSERT/DELETE/UPDATE |
| `installments` | `prevent_update_delete_paid_installment_trigger` | BEFORE DELETE/UPDATE |
| `installments` | `trg_recalculate_contract_on_installment` | AFTER INSERT/DELETE/UPDATE |

> Observação: há **dois** gatilhos de proteção de status no contrato chamando a mesma função. Em toda mudança de status a função roda duas vezes.

### 2.4 Divergência entre repositório e produção

| Item | Repositório | Produção |
|---|---|---|
| `payments.id` | `BIGINT IDENTITY` | **UUID** |
| `payments.payment_date` | `DATE` | **timestamptz** |
| `payments` usuário | `created_by` | **`user_id`** (função legada) |
| CHECK de status do contrato | existe | **não existe** |

As migrações do repositório **não são a fonte da verdade** do banco. Toda correção deve ser escrita contra o schema real.

---

## 3. Causa raiz

### 3.1 `fn_recalculate_contract_totals` (produção)

```sql
v_contract_id := NEW.contract_id;
-- ...
UPDATE contracts
SET "amountReceived"   = v_total_received,
    "amountReceivable" = GREATEST(0, v_contract_value - v_total_received),
    status = CASE
               WHEN v_total_received >= v_contract_value THEN 'Quitado'
               WHEN v_total_received > 0                  THEN 'Parcial'
               ELSE 'Aberto'
             END
WHERE id = v_contract_id;
```

Problemas:

1. **Nunca produz** `Cancelado`, `Estornado` ou `Prorrogado`.
2. **Ignora o status das parcelas** no cálculo do "a receber".
3. Em `DELETE`, usa `NEW.contract_id`, que não existe — a exclusão de parcela quebra o gatilho.
4. Roda a cada linha em atualizações em lote (N execuções).

### 3.2 `fn_protect_contracts_status` (produção)

```sql
IF v_old IN ('quitado', 'cancelado', 'cancelada')
   AND v_new NOT IN ('quitado', 'cancelado', 'cancelada') THEN
  RAISE EXCEPTION 'BLOQUEADO: ...';
END IF;
```

Bloqueia `Cancelado → Aberto/Parcial/Quitado/Estornado` e `Quitado → Estornado`.

### 3.3 `prevent_update_delete_paid_contract` (produção)

Bloqueia qualquer alteração financeira em contrato `Quitado`, inclusive a transição para `Estornado` (só permite `Cancelado`).

### 3.4 `prevent_update_delete_paid_installment` (produção)

Permite `Quitado → Cancelada`, mas bloqueia qualquer outra atualização de parcela quitada.

### 3.5 Cadeia do cancelamento

1. `performFallbackCancellation` atualiza `contracts.status = 'Cancelado'` e comita.
2. Atualiza `installments.status = 'Cancelada'`.
3. `trg_recalculate_contract_on_installment` dispara.
4. `fn_recalculate_contract_totals` tenta gravar `Aberto` no contrato.
5. `fn_protect_contracts_status` lança `BLOQUEADO`.
6. A atualização das parcelas é desfeita.
7. Contrato fica `Cancelado`; parcelas ficam abertas; valor a receber fica cheio.
8. Retry cai em `lib/supabase.ts:210-213` e retorna sucesso sem corrigir nada.

---

## 4. Diagnóstico por rotina

### 4.1 Cancelamento

**Duas vias, nenhuma íntegra:**

| Via | Comportamento |
|---|---|
| Modal (`processContractCancellation`) | Sempre usa fallback no navegador; ignora o RPC (`lib/supabase.ts:203-204`) |
| Select "Status do Contrato" na edição | Altera apenas `contracts`; não toca nas parcelas (`app/contratos/page.tsx:2039-2060`) |
| RPC `process_contract_cancellation` | Único atômico, mas não zera `amountReceivable` e grava parcela `Cancelado` |

**Problemas adicionais:**

- Fallback não é atômico e não confere linhas afetadas (`.select()` ausente).
- Fallback não zera `amountReceivable` (`lib/supabase.ts:241-250`).
- Retry não repara parcelas (`lib/supabase.ts:210-213`).
- RPC rejeita contrato com parcela `Prorrogada` e não é idempotente.
- Precedência visual: `Estornado` vence `Cancelado` (`app/contratos/page.tsx:1544-1550`).

### 4.2 Quitação

- `process_installment_payment` (9 args) funciona no caminho feliz.
- `fn_recalculate_contract_totals` recalcula com base em `contractValue`, não na soma das parcelas.
- `bool_and(status IN ('Quitado','Cancelado'))` ignora `Cancelada`.
- Existe uma **segunda sobrecarga legada** de `process_installment_payment` (7 args) que grava em `payments.user_id`, **não grava caixa** e **não recalcula o contrato**. É uma armadilha latente.

### 4.3 Antecipação / desdobramento

`rpc_recebimento_com_desdobramento`:

- **não grava `payments`** (só `financial_transactions`);
- **não atualiza o contrato**;
- sobrescreve `installments.amount` da parcela original;
- cria a residual com o **mesmo `installmentNumber`** (duplicidade);
- bloqueia apenas `status = 'Cancelado'`, não `Cancelada`.

Isso explica parte das 13 divergências de `amountPaid` e a duplicidade encontrada.

### 4.4 Prorrogação

- Em Contas a Receber, altera `dueDate` + `status = 'Prorrogada'` e **não atualiza o contrato** (`app/contas-a-receber/page.tsx:1195-1219`).
- Em Contratos, alterar a data marca a parcela como `Prorrogada` (`app/contratos/page.tsx:1059-1062`).
- O gatilho de recálculo regrava o contrato como `Aberto`/`Parcial`, apagando `Prorrogado`.
- A projeção futura ignora `Prorrogada` (`supabase/migrations/20260618140000_create_projection_function.sql:17`).

### 4.5 Estorno

- Zera todo o `amountPaid` e apaga **apenas uma** transação financeira (`ORDER BY id DESC LIMIT 1`).
- Insere `reversal` com o valor total e `CURRENT_DATE`.
- Contrato é recalculado para `Aberto`/`Parcial`/`Quitado`, **nunca permanece `Estornado`**.
- Estorno de contrato `Quitado` é bloqueado pelos dois gatilhos de proteção.
- No front, update forçado com chave errada `'"amountPaid"'` e `setTimeout` de 800/2000 ms (`app/contratos/page.tsx:957-1043`).
- Extrato soma `reversal` como recebimento (`ContractStatementModal.tsx:49-56,103`).

### 4.6 Atraso

- Nenhuma rotina grava `Atrasada`.
- O dashboard calcula atraso dinamicamente (`app/page.tsx:583`).
- Os RPCs de resumo do cliente somam apenas `status = 'Atrasada'` (`create_rpc_clients_summary.sql:55`).
- Resultado: dashboard e relatórios divergem; 24 parcelas vencidas sem status.

---

## 5. Catálogo de bugs

| ID | Descrição | Evidência | Impacto |
|---|---|---|---|
| B1 | Recálculo sobrescreve status do contrato | `fn_recalculate_contract_totals` | Cancela/prorroga/estorna de forma inconsistente |
| B2 | Recálculo calcula a receber por `contractValue − pago` | idem | Valor fantasma em cancelados |
| B3 | Proteção bloqueia `Cancelado → Aberto` | `fn_protect_contracts_status` | Desfaz cancelamento das parcelas |
| B4 | Fallback não atômico | `lib/supabase.ts:241-270` | Estado parcial |
| B5 | Retry cego | `lib/supabase.ts:210-213` | Não repara |
| B6 | Fallback não zera valores | `lib/supabase.ts:241-250` | "A receber" cheio |
| B7 | Segunda via de cancelamento | `app/contratos/page.tsx:2039-2060` | Parcelas ficam vivas |
| B8 | Update sem conferir linhas | `lib/supabase.ts:241-270` | Sucesso falso |
| B9 | Grafia `Cancelado`/`Cancelada` | RPC, view, filtros | Parcela cancelada conta como aberta |
| B10 | View usa valor armazenado | `supabase_migrations.sql:1285` | Repete o erro na tela |
| B11 | Projeção ignora `Prorrogada` | migração 20260618140000 | Previsão subestimada |
| B12 | Prorrogação não atualiza contrato | `app/contas-a-receber/page.tsx:1195-1219` | Contrato `Aberto` com parcela prorrogada |
| B13 | Estorno apaga uma transação e reverte o total | `process_installment_estorno` | Caixa sem lastro |
| B14 | Estorno bloqueado em contrato quitado | `fn_protect_contracts_status` + `prevent_update_delete_paid_contract` | Estorno impossível |
| B15 | Estorno com chave `'"amountPaid"'` | `app/contratos/page.tsx:962-969` | Update inócuo |
| B16 | Desdobramento sem `payments` e sem recálculo | `rpc_recebimento_com_desdobramento` | Histórico e totais errados |
| B17 | Lote com assinatura inexistente | `app/contas-a-receber/page.tsx:195-201` | Lote sempre falha |
| B18 | Extrato soma reversões | `ContractStatementModal.tsx:49-56,103` | Recebido inflado |
| B19 | Precedência de cor | `app/contratos/page.tsx:1544-1550` | Cancelado aparece como Estornado |
| B20 | Sem CHECK de status do contrato | schema real | `Prorrogado`/qualquer valor aceito |
| B21 | Dois gatilhos de proteção iguais | schema real | Execução dupla |
| B22 | `DELETE` usa `NEW` no gatilho | `fn_recalculate_contract_totals` | Exclusão de parcela quebra |
| B23 | Sobrecarga legada de pagamento | schema real | Pagamento sem caixa/recálculo |
| B24 | Atraso não persistido | ausência de rotina | Relatórios divergentes |

---

## 6. Evidências de dados (produção)

### 6.1 Auditoria R1–R18

| Regra | Descrição | Ocorrências |
|---|---|---:|
| R1 | Contratos cancelados com valor a receber > 0 | 9 |
| R2 | Contratos cancelados com parcelas vivas | 5 |
| R3 | Contratos cancelados com parcela paga | 0 |
| R4 | Parcelas canceladas com valor pago | 0 |
| R5 | Contratos quitados com parcela aberta | 0 |
| R6 | Parcelas quitadas com valor pago menor que o valor | 0 |
| R7 | `amountReceived` divergente da soma das parcelas | 1 |
| R8 | `amountReceivable` divergente do saldo real | 6 |
| R9 | Parcelas estornadas com valor pago | 0 |
| R10 | Parcelas estornadas sem `reversal` | 0 |
| R11 | Contratos prorrogados sem parcela prorrogada | 0 |
| R12 | Parcelas prorrogadas com contrato não prorrogado | **35** |
| R13 | Parcelas em aberto/prorrogadas já vencidas | **24** |
| R14 | Parcelas atrasadas com vencimento futuro | 0 |
| R15 | Números de parcela duplicados | 1 |
| R16 | Pagamentos sem transação financeira | 6 |
| R17 | `amountPaid` divergente do líquido de `payments` | 13 |
| R18 | Status fora do domínio | 0 |

### 6.2 Distribuição de status

**Contratos (122):** `Quitado` 61 · `Aberto` 43 · `Cancelado` 9 · `Parcial` 7 · `Prorrogado` 2

**Parcelas (166):** `Quitado` 100 · `Prorrogada` 41 · `Aberto` 16 · `Cancelada` 5 · `Parcial` 4

Observações:

- Não existe `Cancelado` (masculino) nos dados: a grafia divergente é **latente**.
- Não existe `Atrasada` nem `Estornado`: esses estados nunca são persistidos.
- 41 parcelas prorrogadas em apenas 2 contratos prorrogados.

### 6.3 Estornos antigos

Seis registros `reversal` entre março e abril/2026, com descrições de teste (`"teste"`, `"este"`, `"SSGFSFD"`). A parcela 147 tem duas reversões (R$ 1.600 e R$ 2.000). Nenhum estorno recente deixou rastro.

---

## 7. Impacto

| Dimensão | Impacto |
|---|---|
| Financeiro | Contratos cancelados continuam em "a receber"; previsão de 30 dias superestimada |
| Contábil | Estorno com valor total e baixa de uma única transação gera caixa sem lastro |
| Operacional | Prorrogação não reflete no contrato; atraso não aparece nos relatórios |
| Auditoria | Estado parcial entre contrato e parcelas; histórico de `payments` incompleto |
| Confiabilidade | Telas diferentes mostram números diferentes para o mesmo contrato |

---

## 8. Correções propostas (não aplicadas)

> Todos os blocos abaixo são **propostas**. Nada foi executado.

### 8.1 Corrigir `fn_recalculate_contract_totals`

```sql
CREATE OR REPLACE FUNCTION public.fn_recalculate_contract_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_contract_id    BIGINT;
  v_received       NUMERIC(12,2);
  v_open           NUMERIC(12,2);
  v_current        TEXT;
  v_new_status     TEXT;
  v_all_cancelled  BOOLEAN;
  v_has_estornado  BOOLEAN;
  v_has_prorrogada BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT status INTO v_current
    FROM contracts
   WHERE id = v_contract_id
     FOR UPDATE;

  SELECT
      COALESCE(SUM("amountPaid"), 0),
      COALESCE(SUM(GREATEST(amount - COALESCE("amountPaid", 0), 0)) FILTER (
          WHERE lower(status) NOT IN ('quitado','cancelado','cancelada','estornado')
      ), 0),
      COALESCE(COUNT(*) > 0 AND bool_and(lower(status) IN ('cancelado','cancelada')), false),
      COALESCE(bool_or(lower(status) = 'estornado'), false),
      COALESCE(bool_or(lower(status) IN ('prorrogada','prorrogado')), false)
  INTO v_received, v_open, v_all_cancelled, v_has_estornado, v_has_prorrogada
  FROM installments
  WHERE contract_id = v_contract_id;

  IF lower(COALESCE(v_current, '')) IN ('cancelado','cancelada') OR v_all_cancelled THEN
      v_new_status := 'Cancelado';
      v_open := 0;
  ELSIF v_has_estornado THEN
      v_new_status := 'Estornado';
  ELSIF v_open <= 0.01 AND v_received > 0 THEN
      v_new_status := 'Quitado';
  ELSIF v_received > 0 THEN
      v_new_status := 'Parcial';
  ELSIF v_has_prorrogada THEN
      v_new_status := 'Prorrogado';
  ELSE
      v_new_status := 'Aberto';
  END IF;

  UPDATE contracts
     SET "amountReceived"   = v_received,
         "amountReceivable" = v_open,
         status             = v_new_status
   WHERE id = v_contract_id
     AND (status IS DISTINCT FROM v_new_status
          OR "amountReceived" IS DISTINCT FROM v_received
          OR "amountReceivable" IS DISTINCT FROM v_open);

  RETURN NULL;
END;
$$;
```

### 8.2 Ajustar as funções de proteção

`fn_protect_contracts_status` precisa permitir os estados de encerramento:

```sql
IF v_new IN ('cancelado','cancelada','estornado') THEN
  RETURN NEW;
END IF;

IF v_old IN ('quitado','cancelado','cancelada','estornado')
   AND v_new NOT IN ('quitado','cancelado','cancelada','estornado') THEN
  RAISE EXCEPTION 'BLOQUEADO: OLD=% , NEW=%', OLD.status, NEW.status;
END IF;
```

`prevent_update_delete_paid_contract` precisa permitir `Quitado → Estornado`:

```sql
IF OLD.status = 'Quitado' THEN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Não é possível excluir um contrato quitado.';
  END IF;
  IF NEW.status NOT IN ('Quitado','Cancelado','Estornado') THEN
    RAISE EXCEPTION 'Não é possível reabrir um contrato quitado.';
  END IF;
  IF NEW.status = OLD.status AND (
       OLD."contractValue" <> NEW."contractValue"
       OR OLD."installmentsCount" <> NEW."installmentsCount"
       OR COALESCE(OLD."paymentMethod",'') <> COALESCE(NEW."paymentMethod",'')
     ) THEN
    RAISE EXCEPTION 'Não é possível alterar dados financeiros de um contrato quitado.';
  END IF;
END IF;
```

> Decisão de negócio pendente: permitir ou não reabrir contrato `Estornado` com novo pagamento.

### 8.3 Cancelamento único e idempotente

```sql
CREATE OR REPLACE FUNCTION public.process_contract_cancellation(
  p_contract_id BIGINT, p_reason TEXT, p_user_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_contract RECORD;
  v_paid NUMERIC(12,2);
BEGIN
  SELECT * INTO v_contract FROM contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato % não encontrado.', p_contract_id;
  END IF;

  SELECT COALESCE(SUM("amountPaid"),0) INTO v_paid
    FROM installments WHERE contract_id = p_contract_id;

  IF v_paid > 0 THEN
    RAISE EXCEPTION 'Contrato possui parcelas recebidas. Estorne antes de cancelar.';
  END IF;

  UPDATE installments
     SET status = 'Cancelada', "amountPaid" = 0, updated_by = p_user_id
   WHERE contract_id = p_contract_id
     AND lower(status) NOT IN ('quitado','cancelada');

  UPDATE contracts
     SET status = 'Cancelado',
         "amountReceivable" = 0,
         "commissionValue" = 0,
         "commissionPaid" = false,
         observations = COALESCE(observations,'') || E'\n\n[CANCELAMENTO]: ' || p_reason,
         updated_by = p_user_id
   WHERE id = p_contract_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
```

No aplicativo:

- chamar o RPC em `lib/supabase.ts:203-204`;
- remover o retorno antecipado em `lib/supabase.ts:210-213`;
- eliminar a segunda via (`app/contratos/page.tsx:2039-2060`) ou fazê-la chamar o RPC;
- usar `.select('id')` e conferir linhas afetadas.

### 8.4 View corrigida

```sql
CREATE OR REPLACE VIEW public.contract_receivables_summary AS
SELECT
    c.id                                        AS contract_id,
    cl.name                                     AS client_name,
    c."processNumber",
    c."contractValue"                           AS contract_value,
    c."amountReceived"                          AS amount_received,
    CASE WHEN lower(c.status) IN ('cancelado','cancelada') THEN 0
         ELSE COALESCE(agg.open_amount,0) END   AS amount_to_receive,
    CASE WHEN lower(c.status) IN ('cancelado','cancelada') THEN NULL
         ELSE agg.next_due_date END             AS next_due_date,
    c.status                                    AS contract_status,
    c.environment
FROM contracts c
JOIN clients cl ON cl.id = c.client_id
LEFT JOIN LATERAL (
    SELECT
        SUM(GREATEST(i.amount - COALESCE(i."amountPaid",0),0)) FILTER (
            WHERE lower(i.status) NOT IN ('quitado','cancelado','cancelada','estornado')
        ) AS open_amount,
        MIN(i."dueDate") FILTER (
            WHERE lower(i.status) NOT IN ('quitado','cancelado','cancelada','estornado')
        ) AS next_due_date
    FROM installments i
    WHERE i.contract_id = c.id
) agg ON true;
```

### 8.5 Constraints

Depois de normalizar os dados:

```sql
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS check_contract_status;
ALTER TABLE contracts ADD CONSTRAINT check_contract_status
  CHECK (status IN ('Aberto','Parcial','Quitado','Cancelado','Estornado','Prorrogado'));

ALTER TABLE installments DROP CONSTRAINT IF EXISTS check_installment_status;
ALTER TABLE installments ADD CONSTRAINT check_installment_status
  CHECK (status IN ('Aberto','Parcial','Atrasada','Prorrogada','Quitado','Cancelada','Estornado'));
```

### 8.6 Estorno com vínculo por ID

```sql
ALTER TABLE payments ADD COLUMN IF NOT EXISTS financial_transaction_id BIGINT
  REFERENCES financial_transactions(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reverses_payment_id UUID
  REFERENCES payments(id) ON DELETE SET NULL;
```

Regras:

1. apagar exatamente a transação referenciada, não por aproximação;
2. inserir reversão referenciando o pagamento original;
3. `amountPaid = 0`, `status = 'Estornado'`;
4. recalcular o contrato (a função corrigida preserva `Estornado`);
5. recusar segundo estorno.

### 8.7 Desdobramento

1. gravar também em `payments`;
2. chamar o recálculo ao final;
3. não sobrescrever `installments.amount` da parcela original;
4. gerar a residual com numeração nova;
5. bloquear `Cancelado` **e** `Cancelada`.

### 8.8 Ajustes no aplicativo

| Arquivo | Correção |
|---|---|
| `lib/supabase.ts:203-204` | Chamar o RPC; fallback só se a função não existir |
| `lib/supabase.ts:210-213` | Substituir retorno cego por reparo + conferência |
| `lib/supabase.ts:241-270` | `.select('id')` e validar linhas |
| `app/contratos/page.tsx:2039-2060` | Unificar com o RPC |
| `app/contratos/page.tsx:1544-1550` | `Cancelado` antes de `Estornado` |
| `app/contratos/page.tsx:613-641` | Aceitar `Cancelada` em `allCanceled` |
| `app/contratos/page.tsx:962-969` | Remover `'"amountPaid"'` e `setTimeout` |
| `app/contas-a-receber/page.tsx:195-201` | Corrigir assinatura do lote |
| `app/contas-a-receber/page.tsx:367-368` | Excluir `Cancelado` e `Estornado` da previsão |
| `app/contas-a-receber/page.tsx:1195-1219` | Refletir prorrogação no contrato |
| `app/contas-a-receber/page.tsx:1402` | Recarregar contratos e KPIs |
| `ContractStatementModal.tsx:49-56,103` | Somar só `payment`, subtrair `reversal` |

---

## 9. Reparação dos registros existentes

> Executar **somente após** aplicar a função corrigida (8.1). Caso contrário, o gatilho de proteção bloqueia a atualização das parcelas.

### Fase 0 — Backup

```sql
CREATE TABLE backup_contracts_20261121    AS SELECT * FROM contracts;
CREATE TABLE backup_installments_20261121 AS SELECT * FROM installments;
CREATE TABLE backup_payments_20261121     AS SELECT * FROM payments;
```

### Fase 1 — Normalização de grafia

```sql
UPDATE installments SET status = 'Cancelada' WHERE status = 'Cancelado';
UPDATE contracts    SET status = 'Cancelado' WHERE status = 'Cancelada';
```

### Fase 2 — Cancelados (9 contratos / 5 parcelas vivas)

```sql
BEGIN;

UPDATE installments i
   SET status = 'Cancelada'
 WHERE i.contract_id IN (
         SELECT id FROM contracts WHERE lower(status) IN ('cancelado','cancelada')
       )
   AND lower(i.status) NOT IN ('quitado','cancelada');

-- conferência antes do commit
SELECT c.id, c.status, c."amountReceivable",
       (SELECT COUNT(*) FROM installments x
         WHERE x.contract_id = c.id
           AND lower(x.status) NOT IN ('quitado','cancelado','cancelada','estornado')) AS vivas
FROM contracts c
WHERE lower(c.status) IN ('cancelado','cancelada');

ROLLBACK;
```

### Fase 3 — Prorrogação (35 parcelas)

Decisão de negócio: manter `Prorrogado` no contrato ou tratar apenas como estado da parcela. Se manter:

```sql
UPDATE contracts c
   SET status = 'Prorrogado'
 WHERE EXISTS (
       SELECT 1 FROM installments i
        WHERE i.contract_id = c.id
          AND lower(i.status) IN ('prorrogada','prorrogado')
     )
   AND NOT EXISTS (
       SELECT 1 FROM installments i
        WHERE i.contract_id = c.id AND COALESCE(i."amountPaid",0) > 0
     )
   AND lower(c.status) NOT IN ('cancelado','cancelada','quitado');
```

### Fase 4 — Atraso (24 parcelas)

Decisão: rotina diária ou cálculo dinâmico. Se rotina:

```sql
UPDATE installments
   SET status = 'Atrasada'
 WHERE lower(status) IN ('aberto','aberta','prorrogada','prorrogado')
   AND "dueDate"::date < CURRENT_DATE
   AND COALESCE("amountPaid",0) = 0;
```

### Fase 5 — Duplicidade (1 caso)

Revisão manual. O desdobramento cria a residual com o mesmo número; decidir se renumera ou se aceita sufixo.

### Fase 6 — `payments` × caixa (6 + 13)

Reconciliação manual. A correspondência por valor/data/conta é heurística; não corrigir em massa sem conferência.

---

## 10. Critérios de aceite

| Cenário | Resultado esperado |
|---|---|
| Cancelar contrato sem pagamento | Contrato `Cancelado`, `amountReceivable = 0`, todas as parcelas `Cancelada`, linha vermelha |
| Repetir o cancelamento | Idempotente, sem erro, estado mantido |
| Cancelar contrato com parcela paga | Bloqueado com mensagem clara |
| Prorrogar parcela | `dueDate` novo, `original_due_date` preservado, contrato `Prorrogado` |
| Estornar parcela | `amountPaid = 0`, `status = 'Estornado'`, contrato `Estornado`, caixa revertido |
| Estornar contrato quitado | Permitido conforme decisão de negócio |
| Desdobrar parcela | Residual criada, `payments` gravado, contrato recalculado |
| Receber em lote | Todas as parcelas processadas com caixa |
| Parcela vencida | `Atrasada` (se rotina) ou refletida nos relatórios |
| Contrato cancelado em Contas a Receber | Não aparece em "a receber" nem na projeção |

---

## 11. Ordem de implantação

1. Backup das tabelas.
2. Corrigir `fn_recalculate_contract_totals`.
3. Ajustar `fn_protect_contracts_status` e `prevent_update_delete_paid_contract`.
4. Corrigir a view.
5. Substituir o RPC de cancelamento e o wrapper do app.
6. Reparar dados (fases 1 a 6), uma por vez, com ensaio e `ROLLBACK`.
7. Corrigir estorno, desdobramento e lote.
8. Ajustes visuais e de recarga no front.
9. Rodar os critérios de aceite em ambiente controlado.

---

## 12. Anexo — SQL de auditoria (somente leitura)

```sql
-- Resumo R1–R18: ver bloco de auditoria entregue em 21/11/2026.
-- Contagem de status:
SELECT 'contracts' AS tabela, COALESCE(status,'(nulo)') AS status, COUNT(*) AS qtd
FROM contracts
GROUP BY COALESCE(status,'(nulo)')
UNION ALL
SELECT 'installments', COALESCE(status,'(nulo)'), COUNT(*)
FROM installments
GROUP BY COALESCE(status,'(nulo)')
ORDER BY tabela, qtd DESC;
```

---

## 13. Declaração de não-alteração

Este documento é **exclusivamente diagnóstico**. Nenhum código-fonte, função SQL, gatilho, constraint, view, dado ou deploy foi alterado durante a análise. As correções e reparos descritos são propostas sujeitas a autorização explícita.

---

## 14. Retomada

O estado consolidado das correções já aplicadas, o código local pendente de publicação, o SQL de aceite e as pendências estão em:

**`docs/HANDOFF-CONTRATOS-CONTAS-A-RECEBER-20261121.md`**

Consultar esse arquivo antes de continuar qualquer atividade nesta série.
