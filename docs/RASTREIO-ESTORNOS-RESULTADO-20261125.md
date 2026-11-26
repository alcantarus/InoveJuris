# Rastreio forense das reversões — resultado confirmado (25/11, complementado em 26/11/2026)

> **Atenção: este arquivo é Markdown, não SQL.** Não cole este conteúdo no SQL
> Editor — o `#` do título causa `ERROR: 42601: syntax error at or near "#"`.
> Os scripts executáveis são `docs/RASTREIO-ESTORNOS-20261125.sql`
> (célula `rastreio_reversoes_20261125`) e
> `docs/RASTREIO-COMPLEMENTAR-20261125.sql`
> (célula `rastreio_complementar_20261125`), ambos já rodados e interpretados.

Fonte principal: célula `rastreio_reversoes_20261125` de
`docs/RASTREIO-ESTORNOS-20261125.sql`, executada pelo usuário às
`2026-11-25T18:50:55.180187+00:00` (PG 17.6). Fonte complementar: célula
`rastreio_complementar_20261125` de `docs/RASTREIO-COMPLEMENTAR-20261125.sql`,
executada pelo usuário às `2026-11-26T10:53:53.395161+00:00` (PG 17.6). A
célula complementar foi recebida duas vezes no chat, idêntica; foi tratada como
**uma única execução**. Ambos os scripts são somente leitura e terminam em
`rollback`. **Nenhuma alteração foi feita**; nenhum `INSERT`/`UPDATE`/`DELETE`
foi executado. Nenhum vínculo foi gravado e nenhum saldo foi baixado.

