# Plano — estorno com colapso da árvore de parcelas (26/11/2026)

> **PREPARADO, NÃO EXECUTADO.** Nenhum SQL foi rodado pelo agente.
> Decisões do usuário em 26/11/2026:
>
> 1. A subparcela é **marcada como `Reabsorvida`** (não é excluída);
> 2. A rotina **só permite o colapso se nenhuma subparcela tiver valor pago**;
> 3. O botão só é habilitado quando **todas as folhas ativas da subárvore estão
>    `Estornado` com `Pago = 0`** (regra B).

---

## 1. Objetivo

Hoje só a **folha** pode ser estornada. Este plano acrescenta a operação de
**reverter o desdobramento**: estornar uma parcela mãe e, em uma transação só,
devolver o saldo a ela e marcar a subparcela como `Reabsorvida`, removendo-a da
árvore e da tela. O processo pode ser repetido nível por nível até a raiz.

Exemplo do contrato 138, após o estorno da folha:

```
2       3.000 / pago 1.000  → saldo na 2.1
2.1     2.000 / pago 1.000  → saldo na 2.1.1
2.1.1   1.000 / pago   500  → saldo na 2.1.1.1   ← candidata ao colapso
2.1.1.1   500 / pago     0  → Estornado (folha)
```

Ao colapsar a `2.1.1`: a `2.1.1.1` vira `Reabsorvida` e sai da tela; a `2.1.1`
volta a ter `Pago = 0`, `Estornado`, devendo **1.000**. Em seguida a `2.1` passa
a ser a folha elegível, e depois a `2`.

---

## 2. Regras da rotina

### 2.1 Elegibilidade (regra B)

A RPC `process_installment_estorno_colapso(p_installment_id, p_reason,
p_account_id, p_user_id)` só aceita se:

- a parcela alvo tiver `amountPaid > 0`;
- **todos os descendentes ativos** (excluindo `Reabsorvida`, `Cancelada`,
  `Cancelado`) tiverem `amountPaid = 0`;
- **todas as folhas ativas** da subárvore tiverem `status = 'Estornado'`.

Se a folha estiver `Aberto` (residual nunca recebida) ou se algum descendente
tiver pago, a rotina **aborta com mensagem clara** e não altera nada.

### 2.2 Efeitos (uma transação)

1. Travar a parcela alvo com `FOR UPDATE`.
2. Estornar o pagamento da alvo: `Pago = 0`, juros/multa zero, `Estornado`,
   excluir a transação `income` vinculada e gravar `payments.type = 'reversal'`.
3. Marcar todos os descendentes ativos como `Reabsorvida`: `amount = 0`,
   `Pago = 0`, juros/multa zero, `parent_installment_id = null`,
   `installment_path = null`. **A linha permanece**, preservando auditoria e o
   vínculo dos `payments` de reversão.
4. Recalcular `amountReceived`/`amountReceivable`/`status` do contrato **uma vez
   no fim**, ignorando linhas `Reabsorvida`.
5. Gravar observação `[ESTORNO-COLAPSO]` no contrato.

Nada é `DELETE`ado. Nenhum dado é alterado pelo agente.

---

## 3. Arquivos preparados

| Arquivo | Função |
|---|---|
| `docs/FORWARD-ESTORNO-COLAPSO-ARVORE-20261126.sql` | cria a RPC nova (você roda no SQL Editor) |
| `docs/VERIFY-ESTORNO-COLAPSO-ARVORE-20261126.sql` | checagem estrutural, somente leitura |
| `docs/ROLLBACK-ESTORNO-COLAPSO-ARVORE-20261126.sql` | remove somente a RPC |
| `docs/FORWARD-CHECK-REABSORVIDA-20261127.sql` | patch da constraint em `test` (o `FORWARD` completo já traz o passo) |
| `docs/ROLLBACK-CHECK-REABSORVIDA-20261127.sql` | restaura a constraint (sem linhas `Reabsorvida`) |

Rollback **não desfaz** colapsos já usados: linhas `Reabsorvida` exigiriam
decisão e autorização separadas para voltar à árvore.

---

## 4. Ordem de execução

1. **Código do front primeiro** (item 5), com `tsc`/`eslint`.
2. Você roda o `FORWARD` em **test** e cola o resultado.
3. Você roda o `VERIFY` em **test** e cola o resultado.
   - Em `test`, se o `FORWARD` original já tiver sido rodado antes da correção
     da constraint, aplicar `FORWARD-CHECK-REABSORVIDA-20261127.sql` antes do
     teste funcional (o `FORWARD` completo já contém esse passo).
