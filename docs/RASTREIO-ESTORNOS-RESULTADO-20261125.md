# Rastreio forense das reversões — resultado confirmado (25/11/2026)

> **Atenção: este arquivo é Markdown, não SQL.** Não cole este conteúdo no SQL
> Editor — o `#` do título causa `ERROR: 42601: syntax error at or near "#"`.
> O script executável é `docs/RASTREIO-ESTORNOS-20261125.sql`
> (célula `rastreio_reversoes_20261125`), que já foi rodado e interpretado.

Fonte: célula `rastreio_reversoes_20261125` de
`docs/RASTREIO-ESTORNOS-20261125.sql`, executada em produção pelo usuário às
`2026-11-25T18:50:55.180187+00:00` (PG 17.6). O script é somente leitura e
termina em `rollback`. **Nenhuma alteração foi feita**; nenhum
`INSERT`/`UPDATE`/`DELETE` foi executado. Nenhum vínculo foi gravado e nenhum
saldo foi baixado.

Este documento é a continuação de
`docs/DIAGNOSTICO-CONTAS-A-RECEBER-RESULTADO-20261125.md` e segue o mesmo padrão:
**fato confirmado**, **classificação** e **decisão ainda em aberto**.

---

## 1. Resumo executivo

| Pergunta do rastreio | Resposta com base nos dados |
|---|---|
| As 9 reversões sem vínculo explicam os R$ 14.800,00? | **Sim.** As 9 linhas somam exatamente R$ 14.800,00 nas mesmas 8 parcelas do diagnóstico. |
| São todas do mesmo tipo de problema? | **Não.** São **quatro mecanismos distintos**: 2 pagamentos convertidos em reversão, 1 vínculo explícito removido, 4 reversões sem origem de mesmo valor no histórico e 2 com candidato só na mesma data/depois. |
| Há estorno duplo, vínculo apontando para pagamento inexistente ou estorno em parcela diferente? | **Não.** O diagnóstico descartou os três; o rastreio trouxe um vínculo **removido** (parcela 227), não um vínculo apontando para pagamento inexistente. |
| O KPI de novembro é afetado por qual reversão? | **Apenas uma:** a da parcela 227 (`60fe1d1b…`, R$ 1.000,00, 21/11). É a única com `esta_no_mes_da_tela=true`. |
| As 5 parcelas `Quitado` com saldo são erros? | **Quatro não:** são desdobramentos com parcela residual criada no mesmo instante. **Uma é anômala:** a parcela 231. |
| O `amountPaid` das 5 está errado? | **Não.** As 5 têm `amount_paid_bate_historico=true`: o salvo bate com `pagamentos − reversões`. O que diverge é o **status `Quitado`** (ou o valor da parcela), não o pagamento. |

**Conclusão central:** não há pagamento perdido. O que existe é um conjunto de
lançamentos **manuais/legados** que produziu reversões sem origem rastreável e
um desdobramento incompleto na parcela 231. A decisão sobre o KPI continua em
aberto e nenhuma correção foi aplicada.

---

## 2. Escopo confirmado

| Indicador | Valor |
|---|---:|
| Reversões no total | 10 |
| Reversões sem `reverses_payment_id` | **9** |
| Parcelas com reversão sem vínculo | 8 |
| Valor das reversões sem vínculo | **R$ 14.800,00** |
| Parcelas `Quitado` com saldo | 5 |
| Saldo dessas parcelas | **R$ 4.310,00** |
| Parcelas únicas analisadas | 13 |

---

## 3. As 9 reversões sem vínculo

### 3.1 Linha a linha

| Parcela | Contrato | Amb. | Valor | Data | Pagamentos antes* | Excede? | Classificação devolvida |
|---:|---:|---|---:|---|---:|---|---|
| 227 | 134 | teste | 1.000,00 | 21/11 | 0,00 | sim | nenhum pagamento anterior registrado na parcela |
| 147 | 90 | produção | 2.000,00 | 11/04 | 600,00 | sim | sem candidato de mesmo valor; há pagamento anterior |
| 113 | 74 | teste | 2.000,00 | 11/04 | 0,00 | sim | nenhum pagamento anterior registrado na parcela |
| 148 | 91 | produção | 300,00 | 10/04 | 300,00 | não | candidato exato por valor+parcela antes do estorno |
| 147 | 90 | produção | 1.600,00 | 10/04 | 0,00 | sim | nenhum pagamento anterior registrado na parcela |
| 129 | 81 | teste | 4.000,00 | 02/04 | 2.000,00 | sim | sem candidato de mesmo valor; há pagamento anterior |
| 122 | 76 | teste | 1.000,00 | 25/03 | 0,00 | sim | nenhum pagamento anterior registrado na parcela |
| 87 | 65 | teste | 2.500,00 | 16/03 | 500,00 | sim | sem candidato de mesmo valor; há pagamento anterior |
| 103 | 70 | teste | 400,00 | 16/03 | 100,00 | sim | candidato exato, mas com data posterior ao estorno |

