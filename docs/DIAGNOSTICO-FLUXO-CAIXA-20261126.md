# Diagnóstico do módulo Fluxo de Caixa — levantamento estático (26/11/2026)

> **Regra permanente:** um único banco (PostgreSQL 17.6). `production` e `test`
> são valores da coluna `environment`, não bancos separados. Toda rotina declara
> o ambiente e inclui `environment` no filtro ou no resultado. Ver
> `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

## Estado

- **SQL forense preparado:** `docs/DIAGNOSTICO-FLUXO-CAIXA-20261126.sql`.
- **Ainda não executado.** Uma única célula (`diagnostico_fluxo_caixa_20261126`),
  somente leitura, termina em `rollback`. Nenhum `UPDATE`/`DELETE` foi preparado
  ou autorizado.
- O documento será atualizado com os números reais depois que você colar a
  saída. Até lá, o que segue é **análise estática do repositório e da
  documentação existente**, não afirmação sobre o estado atual do banco.

## 1. O que já está confirmado em documentos anteriores

| Item | Evidência |
|---|---|
| Views do dashboard, inclusive `vw_cash_flow_forecast`, expõem `environment` e mantêm `security_invoker=on` | F7 em `docs/STATUS-INOVEJURIS.md:630-631` |
| RPCs de Movimentações recebem `p_environment` do ambiente atual | `docs/STATUS-INOVEJURIS.md:707-716`, commit `c29dc84` |
| Ordem dos lançamentos por `date`, `created_at`, `id` | `docs/STATUS-INOVEJURIS.md:718-727`, commit `f016df4` |
| `get_future_receivables_projection` usa saldo, inclui prorrogada/parcial e ignora cancelados | `docs/CORRECAO-B11-PREVISAO-30-DIAS-20261121.sql`, confirmado em `docs/DIAGNOSTICO-CONTRATOS-RESULTADO-20261124.md` |
| Estornos antigos sem vínculo (9, R$ 14.800,00) e par heurístico em `lib/payments.ts` | `docs/DIAGNOSTICO-CONTAS-A-RECEBER-RESULTADO-20261125.md` |
| `Estornado` voltou a ser título a receber; rótulo preservado | `docs/ESTORNADO-RECEBIVEL-PLANO-20261126.md` |
| Nenhuma auditoria anterior escreveu dados; nenhum rollback acionado | Handoffs de Contratos e Contas a Receber |

## 2. Riscos apontados pelo código (a confirmar no banco)

### P0 — saldo pode ser ajustado mais de uma vez por lançamento

`app/fluxo-caixa/movimentacoes/page.tsx:376-416`:

1. INSERT em `financial_transactions` dispara o trigger `update_account_balance`;
2. a tela chama `supabase.rpc('update_account_balance', { acc_id, amount_change })`;
3. a tela ainda faz `UPDATE bank_accounts SET current_balance = ...` com valor em cache.

No baseline, `update_account_balance()` é **trigger function**, sem assinatura
`(acc_id, amount_change)` (`app/setup/page.tsx:519-563`). Se não houver outra
sobrecarga no banco, a chamada RPC falha silenciosamente (o retorno não é
verificado) e ainda assim o `UPDATE` manual pode duplicar o efeito do trigger.
A exclusão tem o mesmo desenho em `:509-539`.

O SQL verifica: assinaturas reais, triggers presentes e divergência entre
`current_balance` persistido e saldo recalculado a partir de
`initial_balance + entradas - saídas + transferências`.

### P0 — isolamento depende do cliente

`lib/supabase.ts` injeta `environment` em `.from(...)`, mas não em `.rpc(...)`
(`:183-186`). Já houve vazamento real de números de produção na tela de teste,
corrigido no frontend (`docs/STATUS-INOVEJURIS.md:707-716`). As policies do
baseline são `USING (true)` (`app/setup/page.tsx:382-394,565-591`).

O SQL verifica: policies atuais das tabelas financeiras, coluna `environment`,
e linhas cujo `environment` difere da conta/categoria/transação vinculada.

### P1 — KPIs da visão geral usam no máximo 100 transações

`app/fluxo-caixa/page.tsx:153-158,179-233`: entradas, saídas, maior despesa e
gráfico de 30 dias são calculados sobre `.limit(100)`, em vez de agregação no
banco. Se o mês tiver mais de 100 lançamentos, os números ficam incompletos.

O SQL verifica: quantidade de transações no mês atual por ambiente e se passa
de 100. Também compara com `get_financial_summary` e `vw_cash_flow_forecast`.

### P1 — previstas da visão geral provavelmente zeradas

`app/fluxo-caixa/page.tsx:192-198` filtra `installments.type === 'income'`, mas
o baseline de `installments` não tem coluna `type` (`app/setup/page.tsx:193-207`).

O SQL verifica a existência real da coluna e traz a projeção da RPC corrigida.

### P1 — integridade fraca no baseline

Sem `CHECK (amount > 0)`, sem `UNIQUE` para contas/categorias/lançamentos, sem
exigência de conta de destino em transferência, e `ON DELETE CASCADE` nas contas
vinculadas a transações (`app/setup/page.tsx:253-266`).

O SQL verifica: valores não positivos, sem conta, sem categoria, tipos fora do
padrão, transferências inválidas, duplicatas e contas/categorias repetidas.

### P2 — fonte de verdade das migrações

Não existe `schema_migrations` em produção
(`docs/DIAGNOSTICO-CONTRATOS-RESULTADO-20261124.md:13`) e há pares `-1`/`-2` das
migrações de caixa sem confirmação de qual versão foi aplicada
(`docs/STATUS-INOVEJURIS.md:304`).

O SQL verifica a existência da tabela e traz as definições reais das funções e
da view para comparação com o repositório.

## 3. O que o SQL responde

Ao rodar `docs/DIAGNOSTICO-FLUXO-CAIXA-20261126.sql`, a célula única devolve:

- `catalogo` — colunas existentes e colunas-chave presentes/ausentes;
- `estrutura` — constraints, índices, triggers, funções com assinatura/
  `security_definer`/grants, e views com `reloptions`;
- `rls` — policies por tabela, com expressões `USING`/`WITH CHECK`;
- `por_ambiente` — contagens e valores de transações, contas, categorias,
  pagamentos e parcelas em `production` e `test`;
- `saldo` — `current_balance` versus saldo recalculado, com detalhe das
  divergências;
- `integridade` — contagens dos problemas listados acima;
- `pagamentos` — vínculos com transações, estornos e
  `amountPaid` versus soma de pagamentos;
- `rpc_e_view` — números reais de `vw_cash_flow_forecast`,
  `get_financial_summary` e `get_future_receivables_projection`;
- `riscos_codigo` — sinais do front confirmados ou refutados no catálogo.

## 4. Próximo passo

Você executa o SQL e cola a célula `diagnostico_fluxo_caixa_20261126`. Com o
resultado, classifico cada achado como **confirmado**, **refutado** ou
**pendente**, escrevo o relatório final e só então proponho — se necessário —
medição prévia, `forward`/`verify`/`rollback`, com autorização explícita para
qualquer mudança.
