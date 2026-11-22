# Rotina de Backup/Restore do Supabase — registro da sessão (2026-11-20)

> Registro consolidado da conversa em que a rotina de backup/restore do projeto Supabase do
> InoveJuris foi criada, executada de verdade e corrigida. Serve de referência futura para
> retomar, executar e auditar o processo.
>
> Use junto com `docs/STATUS-INOVEJURIS.md`, `docs/HANDOFF-PENDENCIAS-20261120.md` e
> `docs/PARECER-JWT.md`.

---

## 0. AVISO DE SEGURANÇA — leia antes de qualquer execução

- A senha do Postgres foi **colada no chat** e ficou embutida em `C:\temp\backup-supabase.ps1`.
  Ela deve ser considerada **comprometida e rotacionada**. O valor real **não** foi reproduzido
  neste documento (regra de `docs/HANDOFF-PENDENCIAS-20261120.md`).
- `$EncryptPassword`, `$ServiceRoleKey` e `$ManagementToken` estavam **vazios** nas execuções
  registradas:
  - sem `$EncryptPassword`, o backup roda com `-AllowPlaintext` e `vault-secrets.json` fica em
    **texto claro** dentro de `working\`;
  - sem `ServiceRoleKey`, os **bytes** do Storage não são baixados (só o metadata SQL);
  - sem `ManagementToken`, Edge Functions e configurações do projeto não são exportadas.
- Diretórios parciais de execuções falhas podem conter segredos em claro e devem ser apagados
  antes de qualquer outra coisa (comando na §7).

---

## 1. Identificação do ambiente

| Item | Valor |
|---|---|
| Projeto | InoveJuris — Supabase |
| `project_ref` | `jhlxzqsgmudkbjkynqdl` |
| Região | `aws-1-sa-east-1` |
| Banco | `postgres` |
| Host direto | `db.jhlxzqsgmudkbjkynqdl.supabase.co:5432` — usuário `postgres` |
| Pooler de sessão | `aws-1-sa-east-1.pooler.supabase.com:5432` — usuário `postgres.jhlxzqsgmudkbjkynqdl` |
| Cliente PostgreSQL | `C:\Program Files\PostgreSQL\18\bin` (major 18); servidor do dump: PostgreSQL 17.6 |
| 7-Zip | `C:\Program Files\7-Zip\7z.exe` |
| PowerShell | 5.1 (comportamentos específicos listados na §5) |
| Raiz dos backups | `C:\Backup\Supabase\inovejuris` (`working\`, `arquivos\`, `logs\`) |
| Scripts (versão viva) | `C:\temp\backup-supabase.ps1` e `C:\temp\restore-supabase.ps1` |
| Dump original analisado | `C:\Temp\dump-inovejuris.dump` |

### 1.1 Diagnóstico do dump original

O arquivo `C:\Temp\dump-inovejuris.dump` era **SQL texto puro**, UTF-8 sem BOM, completo,
gerado por `pg_dump` 18.3 contra PostgreSQL 17.6, com 113 blocos `COPY`, 1 usuário em
`auth.users` e 34 objetos em `storage.objects`.

Conclusão: o dump cobria **apenas o banco**. Não estavam incluídos bytes do Storage, código das
Edge Functions, JWT/API keys, config do projeto, SMTP/OAuth e roles Postgres. Foi por isso que a
rotina foi ampliada.

### 1.2 Rowcounts de referência (baseline)

Última execução que chegou até esta etapa (`20261120_003313`):

```json
{"auth.users":1,"auth.sessions":0,"storage.buckets":3,"storage.objects":34,
 "public.clients":113,"public.contracts":122,"public.installments":166,
 "public.audit_logs":2528}
```

---

## 2. O que a rotina de backup cobre

`C:\temp\backup-supabase.ps1` — 13 etapas, com manifesto e validação:

1. Banco com `pg_dump -Fc -Z6 -f` (formato custom, comprimido).
2. Globals/roles com `pg_dumpall -g` (sem `-d`).
3. Rowcounts de referência para comparar no restore.
4. Jobs do `cron` e segredos descriptografados do Vault.
5. Metadata dos objetos do Storage.
6. Download dos bytes do Storage via REST + `service_role` (depende da chave).
7. Edge Functions (código + metadados via Management API — depende do token).
8. Configurações do projeto (Auth/Storage/Realtime/API keys — depende do token).
9. Validação do TOC via `pg_restore -l` + 6 assinaturas obrigatórias.
10. `MANIFEST.json` + `SHA256SUMS.csv`.
11. Compactação 7z AES-256 com `-mhe=on` e teste `7z t` (quando `$EncryptPassword` está preenchido).
12. Retenção: 7 diários / 4 semanais / 12 mensais.
13. Log em `logs\backup_<timestamp>.log` e webhook opcional (`-NotifyWebhook`).

### 2.1 Decisões técnicas

| Decisão | Motivo |
|---|---|
| `pg_dump -Fc -Z6 -f arquivo` em vez de `>` | Redirecionamento do PowerShell 5.1 gera UTF-16 e corrompe o dump |
| `$env:PGPASSWORD` + `-h/-U/-d` em vez de URI | A senha contém `#`, `@` e `!`, que quebram a URI |
| Pooler de sessão primeiro, direto como fallback | A conexão direta IPv6 do Supabase oscilava com `Connection timed out`; o pooler foi 100% estável |
| Usuário depende do host | Direto = `postgres`; pooler = `postgres.<ref>` |
| `pg_dumpall -g` sem `-d` | Nesse comando `-d` é *connection string*, não nome de banco; `-d postgres` gerava erro de parse |
| `-Fc` em vez de SQL texto | Necessário para `pg_restore` seletivo e para o TOC usado na validação |
| Cliente 17+ obrigatório | O dump usa `\restrict`/`\unrestrict` e `transaction_timeout` |
| AES-256 com cabeçalho criptografado | `-mhe=on` esconde até os nomes dos arquivos dentro do 7z |