\* O campo `pagamentos_antes_do_estorno` usa **`payment_date`**, não `created_at`.
Nos cinco casos com “pagamento anterior”, a linha de pagamento foi **criada
depois da reversão**, no mesmo dia:

| Parcela | Reversão criada em | Pagamento criado em | Diferença |
|---:|---|---|---|
| 87 | 16/03 02:09:17.814574 | 16/03 02:10:09.532689 | +52 s |
| 103 | 16/03 14:45:26.048580 | 16/03 14:46:30.014747 | +64 s |
| 129 | 02/04 09:39:09.295176 | 02/04 09:39:39.383609 | +30 s |
| 147 (2.000) | 11/04 04:33:27.913506 | 11/04 04:41:20.280204 | +7 min 52 s |
| 148 | 10/04 23:41:57.160266 | 10/04 23:50:32.282411 | +8 min 35 s |

Isto é **sinal forense, não prova**: `payment_date` é data de competência e a
ordem de criação pode refletir digitação, não o movimento de caixa. Mas a
sequência “estorno primeiro, pagamento depois” se repete nos cinco casos e
reforça a leitura de que essas reversões **não estão desfazendo um recebimento
que existisse em `payments` no momento do estorno**.

### 3.2 Mecanismo A — pagamento convertido em reversão (parcelas 113 e 122)

`auditoria_pagamentos` registra, **todos no instante
`2026-11-22T00:10:42.202385+00:00`, ambiente `teste`, `performed_by=null`**:

| Pagamento | Parcela | Alteração |
|---|---:|---|
| `f5244bd8-52bb-4471-b968-aba04c6fa821` | 113 | `type`: `payment` → `reversal`; valor 2.000,00 inalterado |
| `5f549cc4-40ca-4007-9a13-096d707cad06` | 122 | `type`: `payment` → `reversal`; valor 1.000,00 inalterado |

Ou seja: essas duas linhas **já existiam como recebimento** e passaram a constar
como estorno. O vínculo está nulo porque **não há mais pagamento original para
apontar** — ele é a própria linha convertida.

A auditoria das parcelas mostra a etapa anterior, em 21/11:

- **113:** `Quitado → Estornado`, `amountPaid` 2.000,00 → 0,00 às
  `23:27:33.049542+00:00`.
- **122:** `Quitado → Estornado`, `amountPaid` 3.000,00 → 0,00 às
  `23:24:02.985817+00:00`.

Atenção ao caso 122: a parcela tinha **3.000,00** baixados, mas apenas
**1.000,00** aparece como reversão em `payments`. Os **2.000,00 restantes não
têm linha alguma** na célula — nem pagamento, nem reversão. Com estes dados não
é possível saber se foram apagados, convertidos ou nunca registrados; o
rastreio confirma a ausência, não recupera o valor.

### 3.3 Mecanismo B — vínculo explícito removido (parcela 227)

| Pagamento | Parcela | Alteração |
|---|---:|---|
| `60fe1d1b-10ad-47c7-aab0-11a4078297d0` | 227 | `reverses_payment_id`: `3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9` → nulo |

Mesmo instante: `2026-11-22T00:10:42.202385+00:00`, `performed_by=null`,
valor 1.000,00 inalterado, `type` já `reversal`. A linha foi criada em 21/11
às `22:08:14.795187+00:00` **com vínculo**; o vínculo foi apagado no dia
seguinte. A parcela 227 passou de `Parcial` (1.000,00 pago) para `Estornado`
(0,00) às `22:08:14.795187+00:00`.