**Origem dos dados (regra permanente):** as duas consultas rodaram no SQL
Editor conectado ao **banco único** de produção (PostgreSQL 17.6). Dentro dele
existem dois ambientes lógicos — `production` e `test` (homologação) —
distinguidos pela **coluna `environment`**. **Não existe banco físico separado
para homologação.** Os scripts não filtraram por ambiente e trouxeram linhas
dos dois rótulos. Todas as linhas examinadas na célula complementar — parcelas
227, 231 e 239, os três pagamentos e toda a auditoria — são **`test`**. No
primeiro rastreio, as parcelas 147 e 148 são `production`; as demais são
`test`. Regra completa em
`docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

Este documento é a continuação de
`docs/DIAGNOSTICO-CONTAS-A-RECEBER-RESULTADO-20261125.md` e segue o mesmo padrão:
**fato confirmado**, **classificação** e **decisão ainda em aberto**. As
inferências do primeiro rastreio que a célula complementar refutou estão
marcadas como **refutada** abaixo.

---

## 1. Resumo executivo

| Pergunta do rastreio | Resposta com base nos dados |
|---|---|
| As 9 reversões sem vínculo explicam os R$ 14.800,00? | **Sim.** As 9 linhas somam exatamente R$ 14.800,00 nas mesmas 8 parcelas do diagnóstico. |
| São todas do mesmo tipo de problema? | **Não.** São **quatro mecanismos distintos**: 2 pagamentos convertidos em reversão, 1 vínculo explícito removido, 4 reversões sem origem de mesmo valor no histórico e 2 com candidato só na mesma data/depois. |
| Há estorno duplo, vínculo apontando para pagamento inexistente ou estorno em parcela diferente? | **Não.** O diagnóstico descartou os três. O rastreio trouxe um vínculo **removido** (parcela 227), e a célula complementar mostrou que o original foi **apagado** — não um vínculo apontando para pagamento inexistente. |
| O KPI de novembro é afetado por qual reversão? | **Apenas uma:** a da parcela 227 (`60fe1d1b…`, R$ 1.000,00, 21/11). É a única com `esta_no_mes_da_tela=true`. A entrada original de 21/11 foi apagada; a reversão permanece. |
| As 5 parcelas `Quitado` com saldo são erros? | **Não.** São **cinco desdobramentos regulares**: cada uma tem uma parcela residual criada `Aberto`. A suspeita de anomalia na parcela 231 foi **refutada** pela célula complementar. |
| O `amountPaid` das 5 está errado? | **Não.** As 5 têm `amount_paid_bate_historico=true`: o salvo bate com `pagamentos − reversões`. O saldo aparente da original foi transferido para a residual: quatro seguem `Aberto` (a receber) e a 239 foi quitada com pagamento próprio. |

**Conclusão central:** não há pagamento perdido e não resta anomalia financeira
no grupo das 5 parcelas `Quitado` com saldo. O que existe é um conjunto de
lançamentos **manuais/legados** que produziu reversões sem origem rastreável.
A única decisão financeira em aberto é a **regra do KPI** diante da reversão
da parcela 227; nenhuma correção foi aplicada.

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
com `esta_no_mes_da_tela=true`**. A célula complementar encerrou a dúvida sobre
o original:

| Instante (UTC) | Ação registrada | Evidência |
|---|---|---|
| 21/11 22:07:52.202727 | `INSERT` do pagamento `3715c3de…`, R$ 1.000,00, conta 9, categoria 1, `payment_date=21/11`, transação financeira **1248**, `created_by=2` | log `15901` (old_data do `DELETE`) e log `15832` |
| 21/11 22:08:14.795187 | `UPDATE` do pagamento original: `financial_transaction_id` **1248 → nulo**, `performed_by=null`; `INSERT` da reversão `60fe1d1b…` com `reverses_payment_id=3715c3de…`, conta 11, `payment_date=21/11`; parcela 227 `Parcial → Estornado` | logs `15835`, `15838`, `15836` |
| 22/11 00:10:42.202385 | `UPDATE` da reversão: `reverses_payment_id` → nulo, `performed_by=null`; **`DELETE` do pagamento original**, com `old_data` completo, `performed_by=null` | logs `15902`, `15901` |

`original_da_reversao_227=null` e `reversoes_que_apontam_para_o_original=0`
confirmam que não há linha viva. **Hipótese refutada:** o original **não estava
fora da janela do mês** — ele tinha `payment_date=2026-11-21`, foi criado em
21/11 e depois **excluído** de `payments` em 22/11 00:10:42 UTC. Todas essas
linhas são `environment=test` no banco de produção.

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
| 227 / contrato 134 | teste | 21/11 | **sim** | Única subtraída de novembro; entrada original de 21/11 apagada em 22/11 |
| Outras 8 | produção e teste | março a abril | não | Nenhum — a tela carrega só `payments` do mês corrente |

A aritmética do KPI segue correta: **36.032,44 − 2.621,00 − 1.621,00 =
31.790,44**. A célula complementar acrescenta um fato novo: a entrada de
R$ 1.000,00 de 21/11 **existeu e foi excluída** de `payments` em 22/11
00:10:42 UTC, enquanto a reversão de R$ 1.000,00, também de 21/11,
**permanece** e é subtraída. Ou seja, o KPI desconta uma devolução cuja entrada
não está mais na tabela — não é uma devolução de mês anterior.

**Não é erro de soma.** É decisão de regra: ou o KPI mostra só entradas do mês
menos estornos de entradas do mês, ou mostra o saldo de caixa do mês incluindo
devoluções de entradas já removidas/atípicas. Qualquer mudança em
`lib/payments.ts` depende dessa decisão.

---

## 5. As 5 parcelas `Quitado` com saldo

### 5.1 Fato comum

Todas as cinco têm **`amount_paid_bate_historico=true`**: `amountPaid` é igual
a `pagamentos − reversões` em todas. Ou seja, **o pagamento salvo está certo**.
O status `Quitado` com saldo aparente não é erro: é o desenho do desdobramento —
a original é encerrada com a parte paga e a parte restante é inscrita em uma
parcela irmã. Quatro irmãs seguem `Aberto` e a 239 foi quitada no dia seguinte
com pagamento próprio.

| Parcela | Contrato | Valor | `amountPaid` | Falta | Pagamentos | Líquido | Residual visível |
|---:|---:|---:|---:|---:|---:|---:|---|
| 194 | 107 | 3.000,00 | 1.500,00 | 1.500,00 | 1 × 1.500,00 | 1.500,00 | **257** (1.500,00, `Aberto`) |
| 207 | 120 | 1.621,00 | 811,00 | 810,00 | 1.621,00 + 811,00; 1 estorno de 1.621,00 com vínculo | 811,00 | **256** (810,00, `Aberto`) |
| 230 | 135 | 2.000,00 | 1.500,00 | 500,00 | 1.000,00 + 500,00 | 1.500,00 | **240** (500,00, `Aberto`) |
| 231 | 135 | 2.000,00 | 1.000,00 | 1.000,00 | 1 × 1.000,00 | 1.000,00 | **239** (1.000,00; `Aberto` de 21/11 e `Quitado` em 22/11 com pagamento próprio) |
| 237 | 135 | 2.000,00 | 1.500,00 | 500,00 | 1 × 1.500,00 | 1.500,00 | **244** (500,00, `Aberto`) |

### 5.2 Cinco desdobramentos regulares

Nas parcelas **194, 207, 230, 231 e 237** a parcela residual foi criada **no
mesmo instante** em que a original foi marcada como `Quitado`:

- **194 → 257:** `07:52:53.405226+00:00` (25/11, produção). O contrato 107 foi
  `Quitado` e voltou a `Parcial` com `amountReceivable=1.500,00` na mesma
  transação.
- **207 → 256:** `07:48:06.290129+00:00` (25/11, produção), depois do ciclo
  recebimento → estorno vinculado → novo recebimento de 811,00.
- **230 → 240:** `2026-11-22T00:01:08.213398+00:00` (teste), na transição
  `Parcial → Quitado` de 1.000,00 para 1.500,00.
- **231 → 239:** `2026-11-21T23:38:12.640373+00:00` (teste), na transição
  `Aberto → Quitado` com 1.000,00; a residual 239 entrou `Aberto` com
  `amountPaid=0,00` no mesmo instante e foi quitada no dia seguinte.
- **237 → 244:** `2026-11-22T20:13:33.049909+00:00` (teste), na transição
  `Aberto → Quitado` com 1.500,00.

Nesses cinco casos o saldo visível na parcela original é **o esperado pelo
desdobramento**: o restante vive na parcela irmã. Somam **R$ 4.310,00**
(1.500 + 810 + 500 + 1.000 + 500).

### 5.3 A parcela 231 — suspeita refutada

A primeira célula mostrava a parcela 239 já `Quitado` com R$ 1.000,00 e nenhum
`payment` correspondente entre os registros retornados. Isso levantou a suspeita
de uma residual **“nascida quitada sem recebimento próprio”**. A célula
complementar **refutou** essa inferência:

| Instante (UTC) | Fato | Evidência |
|---|---|---|
| 21/11 23:38:12.640373 | Parcela 231 `Aberto → Quitado`, `amountPaid` 0 → 1.000,00; **INSERT da parcela 239 como `Aberto`**, número 11, valor 1.000,00, `amountPaid=0,00` — mesma transação | logs `15872` e `15874` |
| 21/11 23:38:12.640373 | Pagamento da 231: `9dc6e441-a731-4bc6-baa3-90899c26b4df`, R$ 1.000,00, conta 8, categoria 1, `payment_date=21/11`, transação financeira **1250** | log `15878` e `transacoes_vinculadas` |
| 22/11 20:13:51.471768 | Pagamento **próprio** da 239: `046c7262-51ac-4c7f-a10f-7be2ce9adc31`, R$ 1.000,00, conta 11, `Cartão de Débito`, categoria 1, `payment_date=22/11`, transação financeira **1271**; parcela 239 `Aberto → Quitado` | log `16003`, `historico_parcelas_227_231_239` e `transacoes_vinculadas` |

Conclusão: a residual ficou `Aberto` por cerca de 20 horas e depois foi quitada
com **recebimento próprio**. Não há pagamento reaproveitado, nem linha
financeira ausente nesse grupo. Os R$ 4.310,00 das cinco parcelas são
desdobramentos regulares. As duas transações vinculadas são uma para cada
parcela (1250 na 231, 1271 na 239).

**Sobre a transação 1248:** ela aparece apenas no par original/reversão da
parcela 227, já datado e encerrado pela auditoria. Não é necessária nova
célula de SQL para as decisões em aberto; uma consulta específica só faria
sentido em uma conciliação de caixa separada.

---

## 6. Auditoria — o que data e o que não data

| Objeto | Evidência |
|---|---|
| 3 linhas em `payments` | `2026-11-22T00:10:42.202385+00:00`, `environment=test`, **`performed_by=null`**: duas conversões `payment → reversal` (113, 122) e a remoção do vínculo da 227. |
| Original da 227 | `INSERT` em 21/11 22:07:52 (`created_by=2`), desvinculação da transação 1248 às 22:08:14 (`performed_by=null`) e **`DELETE`** em 22/11 00:10:42 (`performed_by=null`), com `payment_date=21/11` no `old_data`. |
| Parcelas 113, 122, 227 | Status alterado em 21/11, entre `22:08:14` e `23:27:33`, todas por `performed_by=2`. |
| Parcelas 194, 207 | Correções em 25/11 entre `07:37:25` e `07:52:53`, por `performed_by=2`; incluem o ciclo de estorno vínculado da 207. |
| Parcelas 231 e 239 | 231 aberta e quitada em 21/11 23:38:12; 239 criada `Aberto` no mesmo instante e quitada em 22/11 20:13:51 com pagamento próprio; todas por `performed_by=2`. |
| Reversões antigas | A célula complementar confirmou **`qtd_logs=0`** nos cinco UUIDs `543ce837…`, `b02ef217…`, `ba58e2cc…`, `e672c672…` e `fbf7f49b…`. Não é possível datá-las com `audit_logs`. |

Todas as linhas da célula complementar são `environment=test` no banco de
produção. A ausência de log não prova que o lançamento nunca existiu — apenas
que `audit_logs` não registrou a ação.

Limitações registradas pelos scripts:

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
   o histórico e as cinco têm residual criada, com recebimento próprio.
4. Não transferir o pagamento `9dc6e441…` da parcela 231 para a 239: cada
   parcela tem o seu (transações 1250 e 1271, respectivamente).
5. Não alterar a regra do KPI nem a definição de “vencido” (`Prorrogada`) sem
   decisão de negócio registrada.
6. Não usar `CREATE INDEX CONCURRENTLY` no SQL Editor (erro `25001`).

---

## 8. Próximos passos

1. **Decidir a regra do KPI** para a reversão órfã da parcela 227, agora com
   evidência completa: a entrada de R$ 1.000,00 de 21/11 foi apagada em 22/11
   00:10:42 UTC e a reversão de R$ 1.000,00 da mesma data permanece sendo
   subtraída. Definir a regra antes de qualquer mudança em `lib/payments.ts`.
2. **Manter a decisão de “vencido” em aberto** — a divergência de
   `Prorrogada` continua sendo diferença de definição, não de dado.
3. **Verificar o isolamento da view** `contract_receivables_summary` em tarefa
   separada, com JWT de outro ambiente.
4. Para qualquer mudança: medir antes, escrever forward/verify/rollback em uma
   única célula, pedir autorização explícita e aplicar somente pelo usuário no
   SQL Editor.

Não há mais célula de SQL pendente nesta checagem: as duas foram executadas e
interpretadas.

---

## 9. Conclusão

O rastreio **explicou a origem das 9 reversões sem vínculo sem recuperar
dinheiro algum**: duas são pagamentos convertidos em estorno, uma teve o
vínculo removido, quatro não têm origem de mesmo valor no histórico e duas só
encontram candidato na mesma data/depois. As 8 parcelas e os R$ 14.800,00
continuam exatos, mas agora com mecanismo classificado.

Das 5 parcelas `Quitado` com saldo, **todos os R$ 4.310,00 são desdobramentos
regulares**: as residuais 257, 256, 240, 244 e 239 nasceram `Aberto`, e a 239
foi quitada em 22/11 com pagamento próprio. A suspeita de anomalia na parcela
231, levantada pela primeira célula, foi **refutada** pela complementar.

A única decisão financeira em aberto é a regra do KPI: a entrada de R$ 1.000,00
de 21/11 da parcela 227 foi excluída de `payments`, mas a reversão de
R$ 1.000,00 da mesma data continua sendo subtraída.

Nenhuma correção financeira foi aplicada. Ambos os scripts rodaram dentro de
`begin … rollback`, não persistiram nada e nenhum rollback de mudança anterior
foi acionado.
