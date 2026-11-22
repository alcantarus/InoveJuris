# Decisão de armazenamento de documentos — InoveJuris (22/11/2026)

## Status

**Decisão pendente.** Este documento registra o estado atual, as opções avaliadas e o plano de
integração para escolha futura. Nenhuma alteração de código, banco, autenticação ou fluxo
financeiro foi feita por causa desta análise. Nenhum SQL foi executado.

## Objetivo

Definir plataforma/ambiente para armazenar documentos de clientes: JPG, PNG, DOCX, XLSX, PDF —
contratos assinados, laudos, exames e fotografias — com confiabilidade, segurança, estabilidade,
eficácia e velocidade, integrado ao InoveJuris, preferencialmente sem custo adicional.

## 1. Estado atual do storage no InoveJuris

### 1.1 Buckets

| Bucket | Uso | Estado |
|---|---|---|
| `client_documents` | documentos de clientes | privado desde 18/11/2026 (F6b) |
| `templates` | modelos DOCX | privado; 10 MB; só MIME DOCX no SQL legado |
| `marketing` | imagens de cartões/aniversário | privado; criado fora do código (painel) |

Lista canônica: `lib/storage-server.ts:4` e `lib/storage-client.ts:1`
(`STORAGE_BUCKETS = ['client_documents', 'templates', 'marketing']`).
Inventário anterior: `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md:544-558` e
`docs/STATUS-INOVEJURIS.md:166-170`. Virada para privado: `forward_f6.sql` (fora do repo,
`C:\InoveTecnologia\InoveJuris-Backups\F6-20261118\`), resultando em 0 buckets públicos e
0 policies (`docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md:673-682`).

### 1.2 Rotas servidor

| Rota | Arquivo | Comportamento |
|---|---|---|
| `POST /api/storage/upload` | `app/api/storage/upload/route.ts:35-85` | FormData, service role, máx. 10 MB, `upsert: false` |
| `GET /api/storage/signed-url` | `app/api/storage/signed-url/route.ts:26-69` | URL assinada, TTL 3600 s, `redirect=1` → 302 |
| `POST /api/storage/remove` | `app/api/storage/remove/route.ts:24-49` | remove objeto por bucket/path |

Infraestrutura: `lib/storage-server.ts:14-103` (validação de bucket, cliente service role via
`SUPABASE_SERVICE_ROLE_KEY`, validação de path, extração de URL antiga, `publicUrlFor`),
`lib/storage-policy.ts:7-66` (permissões por bucket + isolamento de `environment` para
`client_documents`), `lib/server-auth.ts:28-55` (`requireSessionContext`).

### 1.3 Consumidores no front-end

| Arquivo | Operação |
|---|---|
| `app/clientes/[id]/page.tsx:284-315`, `:137-143`, `:580` | upload e abertura de documento do cliente |
| `app/documentos/page.tsx:334-405`, `:159-197`, `:408-595` | upload, exclusão e download de modelos DOCX |
| `components/settings/MarketingTab.tsx:272-299`, `:448-458` | upload/exclusão de imagem de cartão |
| `components/BirthdayCardGenerator.tsx:189-210` | uso das imagens de marketing |

Não há upload/download de arquivos em contratos, processos, portal ou publicações.

### 1.4 Metadados

- `client_documents` — `supabase_migrations.sql:1188-1196`
- `document_templates` — `supabase_migrations.sql:1046-1055`
- `template_variables` — `supabase_migrations.sql:1057-1085`
- `birthday_templates` — `force_upgrade_birthday_templates.sql:25-55` (sem coluna `storage_path`)
- `storage.objects` / `storage.buckets` — 34 objetos no inventário de 20/11/2026
  (`docs/RELATORIO-BACKUP-RESTORE-SUPABASE-20261120.md:49,60`)

### 1.5 Ambiente

- Variáveis em `.env.example:1-17`, `:40-45`, `:47-56`:
  `NEXT_PUBLIC_SUPABASE_URL_*`, `NEXT_PUBLIC_SUPABASE_ANON_KEY_*`, `SUPABASE_SERVICE_ROLE_KEY`,
  chaves JWT. Service role **somente no servidor** (`lib/storage-server.ts:24-37`).
- Projeto Supabase único para produção/teste com isolamento lógico por coluna `environment`
  (`lib/supabase.ts:20-24`, `:63-83`).
- Região: **`aws-1-sa-east-1` (São Paulo)** —
  `docs/RELATORIO-BACKUP-RESTORE-SUPABASE-20261120.md:33-37`, `docs/STATUS-INOVEJURIS.md:407`.

### 1.6 Limites/validações atuais

- 10 MB por arquivo (`app/api/storage/upload/route.ts:15,49-51`).
- Extensão só sanitizada (`/^[a-zA-Z0-9]{1,8}$/`, `:17-22`); **sem whitelist de extensão/MIME**;
  `contentType` vem do navegador (`:71`).
- Path: até 500 chars, sem `..`, `\`, `?`, `#`, NUL (`lib/storage-server.ts:40-46`).
- URL assinada com TTL de 1 hora.
- Front-end: `accept=".docx"`, `accept="image/*"`, `accept=".zip,.json"`.

## 2. Opções avaliadas (dados de 2026)

| Plataforma | Free | Pagamento acima do free | Adequação |
|---|---|---|---|
| **Cloudflare R2** | 10 GB-mês, 1M Class A, 10M Class B, egress grátis | $0,015/GB-mês; $4,50/M Class A; $0,36/M Class B | ✅ Melhor gratuita gerenciada |
| **Supabase Storage** (atual) | 1 GB, 10 GB banda (5 cached + 5 uncached), 50 MB/arquivo | Pro: 100 GB, até 500 GB/arquivo | ✅ Integração mais curta; região sa-east-1 |
| **Firebase Storage (Spark)** | 5 GB, 10 GiB egress | $0,10/GB | ⚠️ Fora do ecossistema atual |
| **Oracle Always Free** | 20 GB, 50.000 requests, API S3 | — | ⚠️ Risco de suspensão de contas free |
| **Storj** | trial de 30 dias | mensalidade mínima | ❌ Não "free forever" |
| **MinIO Community** | self-hosted | — | ❌ Modo manutenção/arquivamento |
| **GitHub** | 100 MB/arquivo, repo <1 GB recomendado; LFS 10 GiB | — | ❌ Controle de versão, não object store |
| **Google Drive / Google One** | cota da assinatura | — | ⚠️ Viável, mas não é backend ideal (ver §4) |

Fontes: `https://developers.cloudflare.com/r2/pricing/`,
`https://developers.cloudflare.com/r2/api/s3/presigned-urls/`,
`https://developers.cloudflare.com/r2/reference/data-location`,
`https://supabase.com/docs/guides/storage/pricing`,
`https://supabase.com/docs/guides/storage/uploads/file-limits`,
`https://supabase.com/docs/guides/storage/serving/bandwidth`,
`https://firebase.google.com/pricing`, `https://cloud.oracle.com/free`,
`https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits`.

## 3. Recomendação registrada (a confirmar)

1. **R2 como provedor principal** se a residência de dados fora do Brasil for aceitável:
   10× mais espaço gratuito que o Supabase Free e egress ilimitado.
2. **Supabase Storage (plano Pro) se a residência em São Paulo for requisito do jurídico**:
   já está em `sa-east-1`, integração praticamente zero, mas 1 GB no Free é insuficiente para
   laudos/exames com imagem.
3. **Manter Supabase como provedor alternativo** na abstração, para troca por variável de ambiente.

Ressalva de localização: os data location hints do R2 são `wnam`, `enam`, `weur`, `eeur`, `apac`,
`oc` — **não há hint para América do Sul na documentação de data location**. Uma referência a
São Paulo aparece em documento de integração parceira (Snowflake), mas **não é garantia de
residência do bucket**. Validar com o jurídico antes de migrar prontuários.

## 4. Google Drive com assinatura Google One — análise específica

Pergunta do usuário: "sou assinante do Google Drive; não daria para integrar de forma transparente
e sem intervenção do usuário?"

Resposta registrada: **tecnicamente possível, parcialmente transparente, não recomendado como
armazenamento principal de documentos sensíveis.**

- Uma autorização OAuth inicial é inevitável. Depois dela, o servidor renova tokens com
  refresh token e as operações ficam transparentes para os usuários finais.
- **App OAuth em status Testing: refresh token expira em 7 dias.** Para não exigir reautorização
  periódica, é preciso publicar o app em Produção; escopos sensíveis/restritos podem exigir
  verificação Google. Fonte: `https://developers.google.com/identity/protocols/oauth2`.
- Escopo recomendado: `drive.file` (somente arquivos criados/abertos pelo app), menos invasivo
  que `drive`. É tratado como escopo sensível em muitos fluxos;
  fonte: `https://developers.google.com/workspace/drive/api/guides/api-specific-auth`.
- **Conta pessoal / Google One:** service account não tem quota própria no My Drive; o caminho
  viável é OAuth delegado à conta do titular. Arquivos podem ser renomeados/movidos/apagados
  pelo usuário na interface web, quebrando referências do sistema.
- **Google Workspace:** service account + **Shared Drive** + domain-wide delegation permite
  operação realmente autônoma no servidor, mas exige admin e Shared Drive (não existe em conta
  pessoal). Fonte: `https://developers.google.com/workspace/drive/api/guides/create-file`.
- **Downloads privados:** Drive não oferece o mesmo modelo de URL assinada do S3/R2 para arquivo
  privado; download exige proxy autenticado pelo backend ou fluxo com token. Mais latência e
  banda do servidor. Uploads > 5 MB devem usar resumable upload
  (`https://developers.google.com/workspace/drive/api/guides/manage-uploads`) e há quotas de API
  (`https://developers.google.com/workspace/drive/api/guides/limits`).
- **LGPD:** laudos/exames são dados sensíveis de saúde; o enquadramento contratual de conta
  pessoal é mais fraco que um DPA empresarial. Exige bucket/pasta dedicado, controle de acesso,
  auditoria e criptografia. Referência: `https://www.gov.br/saude/pt-br/acesso-a-informacao/lgpd`
  e Resolução CFM nº 2.314/2022.

Se for adotado no futuro, o encaixe é o mesmo provider descrito em §5: um `GoogleDriveProvider`
implementando `putObject/getSignedUrl/removeObject`, sem alterar os consumidores.

## 5. Plano de integração proposto (para decisão futura)

### Fase 0 — Endurecer o que já existe

- Whitelist de MIME/extensão com validação de magic bytes no servidor
  (`app/api/storage/upload/route.ts:17-22,71`).
- Corrigir `publicUrlFor()` (`lib/storage-server.ts:96-103`), que ainda grava
  `/storage/v1/object/public/...`; hoje a leitura depende 100% do proxy assinado e
  `lib/storage-client.ts:47-52` não tem fallback real.
- Corrigir `MarketingTab.deleteTemplate()` (`components/settings/MarketingTab.tsx:448-458`):
  apaga o registro, mas não o objeto → órfãos.
- Remover/corrigir SQL legado que recria buckets públicos: `supabase_storage_setup.sql`,
  `supabase_storage_fix.sql`, `supabase_storage_final.sql`, `supabase_rebuild_documents.sql`,
  `supabase_fix_all.sql`, `supabase_fix_permissive.sql` e cópias `-1.sql`. Contradiz o F6b.
- Prefixar `environment` também em `templates`/`marketing` (hoje só `client_documents` é isolado).
- Reavaliar o limite de 10 MB para exames/laudos com imagem.
- Registrar UPLOAD/DOWNLOAD/DELETE em `audit_logs`
  (tabela existente: `app/setup/page.tsx:284`, tela `app/auditoria/page.tsx:116`).

### Fase 1 — Abstração de provider

- `lib/storage/provider.ts` — interface `putObject`, `getSignedUrl`, `removeObject`.
- `lib/storage/supabase-provider.ts` — envolve o código atual.
- `lib/storage/r2-provider.ts` — `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
  (hoje **ausentes** do `package.json`; ver `package.json:12-62`).
- Endpoint R2: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, `region: 'auto'`.
- Variáveis novas: `STORAGE_PROVIDER`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY` (token com escopo restrito ao bucket). Nunca expor no cliente.
- Alterar **somente** as três rotas `app/api/storage/*`; consumidores permanecem intactos.

### Fase 2 — Velocidade

- `uploadStorageFile()` (`lib/storage-client.ts:60-84`) passa a pedir URL assinada de PUT e enviar
  o arquivo direto ao R2 (`fetch(url, { method: 'PUT', body: file })`). TTL curto (5 min).
- TTL de leitura reduzido de 3600 s para 1–5 min.

### Fase 3 — Migração

- Copiar os 34 objetos Supabase → destino escolhido via script local (usuário executa).
- Backfill de `storage_path` (F6c, pendente) e limpeza de órfãos.
- Validar em homologação (`test`) antes de cortar a leitura em produção. Nenhum teste financeiro.

## 6. Achados/discordâncias a corrigir na implementação futura

1. SQL legado no repo recria buckets públicos se executado (contraria F6b).
2. `publicUrlFor` grava URL pública antiga no banco; leitura depende do proxy.
3. `lib/storage-client.ts:47-52` não implementa fallback documentado.
4. `MarketingTab.tsx:448-458` deixa objetos órfãos.
5. Não há exclusão de documento de cliente na UI (a rota `/api/storage/remove` suporta).
6. Sem whitelist de MIME/extensão nem checagem de magic bytes.
7. `templates`/`marketing` sem isolamento explícito por `environment`.
8. `components/settings/AppearanceTab.tsx:56-68` mostra “PNG, JPG, GIF até 2MB” em input sem
   `onChange` — texto decorativo.

## 7. Próxima decisão necessária

Escolher uma das opções:

1. Implementar Fase 0 + Fase 1 com R2 (mantendo Supabase como alternativo);
2. Manter apenas Supabase, corrigir lacunas e migrar para Pro (residência sa-east-1);
3. Avaliar/implementar `GoogleDriveProvider` (Workspace + Shared Drive recomendado; conta pessoal
   com ressalvas), ou apenas produzir parecer para o jurídico.

## 8. Restrições observadas

- Usuário executa SQL; agente não executa SQL no banco. Scripts com backup + verificação.
- Testes somente em homologação (`test`); nenhum teste financeiro em produção.
- Não alterar autenticação/permissões nem fluxo financeiro sem autorização.
- Nomenclatura: **Publicações**; grafia canônica: parcela `Cancelada`, contrato `Cancelado`.
- Pendência externa paralela: rotacionar credencial do Postgres Supabase exposta em canal externo
  e em arquivo temporário (`C:\temp\backup-supabase.ps1`).