Este é o caso que interessa ao KPI de novembro: é a **única reversão da lista
com `esta_no_mes_da_tela=true`**. O original `3715c3de…` não aparece na célula,
então não é possível saber, com estes dados, se ele estava dentro ou fora da
janela do mês.

### 3.4 Mecanismo C — reversão sem origem de mesmo valor (parcelas 147, 87 e 129)

| Parcela | Reversões | Pagamento(s) na parcela | Líquido histórico | Situação |
|---:|---:|---|---:|---|
| 147 | 1.600,00 + 2.000,00 | 600,00 | **−3.000,00** | duas reversões, nenhuma de mesmo valor; parcela `Quitado` com 600,00 |
| 87 | 2.500,00 | 500,00 | **−2.000,00** | estorno de “Devolução” 5× maior que o pagamento; parcela `Parcial` |
| 129 | 4.000,00 | 2.000,00 (02/04) + 2.000,00 (19/11) | **0,00** | estorno de 4.000,00, seguido de dois recebimentos de 2.000,00; `amountPaid` passou a 4.000,00 em 20/11 |

São os casos de **liquidação negativa** (147 e 87) que o diagnóstico já havia
marcado como prioridade. O valor de 129 foi posteriormente recomosto por dois
pagamentos, mas nenhum deles tem o valor da reversão — por isso a heurística de
`lib/payments.ts` não encontra candidato.

### 3.5 Mecanismo D — candidato apenas na mesma data ou depois (parcelas 103 e 148)

- **103:** reversão de 400,00 em 16/03; candidato exato de 400,00 com
  `payment_date` **11/04**, criado 26 dias depois (`566e614c…`). Há também um
  pagamento de 100,00 em 16/03 **sem conta** (`c2c02242…`, ambiente produção),
  membro da família já conhecida de pagamentos sem conta recuperável.
- **148:** reversão de 300,00 e pagamento de 300,00 com **a mesma**
  `payment_date` (10/04), criado 8 min 35 s depois (`3872027b…`). O campo
  `candidato_apos_o_estorno=false` aparece **apenas porque as datas são
  iguais**; por `created_at`, o pagamento veio depois.

São os dois casos em que a heurística encontra “candidato exato”, mas **o
candidato não pode ser vinculado sem decisão**: em 103 a data é posterior; em
148 a ordem de criação é posterior. O script **não gravou** `reverses_payment_id`
em nenhum dos dois.

### 3.6 Sinais qualitativos

As descrições e observações `[ESTORNO]` reforçam o caráter manual/de teste:

| Contrato | Observação |
|---:|---|
| 65 | `[ESTORNO]: Devolução` |
| 70 | `[ESTORNO]: SSGFSFD` |
| 74 | `[ESTORNO] erro no recebimento` |
| 76 | `[ESTORNO] erro no recebimento` |
| 81 | `[ESTORNO]: teste` |
| 90 | `[ESTORNO]: este` e `[ESTORNO]: estorno` |
| 91 | `[ESTORNO]: estorno` |
| 134 | `[ESTORNO] erro no sistema` |

Descrições das reversões incluem “Estorno: erro no sistema”, “Estorno: teste”,
“Estorno: SSGFSFD”, “Estorno: este”, “Estorno: estorno” e “Parcial”. Não há
padrão de rotina (`process_installment_estorno`) nestes oito contratos.

### 3.7 Classificação consolidada

| Classe | Parcelas | Valor |
|---|---|---:|
| A — pagamento convertido em reversão | 113, 122 | R$ 3.000,00 |
| B — vínculo explícito removido | 227 | R$ 1.000,00 |
| C — reversão sem origem de mesmo valor | 147 (×2), 87, 129 | R$ 10.100,00 |
| D — candidato só na mesma data/depois | 103, 148 | R$ 700,00 |
| **Total** | **8 parcelas / 9 reversões** | **R$ 14.800,00** |

---

## 4. KPI “Recebido este Mês”

| Reversão | Ambiente | Data | `esta_no_mes_da_tela` | Efeito no KPI de novembro |
|---|---|---|---|---|
| 227 / contrato 134 | teste | 21/11 | **sim** | Única subtraída de novembro; original fora da janela |
| Outras 8 | produção e teste | março a abril | não | Nenhum — a tela carrega só `payments` do mês corrente |

