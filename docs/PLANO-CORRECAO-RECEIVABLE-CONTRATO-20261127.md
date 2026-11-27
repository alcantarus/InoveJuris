# Plano — `contracts.amountReceivable` correto (27/11/2026)

> **PREPARADO, NÃO EXECUTADO.** Nenhum `UPDATE` foi feito pelo agente.

## 1. Causa

O gatilho `fn_recalculate_contract_totals` calcula `amountReceivable` somando
`amount − amountPaid` das parcelas em aberto. Em cadeias legadas **sem vínculo**
(decisão de não fazer backfill), uma parcela estornada reabre 3.000 enquanto a
residual quitada de 1.500 continua existindo. A soma das linhas dá 14.000, mas
o recebido real é 2.500 e o contrato é 15.000 → o correto é **12.500**.

A correção definitiva é trocar a fórmula do gatilho para:

```
amountReceivable = GREATEST(contractValue − SUM(amountPaid), 0)
```

Isso funciona tanto para cadeias legadas quanto para a árvore nova, porque um
estorno zera o `amountPaid` e devolve o saldo automaticamente.

## 2. Ambiente

**Banco único** (`CONVENCAO-AMBIENTES-BANCO-UNICO.md`): `production` e `test`
são valores de `environment` na mesma tabela. A estrutura e os dados corrigidos
valem para os dois rótulos; não existe segundo SQL Editor.

## 3. Arquivos

| Arquivo | Uso |
|---|---|
| `VERIFY-RECEIVABLE-CONTRATO-20261127.sql` | medir divergências (somente leitura) — rodar primeiro |
| `FORWARD-RECEIVABLE-CONTRATO-20261127.sql` | backup + nova versão v5 do gatilho |
| `FORWARD-DADOS-RECEIVABLE-20261127.sql` | `UPDATE` pontual dos contratos divergentes — **só com autorização explícita** |
| `ROLLBACK-TRIGGER-RECEIVABLE-20261127.sql` | restaura o gatilho do backup |
| `ROLLBACK-DADOS-RECEIVABLE-20261127.sql` | devolve os valores anteriores do backup |

## 4. Ordem

1. Rodar o `VERIFY` e colar o resultado (medição prévia).
2. Rodar o `FORWARD` do gatilho e colar o resultado.
3. Se aprovar a correção dos dados: rodar o `FORWARD-DADOS`.
4. Rodar o `VERIFY` novamente — divergências devem zerar.
5. O front já usa `valor do contrato − recebido`, então o KPI da tela já está
   correto mesmo antes do passo 3.

## 5. Restrições

- Sem `UPDATE`/`DELETE` em dados de negócio sem autorização explícita.
- Sem credenciais no chat.
- Sem dumps/linhas completas de prévia — só contagens e totais.
- Toda rotina declara/traz `environment`.
- Rollbacks preservam tabelas de backup como evidência.
