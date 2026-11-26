# Convenção permanente — banco único, dois ambientes (`production` e `test`)

> **Regra permanente, confirmada pelo usuário em 26/11/2026.** Vale para toda
> sessão, todo SQL, todo relatório e toda rotina futura. Não expira e não depende
> de contexto: **`test` é homologação dentro do mesmo banco, não outro banco**.

## 1. A regra

- Existe **um único banco de dados** — o PostgreSQL 17.6 acessado pelo SQL
  Editor (o banco de produção da aplicação).
- Dentro desse banco convivem **dois ambientes lógicos**:
  - **`production`** — produção;
  - **`test`** — homologação/teste.
- A separação é feita pela **coluna `environment`** presente nas tabelas
  (`payments`, `installments`, `audit_logs`, `contracts`, entre outras).
- **Não existe banco físico separado para homologação.** Uma consulta sem
  filtro de `environment` retorna linhas dos dois ambientes misturadas.

## 2. Como aplicar em toda rotina

1. Toda rotina de leitura — diagnóstico, rastreio, forense, KPI, relatório —
   deve **declarar explicitamente** qual ambiente consulta: `production`,
   `test` ou `ambos`.
2. Toda rotina deve **incluir `environment` no filtro ou no resultado** quando
   a distinção for relevante. Se a célula não trouxer o campo, a interpretação
   deve registrar essa limitação em vez de presumir o ambiente.
3. Relatórios devem identificar, para cada linha citada, se ela é
   `production` ou `test`. Nunca usar “banco de testes” como sinônimo de outro
   *database*.
4. Rotinas que comparam ambientes devem **agrupar por `environment`**. Nunca
   somar os dois como se fossem um único cenário sem aviso explícito.
5. Rotinas de escrita, quando autorizadas, devem preservar ou definir
   `environment` corretamente e **nunca mover dados entre ambientes** sem
   autorização explícita e scripts de forward/verify/rollback.
6. O isolamento visto pela tela é feito por RLS
   (`_rls_can_access(environment)`), não por conexão a outro banco. Ao analisar
   um KPI, considerar essa regra antes de atribuir uma linha a determinado
   ambiente.

## 3. Aplicação imediata ao trabalho de 25–26/11/2026

- `docs/DIAGNOSTICO-CONTAS-A-RECEBER-20261125.sql`,
  `docs/RASTREIO-ESTORNOS-20261125.sql` e
  `docs/RASTREIO-COMPLEMENTAR-20261125.sql` rodaram no **banco único**. Como não
  filtraram por ambiente, trouxeram linhas dos dois rótulos.
- No primeiro rastreio, as parcelas **147 e 148 são `production`**; as demais
  (227, 113, 122, 129, 87 e 103) são `test`.
- Na célula complementar, **todas** as linhas são `test`: parcelas 227, 231 e
  239, pagamentos `3715c3de…`, `9dc6e441…` e `046c7262…`, e toda a auditoria.
- A reversão que afeta o KPI de novembro (parcela 227) é, portanto, uma linha
  **`test` no banco de produção**. Isso não a torna “de outro banco”.
- A decisão do KPI e a regra de “vencido” devem ser tomadas com essa
  ambientação explícita: se a regra for por ambiente, ela precisa dizer se
  inclui `production`, `test` ou ambos.

## 4. Histórico da regra

- **26/11/2026:** o usuário corrigiu a interpretação de que `test` pudesse ser
  um banco separado. A regra acima passa a ser permanente e prevalece sobre
  qualquer inferência anterior em contrário.
