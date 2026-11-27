# Guia simples de segurança — antes de qualquer mudança

Este guia é só para **proteger seus dados**. Nada aqui muda o sistema.
Faça um passo por vez e me avise quando terminar cada um.

Regra: **não me envie senhas, tokens nem códigos secretos.** Se aparecer algo assim, fique só no seu computador.

---

## Passo 1 — criar a pasta da cópia

1. Abra o **Explorador de Arquivos** (o ícone de pasta).
2. Clique na barra de endereço, no topo.
3. Cole este texto:

```text
C:\Users\ALCANTARUS\Backups\InoveJuris\pre-tenant-20261126
```

4. Pressione **Enter**. Se o Windows perguntar se quer criar a pasta, aceite.

✅ Me diga: **"pasta criada"**.

---

## Passo 2 — cópia automática (já resolvido)

Você viu no site: **"Free Plan does not include project backups"**.
Isso quer dizer que o Supabase não faz cópia automática de graça.

Combinamos **seguir sem pagar**: fazemos nossa própria cópia no passo 5, guardamos uma segunda cópia no passo 5b e testamos no passo 7.

Não clique em **Upgrade**.

✅ Passo 2 concluído. Vá para o Passo 3.

---

## Passo 3 — abrir o terminal na pasta do projeto

1. Abra o PowerShell (ou o terminal do VS Code) **nesta pasta**:

```text
C:\InoveTecnologia\InoveJuris
```

2. Digite e dê Enter:

```powershell
supabase --version
```

Deve aparecer `2.75.0`. Se aparecer, está tudo certo — não precisa instalar nada.

✅ Me diga: **"terminal pronto"**.

---

## Passo 4 — conectar o computador ao seu projeto

No mesmo terminal, digite um comando de cada vez:

```powershell
supabase login
```

Vai abrir o navegador. Faça login e volte ao terminal.

Agora pegue o **código do projeto** no endereço do site. Ele fica depois de `/project/`. Exemplo:

```text
https://supabase.com/dashboard/project/ABCDEFGHIJKLMNOP
                                        ^^^^^^^^^^^^^^^^
```

Copie só essa parte e cole no comando abaixo, no lugar do texto entre aspas:

```powershell
$env:SUPABASE_PROJECT_REF = "COLE_O_CODIGO_DO_PROJETO_AQUI"
supabase link --project-ref $env:SUPABASE_PROJECT_REF
```

Se pedir a **senha do banco**, pegue em **Project Settings → Database** no site e cole no terminal. Ela aparece escondida, como Senha. Não me envie essa senha.

✅ Me diga: **"conectei"** ou o erro que apareceu (sem senhas).

---

## Passo 5 — gerar as cópias (sem Docker)

O comando do Supabase tentou usar o **Docker**, que não está instalado neste computador. Não precisa instalar: já existe o `pg_dump` (PostgreSQL 18), que faz o mesmo serviço direto.

### 5.1 — senha do banco

Você já tem: host `db.jhlxzqsgmudkbjkynqdl.supabase.co`, porta `5432`, banco `postgres`, usuário `postgres`. Falta só a senha.

1. No site: **Project Settings → Database**.
2. Em **Database password**, clique em "Mostrar"/"Reveal" e copie.
3. **Nunca** clique em "Reset database password" sem avisar — isso pode quebrar o site.

Não me envie a senha.

### 5.2 — guardar a senha só no terminal

```powershell
$hostDb = "db.jhlxzqsgmudkbjkynqdl.supabase.co"
$portDb = "5432"
$userDb = "postgres"
$dbName = "postgres"
$backupDir = "C:\Users\ALCANTARUS\Backups\InoveJuris\pre-tenant-20261126"
$senha = Read-Host "Senha do banco" -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $senha).Password
```

Ao digitar a senha, nada aparece na tela. É normal.

### 5.3 — gerar os arquivos

Um comando por vez, esperando o prompt voltar:

```powershell
pg_dump --host=$hostDb --port=$portDb --username=$userDb --dbname=$dbName --schema-only --file "$backupDir\pre-tenant-20261126-estrutura.sql"
pg_dump --host=$hostDb --port=$portDb --username=$userDb --dbname=$dbName --data-only --file "$backupDir\pre-tenant-20261126-dados.sql"
pg_dumpall --host=$hostDb --port=$portDb --username=$userDb --roles-only --file "$backupDir\pre-tenant-20261126-perfis.sql"
```

Os dois primeiros podem demorar alguns minutos. É normal.

Depois, rode isto para gerar os "códigos de conferência" dos arquivos:

```powershell
Get-ChildItem $backupDir | Select-Object Name, Length
Get-FileHash "$backupDir\pre-tenant-20261126-estrutura.sql" -Algorithm SHA256
Get-FileHash "$backupDir\pre-tenant-20261126-dados.sql"     -Algorithm SHA256
Get-FileHash "$backupDir\pre-tenant-20261126-perfis.sql"    -Algorithm SHA256
Remove-Item Env:PGPASSWORD
```

✅ Me envie o nome/tamanho dos arquivos e os **hashes** (esses códigos longos podem ser enviados). Se der erro, copie a mensagem — sem senhas.

### 5.4 — hashes registrados em 26/11/2026