A aritmética do KPI segue correta: **36.032,44 − 2.621,00 − 1.621,00 =
31.790,44**. O ponto em aberto é o mesmo do diagnóstico, agora com evidência
de origem: a reversão de R$ 1.000,00 da parcela 227 teve o vínculo
`3715c3de…` **removido em 22/11 00:10:42 UTC**, e o destino desse pagamento
original não consta na célula.

**Não é erro de soma.** É decisão de regra: ou o KPI mostra só entradas do mês
menos estornos de entradas do mês, ou mostra o saldo de caixa do mês incluindo
devoluções de meses anteriores. Qualquer mudança em `lib/payments.ts` depende
dessa decisão.

---

## 5. As 5 parcelas `Quitado` com saldo

### 5.1 Fato comum

Todas as cinco têm **`amount_paid_bate_historico=true`**: `amountPaid` é igual
a `pagamentos − reversões` em todas. Ou seja, **o pagamento salvo está certo**.
O que precisa de decisão é o **status `Quitado`** diante de um saldo devedor —
ou a revisão do valor original da parcela.

| Parcela | Contrato | Valor | `amountPaid` | Falta | Pagamentos | Líquido | Residual visível |
|---:|---:|---:|---:|---:|---:|---:|---|
| 194 | 107 | 3.000,00 | 1.500,00 | 1.500,00 | 1 × 1.500,00 | 1.500,00 | **257** (1.500,00, `Aberto`) |
| 207 | 120 | 1.621,00 | 811,00 | 810,00 | 1.621,00 + 811,00; 1 estorno de 1.621,00 com vínculo | 811,00 | **256** (810,00, `Aberto`) |
| 230 | 135 | 2.000,00 | 1.500,00 | 500,00 | 1.000,00 + 500,00 | 1.500,00 | **240** (500,00, `Aberto`) |
| 231 | 135 | 2.000,00 | 1.000,00 | 1.000,00 | 1 × 1.000,00 | 1.000,00 | **239** (1.000,00, **`Quitado`**) — anômalo |
| 237 | 135 | 2.000,00 | 1.500,00 | 500,00 | 1 × 1.500,00 | 1.500,00 | **244** (500,00, `Aberto`) |

### 5.2 Quatro desdobramentos regulares

Nas parcelas **194, 207, 230 e 237** a parcela residual foi criada **no mesmo
instante** em que a original foi marcada como `Quitado`:

- **194 → 257:** `07:52:53.405226+00:00` (25/11, produção). O contrato 107 foi
  `Quitado` e voltou a `Parcial` com `amountReceivable=1.500,00` na mesma
  transação.
- **207 → 256:** `07:48:06.290129+00:00` (25/11, produção), depois do ciclo
  recebimento → estorno vínculado → novo recebimento de 811,00.
- **230 → 240:** `2026-11-22T00:01:08.213398+00:00` (teste), na transição
  `Parcial → Quitado` de 1.000,00 para 1.500,00.
- **237 → 244:** `2026-11-22T20:13:33.049909+00:00` (teste), na transição
  `Aberto → Quitado` com 1.500,00.

Nesses quatro casos o saldo visível na parcela original é **o esperado pelo
desdobramento**: o restante vive na parcela irmã `Aberto`. Somam
**R$ 3.310,00** (1.500 + 810 + 500 + 500).

### 5.3 A anomalia da parcela 231

A parcela 231 foi aberta e marcada `Quitado` com 1.000,00 às
`2026-11-21T23:38:12.640373+00:00`. No **mesmo instante** foi criada a parcela
**239**, número 11, valor 1.000,00 — mas já com status **`Quitado`** e
`amountPaid=1.000,00`.

O pagamento `9dc6e441-a731-4bc6-baa3-90899c26b4df` (1.000,00, conta Carteira,
transação financeira 1250) está lançado na **parcela 231**, não na 239. A
célula não traz nenhum `payment` para a parcela 239. Resultado: a residual
**nasceu quitada sem recebimento próprio**, enquanto a original ficou com
R$ 1.000,00 em aberto.

É o único R$ 1.000,00 dos R$ 4.310,00 que **não tem residual `Aberto`**
correspondente. O contrato 135 mostra `amountReceived=19.000,00` e
`amountReceivable=1.000,00`, coerente com o desdobramento incompleto.

---

## 6. Auditoria — o que data e o que não data