---

## 3. Erros encontrados na execução real e correções aplicadas

Todas as correções estão em `C:\temp\backup-supabase.ps1`.

| # | Sintoma | Causa raiz | Correção |
|---:|---|---|---|
| 1 | `column "objects.bucket_id" must appear in the GROUP BY clause...` | `ORDER BY bucket_id, name` estava **fora** do `json_agg` | Ordenação movida para dentro: `json_agg(json_build_object(...) ORDER BY bucket_id, name)` |
| 2 | `faltando "=" ap¾s "postgres" na cadeia de caracteres de informaþ§es da conexÒo` (`pg_dumpall`) | `-d postgres` foi passado; no `pg_dumpall`, `-d` é connection string | Removido `-d` da chamada; testado: `globals.sql` de 7,4 KB, exit 0 |
| 3 | `password authentication failed for user "postgres.jhlxzqsgmudkbjkynqdl"` no host direto | Usuário do direto é `postgres`; o sufixo `.<ref>` só vale no pooler | Seleção do usuário por host (`$dbUserEffective`) |
| 4 | Mesmo erro de autenticação **depois** do item 3 | A correção foi aplicada só na conexão de teste; as 4 consultas seguintes continuavam com `$DbUser` padrão | Todas as chamadas de `Invoke-PgQuery` passaram a receber `-User $dbUserEffective`; default da função também trocado |
| 5 | `0` solto no console | `return $code` do helper `Invoke-Native` sendo impresso | `return` removido |
| 6 | `Storage: 1 objeto(s) no manifesto` (esperado 34) | Bug do PowerShell 5.1: `@($json \| ConvertFrom-Json)` retorna **1** quando a raiz é array | Atribuir numa variável primeiro, depois `@()`; mesma correção aplicada à lista de Edge Functions |
| 7 | `nao encontrei 'PUBLICATION supabase_realtime' no TOC` | O `pg_restore -l` escreve `PUBLICATION - supabase_realtime` (com `-` no lugar do schema) | Assinaturas trocadas por regex tolerante: `PUBLICATION[^\r\n]*supabase_realtime` e `EXTENSION[^\r\n]*supabase_vault` |
| 8 | Timeout intermitente no host direto | IPv6 do Supabase oscilando | Ordem dos hosts invertida: pooler primeiro |
| 9 | `Connection timed out` ao testar o direto após a correção do usuário | Confirmou a instabilidade do item 8 | Mantido pooler como primário |

### 3.1 Cronologia das execuções

| Timestamp do backup | Resultado |
|---|---|
| `20261120_002548` | Falhou: GROUP BY, `pg_dumpall -d` e usuário do pooler no host direto |
| `20261120_002937` | Falhou: teste de conexão com usuário certo, mas consultas seguintes com usuário errado |
| `20261120_003313` | Chegou até rowcounts/Storage, falhou na validação do TOC (regex). Foi a última execução; **não houve nova execução após a correção do TOC** |

Após a última correção, validações feitas:

- sintaxe de `backup-supabase.ps1`: **0 erros**;
- consulta corrigida do Storage executada no banco: **exit 0, 34 objetos**;
- `pg_dumpall -g` sem `-d`: **exit 0, 7453 bytes**;
- dump fresco + `pg_restore -l`: **6/6 assinaturas True**.

---

## 4. Rotina de restore / teste

`C:\temp\restore-supabase.ps1` foi comparada com a versão nova do backup e estava **desatualizada
em 3 pontos**, um deles com risco de falso positivo. Correções aplicadas (sintaxe validada, 0 erros):

