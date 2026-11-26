# `Estornado` como título a receber — medição, aplicação e verificação (26/11/2026)

> **Regra permanente:** um único banco (PostgreSQL 17.6). `production` e `test`
> são valores da coluna `environment`, não bancos separados. Ver
> `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

## 1. Decisão do usuário

> "O estorno é uma operação de desfazimento de um recebimento equivocado. Logo,
> ao desfazer o recebimento (o estorno), a parcela, o título volta ao estado de
> devedor, a receber."

Isso confirma a correção já aplicada em 25/11
(`docs/CORRECAO-ESTORNO-RECEBIMENTO-20261125.sql`, desdobramento v8: estorno
limpo com `amountPaid = 0` pode ser recebido inclusive de forma parcial). O que
faltava era alinhar as regras de leitura.

**Não muda:** o rótulo/status `Estornado`, o KPI "Recebido este Mês" (decisão do
item 1) e `Prorrogada` fora de "vencido" (também decidido). Nenhuma reversão é
apagada.

## 2. Medição prévia

Script: `docs/MEDICAO-ESTORNADO-RECEBIVEL-20261126.sql`, executado pelo usuário
em 26/11 às 12:38:50 UTC. Uma célula, somente leitura, `rollback` final. Nenhum
dado alterado.

| Métrica | `test` | `production` |
|---|---:|---:|
| Parcelas estornadas | 3 | 0 |
| Saldo estornado | R$ 15.000,00 | R$ 0,00 |
| Estornadas vencidas | 2 (R$ 5.000,00) | 0 |
| Contratos com parcela estornada | 3 | 0 |
| Contratos com status `Estornado` | 3 | 0 |
| Parcelas elegíveis no lote | 7 → **10** | 50 → 50 |
| A receber (view) | R$ 15.000 → **R$ 30.000** | R$ 320.655,80 |
| Vencido (view) | R$ 14.000 → **R$ 19.000** | R$ 65.270,00 |
| Previsão 30d | R$ 0 → **R$ 10.000** | R$ 19.329,60 |

O impacto em `production` é **zero**. As três views de dashboard também
excluíam `Estornado` (P0 de 24/11) e passaram a incluí-lo após o forward.

### Resultado do verify — 26/11/2026, 12:44:20.654672+00:00

Script `docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql`, executado pelo usuário,
uma única célula (`verificacao_estornado_recebivel_20261126`), somente leitura,
`rollback` final. Estrutura confirmada:

| Verificação | Resultado |
|---|---|
| `view_sem_estornado` | `true` |
| `view_security_invoker_on` | `true` (isolamento do item 2 preservado) |
| `gatilho_sem_estornado_no_filtro` | `true` |
| `gatilho_preserva_rotulo_estornado` | `true` |
| `dashboards_com_estornado` | `0` |

KPIs medidos após o forward — idênticos à previsão:

| Métrica | `test` | `production` |
|---|---:|---:|
| A receber | R$ 30.000,00 | R$ 320.655,80 |
| Vencido | R$ 19.000,00 | R$ 65.270,00 |
| Previsão 30d | R$ 10.000,00 | R$ 19.329,60 |
| Lote elegíveis | 10 | 50 |
| Parcelas estornadas / saldo | 3 / R$ 15.000,00 | 0 / R$ 0,00 |

Integridade: nenhuma parcela, pagamento ou transação alterado. O forward
estrutural mexeu apenas em DDL de view/gatilho.

### Verify final — 26/11/2026, 12:54:50.848899+00:00

Após o forward de dados, o mesmo script foi executado novamente. Estrutura e
KPIs permaneceram idênticos aos valores acima e
`amount_receivable_desatualizado=0` em **`test` e `production`**. Parcelas
estornadas e saldo também inalterados (3 / R$ 15.000,00 em `test`; 0 / R$ 0,00
em `production`). Nenhum rollback foi acionado.

## 3. O que foi encontrado no banco

Objetos que realmente excluem `estornado` do recebível:

| Objeto | Situação real | Ação |
|---|---|---|
| `contract_receivables_summary` | 4 filtros com `estornado` | remover dos 4 |
| `fn_recalculate_contract_totals` v4 | filtro de `amountReceivable` + ramo `v_has_estornado` | remover só do filtro; manter o ramo |
| 3 views de dashboard | `ARRAY[..., 'Estornado', 'Estornada']` | remover as duas do array |
| `process_installment_payment` (2 sobrecargas) | não exclui; o flag veio de comentário | nenhuma |
| `process_installment_estorno` v7 | só grava o status e delega o recálculo ao gatilho | nenhuma |
| `rpc_recebimento_com_desdobramento` v8 | já aceita estorno limpo | nenhuma |

As definições reais foram capturadas na medição porque o banco está à frente do
código do repositório (versões v7/v8).

## 4. Mudanças

### Front — editadas e publicadas em `main` no commit `0cc6bdb`

`app/contas-a-receber/page.tsx`:

- `isBatchEligible` (`:364`) — estornada volta a ser elegível no lote;
- `getInstallmentFlags` (`:397`) — estornada pode contar como atrasada;
- `totalOpen` (`:417`) — inclui o saldo estornado;
- Previsão 30d (`:468`) — `Estornado` entra no `.in('status', ...)`.

`Prorrogada` continua fora de atrasado/vencido.

### Banco — forward estrutural **aplicado e verificado**

| Arquivo | Função | Estado |
|---|---|---|
| `docs/FORWARD-ESTORNADO-RECEBIVEL-20261126.sql` | DDL da view, do gatilho e das 3 views de dashboard, com backup e pré-validação | **aplicado pelo usuário em 26/11; verify favorável às 12:44:20 UTC** |
| `docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql` | estrutura + KPIs + integridade dos dados por ambiente | executado às 12:44:20 UTC |
| `docs/ROLLBACK-ESTORNADO-RECEBIVEL-20261126.sql` | restaura as definições do backup | preparado, **não acionado** |

As definições originais ficaram guardadas em
`public.backup_estornado_recebivel_20261126`. Nenhum dado foi alterado nesta
etapa; nenhum rollback foi acionado.

### Dados — preparado, **depende de autorização explícita**

`docs/FORWARD-ESTORNADO-RECEBIVEL-DADOS-20261126.sql` e
`docs/ROLLBACK-ESTORNADO-RECEBIVEL-DADOS-20261126.sql`.

Motivo: o gatilho recalcula `contracts."amountReceivable"` apenas em eventos de
`installments`/`payments`. O verify de 12:44:20 UTC confirmou a divergência:
`amount_receivable_desatualizado=3` em `test` e `0` em `production`. Sem esta
correção, os 3 contratos de `test` continuariam com o valor antigo (R$ 15.000,00
no total) em `/contratos` e no dashboard até o próximo recebimento, enquanto a
view `contract_receivables_summary` já mostra R$ 30.000,00. O script faz
`UPDATE` **somente** nesses contratos, com guarda de abort se aparecer qualquer
contrato de `production` ou mais de 10 afetados. **Executada pelo usuário em
26/11 às 12:50:01.655136+00:00:** contratos 74 (0,00 → 2.000,00), 76
(0,00 → 3.000,00) e 134 (0,00 → 10.000,00), todos `environment=test`, total
R$ 15.000,00. Nenhum contrato de `production` afetado. Verify final favorável
às 12:54:50 UTC (`amount_receivable_desatualizado=0` nos dois ambientes).

## 5. Execução (pelo usuário)

1. ✅ `docs/FORWARD-ESTORNADO-RECEBIVEL-20261126.sql` — estrutural; sem dados. **Aplicado.**
2. ✅ `docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql` — estrutura e KPIs conferidos às 12:44:20 UTC.
3. ✅ `docs/FORWARD-ESTORNADO-RECEBIVEL-DADOS-20261126.sql` — executada às 12:50:01 UTC (UPDATE em 3 contratos de `test`).
4. ✅ Verify final às 12:54:50 UTC; `amount_receivable_desatualizado=0` nos dois ambientes.

A etapa estrutural não alterou linhas; a etapa de dados alterou somente as 3
colunas `amountReceivable` já listadas, com backup em
`public.backup_estornado_recebivel_dados_20261126`. **Item 3 encerrado com
sucesso**; os rollbacks de dados e estrutural seguem disponíveis, não acionados.