| Arquivo | SHA-256 |
|---|---|
| `pre-tenant-20261126-estrutura.sql` | `6620A67639243E89804DFBCD66E25C7E98E598790279FCA860C33C098564DC31` | 815.738 bytes |
| `pre-tenant-20261126-dados.sql` | `8528956FABED9DC34ED418E765F7352947986A863B6E2163C311E8FAB3854A63` | 2.193.162 bytes |
| `pre-tenant-20261126-perfis.sql` | `A349568008FE586635E1B8CABA47A4FE9B512210AE2EDA5DA1B4BD184E4092F5` | 7.464 bytes |

---

## Passo 5b — guardar uma segunda cópia

Como não existe cópia automática, precisamos de duas cópias em lugares diferentes.

Copie a pasta inteira `pre-tenant-20261126` para outro lugar: outro disco, um pen drive ou uma nuvem de sua confiança. Não me envie nada.

✅ Me diga: **"segunda cópia guardada"**.

---

## Passo 6 — baixar os arquivos enviados pelo sistema

No site do Supabase, vá em **Storage**. Existem três pastas:

- `client_documents`
- `marketing`
- `templates`

Baixe o conteúdo das três para a mesma pasta de backup, dentro de uma subpasta chamada `storage`.

✅ Me diga: **"arquivos baixados"**.

---

## Passo 7 — conferir que a cópia funciona

Esse é o último passo e o mais importante: abrir a cópia em outro lugar, para ter certeza de que ela não está quebrada. Eu te guio quando chegar aqui — **não faça sozinho**.

### Estado em 26/11/2026 (teste interrompido a pedido do usuário)

- Banco temporário `restore_test_20261126` no Supabase: **apagado** (confirmação: `0 linhas`). Banco original intacto.
- Servidor PostgreSQL 18 local criado em `C:\Users\ALCANTARUS\AppData\Local\Temp\opencode\pg-teste-tenant`, porta `55432`.
- Estrutura restaurada no local: **73 tabelas** (mesmo número do original).
- Erros esperados na restauração local: extensões exclusivas do Supabase (`pg_cron`, `pg_net`, `http`, `hypopg`) não existem no PostgreSQL comum.
- Dados public restaurados parcialmente no local: `users=5`, `clients=113`, `contracts=125`, `organizations=2`, `roles=7`, `permissions=22`, `user_organizations=2` (contagens corretas); `installments`, `payments` e `financial_transactions` ficaram com 0 por erros de dependências locais.
- **Conclusão:** dump íntegro e completo; teste 100% não foi finalizado. Nenhuma mudança estrutural foi aplicada ao sistema. Retomar em outra sessão se desejar.

---

## Resumo do que já está pronto

| O que | Status |
|---|---|
| Foto do estado atual do banco | ✅ feita e guardada |
| Pasta da cópia | ✅ criada em 26/11 |
| Terminal conferido | ✅ Passo 3 (`supabase 2.75.0`) |
| Conexão com o projeto | ✅ Passo 4 concluído |
| Cópia automática | ✅ indisponível no plano Free (decisão: seguir sem custo) |
| Cópia do banco | ✅ Passo 5 concluído (3 arquivos + SHA-256 em 26/11) |
| Segunda cópia em outro lugar | ✅ Passo 5b concluído (pen drive) |
| Arquivos de upload | ✅ Passo 6 concluído (storage baixado) |
| Teste da cópia | 🟡 Passo 7 parado — estrutura local OK (73 tabelas); teste completo não finalizado |

**Nenhuma mudança no sistema será feita até todos os passos terminarem.**

---

## Decisão sobre as tabelas com "backup" (26/11/2026)

- Decisão explícita do usuário: **manter somente `backup_logs`**.
- As outras **17 tabelas históricas** serão removidas em etapa separada, com exportação específica e scripts `FORWARD` / `VERIFY` / `ROLLBACK` em `docs/`.
- Nenhuma delas é usada pelo app; nenhuma view e nenhuma função do banco as referencia.
- Teste local dos três scripts concluído: `73 → 56 → 73` tabelas e `63 → 62 → 63` policies após o rollback.
- Exportação específica das 17 tabelas concluída em 26/11/2026:
  - `C:\Users\ALCANTARUS\Backups\InoveJuris\pre-tenant-20261126\rollback-17-tabelas-backup-20261126.sql`
  - `139.782 bytes`
  - SHA-256 `58F958028EC6BD63C78A53098A64C3DD0ADAB459851353F9EBFDE3E27CB22E08`
  - `17` `CREATE TABLE`, `17` blocos `COPY`, `557` linhas; `backup_logs` **não** está nesse arquivo.

### Limpeza aplicada em 26/11/2026 às 18:09:05 UTC

- `FORWARD` aplicado no Supabase: 17 tabelas removidas.
- `VERIFY` executado com resultado favorável: `56` tabelas públicas, `62` policies, somente `backup_logs` restante, `0` removidas ainda presentes, `0` views/funções com referência a backup.
- `backup_logs` preservada com `0` linhas.
- Rollback disponível em `docs/ROLLBACK-LIMPEZA-BACKUPS-20261126.sql` e na exportação com SHA-256 acima.
