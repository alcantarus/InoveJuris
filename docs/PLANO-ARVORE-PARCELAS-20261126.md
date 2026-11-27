# Plano — árvore de parcelas `1 → 1.1 → 1.1.1` (26/11/2026)

> **Decisões aprovadas:** banco + front; **só parcelas novas** (sem backfill);
> estorno de parcela com filha **bloqueado com aviso**.
> **Nada é publicado sem pedido explícito.**

---

## 1. O que muda

| Antes | Depois |
|---|---|
| Residual criada com `MAX(installmentNumber)+1`, sem vínculo | Residual criada com `parent_installment_id` e `installment_path` |
| Tela mostra `6` longe da origem | Tela mostra `1`, `1.1`, `1.1.1` com indentação |
| Estorno isolado da origem deixa saldo órfão | Botão bloqueado: “Estorne a partir da última subparcela” |

Valores, vencimentos, pagamentos e totais do contrato **não são alterados**.

---

## 2. Ordem de execução (SQL — você roda no SQL Editor)

### 2.1 Pré-checagem (somente leitura)

Rode `docs/VERIFY-RESIDUAL-263-POS-RECEBIMENTO-20261126.sql` se quiser
reconfirmar o estado do contrato 138 em `test`. Não é obrigatório para a
migração; serve de linha de base.

### 2.2 FORWARD em `test`

1. Abra o SQL Editor do projeto de **test** (org `cf4c416b-…`).
2. Cole `docs/FORWARD-ARVORE-PARCELAS-20261126.sql`.
3. Confira o SELECT final:
   - `colunas_novas = 2`
   - `linhas_vinculadas = 0` (sem backfill)
   - `backup_rpc = 1`
4. Cole o resultado no chat.

> Se aparecer “Abortado: … não é a v8 esperada”, **pare**: a RPC mudou desde
> 25/11. Não force a substituição.

### 2.3 VERIFY em `test`

Rode `docs/VERIFY-ARVORE-PARCELAS-20261126.sql`. Todas as linhas devem trazer
`situacao = OK` (a linha “sem backfill” deve dizer `OK — só parcelas novas`) e a
linha `resumo` deve trazer `PASS`.

### 2.4 Teste funcional em `test` (a sua vez)

Com a tela já publicada com o front desta rodada:

1. Abra um contrato de teste com parcela em aberto.
2. Receba **parcialmente** a parcela `1` → conferir `1.1`.
3. Receba **parcialmente** a `1.1` → conferir `1.1.1`.
4. Receba **parcialmente** a `1.1.1` → conferir `1.1.1.1`.
5. Receba parcialmente a parcela `2` → conferir `2.1`.
6. Tente `Estornar` na `1`: botão deve estar bloqueado com o aviso.
7. Confira que o “A receber” do contrato continua igual à soma das folhas.

**Não vou executar recebimentos, estornos ou cancelamentos.** Os passos acima
são para você, no ambiente de teste.

### 2.5 Produção

Só depois de `test` PASS e da sua autorização explícita:
FORWARD → VERIFY em `production` (org `eaf29983-…`). Mesmo gate, mesma ordem.

---

## 3. Rollback

Antes de qualquer correção, o `FORWARD` já salva a definição exata da RPC em
`public.backup_func_desdobramento_arvore_20261126`.

Para reverter: rode `docs/ROLLBACK-ARVORE-PARCELAS-20261126.sql` no mesmo
projeto. Ele:

- restaura a RPC v8 do backup (só se a atual for a v9);
- remove os dois índices, a constraint e as duas colunas;
- **preserva a linha de backup** como evidência;
- **não apaga** parcelas/pagamentos criados após o FORWARD.

---

## 4. Compatibilidade com o legado

- Parcelas já desdobradas (ex.: `263` filha de `258`) **não** recebem path nem
  vínculo — continuam com número inteiro e com os badges atuais.
- O front lê `installment_path`/`parent_installment_id` quando existem e cai
  no critério antigo (número > total de parcelas) quando não existem.
- A ordenação nova agrupa por raiz; linhas sem path ficam na ordem antiga,
  dentro da mesma raiz.

---

## 5. Validação de código (antes de commitar/publicar)

```powershell
npx tsc --noEmit
npx eslint app/contas-a-receber/page.tsx
```

Restaurar `tsconfig.tsbuildinfo` se o `tsc` o alterar. Commit e deploy **só com
pedido explícito**.