| Objeto | Evidência |
|---|---|
| 3 linhas em `payments` | `2026-11-22T00:10:42.202385+00:00`, ambiente teste, **`performed_by=null`**: duas conversões `payment → reversal` (113, 122) e a remoção do vínculo da 227. |
| Parcelas 113, 122, 227 | Status alterado em 21/11, entre `22:08:14` e `23:27:33`, todas por `performed_by=2`. |
| Parcelas 194, 207 | Correções em 25/11 entre `07:37:25` e `07:52:53`, por `performed_by=2`; incluem o ciclo de estorno vínculado da 207. |
| Parcela 231 / contrato 135 | Abertura e quitação em 21/11; vários ajustes de `amountReceived` no contrato 135 até `2026-11-22T20:13:51.471768+00:00`. |
| Reversões 147, 87, 129, 103, 148 | **Nenhuma linha** em `auditoria_pagamentos` na célula — não é possível datá-las com estes dados. |

Limitações registradas pelo próprio script:

- `payments` e `installments` **não têm `updated_at`**; `audit_logs` é o único
  meio de datar mudanças.
- `date_trunc('month')` usa o **timezone da sessão do SQL Editor**.
- Candidatos de valor+parcela são **apenas candidatos** à heurística; não são
  vínculos confirmados e não autorizam `UPDATE`/`DELETE`.
- `performed_by=null` nas três alterações críticas de 22/11 — não há como
  atribuir a ação a um usuário pelo `audit_logs`.

---

## 7. O que **não** fazer

1. Não executar `UPDATE`/`DELETE` em `payments`, `installments` ou `contracts`
   sem autorização explícita, medição prévia e forward/verify/rollback.
2. Não gravar `reverses_payment_id` “por valor + parcela”. A própria rotina
   atual evita aproximação, e a célula mostra que em 103 e 148 o candidato só
   existe na mesma data/depois.
3. Não baixar `amountPaid` das 5 parcelas `Quitado` com saldo: o salvo bate com
   o histórico, e quatro já têm residual criado.
4. Não “fechar” a parcela 239 nem transferir o pagamento da 231 sem decidir o
   que aconteceu com o desdobramento — o pagamento pertence à 231.
5. Não alterar a regra do KPI nem a definição de “vencido” (`Prorrogada`) sem
   decisão de negócio registrada.
6. Não usar `CREATE INDEX CONCURRENTLY` no SQL Editor (erro `25001`).

---

## 8. Próximos passos

1. **Decidir a regra do KPI** para a reversão órfã da parcela 227. Antes disso,
   uma célula complementar somente leitura pode dizer onde ficou o pagamento
   `3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9` e se a parcela 239 tem algum
   pagamento próprio (`docs/RASTREIO-COMPLEMENTAR-20261125.sql`).
2. **Decidir o destino dos R$ 1.000,00 da parcela 231**: manter o saldo na
   231, desfazer a quitação da 239 ou realocar o pagamento. São três saídas de
   negócio diferentes; nenhuma foi aplicada.
3. **Manter a decisão de “vencido” em aberto** — a divergência de
   `Prorrogada` continua sendo diferença de definição, não de dado.
4. **Verificar o isolamento da view** `contract_receivables_summary` em tarefa
   separada, com JWT de outro ambiente.
5. Para qualquer mudança: medir antes, escrever forward/verify/rollback em uma
   única célula, pedir autorização explícita e aplicar somente pelo usuário no
   SQL Editor.

---

## 9. Conclusão

O rastreio **explicou a origem das 9 reversões sem vínculo sem recuperar
dinheiro algum**: duas são pagamentos convertidos em estorno, uma teve o
vínculo removido, quatro não têm origem de mesmo valor no histórico e duas só
encontram candidato na mesma data/depois. As 8 parcelas e os R$ 14.800,00
continuam exatos, mas agora com mecanismo classificado.

Das 5 parcelas `Quitado` com saldo, **R$ 3.310,00 são desdobramentos regulares**
com residual `Aberto` e **R$ 1.000,00 são a anomalia da parcela 231**, cuja
residual 239 nasceu quitada sem pagamento próprio.

Nenhuma correção financeira foi aplicada. O rastreio rodou dentro de
`begin … rollback`, não persistiu nada e nenhum rollback de mudança anterior
foi acionado.
