# Backup completo pré-tenant — 26/11/2026

> **Procedimento preparado, não executado.** Nenhum comando abaixo foi rodado pelo agente.
> Nenhuma credencial deve ser colada no chat. Use variáveis de ambiente locais.
> `production` e `test` são valores de `environment` em **um único banco** — ver `CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

---

## 1. Regras

1. Guardar os dumps **fora do repositório Git**. Dumps com dados reais não devem ser comitados.
2. Registrar data/hora exata, hash SHA-256 e o projeto Supabase de origem.
3. **Nunca testar restore diretamente em produção.** Restaurar primeiro em staging/local.
4. O backup precisa cobrir quatro frentes: banco, PITR, Storage e configuração.
5. Só avançar para o `FORWARD-ESCOPO-FUNDACAO` depois que os quatro itens estiverem confirmados.

---

## 2. Camada 1 — PITR / ponto de restauração

**Confirmado em 26/11/2026:** o projeto está no **Free Plan**. O Dashboard exibe
"Free Plan does not include project backups". Portanto **não há PITR nem backups
automáticos**, e não há como ativá-los sem upgrade pago.

**Decisão do usuário em 26/11/2026:** seguir **sem custo**, sem upgrade. O gate de
PITR é substituído por controles compensatórios obrigatórios:

1. dumps de estrutura + dados + perfis, com hashes SHA-256;
2. download dos arquivos do Storage;
3. export da configuração;
4. **restore testado em banco novo** antes de qualquer `forward`;
5. **segunda cópia em local físico diferente** (outro disco, pen drive ou nuvem de confiança).

Registrar em local seguro:

```text
rotulo: pre-tenant-20261126
timestamp UTC: 2026-11-26T14:50:49.912514+00:00 (snapshot lógico)
wal_lsn: 5C/A7000000
projeto Supabase: <ref do projeto>
PITR: indisponível (Free Plan) — decisão: seguir sem custo
```

Nenhum `forward` pode ser executado enquanto os cinco controles acima não estiverem concluídos.

---

## 3. Camada 2 — cópia lógica (estrutura + dados)

**Docker não está instalado nesta máquina.** `supabase db dump` falha com
`docker_engine: O sistema não pode encontrar o arquivo especificado`.

Alternativa adotada: `pg_dump` / `pg_dumpall` do PostgreSQL 18, já instalados em
`C:\Program Files\PostgreSQL\18\bin\`. Eles conectam direto, sem Docker, e por
padrão incluem **todos os esquemas** (`public`, `auth`, `storage`), ao contrário
do dump da CLI. Nenhum token ou senha deve ser colado no chat.

Diretório fora do repositório:

```powershell
$backupDir = "C:\Users\ALCANTARUS\Backups\InoveJuris\pre-tenant-20261126"
New-Item -ItemType Directory -Force -Path $backupDir
```

Dados de conexão medidos pelo usuário em 26/11: host
`db.jhlxzqsgmudkbjkynqdl.supabase.co`, porta `5432`, database `postgres`,
user `postgres`. A senha é pedida escondida no terminal; **nunca** redefinir a
senha do banco sem autorização (isso pode quebrar a aplicação).

```powershell
$hostDb = "db.jhlxzqsgmudkbjkynqdl.supabase.co"
$portDb = "5432"
$userDb = "postgres"
$dbName = "postgres"
$senha = Read-Host "Senha do banco" -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $senha).Password
```

Três arquivos:

```powershell
pg_dump --host=$hostDb --port=$portDb --username=$userDb --dbname=$dbName --schema-only --file "$backupDir\pre-tenant-20261126-estrutura.sql"
pg_dump --host=$hostDb --port=$portDb --username=$userDb --dbname=$dbName --data-only --file "$backupDir\pre-tenant-20261126-dados.sql"
pg_dumpall --host=$hostDb --port=$portDb --username=$userDb --roles-only --file "$backupDir\pre-tenant-20261126-perfis.sql"
```

Depois dos dumps, limpar a variável da senha:

```powershell
Remove-Item Env:PGPASSWORD
```

Hashes para conferir integridade:

```powershell
Get-FileHash "$backupDir\pre-tenant-20261126-estrutura.sql" -Algorithm SHA256
Get-FileHash "$backupDir\pre-tenant-20261126-dados.sql"     -Algorithm SHA256
Get-FileHash "$backupDir\pre-tenant-20261126-perfis.sql"    -Algorithm SHA256
```

Registre os três hashes. Eles são a prova de que o backup não foi alterado depois de gerado.

> Arquivos enviados ao Storage **não** estão no dump do banco (só metadados). Baixar separadamente (seção 4). Se algum dump falhar, anotar o erro exato antes de seguir.

---

## 4. Camada 3 — Storage

Os buckets medidos em 26/11 são:

| Bucket | Público | Limite |
|---|---|---|
| `client_documents` | não | — |
| `marketing` | não | — |
| `templates` | não | 10 MB |

Faça download dos três pelo **Dashboard → Storage**, ou, se o seu CLI tiver suporte, confirme primeiro:

```powershell
npx supabase storage --help
```

Se houver comando de cópia disponível, use-o com as mesmas variáveis de ambiente locais. Caso contrário, o download manual pelo Dashboard é suficiente.

Guardar em:

```text
$backupDir\storage\client_documents\
$backupDir\storage\marketing\
$backupDir\storage\templates\
```

---

## 5. Camada 4 — configuração

Exportar ou anotar, fora do chat:

- variáveis de ambiente da Vercel;
- `.env.local`;
- `system_settings` (`session_timeout`, `maintenance_mode`, preferências, integrações);
- `backup_settings` e `backup_logs`;
- tokens OAuth de e-mail;
- configuração de SMTP e domínio;
- logo e arquivos estáticos usados pela Sidebar.

Nenhum segredo deve ser colado neste documento nem enviado por mensagem.

---

## 6. Snapshot lógico no SQL Editor

Executar, em uma única célula:

```text
docs/VERIFY-BACKUP-PRE-TENANT-20261126.sql
```

Ele devolve um JSON com `now()`, LSN do WAL, contagens por `environment`, catálogos, policies, buckets e estado dos helpers. Salve esse JSON junto com os hashes.

Resultado recebido em 26/11/2026 e arquivado em `SNAPSHOT-BACKUP-PRE-TENANT-20261126.json`: `snapshot_em=2026-11-26T14:50:49.912514+00:00`, `wal_lsn=5C/A7000000`, `pg_version=17.6`, banco `postgres`.

**Esse JSON não é o backup.** É apenas o estado lógico de referência. Ele permite responder, depois de qualquer falha: "o que mudou entre o backup e o problema?". O backup continua sendo PITR + dumps + Storage + configuração.

---

## 7. Teste de restore (antes do forward)

1. Criar projeto Supabase de staging ou banco local.
2. Restaurar `pre-tenant-20261126-full.sql`.
3. Conferir contagens com o JSON do snapshot.
4. Aplicar, no staging, o `FORWARD-ESCOPO-FUNDACAO` e o `FORWARD-ESCOPO-RLS-TESTE`.
5. Rodar os respectivos `VERIFY` no staging.
6. Comparar com o snapshot salvo antes de seguir.
7. Só então executar no banco real.

---

## 8. Checklist para liberar o forward

- [x] PITR indisponível no Free Plan (decisão registrada: seguir sem custo).
- [ ] `-estrutura.sql` gerado, com hash SHA-256 registrado.
- [ ] `-dados.sql` gerado, com hash (ou erro justificado).
- [ ] `-perfis.sql` gerado, com hash.
- [ ] Storage baixado.
- [ ] Configuração exportada.
- [x] JSON do `VERIFY-BACKUP-PRE-TENANT-20261126.sql` salvo em `SNAPSHOT-BACKUP-PRE-TENANT-20261126.json` (14:50:49 UTC, LSN `5C/A7000000`).
- [ ] Restore testado em staging/local.
- [ ] Segunda cópia guardada em local físico diferente (compensa a ausência de PITR).

Enquanto esse checklist não estiver completo, **nenhum `forward` deve ser executado**.