| Problema | Impacto | Correção |
|---|---|---|
| `-Archive` só aceitava `.7z`/`.dump` | Não funcionava com as pastas do `-AllowPlaintext` | Aceita diretamente `working\inovejuris_*`; `MANIFEST.json` localizado recursivamente |
| Validava só o `exit code` do `pg_restore -l` | Dump legível mas corrompido passaria | Exige as mesmas 6 assinaturas do backup, com as regex tolerantes |
| Ignorava Storage/Functions/config | Dizia "PASSOU" com banco perfeito mesmo sem nenhum byte de Storage | Auditoria de cobertura: conta arquivos em `storage\`, `.ts` em `functions\`, JSONs em `config\management\` e lê `steps_warn` do manifesto |

### 4.1 Exit codes do restore

```
0 = banco OK + pacote completo
3 = banco OK, mas pacote incompleto (Storage/Functions/config faltando)
2 = divergência de rowcounts
1 = erro
```

No estado atual (chaves vazias), o teste deve retornar **3**, não 0. Isso é intencional: o script
não deve dar falsa sensação de segurança.

### 4.2 Limitação de escopo

O `restore-supabase.ps1` é **teste de restauração do banco**, não o restore de produção. Ele não
reaplica JWT/config no Supabase nem reenvia os arquivos ao Storage — isso está no runbook das
seções 6 e 7. Ele apenas garante que o pacote contém de fato o que promete conter.

---

## 5. Comandos de referência

### 5.1 Backup (modo diagnóstico, sem criptografia)

```powershell
cd C:\temp
powershell -ExecutionPolicy Bypass -File .\backup-supabase.ps1 -AllowPlaintext
```

### 5.2 Backup final (objetivo — após preencher os campos)

Editar no topo de `C:\temp\backup-supabase.ps1`:

- `$EncryptPassword` — senha do 7z AES-256;
- `$ServiceRoleKey` — Dashboard → Project Settings → API → `service_role` (secret);
- `$ManagementToken` — https://supabase.com/dashboard/account/tokens (PAT `sbp_...`);
- `$DbPass` — **senha nova**, após a rotação.

Depois rodar **sem** `-AllowPlaintext`:

```powershell
cd C:\temp
powershell -ExecutionPolicy Bypass -File .\backup-supabase.ps1
```

O script grava `arquivos\inovejuris_<timestamp>.7z`, cria o `.sha256`, roda `7z t`, apaga o
`working\` temporário e aplica a retenção.

### 5.3 Teste de restore local

```powershell
docker run -d --name pg17-check -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17

powershell -ExecutionPolicy Bypass -File .\restore-supabase.ps1 `
  -Archive 'C:\Backup\Supabase\inovejuris\working\inovejuris_20261120_003313' `
  -LocalAdminUrl 'postgresql://postgres:postgres@localhost:55432/postgres'
```

Para o pacote final criptografado, trocar `-Archive` pelo `.7z` e informar `-EncryptPassword`.
Ajustar o timestamp da pasta para o da execução nova. Serve qualquer Postgres 17 ou 18 local —
é só trocar a URL.

---

## 6. Estado atual (congelado neste registro)

- Rotina de backup **funcional até a validação do TOC**, com as correções aplicadas e testadas
  isoladamente. **Não houve execução completa nova** depois da correção da regex do TOC.
- Rotina de restore **atualizada** para a versão nova do backup; **não foi executada**.
- `C:\Backup\Supabase` foi apagado pelo usuário durante o processo; o script recria a estrutura.
- Nenhum backup criptografado foi gerado até agora.
- Nenhuma alteração foi feita em produção, autenticação, variáveis da Vercel ou código do app.
- Dados do banco inalterados: todas as consultas foram `SELECT` ou dumps.

---

## 7. Pendências para retomar

| # | Pendência | Prioridade | Observação |
|---:|---|---|---|
| 1 | Apagar diretórios parciais com segredos em claro | **Alta** | `Remove-Item 'C:\Backup\Supabase\inovejuris\working\inovejuris_20261120_002548','C:\Backup\Supabase\inovejuris\working\inovejuris_20261120_002937' -Recurse -Force -ErrorAction SilentlyContinue` |
| 2 | Rotacionar a senha do Postgres | **Alta** | Vazou em chat e ficou no script; trocar no Supabase e atualizar `$DbPass` |
| 3 | Preencher `$EncryptPassword`, `$ServiceRoleKey` e `$ManagementToken` | **Alta** | Sem eles não há Storage bytes, Functions, config nem criptografia |
| 4 | Rodar o backup completo uma vez após as correções | **Alta** | Confirmar `Storage: 34 objeto(s)` e `Validacao do TOC: 6/6` |
| 5 | Subir Postgres local e executar o teste de restore | **Alta** | Esperado: exit `3` no estado sem chaves; exit `0` no estado completo |
| 6 | Mover os scripts de `C:\temp\` para um local versionado do InoveJuris | Média | Hoje vivem em pasta temporária |
| 7 | Agendar o backup (Task Scheduler) e testar o webhook | Média | Só após o fluxo manual estar estável |
| 8 | Revisar `docs/PARECER-JWT.md` na restauração | Média | JWT secret/API keys não voltam pelo `pg_dump` sozinho |

---

## 8. Regras que continuam valendo

- Credenciais, tokens e chaves privadas **não** devem ser colados no chat nem persistidos em
  arquivos/documentação.
- Nunca rodar restore contra produção; o script é somente para Postgres local de teste.
- Não considerar backup válido sem `7z t` e sem o teste de restore com rowcounts conferidos.
- "PASSOU" só com exit code `0`. Exit `3` significa banco íntegro, mas pacote incompleto.
- Documento mestre do projeto: `docs/STATUS-INOVEJURIS.md`.