4. Teste funcional em **test** (item 6).
5. Só depois: `FORWARD` + `VERIFY` em **production** e commit/publicação, com
   pedido explícito.

---

## 5. Mudança no front (`app/contas-a-receber/page.tsx`)

- Ocultar linhas com `status = 'Reabsorvida'` em
  `fetchInstallmentsForContract`.
- Helper `getActiveDescendants(i)`: navigate por `parent_installment_id`,
  ignorando `Reabsorvida`/`Cancelada`/`Cancelado`.
- Helper `canCollapse(i)`: `Pago > 0` + descendentes com `Pago = 0` + folhas
  `Estornado`.
- `getInstallmentRole` passa a devolver `canCollapse`.
- Botão `Estornar`:
  - **sem filha** → RPC atual `process_installment_estorno`;
  - **com filha e `canCollapse`** → habilitado, abre confirmação com a quantidade
    de subparcelas que serão reabsorvidas e chama
    `process_installment_estorno_colapso`;
  - **com filha e sem `canCollapse`** → desabilitado, com aviso da regra B.

---

## 6. Critérios de teste em `test`

| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Estornar folha `2.1.1.1` | `Estornado`, `Pago = 0`; `2.1.1` liberada |
| 2 | Estornar `2.1.1` com folha estornada | `2.1.1.1` vira `Reabsorvida` e desaparece; `2.1.1` com `Pago = 0`, `Estornado`, devendo 1.000 |
| 3 | Repetir em `2.1` e `2` | Cada nível volta a dever o valor cheio; contrato volta ao estado original |
| 4 | Folha `Aberto` com `Pago = 0` (nunca recebida) | Botão da mãe **continua bloqueado** |
| 5 | Algum descendente com `Pago > 0` | RPC aborta; nenhuma linha alterada |
| 6 | Após cada colapso | `a receber` do contrato = soma das linhas em aberto; sem saldo duplicado |
| 7 | Console do navegador | Sem erros vermelhos |

---

## 7. Restrições lembradas

- Nenhum `UPDATE`/`DELETE` em dados de negócio sem autorização explícita.
- Nenhuma credencial no chat; senha apenas no terminal.
- Sem dumps ou linhas completas de prévia; totais e contagens apenas.
- Não atualizar Supabase CLI de `2.75.0` para `v3.4.0`.
- Não comitar/publicar sem pedido explícito.
- Toda rotina declara/filtra/traz `environment`.

---

## 8. Adendo de 27/11 — regra unificada aplicada (substitui B)

> Atualizado em 27/11: a regra A foi aprovada e implementada no front e na RPC.
> Ela **engloba** a regra B: basta que nenhum descendente ativo tenha `Pago > 0`;
> folha `Aberto` ou `Estornado` com `Pago = 0` são elegíveis.
>
> Arquivos: `FORWARD-REGRA-A-ESTORNO-COLAPSO-20261127.sql`,
> `VERIFY-REGRA-A-ESTORNO-COLAPSO-20261127.sql` e
> `ROLLBACK-REGRA-A-ESTORNO-COLAPSO-20261127.sql`. O `FORWARD` original também
> foi atualizado para a v2.

### Histórico do impasse que motivou a mudança

A regra B (exigir folhas `Estornado`) foi implementada e gerou um impasse real:
a parcela `2` pagou 1.000 e gerou a `2.1` de 2.000, mas a `2.1` está `Aberto`
com `Pago = 0`. Como não há pago nela, ela não pode ser estornada; exigir que
ela esteja `Estornado` deixa a `2` sem possibilidade de colapso.

**Proposta (não implementada):** adotar a **regra A** — o colapso é permitido
quando **nenhum descendente ativo tiver `Pago > 0`**, aceitando folhas
`Aberto` ou `Estornado`. Isso reflete a operação correta: o que se desfaz é o
desdobramento da mãe, não um pagamento da folha.

Mudanças necessárias quando aprovada:

1. `canCollapse` no front: remover a exigência de `status === 'estornado'`,
   mantendo a checagem de `amountPaid = 0` na subárvore.
2. RPC `process_installment_estorno_colapso`: remover o `if v_folhas_invalidas > 0`
   (a verificação de `v_desc_pago <> 0` permanece).
3. Renomear a ação das parcelas com filha para **“Desfazer desdobramento”**,
   preservando “Estornar” para folhas com pago.
4. Novo `FORWARD`/`VERIFY`/`ROLLBACK` para a RPC, com testes em `test`.

Registrado em `docs/HANDOFF-NOITE-20261127.md` §5. Nada foi alterado no banco
nem no front além do que já está publicado.
