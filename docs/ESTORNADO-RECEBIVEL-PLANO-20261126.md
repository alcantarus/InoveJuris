# `Estornado` como título a receber — medição e plano (26/11/2026)

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

O impacto em `production` é **zero**. As três views de dashboard também excluem
`Estornado` hoje (P0 de 24/11) e voltarão a incluí-lo.

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

## 4. Mudanças preparadas

### Front — já editadas no repositório, **não publicadas**

`app/contas-a-receber/page.tsx`:

- `isBatchEligible` (`:364`) — estornada volta a ser elegível no lote;
- `getInstallmentFlags` (`:397`) — estornada pode contar como atrasada;
- `totalOpen` (`:417`) — inclui o saldo estornado;
- Previsão 30d (`:468`) — `Estornado` entra no `.in('status', ...)`.

`Prorrogada` continua fora de atrasado/vencido.

### Banco — preparado, **não aplicado**

| Arquivo | Função | Estado |
|---|---|---|
| `docs/FORWARD-ESTORNADO-RECEBIVEL-20261126.sql` | DDL da view, do gatilho e das 3 views de dashboard, com backup e pré-validação | **preparado, não aplicado** |
| `docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql` | estrutura + KPIs + integridade dos dados por ambiente | preparado, não executado |
| `docs/ROLLBACK-ESTORNADO-RECEBIVEL-20261126.sql` | restaura as definições do backup | preparado, não aplicado |

### Dados — preparado, **depende de autorização explícita**

`docs/FORWARD-ESTORNADO-RECEBIVEL-DADOS-20261126.sql` e
`docs/ROLLBACK-ESTORNADO-RECEBIVEL-DADOS-20261126.sql`.

Motivo: o gatilho recalcula `contracts."amountReceivable"` apenas em eventos de
`installments`/`payments`. Sem esta correção, os 3 contratos de `test`
continuariam com R$ 15.000,00 em `/contratos` e no dashboard até o próximo
recebimento, enquanto a view passaria a mostrar R$ 30.000,00. O script faz
`UPDATE` **somente** nesses contratos, com guarda de abort se aparecer qualquer
contrato de `production` ou mais de 10 afetados. **Não executar sem autorização.**

## 5. Ordem sugerida de execução (pelo usuário)

1. `docs/FORWARD-ESTORNADO-RECEBIVEL-20261126.sql` — estrutural; sem dados.
2. `docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql` — conferir estrutura e KPIs.
3. Se aprovado, e **com autorização explícita**, o forward de dados.
4. Verify novamente; `amount_receivable_desatualizado` deve ser 0.

Se algo divergir: rollback de dados (se aplicado) e rollback estrutural, nessa
ordem. Nenhuma linha de negócio foi alterada até o momento.
