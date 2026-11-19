# InoveJuris — Parecer técnico de impacto das correções de segurança

> **Documento de decisão. Somente leitura.**  
> Emitido em: **2026-11-18**.  
> Branch: `trabalho-com-claude` · HEAD de referência: `f89ba67`.  
> Último ponto bom em produção: **deploy `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`**.  
> Status: **nenhuma correção foi aplicada**. Este parecer apenas mapeia impacto, ajustes de rotina, validação e rollback.  
> Relacionados: `docs/PARECER-TENANT-INOVEJURIS.md` (multitenancy) e a auditoria de segurança de 2026-11-18.

---

## 0. Resposta direta

**Sim, há impacto — mas ele é concentrado, previsível e controlável.**

- Das nove fatias de correção, **cinco são invisíveis** para quem usa o sistema.
- **Três exigem ajuste interno de código/rotina**: restauração de backup, chave Gemini e URLs de storage.
- **Uma exige cuidado extra**: atualização do Next.js, que precisa de trilha própria em staging.
- **Nenhuma muda o dia a dia de quem lança clientes, processos, prazos, Publicações ou financeiro.**

O risco de "sistema parado" não vem das correções em si. Vem de aplicá-las **fora de ordem** — por exemplo, fechar os grants do banco antes de reescrever o restore de backup, que hoje só funciona *por causa* dos grants aberto.

---

## 1. Confirmações levantadas antes deste parecer

### 1.1 Rotas `exec_sql` usam a chave anônima

| Rota | Cliente usado | Evidência |
|---|---|---|
| `/api/fix-db` | `supabase` de `@/lib/supabase` → **anon key** | `app/api/fix-db/route.ts:2`, `:6` |
| `/api/diagnose-db` | idem | `app/api/diagnose-db/route.ts:2`, `:15` |
| `/api/check-enum` | idem | `app/api/check-enum/route.ts:2`, `:18` |
| `/api/alter-leads` | service role **com fallback para anon** | `app/api/alter-leads/route.ts:7` |
| `/api/fix-cancellation` | service role **com fallback para anon** | `app/api/fix-cancellation/route.ts:7` |

A chave anônima está hardcoded em `lib/supabase.ts:18-19`. Consequência:

> Revogar `exec_sql` de `anon` **vai desativar** `/api/fix-db`, `/api/diagnose-db` e `/api/check-enum`.  
> Isso é desejável — são utilitários de reparo de banco, não funcionalidade de uso corrente.  
> **Não afeta** login, cadastro, prazos, Publicações, contratos, contas a receber, dashboard ou logout global.

As rotas que usam service role continuariam funcionando se a variável estiver configurada em produção; mesmo assim, devem ser tombadas/removidas na mesma fatia, porque são o outro caminho para SQL arbitrário.

### 1.2 O restore de backup hoje depende da brecha

`app/api/backup/restore/route.ts:5`, `:22` e `:58`:

```ts
import { defaultUrlProd, defaultKeyProd } from '@/lib/supabase';   // anon key
const supabase = createClient(defaultUrlProd, defaultKeyProd);
await supabase.from(tableName).upsert(data);                        // sem sessão, sem admin
```

O restore funciona hoje **porque** `anon` tem INSERT/UPDATE e a RLS é permissiva. Portanto:

> Ao corrigir grants/RLS, **a restauração para de funcionar** até ser reimplementada com sessão validada, verificação de administrador e service role usado apenas no servidor.  
> Por isso a correção de backup/restore vem **antes** do fechamento dos grants — na mesma fatia ou na anterior.

### 1.3 Storage: três pontos usam URL pública

| Local | Bucket |
|---|---|
| `app/documentos/page.tsx:307` | `templates` |
| `app/clientes/[id]/page.tsx:299` | `client_documents` |
| `components/settings/MarketingTab.tsx:127` | marketing |

Tornar os buckets privados **sem** substituir `getPublicUrl()` por URL assinada quebra:

- preview/download de documentos de cliente;
- modelos de documentos;
- imagens de campanhas de marketing.

Logo, a fatia de storage só entra depois que os três pontos estiverem adaptados e validados.

### 1.4 Versão do Next.js e dependências

- `package.json:46` declara `next: ^15.4.9`.
- `package-lock.json` e `npm ls next --depth=0` resolvem **15.5.12**.
- A versão efetiva é, portanto, **15.5.12**; a citação a 15.4.9 veio do intervalo declarado no `package.json`, não do instalado.

`npm audit`:

| Escopo | Total | Críticas |
|---|---:|---:|
| `--omit=dev` (produção) | 48 | 3 |
| completo | 80 | 4 |

Críticas: `next` (faixa `9.3.4-canary.0 - 16.3.0-preview.10`, `fixAvailable: true`), `protobufjs`, `proxy-addr`, `tar`. Altas com correção *major*: `nodemailer` → 10.6.0, `adm-zip` → 0.6.1.

A faixa crítica do Next vai até `16.3.0-preview.10`. **Não foi possível confirmar em leitura se a correção cabe em 15.x ou exige migração para 16.x** — o `npm audit fix --dry-run` não concluiu no tempo limite. Essa confirmação é pré-requisito da fatia F8, em staging.

### 1.5 Views usadas por KPIs

As views sem `security_invoker` alimentam diretamente:

| View | Consumidor |
|---|---|
| `vw_dashboard_receivables_metrics`, `_forecast`, `_top_defaulters`, `vw_process_velocity`, `vw_cash_flow_forecast`, `vw_area_efficiency` | `app/page.tsx:243-248` e `components/dashboard/dynamic/*` |
| `contract_receivables_summary` | `app/contas-a-receber/page.tsx:359` |
| `vw_indicator_commission_status` | `app/indicadores/page.tsx:379` |
| `v_client_guardians` | `lib/client-guardians.ts:58` |

Qualquer alteração nessas views precisa de comparação de KPIs antes/depois.

---

## 2. Matriz de impacto por fatia

| Fatia | O que muda | Impacto no uso | Ajuste de rotina | Rollback |
|---|---|---|---|---|
| **F0 — Backup e pontos de retorno** | Dumps full/schema/data, PITR, tag no Git, SQL das policies atuais | **Nenhum** | Não | Não se aplica |
| **F1 — Rotação de segredos** | DataJud, token do `pg_cron`, Gemini, token antigo da Vercel | Nenhum para DataJud/`pg_cron`/Vercel. Gemini: widget de IA passa a chamar API própria | **Sim, no código** (interno) | Promover deploy anterior; **não reverter a rotação** |
| **F2 — Rotas administrativas** | `/api/backup/restore`, `/api/backup/generate`, limpeza de auditoria passam a exigir sessão/admin | Botão “Restaurar” em Configurações muda e passa a pedir admin | **Sim, na tela Configurações → Backup** — a função não é removida | Promover deploy anterior |
| **F3 — `exec_sql` e extensão `http`** | Revogar execução de `anon`/`public`/`authenticated` | Desativa `fix-db`, `diagnose-db`, `check-enum` e congêneres. **Nenhum** no uso normal | Não — e é o objetivo | Re-grant apenas em emergência, com registro |
| **F4 — Grants e RLS por tabela** | Remover `USING (true)`, aplicar policy da sessão, `FORCE RLS` | Invisível se correto; pode gerar `403` se alguma consulta ficar sem policy | Não, mas exige observação primeiro | SQL forward/rollback por tabela |
| **F5 — Views com `security_invoker`** | Views passam a respeitar a identidade da sessão | Pode alterar KPIs se houver divergência de contagem | Não, mas comparar antes/depois | Recriar view na definição anterior |
| **F6 — Storage privado** | Buckets privados + URL assinada nos 3 pontos listados | Sem o ajuste, quebra preview de documentos/modelos/marketing | **Sim, nos 3 arquivos** | Restaurar policy anterior do bucket |
| **F7 — Headers e CSP** | `next.config.ts`: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false` | Começa em `report-only`; pode bloquear script/fonte/analytics se mal configurado | Não | Remover `headers()` |
| **F8 — Dependências / Next.js** | Corrigir `next`, `protobufjs`, `proxy-addr`, `tar`, `nodemailer`, `adm-zip` | Maior risco de build/quebra; `nodemailer` e `adm-zip` são major | Não, mas exige staging | Promover deploy anterior |

### Ordem obrigatória

```text
F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8
                    ↑
        F2 antes de F4: o restore depende dos grants abertos
```

**F8 corre em trilha paralela de staging** e só entra na sequência de produção depois de validada. Não deve ser misturada com F1–F7: é a única com risco real de quebra de build por mudança major.

---

## 3. O que não muda em nenhuma fatia

- Login e senha; logout global ao fechar aba/janela em todos os dispositivos.
- Cadastro e edição de clientes, indicadores, advogados.
- Processos, prazos, calendário e **Publicações** (nome obrigatório).
- Contratos, parcelas, contas a receber, pagamentos e estornos.
- Relatórios, indicadores e dashboard — salvo a validação de KPIs da F5.
- Alternância Produção/Teste.
- Padrão visual tabela desktop + cards mobile.
- Perfis Administrador / Advogado / Estagiário e a Camada A já entregue.
- Nenhuma nova exigência de MFA nesta rodada.

---

## 4. Validação obrigatória entre fatias

Antes de promover cada fatia:

1. `npm run build` e deploy de preview.
2. Login, reload e heartbeat; sessão ativa e logout global.
3. Uma operação de escrita em cada módulo sensível: cliente, prazo, Publicação, contrato, pagamento.
4. Dashboard: comparar os seis KPIs com os valores anteriores (F5).
5. Upload e download em `templates`, `client_documents` e marketing (F6).
6. Exportar e restaurar um backup de teste (F2) — **nunca sobre produção sem staging**.
7. Contagens antes/depois nas tabelas listadas na auditoria (F4).
8. Confirmar que `/api/fix-db`, `/api/diagnose-db` e `/api/check-enum` retornam falha controlada (F3).
9. Promover o deploy anterior se qualquer item falhar.

Cada fatia deve conter: **SQL/projeto forward**, **rollback** e **query de verificação**. Sem os três, não entra.

---

## 5. Riscos residuais que a correção não elimina

- **Histórico já exposto:** a chave DataJud esteve no Git por vários commits. Rotacionar impede uso futuro, mas não desfaz eventual uso passado.
- **Logs descartáveis:** `audit_logs` é gravável/deletável por `anon`. A correção não recupera evidências apagadas; a conclusão "não detectado" continua sendo a correta — não "confirmado seguro".
- **Token Vercel antigo:** precisa ser revogado no painel da Vercel, fora do repositório.
- **Chave Gemini no bundle:** enquanto estiver em `NEXT_PUBLIC_*`, continuará extraível; a F1 é que resolve.
- **Fora do escopo desta correção:** Camada B de permissões, MFA, multitenancy e limpeza de legado (`/setup`, `route-1.ts`, `clientes-v2`, `doencas`, migrations `-1/-2`). Ver parecer de tenant.

---

## 6. Status e próximo passo

**F0 concluída em 2026-11-18 com autorização do usuário.** Nenhuma correção de segurança (F1–F8) foi aplicada. Árvore de trabalho, código e deploy intactos.

Registro da F0:

- timestamp PITR: `2026-11-18 18:01:02.49299+00`; `archive_mode=on` e `wal_level=logical`;
- tag: `pre-security-fix-f0-20261118`, HEAD `878fd03`;
- local fora do repositório: `C:\InoveTecnologia\InoveJuris-Backups\F0-20261118`;
- `MANIFEST.txt` com SHA256 de todos os arquivos;
- `table_counts.json`, `schema_columns.json`, `schema_indexes.json`, `views_snapshot.json`, `functions_snapshot.json`;
- `policies_rollback.json/.sql` — 261 policies, com `drop` antes dos `create`;
- `grants_rollback.json/.sql` — 930 grants;
- `data_chunk_1..6.json` — 58 tabelas, 3.806 linhas.

`npx supabase db dump` exige Docker, que não está disponível neste ambiente. A exportação lógica foi feita por API SQL (`npx supabase db query`), em leitura. A pequena diferença entre o baseline (3.785) e a exportação (3.806) é de heartbeats gravados entre as consultas.

Próxima fatia pendente de autorização: **F1 — rotação de segredos** (DataJud, token do `pg_cron`, Gemini e token antigo da Vercel).

---

# 7. F1 — preparação de código (autorizada em 2026-11-18)

O usuário autorizou **apenas a preparação do código**. Nenhuma variável de ambiente, segredo, banco ou deploy será alterado nesta etapa. As novas chaves serão fornecidas pelo usuário posteriormente.

## 7.1 Escopo exato das alterações

| Arquivo | Alteração |
|---|---|
| `lib/gemini-server.ts` (novo) | Centraliza a resolução da chave no servidor: chave manual do usuário → `GEMINI_API_KEY` → `GOOGLE_API_KEY` → legado `NEXT_PUBLIC_GEMINI_API_KEY` apenas como fallback temporário |
| `app/api/ai/generate/route.ts` (novo) | Único ponto de chamada ao Gemini. Aceita apenas `kind` fixo (`dashboard_insight`, `task_subtasks`, `lead_score`, `lead_insights`), valida sessão pelo cookie `session_id` via `app_validate_session`, e nunca devolve a chave |
| `lib/actions/gemini.ts` | Passa a usar o resolvedor central; mantém a ação de análise de imagem de aniversário |
| `app/layout.tsx`, `app/layout-1.tsx` | Remove a injeção `window.GEMINI_API_KEY` — hoje a chave é gravada no HTML |
| `next.config.ts`, `next.config-1.ts` | Remove o bloco `env` que força `NEXT_PUBLIC_GEMINI_API_KEY` no bundle |
| `components/reports/AIInsightsWidget.tsx` | Chama a nova API com contagens agregadas; deixa de importar `@google/genai` |
| `components/tasks/TaskIntelligence.tsx` | Chama a nova API com o título da tarefa; deixa de importar `@google/genai` |
| `app/leads/page.tsx` | Substitui as três chamadas client-side por `fetch` à nova API; mantém a chave manual do usuário em `localStorage` |
| `.env.example` | Documenta `GEMINI_API_KEY` como servidor e marca a variável `NEXT_PUBLIC_` como legada |

## 7.2 Por que a API valida sessão

A rota usa o mesmo par de cookies (`session_id` + `app_env`) e a mesma RPC `app_validate_session` já usada pelo carregamento da aplicação. Isso evita que a nova rota vire um proxy aberto de Gemini. A chave manual informada pelo próprio usuário continua sendo aceita — ela não é segredo da aplicação.

## 7.3 Compatibilidade

- Enquanto o usuário não fornecer `GEMINI_API_KEY`, a variável legada `NEXT_PUBLIC_GEMINI_API_KEY` continua funcionando **somente no servidor**. Nenhum componente client passa a referenciá-la.
- Os textos, prompts e fallbacks exibidos ao usuário permanecem os mesmos.
- A geração de insight, sub-tarefas e análise de leads continua com a mesma interface.

## 7.4 Fora desta preparação

- Rotação em si: DataJud, `pg_cron`, Gemini e token Vercel — depende das novas chaves do usuário.
- Revogação do token antigo da Vercel: precisa ser feita no painel da Vercel.
- Token do `pg_cron`: depende de confirmação de Vault/secret no Supabase.
- Fallbacks de `SUPABASE_SERVICE_ROLE_KEY` para anon key: tratados na F2, não aqui, para não quebrar rotas que hoje dependem deles.

## 7.5 Validação e rollback

1. `npm run build` — nenhuma referência a `NEXT_PUBLIC_GEMINI_API_KEY` deve restar em arquivos `'use client'`.
2. Deploy de preview e teste das quatro funções de IA.
3. Rollback: promover o deploy anterior (`dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`) e rever os arquivos da tabela acima.

## 7.6 Execução e achado adicional (2026-11-18)

- Preparação de código **concluída**. `npm run build` passou em Next.js 15.5.12 e a rota `/api/ai/generate` aparece no resultado do build.
- Nenhuma variável de ambiente, segredo, banco ou deploy foi alterado.
- Varredura do bundle client: a única ocorrência de `GEMINI_API_KEY` em `.next/static` é o nome da chave do `localStorage` da tela de leads. Nenhuma chave ou variável de ambiente do Gemini está exposta no cliente.
- **Novo achado durante a preparação:** `.env.example` continha, em um comentário, uma URL de conexão ao pooler do Supabase com senha literal. O valor foi removido e substituído por placeholder genérico. Essa senha deve ser tratada como comprometida e rotacionada junto com a F1; uma varredura confirmou que não restou nenhuma ocorrência no repositório.
- Pendente do usuário: fornecer a nova `GEMINI_API_KEY`, a chave DataJud, o token do `pg_cron` e revogar o token antigo da Vercel no painel da Vercel.

---

# 8. F2 — rotas administrativas (autorizada em 2026-11-18)

O usuário optou por **continuar sem trocar as chaves**, usando as atuais até nova instrução. A F2 não depende de chaves novas.

## 8.1 Escopo

| Rota | Alteração |
|---|---|
| `/api/backup/restore` | Exigir sessão válida no servidor e permissão administrativa de configurações; ambiente passa a vir da sessão validada, não do cookie cru |
| `/api/backup/generate` | Mesma proteção; `userId` recebido no body deixa de ser confiável e é substituído pelo id do usuário validado na sessão |
| `/api/settings/audit/cleanup` | Exigir sessão válida e permissão de auditoria |
| `/api/settings/smtp/test` | Exigir sessão válida e permissão administrativa de configurações (hoje aceita qualquer chamada e dispara conexão SMTP externa) |

A validação usa `app_validate_session` com os cookies `session_id` + `app_env`, a mesma RPC usada no carregamento da aplicação. A autorização considera `is_superadmin` ou as flags `canAccessUsers` / `canAccessSettings` / `canAccessAudit` devolvidas pela própria sessão.

## 8.2 Compatibilidade

- Nenhuma chave é rotacionada; as atuais continuam em uso, inclusive o fallback server-side do Gemini.
- As telas continuam iguais. Usuários comuns deixam de conseguir chamar essas rotas diretamente; administradores continuam usando normalmente.
- O `userId` do body era usado apenas para `performed_by` do log e `user_id` do `backup_logs`. Passa a ser o usuário autenticado.

## 8.3 Validação e rollback

1. `npm run build`.
2. Com sessão de administrador: exportar e restaurar backup de teste, limpar logs e testar SMTP.
3. Sem sessão: as quatro rotas devem responder `401` ou `403`.
4. Rollback: promover o deploy anterior (`dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`).

## 8.4 Execução e validação (2026-11-18)

- Implementação **concluída** nas quatro rotas `route.ts`. Nenhuma chave foi rotacionada; as atuais continuam em uso.
- `npm run build` passou em Next.js 15.5.12; as quatro rotas aparecem no resultado do build.
- Validação local com o build de produção (`next start` na porta 3100, encerrado ao final):
  - sem cookies: middleware redireciona para `/login` (`307`) e limpa `session_id`/`app_env`;
  - com cookies forjados para atravessar o middleware: `/api/backup/restore`, `/api/backup/generate`, `/api/settings/audit/cleanup`, `/api/settings/smtp/test` e `/api/ai/generate` responderam **`401`** — a RPC `app_validate_session` rejeitou a sessão.
- O `userId` do body deixou de ser usado: `performed_by` e `backup_logs.user_id` agora vêm do usuário validado na sessão. O ambiente também vem da sessão validada, não do cookie cru.
- **Pendente:** validar o fluxo positivo com um administrador real em staging/preview (exportar/restaurar backup de teste, limpar logs e testar SMTP). Não foi possível fazê-lo sem credenciais reais, e nenhum deploy foi publicado.
- **Fora do escopo:** os arquivos legados `route-1.ts` (`backup/restore`, `backup/generate`, `settings/audit/cleanup`) não são rotas do App Router e permanecem intocados; a limpeza do legado está prevista no parecer de tenant.

---

# 9. F3 — `exec_sql` e funções `http` (parecer; aguardando autorização)

Nesta etapa **nada foi aplicado**. Apenas leitura do catálogo e preparação dos arquivos SQL locais.

## 9.1 Evidências levantadas

- `public.exec_sql(text)`: `SECURITY DEFINER = false`, mas com `EXECUTE` para `anon`, `authenticated`, `PUBLIC`, `service_role`, `postgres` e `supabase_admin`.
- 17 funções de `http`/`urlencode` no schema `public` (`http`, `http_get`, `http_post`, `http_put`, `http_patch`, `http_delete`, `http_head`, `http_header`, `http_set_curlopt`, `http_reset_curlopt`, `http_list_curlopt` e as três sobrecargas de `urlencode`): todas com `EXECUTE` para `anon`, `authenticated` e `PUBLIC`.
- A aplicação **não** chama nenhuma função `http` via RPC. O único uso é `exec_sql`, em rotas utilitárias de reparo: `fix-db`, `diagnose-db`, `check-enum`, `alter-leads`, `fix-cancellation` e em scripts avulsos fora de `app/`.
- Os três jobs do `pg_cron` (ids 1, 2 e 5) executam como **`postgres`**. Revogar de `anon`/`authenticated`/`PUBLIC` não interfere neles.
- O token do `pg_cron` continua em texto plano — item pendente da F1, fora desta fatia.

## 9.2 Impacto no uso

| Item | Depois da F3 |
|---|---|
| Login, clientes, processos, prazos, Publicações, contratos, financeiro, dashboard | **Nenhuma mudança** |
| `/api/fix-db`, `/api/diagnose-db`, `/api/check-enum` | Deixam de funcionar — **objetivo da correção** |
| `/api/alter-leads`, `/api/fix-cancellation` | Continuam se `SUPABASE_SERVICE_ROLE_KEY` estiver configurada; os fallbacks para anon deixam de funcionar |
| Jobs `pg_cron` (inclusive o de andamentos/DataJud) | Não afetados — rodam como `postgres` |
| Rotas F1/F2 já corrigidas | Não usam `exec_sql` nem `http`; não afetadas |

Não há rotina de uso corrente dependente dessas funções. Não é necessário ajuste de tela.

## 9.3 Arquivos preparados (fora do repositório)

`C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\`

| Arquivo | Finalidade |
|---|---|
| `forward.sql` | 18 `REVOKE EXECUTE ... FROM public, anon, authenticated` |
| `rollback.sql` | Devolve os grants exatos anteriores (`public`, `anon`, `authenticated`) |
| `verify.sql` | Confirma `anon`/`authenticated` sem execução e `service_role` mantendo |

`service_role`, `postgres` e `supabase_admin` **não** são tocados. O rollback não mexe nas chaves rotacionadas nem nas correções F1/F2.

## 9.4 Validação obrigatória

1. Executar `verify.sql` **antes** e guardar o resultado.
2. Aplicar `forward.sql`.
3. Executar `verify.sql`: `anon_pode_executar=false`, `authenticated_pode_executar=false`, `service_role_pode_executar=true` para todas as 18 funções.
4. Confirmar que `/api/fix-db`, `/api/diagnose-db` e `/api/check-enum` falham de forma controlada e que nenhuma tela de uso corrente apresenta erro.
5. Confirmar que um job `pg_cron` executou no horizonte esperado (sem expor o comando/token).
6. Se qualquer item falhar: executar `rollback.sql` e revalidar.

## 9.5 Rollback de deploy

A F3 é apenas SQL. Se houver efeito indireto em produção, promover `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` e executar `rollback.sql`. O ponto PITR da F0 (`2026-11-18 18:01:02.49299+00`) permanece disponível.

## 9.6 Execução em 2026-11-18 — **parcial**

Com autorização do usuário para a F3 completa, a execução produziu:

- **`exec_sql(text)`: revogado com sucesso** de `PUBLIC`, `anon` e `authenticated`. `service_role` e `postgres` continuam podendo executar.
- **`verify_before.json`:** 18/18 funções com `anon=true` e `authenticated=true`.
- **`verify_after.json`:** 1/18 (`exec_sql`) com `anon=false`; as 17 funções `http`/`urlencode` continuam `true`.
- Efeito confirmado em produção: `GET /api/diagnose-db` retornou `42501 permission denied for function exec_sql` — falha controlada, sem alteração de dados.
- Os três jobs do `pg_cron` continuam ativos e rodando como `postgres`.

### Bloqueio das funções `http`

As 17 funções são **propriedade de `supabase_admin`** (`proacl` com grantor `supabase_admin`). A conexão disponível executa como `postgres`, que não é superuser, não é membro de `supabase_admin` e não tem `GRANT OPTION`. Os `REVOKE` retornaram sucesso silencioso, mas a ACL não mudou — inclusive em teste isolado. Um teste com `select 1/0` confirmou que erros normais são reportados pelo endpoint.

Diagnóstico completo e opções em `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\BLOCKED-http.md`.

### Estado e rollback

- A F3 **não está completa**: o buraco de SQL arbitrário está fechado; o de SSRF/exfiltração via `http` permanece.
- Não foi feito deploy e nenhuma chave foi trocada.
- `rollback_partial.sql` desfaz somente `exec_sql`; `rollback.sql` restauraria os 18 grants caso a parte `http` venha a ser executada com role elevada.
- **Decisão do usuário (2026-11-18):** acionar o **Supabase Support** para executar os `REVOKE` com role elevada. Pacote pronto em `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\`: `support_http_revoke.sql` (17 comandos), `SUPPORT-REQUEST.md` (texto do chamado) e `verify.sql`. O chamado ainda precisa ser aberto pelo usuário; este agente não o abriu.
- Até a resposta do Supabase, a F4 pode seguir, mas o risco residual das funções `http` deve constar do relatório final.

---

# 10. F4 — grants e RLS por tabela (parecer; **nada aplicado**)

Preparado em 2026-11-18 a partir de levantamento **somente leitura**. Nenhuma policy, grant, tabela ou dado foi alterado.

## 10.1 O que foi medido

| Fonte | Resultado |
|---|---|
| `pg_policies` (`policies_current.json`) | **261 policies** no schema `public` |
| `information_schema.role_table_grants` (`grants_current.json`) | **134 linhas** = 67 objetos × (`anon`, `authenticated`) |
| Cruzamento com contagens da F0 | **54 tabelas** têm policy `USING (true)` ou alvo `public`/`anon` |
| Grants por objeto | 66 objetos com `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`; `users` só com `REFERENCES, TRIGGER, TRUNCATE` |
| Views incluídas | 11 views de KPIs também com grants de escrita |

Snapshots em `C:\InoveTecnologia\InoveJuris-Backups\F4-20261118\`.

## 10.2 Achado estrutural — muda a recomendação da F4

A F4 foi originalmente descrita como “remover `USING (true)`, aplicar policy da sessão e `FORCE RLS`”. O levantamento mostra que **isso não pode ser feito agora sem parar o sistema**:

1. **Toda consulta roda como `anon`.** `lib/supabase.ts`, `lib/supabase-server.ts` e `lib/server-auth.ts` usam a anon key (`defaultKeyProd`) sem sessão Supabase Auth; não há `setSession` nem JWT de usuário. As policies `to authenticated` são, na prática, **irrelevantes** para o uso corrente — quem decide o acesso é a policy permissiva `to public`/`to anon`.
2. **A identidade da aplicação está no cookie `session_id`, validada por RPCs** (`app_validate_session` e congêneres), não em `auth.uid()`/`auth.jwt()`.
3. **Os GUCs das policies de tenant não são definidos em lugar nenhum do código.** Existem policies `custom.organization_id`, `app.current_organization_id`, `custom.user_id`, `get_auth_organization()` — mas o único GUC configurado é `app.current_env`, via `set_app_environment` (`supabase_migrations.sql:645`). Há ainda divergência de nome: umas usam `app.current_env`, outras `app.current_environment`.
4. Portanto, as policies “Isolamento por Tenant” estão **inertes**; as permissivas `USING (true)` é que liberam leitura/escrita. Se elas forem removidas hoje, o sistema inteiro recebe `403`/linhas vazias — clients, prazos, Publicações, contratos, parcelas, financeiro e dashboard.
5. **A anon key é pública e está no bundle.** Qualquer pessoa pode chamar a REST API diretamente e ler `clients`, `contracts`, `financial_transactions`, `bank_accounts`, `installments`, `payments` e `system_settings` (onde há tokens OAuth em texto claro, ver `app/api/auth/email/callback/route.ts:113-127`). Isso **não é resolvido por ajuste de grants**; exige identidade por requisição no banco.

Conclusão: a F4 precisa ser dividida.

## 10.3 F4a — fatia segura, preparada e pronta para autorização

Objetivo: remover privilegios de nível SQL que o PostgREST **nunca utiliza** e que não respeitam RLS.

- `TRUNCATE` — RLS não se aplica; permite esvaziar tabela inteira.
- `REFERENCES` — permite criar FK; sem uso pela aplicação.
- `TRIGGER` — permite criar trigger; sem uso pela aplicação.

**Não mexe** em `SELECT`, `INSERT`, `UPDATE` nem `DELETE`, que são usados pelas telas e por rotinas como o restore da F2. Não toca policies, `FORCE RLS`, `service_role`, `postgres` ou `supabase_admin`.

| Arquivo (pasta F4) | Conteúdo |
|---|---|
| `forward_f4a.sql` | 67 `REVOKE TRUNCATE, REFERENCES, TRIGGER ... FROM anon, authenticated` |
| `rollback_f4a.sql` | 67 `GRANT` devolvendo exatamente os três privilégios do snapshot |
| `verify_f4a.sql` | Consulta que deve retornar **0 linhas** após o forward + controle de `SELECT/INSERT/UPDATE/DELETE` |
| `grants_current.json`, `policies_current.json` | Baseline tirado antes de qualquer alteração |

Impacto esperado: **nenhum** para o uso corrente; nenhum deploy, nenhuma troca de chave. Reduz superfície de abuso em SQL, mas **não resolve o vazamento via REST** descrito no item 5 — esse é o objetivo da F4b.

Validação obrigatória da F4a:

1. Rodar `verify_f4a.sql` antes (esperado: 402 linhas de privilégios sensíveis = 67 objetos × 3 privilégios × 2 roles) e salvar.
2. Aplicar `forward_f4a.sql`.
3. Rodar `verify_f4a.sql`: primeira consulta com **0 linhas**; segunda com as mesmas contagens de `SELECT/INSERT/UPDATE/DELETE` do antes.
4. Verificar em produção: login, uma escrita em cliente, prazo, Publicação, contrato e pagamento, dashboard com os seis KPIs, exportar/restaurar backup de teste (já protegido na F2).
5. Se qualquer item falhar: `rollback_f4a.sql` e revalidar. Último recurso: ponto PITR da F0.

## 10.4 F4b — reescrita de RLS: **não executar nesta rodada**

Para fechar o vazamento via REST é preciso responder “quem é o usuário desta requisição?” dentro do banco. Hoje a resposta está apenas no cookie, do lado da aplicação. Três caminhos:

| Caminho | O que exige | Impacto | Adequação agora |
|---|---|---|---|
| **A. Supabase Auth (JWT)** | Trocar a sessão opaca por JWT; `auth.uid()` deixa de ser `null`; reescrever login, RPCs e policies `to authenticated` | Alto: mexe no login e em todas as consultas | **Não** — fora do acordo desta rodada |
| **B. RPCs `SECURITY DEFINER`** | Toda leitura/escrita passa por funções que validam `session_id`; revogar acesso direto das tabelas ao `anon` | Muito alto: reescrever todas as consultas e views | **Não** — exigiria parar o sistema |
| **C. GUC derivado da sessão** | Função `SECURITY DEFINER` que valida o cookie e seta `app.current_user_id` / `app.current_organization_id`; trocar policies permissivas por policies que usam esses GUCs | Médio-alto: exige padronizar nomes de GUC e garantir que toda requisição passe pela validação | **Alvo recomendado**, mas depende da decisão de multitenancy e da Camada B |

Mesmo o caminho C não pode ser feito apenas “trocando policies”: é preciso (i) escolher um nome canônico para os GUCs, (ii) garantir que a validação da sessão rode antes de qualquer consulta, (iii) tratar RPCs `SECURITY DEFINER` e views — que hoje leem como definer — e (iv) decidir se a organização é derivada do usuário ou enviada pela aplicação. Isso está descrito em `docs/PARECER-TENANT-INOVEJURIS.md` (Apêndice C) e depende de decisão de produto que o usuário ainda não tomou.

**Não fazer agora:** dropar policies `USING (true)`, revogar `SELECT/INSERT/UPDATE/DELETE` do `anon`, aplicar `FORCE RLS` ou renomear GUCs “de passagem”. Qualquer um desses interromperia clientes, prazos, Publicações, financeiro e dashboard.

## 10.5 Posição técnica e decisão pedida

- **Recomendação:** autorizar apenas a **F4a** nesta rodada, com os três arquivos já preparados e validação entre etapas. Manter a F4b como fatia futura, com decisão prévia entre os caminhos A/B/C.
- **Risco residual após F4a:** o vazamento via REST com a anon key continua existindo e deve constar do relatório final — assim como as 17 funções `http` pendentes do Supabase Support.
- **Ordem preservada:** F4a entra depois da F3; não depende de deploy nem de novas chaves. F4b depende de decisão de arquitetura de sessão/tenant e não deve ser misturada com F5/F6 nesta rodada.

## 10.6 Execução da F4a em 2026-11-18 — **concluída**

Com autorização do usuário, a F4a foi aplicada em produção:

- `verify_f4a_before.json`: **402 linhas** de `TRUNCATE`/`REFERENCES`/`TRIGGER` para `anon`/`authenticated` (67 objetos × 3 × 2).
- Aplicação de `forward_f4a.sql`: 67 `REVOKE`, sem erro.
- `verify_f4a_after.json`: **0 linhas** sensíveis. `SELECT`, `INSERT`, `UPDATE` e `DELETE` permaneceram em **66 objetos por role**, exatamente como antes.
- Validação de leitura via REST com a anon key (sem sessão): `clients` 113, `contracts` 122, `installments` 166, `financial_transactions` 1.135, `publications` 56 e `system_settings` 11 — todos `HTTP 206`, sem alteração de contagens além do heartbeats já conhecido.
- A F3 permanece intacta: `/api/diagnose-db` continua retornando `42501 permission denied for function exec_sql`.
- Nenhum deploy foi publicado e nenhuma chave foi trocada.
- `MANIFEST.txt`, `forward_f4a.sql`, `rollback_f4a.sql` e os dois `verify_f4a_*.json` estão em `C:\InoveTecnologia\InoveJuris-Backups\F4-20261118\`.

**Não feito:** F4b. O vazamento via REST e as 17 funções `http` seguem como riscos residuais.

---

# 11. F5 — views e `security_invoker` (parecer; **nada aplicado**)

Preparado em 2026-11-18 a partir de leitura do catálogo e das consultas que alimentam os KPIs. Nenhuma view foi alterada.

## 11.1 Inventário atual

| Item | Resultado |
|---|---|
| Views no schema `public` | **13** |
| Proprietário | `postgres` em todas |
| Já com `security_invoker=on` | **4**: `vw_dashboard_receivables_forecast`, `vw_dashboard_receivables_metrics`, `vw_dashboard_top_defaulters`, `vw_legal_contract_indicators` |
| Sem a opção | **9**: `contract_receivables_summary`, `process_sync_status`, `v_client_guardians`, `vw_area_efficiency`, `vw_cash_flow_forecast`, `vw_client_process_summary`, `vw_indicator_commission_status`, `vw_portal_commission_details`, `vw_process_velocity` |

Arquivos em `C:\InoveTecnologia\InoveJuris-Backups\F5-20261118\`: `views_current.json` (definições/owner/opções), `view_columns.json`, `kpi_baseline.sql` e `kpi_baseline.json` (48 linhas de contagens e agregados por view/ambiente).

## 11.2 Consumidores

| View | Onde é usada |
|---|---|
| `vw_dashboard_receivables_metrics`, `_forecast`, `_top_defaulters` | `app/page.tsx:243-245` |
| `vw_process_velocity` | `app/page.tsx:246`, `components/dashboard/dynamic/ProcessVelocityCard.tsx`, `app/api/check-db` |
| `vw_cash_flow_forecast` | `app/page.tsx:247`, `components/dashboard/dynamic/CashFlowForecastCard.tsx` |
| `vw_area_efficiency` | `app/page.tsx:248`, `components/dashboard/dynamic/AreaEfficiencyCard.tsx` |
| `contract_receivables_summary` | `app/contas-a-receber/page.tsx:359` |
| `vw_indicator_commission_status` | `app/indicadores/page.tsx:379` |
| `vw_portal_commission_details` | `app/portal/indicador/[token]/page.tsx:52` |
| `v_client_guardians` | `lib/client-guardians.ts:58` e consumida em RPCs de clientes |
| `vw_client_process_summary` | RPCs `get_clients_with_process_summary*` (migrations) e `app/clientes/page.tsx` |
| `process_sync_status` | consultas de sincronização de andamentos |

## 11.3 Impacto esperado

Hoje as tabelas de base têm RLS permissiva, portanto **os valores dos KPIs não devem mudar**. A alteração é de quem avalia a RLS: com `security_invoker=on`, a view passa a usar a identidade da sessão chamadora em vez do dono da view. Isso é pré-requisito da F4b — sem isso, a view continuaria um caminho de desvio da RLS restritiva futura.

Não há mudança de colunas, nomes, tipos ou definição SQL. Nenhuma policy, grant ou dado é tocado.

### Achados preexistentes (não causados pela F5)

1. `vw_process_velocity` **não tem coluna `environment`**, mas o Proxy em `lib/supabase.ts` injeta `.eq('environment', currentEnv)` em toda consulta de view. Teste via REST retornou `42703 column vw_process_velocity.environment does not exist`. O mesmo vale para `vw_cash_flow_forecast`, `vw_area_efficiency`, `vw_client_process_summary` e `process_sync_status`, que também não têm a coluna.
2. `app/page.tsx:246` seleciona `contract_id, client_id, law_area` em `vw_process_velocity`; a view expõe `process_id, process_number, status, created_at, last_update, days_since_last_movement`. Essa consulta já falha antes da F5.

A F5 **não corrige nem agrava** esses itens — eles precisam de fatia própria de código. A validação da F5 deve usar as contagens do banco, não o resultado dessas consultas quebradas.

## 11.4 Arquivos preparados

| Arquivo | Finalidade |
|---|---|
| `forward_f5.sql` | 9 `ALTER VIEW ... SET (security_invoker = on)` |
| `rollback_f5.sql` | 9 `ALTER VIEW ... RESET (security_invoker)` |
| `verify_f5.sql` | Conta views com/sem a opção: antes `9/4`, depois `0/13` |
| `kpi_baseline.sql` / `kpi_baseline.json` | 48 medições de contagem e agregados por view/ambiente |

Exemplos do baseline: `vw_dashboard_receivables_metrics` production `total_expected=488095.63`, `total_received=152526.65`, `total_pending=335568.98`, `total_overdue=82470.40`; `vw_dashboard_top_defaulters` production 20 linhas e `82470.40`; `vw_process_velocity` 21 linhas.

## 11.5 Validação obrigatória

1. Rodar `verify_f5.sql` antes: `sem_security_invoker=9`, `com_security_invoker=4`.
2. Aplicar `forward_f5.sql`.
3. Rodar `verify_f5.sql` depois: `sem=0`, `com=13`.
4. Rodar `kpi_baseline.sql` gerando `kpi_after.json` e comparar com `kpi_baseline.json`: **0 linhas ausentes, alteradas ou novas**.
5. Validar via REST com a anon key, para as views que têm `environment`: `contract_receivables_summary`, `v_client_guardians`, `vw_dashboard_receivables_*`, `vw_indicator_commission_status`, `vw_portal_commission_details` — mesmas contagens.
6. Validar nas telas: dashboard (KPIs), contas a receber, indicadores, portal do indicador, representação legal em clientes.
7. Se qualquer item falhar: `rollback_f5.sql`, revalidar. Último recurso: PITR da F0.

## 11.6 Posição e decisão

Recomendo aplicar a F5 **como preparação para a F4b**, depois da F4a e com a validação acima. Ela é de baixo risco no estado atual e não depende de deploy nem de novas chaves. Não resolve, por si só, o vazamento via REST — esse ponto continua dependente da decisão de identidade/sessão da F4b.

Antes da execução registrada abaixo, nenhuma alteração havia sido aplicada nesta fatia.

## 11.7 Execução da F5 em 2026-11-18 — **concluída**

Com autorização do usuário, os 9 `ALTER VIEW` foram aplicados:

- `verify_f5_before.json`: `sem_security_invoker=9`, `com_security_invoker=4`.
- `verify_f5_after.json`: `sem_security_invoker=0`, `com_security_invoker=13`.
- `kpi_after.json` comparado com `kpi_baseline.json`: 48 medições antes e depois, **0 ausentes, 0 alteradas, 0 novas**.
- Validação via REST com a anon key em 7 views com `environment`: contagens idênticas ao baseline — `contract_receivables_summary` 106, `v_client_guardians` 1, `vw_dashboard_receivables_forecast` 5, `vw_dashboard_receivables_metrics` 1, `vw_dashboard_top_defaulters` 20, `vw_indicator_commission_status` 40, `vw_portal_commission_details` 106.
- Revalidação das fatias anteriores: F4a continua com 0 privilégios sensíveis; `/api/diagnose-db` continua retornando `42501` (F3 intacta).
- Nenhum deploy foi publicado e nenhuma chave foi trocada. `MANIFEST.txt`, `verify_f5_*.json`, `kpi_after.json` e os SQL forward/rollback estão em `C:\InoveTecnologia\InoveJuris-Backups\F5-20261118\`.

Os achados preexistentes do item 11.3 permanecem — a F5 não os corrigiu, conforme previsto.

---

# 12. F6 — storage privado (parecer; **nada aplicado**)

Preparado em 2026-11-18 a partir de leitura do catálogo de storage e do código. Nenhum bucket, policy ou objeto foi alterado.

## 12.1 Inventário atual

| Bucket | `public` | Objetos | Restrições |
|---|---|---:|---|
| `client_documents` | **sim** | 0 | nenhuma |
| `templates` | **sim** | 5 | 10 MB, somente `.docx` |
| `marketing` | **sim** | 29 | nenhuma |

A tabela `storage.objects` tem RLS ativa (owner `supabase_storage_admin`, `FORCE RLS` desligado). Existem **17 policies**, todas permissivas. Os problemas:

- `SELECT` público para os três buckets (`Public Access`, `Public Access Templates`, `Acesso Público para Marketing`, `Leitura Pública Marketing`).
- `INSERT`/`UPDATE`/`DELETE` para `anon` e `public` em `marketing` e `templates` — qualquer pessoa com a anon key pode sobrescrever/apagar modelos e imagens.
- Em `client_documents`, as policies de escrita usam `auth.role() = 'authenticated'`. Como a aplicação não usa JWT Supabase, essas policies **não protegem nada**; já a leitura pública está liberada.

Snapshots em `C:\InoveTecnologia\InoveJuris-Backups\F6-20261118\`: `buckets_current.json`, `policies_current.json`, `objects_counts.json`, `rls_status.json`.

## 12.2 Pontos de código

| Local | Uso | Onde a URL é consumida |
|---|---|---|
| `app/clientes/[id]/page.tsx:291-305` | upload em `client_documents` e `getPublicUrl` | `file_url` gravado em `client_documents`; aberto em `window.open(doc.file_url)` (`:581`) |
| `app/documentos/page.tsx:297-316` | upload em `templates` e `getPublicUrl` | `file_url` em `document_templates`; `fetch(template.file_url)` para gerar DOCX (`:462`) e `remove()` por nome extraído da URL (`:175-178`) |
| `components/settings/MarketingTab.tsx:112-133` | upload em `marketing` e `getPublicUrl` | `image_url` em `birthday_templates`, exibida em `<Image src>` (`:663`, `:830`) e enviada para análise de IA (`:133`, `:791`) |

## 12.3 Por que “gerar URL assinada no cliente” não resolve

`createSignedUrl` chamado no navegador com a anon key depende da policy de `SELECT` em `storage.objects`. Se essa policy permitir `anon`, qualquer pessoa pode gerar sua própria URL assinada — não há ganho de segurança. Para fechar o bucket é preciso:

1. **negar `SELECT` a `anon`/`public`** em `storage.objects`;
2. gerar URLs assinadas **no servidor**, com `SUPABASE_SERVICE_ROLE_KEY` (que ignora RLS), depois de validar sessão/permissão com o helper da F2;
3. fazer upload também por rota servidor, porque o cliente deixará de ter policy de `INSERT`.

Portanto a F6 **não é somente SQL**: ela exige código, deploy e migração de leitura dos registros existentes. As URLs públicas já gravadas em `client_documents.file_url`, `document_templates.file_url` e `birthday_templates.image_url` deixarão de funcionar no momento em que os buckets virarem privados.

## 12.4 Proposta em três sub-fatias

**F6a — código, sem deploy e sem alteração no banco**

- Nova rota servidor `/api/storage/signed-url` (download) e `/api/storage/upload` (upload), usando `requireAdminContext` da F2 ou validação de sessão equivalente e `SUPABASE_SERVICE_ROLE_KEY` somente no servidor.
- Extrair o `storage_path` das URLs públicas existentes no momento da leitura (não exige migration): o path é o trecho após `/object/public/<bucket>/`. Para registros novos, passar a gravar o path relativo.
- Ajustar os três pontos de código: clientes (abrir via signed URL obtida no servidor), documentos (fetch da signed URL para DOCX e delete por path), marketing (URL assinada para `<Image>` e análise de IA).
- Manter fallback para URLs antigas enquanto os buckets ainda estiverem públicos — evita parar o sistema.
- **Pré-requisito:** confirmar que `SUPABASE_SERVICE_ROLE_KEY` existe no ambiente da Vercel e que não há chave de service role em variável `NEXT_PUBLIC_*`. O CLI da Vercel não está disponível neste ambiente; essa confirmação depende do painel ou de `npx vercel`.

**F6b — SQL + deploy, na mesma janela de validação**

- Aplicar `forward_f6.sql`: `public=false` nos três buckets e remoção das 17 policies.
- Publicar o código da F6a.
- Rodar `verify_f6.sql`: três buckets com `public=false` e `policies_restantes=0`.
- Validar upload/download nos três pontos, preview de marketing e geração de DOCX.
- Rollback: `rollback_f6.sql` (recria as 17 policies e devolve `public=true`) e promover o deploy anterior.

**F6c — limpeza posterior**

- Backfill opcional de colunas `storage_path`, remoção das URLs públicas antigas e exclusão de objetos órfãos. Pode ser feito depois da validação, sem urgência.

## 12.5 Validação obrigatória

1. Antes: salvar `buckets_current.json`, `policies_current.json`, `objects_counts.json` (já salvos).
2. Com o código da F6a em preview: validar os três fluxos com buckets ainda públicos — não pode haver regressão.
3. Aplicar F6b e executar `verify_f6.sql`.
4. Testar em produção: upload e download de documento de cliente; upload, download e exclusão de modelo DOCX com geração de documento; upload de imagem de marketing, preview no formulário e na listagem, análise de IA.
5. Confirmar que nenhuma URL `.../object/public/...` continua sendo gravada.
6. Se falhar: `rollback_f6.sql` + deploy anterior.

## 12.6 Posição

Recomendo **autorizar primeiro apenas a F6a** (preparação de código, sem deploy e sem banco). A virada dos buckets (F6b) deve acontecer somente depois que o código estiver em preview e validado — aplicar o SQL antes deixaria documentos, modelos e imagens inacessíveis.

Antes da F6a, nenhuma alteração havia sido feita nesta fatia.

## 12.7 Execução da F6a em 2026-11-18 — código preparado, **sem deploy e sem banco**

Com autorização do usuário, a F6a foi implementada no repositório:

| Arquivo | Alteração |
|---|---|
| `app/api/storage/upload/route.ts` | `POST`: valida sessão, bucket e permissão; aceita `FormData`, limita a 10 MB e envia via service role. Nunca usa `NEXT_PUBLIC_*`. |
| `app/api/storage/signed-url/route.ts` | `GET`: valida sessão e gera URL assinada de 1 hora. Com `redirect=1`, responde `302` para a URL assinada — permite que `<img>`, `fetch()` e `window.open()` continuem funcionando sem código assíncrono nas telas. |
| `app/api/storage/remove/route.ts` | `POST`: valida sessão e remove o objeto por caminho. |
| `lib/storage-server.ts` | Lista de buckets permitidos, validação de caminho, cliente service role somente no servidor e formato da URL pública mantido. |
| `lib/storage-policy.ts` | Autorização por módulo (`canAccessClients`, `canAccessDocTemplates`/`canAccessDocGeneration`, `canAccessSettings` ou superadmin). Para `client_documents`, exige que o primeiro segmento seja um cliente do ambiente da sessão. |
| `lib/server-auth.ts` | Extração de `requireSessionContext()`; `requireAdminContext()` continua idêntico na prática. |
| `lib/storage-client.ts` | Helpers do navegador: converte URL pública antiga em URL do proxy assinado, faz upload/remoção. Não contém chave alguma. |

Pontos de código ajustados:

- `app/clientes/[id]/page.tsx`: upload por rota servidor e abertura do documento via URL assinada.
- `app/documentos/page.tsx`: upload por rota servidor, download do DOCX via URL assinada e exclusão por caminho extraído da URL.
- `components/settings/MarketingTab.tsx`: upload por rota servidor, preview com `<Image unoptimized>`, listagem e análise de IA via URL assinada.
- `components/BirthdayCardGenerator.tsx`: ajuste adicional necessário — o gerador de cartões também consome `birthday_templates.image_url` (canvas e duas imagens); sem isso, a F6b quebraria os cartões de aniversário.

Não resta nenhuma chamada a `getPublicUrl` no código cliente. Os registros novos continuam gravando a URL pública no formato atual — não houve migration. A leitura passa pelo proxy assinado e a URL pública antiga é usada somente como fallback se a rota falhar enquanto os buckets ainda estiverem públicos. A limpeza/backfill de `storage_path` fica para a F6c.

Validações feitas:

- `npm run build`: concluído com sucesso; as três rotas aparecem na tabela de rotas.
- Teste local sem cookie: `/api/storage/signed-url`, `/api/storage/upload` e `/api/storage/remove` retornaram **`307`** para `/login` (middleware), antes mesmo da validação `app_validate_session` interna.
- Nenhuma chave `NEXT_PUBLIC_*` foi introduzida; nenhuma chamada ao Supabase Storage foi feita nesta etapa.

**Pré-requisito para a F6b:** `SUPABASE_SERVICE_ROLE_KEY` precisa existir no ambiente da Vercel. Se estiver ausente, as rotas retornam `503` com mensagem explícita — não há fallback para anon key, porque isso não permitiria assinar URLs de buckets privados. O CLI da Vercel não está disponível neste ambiente; a confirmação depende do painel ou de `npx vercel`.

Nenhum deploy de produção foi publicado e nenhuma alteração foi feita em buckets, policies ou objetos do Storage.

## 12.8 Validação em preview da F6a (2026-11-18)

- A consulta às variáveis do Vercel mostrou que `SUPABASE_SERVICE_ROLE_KEY` **não existia** em nenhum ambiente. Sem ela, as rotas da F6a retornariam `503` e o proxy de URL assinada quebraria imagens/DOCX no preview.
- Com autorização do usuário, a chave `service_role` **atual** do Supabase foi adicionada como **Secret somente no Preview**. Production e Development continuam sem a variável. A chave legada foi exibida no output da CLI durante a consulta — mais um motivo para a rotação prevista na F1.
- Preview publicado: **`dpl_DhMwQBT242d2HNL6eEcAPLCioAbU`**, `https://inove-juris-9nni894w2-alcantarus-projects.vercel.app`. Não foi promovido a produção; o deploy de produção permanece `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`.
- Validação negativa no preview: `/api/storage/signed-url`, `/api/storage/upload` e `/api/storage/remove` retornam **`307` → `/login`** sem cookie, antes mesmo da validação `app_validate_session`.
- Validação da chave: com a service role atual foi gerada com sucesso uma URL assinada para `templates/1772776048729_clients.docx` (`signed_url_ok=true`). Nenhuma chave foi exibida nos artefatos comitados.
- **Não foi feita** a validação positiva dos três fluxos no navegador: ela exige uma sessão válida de teste. Não foi usada sessão de usuário real nem criada uma sessão artificial sem autorização.
- Rollback do preview: `npx vercel env rm SUPABASE_SERVICE_ROLE_KEY preview` e descarte do deploy `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU`.
- Para a F6b: replicar a variável em Production, publicar o código e aplicar `forward_f6.sql` na mesma janela, com `rollback_f6.sql` pronto.

## 12.9 Validação positiva da F6a em preview (2026-11-18)

Executada com cookie de sessão de teste no deploy `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU`, por `npx vercel curl` (somente leitura). O valor de `app_env` é `production` e o de `session_id` é o UUID da sessão — a primeira tentativa com os valores trocados foi corrigida antes da execução.

| Teste | Resultado | Leitura |
|---|---|---|
| A — `templates/1772776048729_clients.docx` | JSON com `signedUrl` e `expiresIn: 3600` | Service role visível no preview, sessão válida e path correto. |
| B — mesmo objeto com `redirect=1` | `302 Found` com `Location: .../storage/v1/object/sign/templates/...` | Redirecionamento funcionando; `iat`/`exp` do token separados por 3600 s. |
| C — `marketing/templates/0.025508762559267928.png` | JSON com `signedUrl` e `expiresIn: 3600` | Bucket com subpasta também assinado; `%2F` decodificado corretamente. |

Observações: `vercel curl` avisa que bypassa o Deployment Protection da Vercel — a autenticação exercitada foi a da aplicação (cookie de sessão), que é o escopo deste teste; a proteção do Vercel permanece ativa para acesso normal. O status veio como `HTTP/1.1 302` em vez de `HTTP/2 302`, diferença apenas da versão do protocolo reportada pelo proxy. As URLs assinadas não foram reproduzidas neste documento por serem credenciais válidas por 1 hora.

**Posição:** a condição que bloqueava a F6b está satisfeita para o fluxo de **download**. Ressalvas que permanecem: (1) os fluxos de upload e remoção, bem como os testes de tela (abrir documento de cliente, gerar DOCX, preview/imagem de marketing, análise de IA e cartões de aniversário), seguem sem validação positiva e devem ser checados no item 12.5; (2) as URLs públicas antigas continuam gravadas no banco e, após a F6b, não haverá fallback — qualquer falha do proxy afetará imediatamente imagens e DOCX; (3) a `service_role` usada é a atual, que apareceu em output da CLI e está na fila de rotação da F1. Recomendação: F6b em janela única, com `rollback_f6.sql` e o deploy anterior prontos. Nenhuma alteração de produção foi feita por este registro.

## 12.10 Execução da F6b em 2026-11-18 — **concluída**

- `SUPABASE_SERVICE_ROLE_KEY` cadastrada como **Secret em Production**. O valor usado foi a **chave secreta nova** (`sb_secret_...`), obtida em `Settings > API Keys` do Supabase (as chaves legadas `eyJ...` não aparecem mais nesse painel). O Preview segue com a chave legada — unificar em F1.
- Deploy do código da F6a em Production: **`dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i`**, alias `https://inove-juris.vercel.app`, `target: production`, `readyState: READY`, `environment: production`. A variável foi adicionada **antes** do deploy, para o build já nascer com ela.
- Tentativa de aplicar `forward_f6.sql` via `exec_sql` com a service role falhou com `42501 must be owner of relation objects`; o diagnóstico seguinte confirmou que **nada foi aplicado** (3 buckets públicos, 17 policies). O SQL foi então executado no **SQL Editor do Supabase** (role dono do schema), com sucesso.
- Verificação pós-SQL: `ESTADO_ATUAL buckets_publicos=0 policies=0` — os três buckets privados e as 17 policies removidas.
- Validação em produção com buckets já privados: Testes A, B e C repetidos com sucesso (`signedUrl` + `expiresIn: 3600` nos dois buckets; `302` no `redirect=1`). Páginas `/`, `/documentos` e `/publicacoes` retornaram `HTTP 200` com a sessão de teste.
- Validação negativa: `/object/public/templates/1772776048729_clients.docx` → `400` (`Bucket not found`); geração de URL assinada com a anon key → `400`. Ou seja, o acesso público antigo deixou de existir.
- Ressalva: os fluxos de **upload/remoção** e os testes visuais (abrir documento de cliente, gerar DOCX, preview e análise de IA de marketing, cartões de aniversário) permanecem como validação manual pendente; a leitura via proxy está confirmada.
- Rollback disponível: `rollback_f6.sql` + promover `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` + `npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production`.
- A chave temporária usada localmente para o SQL foi apagada ao final. Nenhuma chave foi registrada em arquivos versionados.

## 12.11 Ponto 2 — unificação das chaves do Supabase (2026-11-18) — **concluída**

- As duas chaves novas entregues localmente foram validadas antes de qualquer alteração: `sb_publishable_...` respondeu `200` em `/auth/v1/health`; `sb_secret_...` gerou URL assinada no Storage com `200`. Os valores circularam apenas por arquivos temporários fora do repositório.
- **Preview:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` sobrescrito (`--force`, tipo `Config`) com a chave publishable e `SUPABASE_SERVICE_ROLE_KEY` sobrescrito (`--force`, tipo `Secret`) com a chave secreta. A checagem por `vercel env pull` confirmou o prefixo `sb_publishable_` no valor efetivo — a coluna de valor do `vercel env ls` mostra um prefixo antigo e não deve ser usada como verificação.
- **Production:** anon key sobrescrito com a publishable; a service role já estava com a chave secreta desde a F6b e não foi alterada.
- Deploys gerados após as trocas: Preview **`dpl_DVUkHA4hhKzni8ENe62i8wvsM65w`** e Production **`dpl_7PA9Yead2KsQSNhjAf1dhULMap7s`**, este com alias `https://inove-juris.vercel.app`. `NEXT_PUBLIC_*` é incorporado no build, por isso o redeploy foi obrigatório nos dois ambientes.
- Validação nos dois deploys: Testes A/B/C OK (`signedUrl` + `expiresIn: 3600`; `302` no `redirect=1`), `/`, `/documentos` e `/publicacoes` com `200`, sem cookie com `307 → /login` e URL pública antiga com `400`. Nenhuma regressão observada.
- As chaves legadas `eyJ...` **ainda estão ativas** no Supabase; desativá-las no painel é o próximo passo manual e deve ocorrer só depois desta validação.
- Rollback: promover `dpl_6QkgKQDyWcFo4c45y8qSUZ1QbQ6i` em Production e `dpl_DhMwQBT242d2HNL6eEcAPLCioAbU` no Preview. A promoção de um deploy antigo não desfaz as variáveis de ambiente; como as chaves novas funcionaram, não há necessidade de restaurar as legadas.

## 12.12 Desativação das chaves legadas e verificação do `pg_cron` (2026-11-18)

- Antes de desativar, investigou-se o job 5 do `pg_cron`, que era o único com JWT em texto plano (`chama_supabase=true`, `tem_jwt_legado=true`). Consulta detalhada: `chamada_functions=true`, `chamada_auth=false`, `chamada_rest=false`, `bearer_com_jwt=true`, `apikey_com_jwt=false`, `prefixo_chave_supabase_v2=false`, `menciona_datajud=true`, primeiro JWT com 219 caracteres. Conclusão: trata-se do **token da API DataJud**, não de uma chave do Supabase — desativar as chaves legadas do Supabase não deveria afetá-lo.
- Baseline do job 5 antes da desativação: `status=succeeded`, `start_time=2026-11-18 03:00:00.533347+00`, `end_time=03:00:00.601988+00`.
- As chaves legadas `anon` e `service_role` foram desativadas pelo usuário em **Settings → API Keys**. Verificação empírica: uma chamada REST com a anon key legada retornou **`401`**, confirmando que ela foi rejeitada. O valor da chave não foi registrado em arquivo algum.
- A chave legada foi colada no chat pelo usuário durante essa verificação; como ela já está desativada, não há validade remanescente. Registra-se apenas como prática a evitar em rodadas futuras.
- Risco residual: a Edge Function invocada pelo job 5 pode ler a variável legada `SUPABASE_SERVICE_ROLE_KEY` do próprio ambiente. O job será verificado no próximo disparo (cerca de `03:00 UTC`); se falhar, as legadas devem ser reativadas temporariamente e a função ajustada para as novas variáveis `SUPABASE_SECRET_KEYS`.
- Revalidação dos dois deploys após a desativação: A/B/C retornaram `401` com `{"error":"Sessão inválida."}` nos dois ambientes; `/`, `/documentos` e `/publicacoes` continuaram `200` e sem cookie `307`. A causa imediata foi a **expiração do cookie de teste**: a sessão exige heartbeat com tolerância de 90 segundos e as chamadas via `curl` não renovam `last_seen_at`.

## 12.13 Achado crítico — chave legada fixa no código (2026-11-18)

- Ao investigar o `401`, descobriu-se que `lib/supabase.ts` mantinha a anon key legada fixa em `defaultKeyProd`, usada por `getSupabaseConfig()` e `getSupabase()` — ou seja, por **todo o acesso a dados da aplicação**, não apenas pelo storage. A chave era exatamente a que o usuário colou no chat na verificação da desativação. Com a chave desativada no Supabase, os clientes reais deixariam de carregar dados, embora as páginas continuassem respondendo `200` (casca HTML).
- Correção aplicada: `defaultKeyProd` passou a ler `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `defaultUrlProd` passou a ler `NEXT_PUBLIC_SUPABASE_URL` (com fallback de URL). Nenhuma chave fica mais fixa no código principal. Varredura do `.next/static` pelo sufixo da chave antiga retornou vazio; a única ocorrência do prefixo `eyJ...` no bundle é um placeholder textual na tela de setup.
- `npm run build` passou em Next.js 15.5.12. O `.env.local` local também foi alinhado com a chave publishable.
- Deploys intermediários da correção da chave fixa: Production **`dpl_5qvCZ4fmEzYkcjrXugZRBFSJBEUo`** (alias `https://inove-juris.vercel.app`) e Preview **`dpl_HoAt2kNRiBweZS9itN7kUipzBYor`**. Foram superados pelo deploy da seção 12.14.
- Validação com sessão fresca concluída em 2026-11-18: com cookie obtido no login da conta de teste, A/B/C passaram nos dois deploys (`signedUrl` + `expiresIn: 3600` e `302` no `redirect=1`); `/`, `/documentos` e `/publicacoes` retornaram `200` e sem cookie `307`. Isso confirma que a aplicação opera normalmente **sem nenhuma chave legada**.
- Pendência adicional: cerca de 25 scripts avulsos na raiz do repositório ainda contêm a mesma chave legada fixa. Não são importados pela aplicação, mas devem ser limpos na F1.

## 12.14 Erro "Erro ao carregar colunas" — cache do navegador + chave custom (2026-11-18)

- O usuário reportou `Erro ao carregar colunas.` e o console mostrou `Legacy API keys are disabled` em vários fluxos (settings, KPIs `vw_process_velocity`/`vw_cash_flow_forecast`/`vw_area_efficiency`, tarefas, aniversariantes, vencimentos de GPS) e na URL do WebSocket do Realtime, com a chave antiga `eyJ...` completa.
- Diagnóstico: as consultas diretas à REST com a chave publishable retornaram `200` (incluindo `kanban_boards`, `kanban_columns`, filtro `environment=eq.production` e a RPC `set_app_environment`), e o bundle gerado localmente já estava limpo. A chave antiga vinha de **dois caminhos client-side**:
  1. **Cache do Firefox:** o chunk `6650-43dd9d69e98687d7.js` manteve o mesmo nome de arquivo entre builds (o hash do Next.js não muda quando apenas o valor de `NEXT_PUBLIC_*` muda), então o navegador continuou servindo a versão antiga com a chave fixa.
  2. **`localStorage` customizado:** `getSupabaseConfig()` dava prioridade a `custom_supabase_url_production` / `custom_supabase_key_production`, gravados por `app/setup/page.tsx` e `components/settings/SystemTab.tsx`. Uma chave legada salva ali quebraria todos os clientes mesmo com bundle correto.
- Correção aplicada:
  - `getSupabaseConfig()` passou a aceitar somente chaves customizadas com prefixo `sb_publishable_`; chave legada é removida do `localStorage` e ignorada. URL custom passou pela validação `getValidUrl`.
  - `SystemTab.tsx` não carrega mais chave legada e bloqueia o salvamento dela; `app/setup/page.tsx` exige `sb_publishable_...`.
  - `npm run build` passou. Varredura do `.next/static`: **0 arquivos** com a chave antiga e 15 com `sb_publishable_`.
- Novos deploys: Production **`dpl_2vB2eVQRtA4Qm5YrhR2Uz1MaNLU2`** (alias `https://inove-juris.vercel.app`) e Preview **`dpl_4f7xJnTzyjcQu8k7TLvgzhMRRGAP`**. Verificação no deploy de produção: o chunk `6650-43dd9d69e98687d7.js` servido contém `sb_publishable_` e não contém a chave antiga.
- Ação necessária no navegador do usuário: **hard reload (`Ctrl+Shift+R`)** para descartar o chunk em cache; se persistir, remover `custom_supabase_key_production` / `custom_supabase_url_production` no Console (`localStorage.removeItem(...)`) ou usar "restaurar padrão" em Configurações → Sistema.
- Os erros de Kanban, KPIs, aniversariantes, GPS e WebSocket tinham a **mesma causa**; não eram falhas de RLS, grants ou das correções F3–F6.

## 12.15 Erros `42703` nas views do dashboard — correção de código (2026-11-18)

- Com a chave corrigida, o console passou a mostrar erros `42703` que estavam mascarados:
  - `column vw_process_velocity.environment does not exist`;
  - `column vw_cash_flow_forecast.environment does not exist`;
  - `column vw_area_efficiency.environment does not exist`;
  - `column vw_process_velocity.contract_id does not exist` (achado preexistente já registrado no item 11.3).
- Causa: o Proxy em `lib/supabase.ts` injeta `.eq('environment', currentEnv)` em **toda** tabela consultada. Cinco views não expõem essa coluna: `vw_process_velocity`, `vw_cash_flow_forecast`, `vw_area_efficiency`, `vw_client_process_summary` e `process_sync_status`. As views `vw_dashboard_*`, `vw_indicator_commission_status` e `vw_portal_commission_details` **têm** a coluna e continuaram filtradas normalmente.
- Correções aplicadas:
  - Proxy passou a isentar explicitamente as cinco views sem `environment` do filtro automático.
  - `app/page.tsx:246` passou a selecionar as colunas reais de `vw_process_velocity` (`process_id, process_number, status, created_at, last_update, days_since_last_movement`) em vez de `contract_id, client_id, law_area`.
- Validação REST com a chave publishable: os quatro `select` usados pela tela e pelos cards retornaram `200`; a consulta com `environment=eq.production` em `vw_process_velocity` retornou `400`, confirmando o diagnóstico. `npm run build` passou.
- Novos deploys: Production **`dpl_2i4To1n9zycciTw2cuVLuB6yjwvL`** (alias `https://inove-juris.vercel.app`) e Preview **`dpl_HeKYexkBYyaELZR2DN46femm2YHK`**.
- **Risco residual:** encerrado na seção 12.16. As definições SQL das cinco views passaram a expor e separar `environment`; o Proxy voltou a filtrar todas as tabelas/views sem lista de exceções.
- Avisos restantes no console são cosméticos/ambientais: `__cf_bm` é cookie do Cloudflare e `width(-1)/height(-1)` é tamanho de contêiner de gráfico; tratados na seção 12.17.

## 12.16 F7 — separação definitiva por `environment` nas views do dashboard (2026-11-18)

- **Parecer prévio e autorização:** o usuário autorizou a correção das views "sem gambiarras", de forma limpa e eficaz. Foi explicado que a `service_role` não é owner das views (owner `postgres`), então o DDL precisa ser aplicado no SQL Editor do Supabase, como na F6b.
- **Estratégia:** `CREATE OR REPLACE VIEW` preservando a ordem das colunas existentes e acrescentando `environment` como **última coluna**. Mantido `security_invoker=on` (aplicado na F5). O `GROUP BY` de `vw_area_efficiency` passou a incluir `environment`; o join de `vw_client_process_summary` passou a exigir `c.environment = p.environment`, evitando contar processos de `test` para clientes de `production`.
- **Artefatos:** `C:\InoveTecnologia\InoveJuris-Backups\F7-VIEWS-20261118\` — `forward_f7.sql`, `rollback_f7.sql`, `verify_f7.sql`, `MANIFEST.txt`.
- **Baseline REST antes:** `process_sync_status` 21, `vw_area_efficiency` 5, `vw_cash_flow_forecast` 10, `vw_client_process_summary` 113, `vw_process_velocity` 21.
- **SQL aplicado pelo usuário no SQL Editor.** Validação REST depois (filtro `environment=eq...`):

| View | production | test |
|---|---:|---:|
| `process_sync_status` | 19 | 2 |
| `vw_area_efficiency` | 4 | 3 |
| `vw_cash_flow_forecast` | 10 | 0 |
| `vw_client_process_summary` | 107 | 6 |
| `vw_process_velocity` | 19 | 2 |

- `vw_area_efficiency` passou de 5 para 7 linhas porque agora agrupa por área **e** ambiente; esperado. As demais fecharam com a baseline.
- **Código:** removida a lista `VIEWS_SEM_ENVIRONMENT` de `lib/supabase.ts`. Agora existe uma regra única — toda tabela/view recebe `.eq('environment', currentEnv)` — sem exceções. `npm run build` passou; varredura do `.next/static`: 0 arquivos com a chave legada.
- **Deploys F7-VIEWS:** Production `dpl_DykQeTzCcRQ3yhhYQ8G3qooATE4Y` e Preview `dpl_GFvFohoh2piXQqNVTYLeNzVMPkFR`.
- **Rollback:** `rollback_f7.sql` + promover `dpl_2i4To1n9zycciTw2cuVLuB6yjwvL` (Production) / `dpl_HeKYexkBYyaELZR2DN46femm2YHK` (Preview). O rollback mantém `security_invoker=on`.

## 12.17 Limpeza dos avisos do console (2026-11-18)

- Logs de debug removidos: `Velocity:` / `Forecast:` / `Efficiency:` (e o `null` dos `.error`) em `app/page.tsx`; `Eventos encontrados:` em `components/BirthdayChecker.tsx`; `DashboardLayout: pathname:` em `app/dashboard-layout.tsx`; `Settings changed:` em `components/providers/SettingsProvider.tsx`.
- Consultas duplicadas removidas de `app/page.tsx`: as três views de KPI eram buscadas duas vezes na mesma carga; ficou uma única `Promise.all`.
- `ResponsiveContainer` padronizado com `minWidth={0} minHeight={0}` em **todos os 19 gráficos** (`app/page.tsx`, `app/relatorios/page.tsx`, `app/fluxo-caixa/page.tsx`, `app/fluxo-caixa/movimentacoes/page.tsx`, `components/AuditAccessLogs.tsx`, `components/dashboard/DashboardReceivablesCards.tsx`, `components/portal/CommissionChart.tsx`, `components/reports/ProductivityChart.tsx`). Isso elimina `The width(-1) and height(-1) of chart should be greater than 0`.
- Fontes: `Inter` removido (não era usado); `JetBrains_Mono` e `Playfair_Display` com `preload: false`. A Geist continua ativa e é efetivamente usada por `font-sans` (a variável definida pela classe `next/font` prevalece sobre a declaração `@theme` por especificidade), então não gera preload órfão.
- `npm run build` passou. Varredura do `.next/static`: **0** arquivos com chave antiga e **0** com os textos de debug removidos.
- **Deploys da limpeza (atuais):** Production `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj` (alias `https://inove-juris.vercel.app`) e Preview `dpl_AWWbfXvcZNSJaqQcz1bygGfZ5otY`. Rollback: promover `dpl_DykQeTzCcRQ3yhhYQ8G3qooATE4Y` / `dpl_GFvFohoh2piXQqNVTYLeNzVMPkFR`.
- Validação sem cookie nos dois deploys: `/`, `/documentos`, `/publicacoes`, `/configuracoes`, `/relatorios` e `/fluxo-caixa` → `307` (redirect de login), conforme esperado. A validação A/B/C com cookie fresco ficou pendente porque a sessão de teste expira após 90 s sem heartbeat.
- **Não corrigíveis no código do app:** `__cf_bm` é cookie de bot management do Cloudflare (domínio rejeitado pelo navegador); a falha de websocket é da conexão Realtime do Supabase (infra/rede/autenticação do canal), não do Proxy de dados. Nenhum dos dois afeta dados ou funcionalidade.

# 13. Indisponibilidade de acesso ao sistema — diagnóstico e causa (2026-11-19)

- **Sintoma relatado:** tela de login em "Validando..." e, com credenciais corretas, a mensagem "Não foi possível validar as credenciais.". O usuário levantou a hipótese de que alguma implementação/correção tivesse comprometido o acesso e pediu verificação do vínculo, desfazimento e alternativa que não impedisse o acesso.
- **Fluxo verificado:** `app/login/page.tsx` → `lib/auth.ts` (`validateCredentials` → `postAuth('authenticate')`) → `POST /api/auth/session` → RPC `app_authenticate` no Postgres. **Nenhum desses arquivos foi alterado** na F7-VIEWS nem na limpeza do console (que mexeram em dashboard, gráficos, fontes e logs). Busca por `statement_timeout` no código e nos backups: **zero ocorrências**.
- **Parecer prévio:** antes de qualquer mudança de código ou rollback, foi feito teste controlado sem depender do navegador do usuário.

## 13.1 Evidências coletadas

| Teste | Resultado | Interpretação |
|---|---|---|
| RPC `app_authenticate` com e-mail vazio (sem efeito colateral) | `504 upstream request timeout` | Não é erro de senha |
| RPC `app_validate_session` (sem vínculo com login) | timeout | Não é específico do login |
| `GET /rest/v1/processes?select=id&limit=1` | timeout em 40 s | Consulta simples também falha |
| `GET /rest/v1/system_settings?select=key&limit=1` | timeout em 8 s | Origem do `Error fetching settings:` no console |
| Mesma consulta com chave inválida de propósito | `401` em 0 s | Gateway aceita a chave correta; o travamento é no banco |
| Chave publishable correta (`.env.local`) | timeout em 12 s, duas vezes | Chave válida, backend sem resposta |
| `POST /api/auth/session` pelo alias público | timeout em 25 s | A rota herda o timeout do banco |
| SQL Editor do Supabase | `Failed to run sql query: Connection terminated due to connection timeout` | Conexão direta ao Postgres também falha |
| Erro no console do app | `57014 canceling statement due to statement timeout` | `statement_timeout` do Postgres |
| `https://status.supabase.com/` | verde | Não é indisponibilidade global declarada |
| `/login` no Vercel | `HTTP 200` em 2 s | Staticidade do front está sã |
| `SUPABASE_SERVICE_ROLE_KEY` lida do Vercel | `401 Invalid API key`; `vercel env pull` devolve `[SENSITIVE]` | Não há como consultar/reiniciar o projeto por Management API neste ambiente |

## 13.2 Teste A/B controlado de deploy

Promoção temporária do deploy anterior, teste no alias público e devolução imediata ao deploy atual — nenhum arquivo alterado:

| Deploy | `POST /api/auth/session` |
|---|---|
| `dpl_DykQeTzCcRQ3yhhYQ8G3qooATE4Y` (anterior à limpeza) | **TIMEOUT** |
| `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj` (atual) | **TIMEOUT** |

**Conclusão:** desfazer a limpeza não resolve. Não foi mantido nenhum rollback: além de inútil, custaria as correções já validadas (F7-VIEWS, chaves novas, buckets privados). O alias de produção foi devolvido ao deploy atual.

## 13.3 Causa confirmada

Mensagem exibida pelo Supabase ao usuário: *"Once exhausted, disk throughput will return to its baseline of 5 MB/s. The budget refills whenever disk IO demand is at or below baseline. Upgrade your compute or use the AI Assistant to identify and optimize disk-intensive queries."*

- Projeto: `jhlxzqsgmudkbjkynqdl` (`https://jhlxzqsgmudkbjkynqdl.supabase.co`).
- Plano Nano (free): **5 MB/s baseline**, burst até **261 MB/s**, **250 IOPS baseline / 11.800 IOPS máximas**, 500 MB de banco, 1 GB de storage e 5 GB de egress.
- Com o burst esgotado, até leitura de catálogo/`select 1` estoura o `statement_timeout`: daí o `57014`, o `504`, a falha do SQL Editor e a mensagem enganosa de credenciais inválidas.
- Réplicas de leitura e replicação externa só existem nos planos **Pro/Team/Enterprise** (confirmado na documentação oficial).

## 13.4 Ação imediata sem deploy

1. Fechar **todas** as abas/janelas do InoveJuris (inclusive celular) e parar tentativas de login por 10–15 minutos — o orçamento recarrega quando a demanda fica em ou abaixo de 5 MB/s.
2. Testar `select 1;` no SQL Editor: https://supabase.com/dashboard/project/jhlxzqsgmudkbjkynqdl/sql/new
3. Se não responder: **Project Settings → Billing/Compute → upgrade** (caminho pago estrutural) ou **Help → Support** com: projeto `jhlxzqsgmudkbjkynqdl`, erro do SQL Editor `Connection terminated due to connection timeout`, erros da API `57014` e `504`, horário aproximado 19/11 entre 01:30 e 02:00 UTC e a mensagem de esgotamento de burst de I/O.
4. Não há `SUPABASE_ACCESS_TOKEN` neste ambiente; `~/.supabase` contém apenas `telemetry.json`. Não foi possível consultar status nem reiniciar o projeto via Management API.

## 13.5 O que **não** foi feito

- Nenhum rollback de deploy foi mantido e nenhum arquivo de autenticação foi alterado.
- Nenhum login emergencial, backdoor ou enfraquecimento de validação foi criado.
- O heartbeat de 20 s não foi alterado: a tolerância de 90 s faz parte do controle de sessão e qualquer mudança exige parecer e autorização explícitos.

## 13.6 Validação pendente após a recuperação do banco

1. Repetir `GET /rest/v1/system_settings?select=key&limit=1` e a rota `POST /api/auth/session` (com credencial fictícia, sem gravação).
2. Repetir os testes A/B/C com **cookie de teste fresco** (`app_env=production` + `session_id` do UUID; expira após 90 s sem heartbeat).
3. Conferir o console no navegador com hard reload (`Ctrl+Shift+R`).
4. Levantar `pg_stat_statements` / `pg_stat_activity` e preparar o plano de otimização da Fase 1 (seção 14.5), com backup e rollback antes de cada mudança.
5. Com aval do usuário, trocar a mensagem "Não foi possível validar as credenciais." por "Sistema temporariamente indisponível — tente novamente" quando o erro for `57014`/timeout — sem criar acesso alternativo.

## 13.7 Prazo de reposição do orçamento de I/O — esclarecimento (2026-11-19)

- **Não existe reset diário em horário fixo nem intervalo fixo de horas.** A documentação atual afirma que o budget *"refills whenever disk IO demand is at or below baseline"*; o guia de troubleshooting de memória/swap detalha que cada projeto tem uma *"baseline balance replenishment rate"*: uso abaixo dessa taxa aumenta o saldo, uso acima o reduz. Há redação mais antiga em KBs (*"burst ... every day"*, *"replenished the next day"*), interpretada aqui como **saldo diário com recarga contínua**, não como disparo de relógio.
- **Nano (free):** baseline de **5 MB/s e 250 IOPS**. O saldo se reconstrói na razão aproximada `5 MB/s − demanda atual`. Com demanda zero são ~5 MB por segundo (≈300 MB/min, ≈18 GB/h). Exemplos **ilustrativos** — o tamanho do bucket não é publicado pela Supabase: 10 GB ≈ 34 min; 50 GB ≈ 2,8 h; 100 GB ≈ 5,7 h; um dia inteiro de baseline (5 MB/s × 86.400 s ≈ 432 GB) ≈ 24 h. Se o app continuar gerando tráfego no baseline, o saldo praticamente não sobe.
- **Só o saldo de I/O muda com o tempo.** Não há redefinição automática das configurações do plano free, nem do `statement_timeout`, nem do limite de 500 MB de banco. A pausa de projetos free após 1 semana de inatividade é política separada, com retomada manual.
- **Onde acompanhar:** Dashboard → **Observability** → Overview/Database → métrica **"Disk IO Balance"** (0% = esgotado, 100% = cheio); em **Infrastructure Settings** aparece o menor saldo amostrado dos últimos 7 dias. A métrica não está disponível via Metrics API, portanto não permite alerta customizado.
- **Correção da orientação anterior:** "fechar as abas por 10–15 min" era apenas um primeiro teste, não o prazo de recarga. Na prática, deixe o app **fechado por algumas horas**. Se não voltar: upgrade de compute (Micro: 11 MB/s de baseline, 500 IOPS, 1 GB RAM — **exige organização paga; ver 14.6**) ou Support.
- **Restart pelo Dashboard (local exato, se disponível):** **Project Settings → General → seção "Project availability"** (no fim da página), não Organization Settings e não a aba Infrastructure. URL direta: `https://supabase.com/dashboard/project/jhlxzqsgmudkbjkynqdl/settings/general`. O botão pode aparecer como **"Restart project"** ou, conforme o rollout da feature, **"Restart database"**; quando há seta ao lado, a opção **"Fast database reboot"** reinicia só o Postgres, com menos downtime. Não apaga dados, mas o projeto fica indisponível por alguns minutos — usar só com o sistema parado.
- **Por que o botão pode não aparecer:** o código do Studio só habilita o restart se o usuário tiver permissão de escrita em operações do projeto (Owner/Admin) **e** o projeto estiver `active` ou `active_unhealthy`; há também flag de feature/rollout que pode escondê-lo ou desabilitá-lo globalmente. Se não aparecer, **não é condição necessária**: o restart apenas resolve temporariamente workloads presos, sem aumentar o budget de I/O. Nesse caso, seguir com redução de demanda, upgrade de compute ou Support.
- **Revalidação em 19/11:** consulta REST simples continua em **TIMEOUT** em 8 s.
- **Fontes consultadas em 2026-11-19:** *Compute and Disk*, *High Disk I/O*, *Memory and Swap usage explained* e *Diagnose HTTP API issues* (docs.supabase.com).

## 13.8 Recuperação confirmada em 2026-11-19 (após `select 1` do usuário)

- O usuário executou `select 1;` no SQL Editor e obteve `[{ "?column?": 1 }]`, confirmando que o Postgres voltou a responder.
- Validações repetidas imediatamente depois:

| Teste | Resultado |
|---|---|
| `GET /rest/v1/system_settings?select=key&limit=1` (chave publishable) | **HTTP 200 em 5 s** — `[{"key":"session_timeout"}]` |
| RPC `app_authenticate` com e-mail vazio (sem efeito colateral) | **HTTP 200 em 0 s** — `{"code":"invalid_credentials","error":"E-mail ou senha inválidos.","success":false}` |
| `POST /api/auth/session` (`authenticate`, e-mail vazio) no alias de produção | **HTTP 401 em 3 s** — `{"success":false,"error":"E-mail ou senha inválidos."}` |

- O `401` é o comportamento **correto** da rota (`app/api/auth/session/route.ts:89`) para credencial inválida; a mensagem de erro genérica do incidente (`500` / timeout) não aparece mais.
- **Conclusão:** o acesso ao sistema não estava comprometido por código, deploy, F7-VIEWS ou limpeza. A causa foi exclusivamente o esgotamento do orçamento de I/O do Supabase. Nenhum rollback, backdoor ou mudança de autenticação foi necessário.
- **Ainda pendente:** teste de login com conta de **teste** no navegador; A/B/C do storage com cookie fresco; conferência visual do console com hard reload; acompanhamento do **Disk IO Balance** no Observability para evitar recorrência. Não foi usada conta real nem criada sessão artificial.

## 13.9 Otimização máxima e "sujeira" do banco — levantamento (2026-11-19)

- **Pergunta do usuário:** otimizar o banco é a melhor alternativa? Dá para levantar se há "sujeira" gerando consumo excessivo?
- **Resposta:** sim, é a melhor **primeira** alternativa — é gratuita, reversível e não mexe em autenticação. Mas ela tem limite: no Nano (5 MB/s, cache pequeno), mesmo um banco limpo pode voltar a estourar se o padrão de acesso continuar com 14 consultas no mount do dashboard, 5+ canais Realtime, settings no mount e heartbeat de 20 s por aba. Por isso a ordem é **medir → otimizar → só então pagar/migrar**.
- **O que já foi medido sem custo e sem gravação:**
  - `check_database_orphans()` via REST: **0 órfãos nas 8 verificações de FK** (financial_transactions → bank_accounts/financial_categories, contracts → clients/products/indicators, installments → contracts, products → law_areas). Não há "sujeira" de relacionamento quebrado.
  - `get_db_size` via REST com chave publishable: **404** (privilégio de catálogo); será lido via SQL Editor.
- **O que é "sujeira" neste contexto** (tudo verificado no script read-only):
  1. **Tuplas mortas** (`n_dead_tup`) — linhas apagadas/atualizadas não recolhidas; `VACUUM`/`autovacuum` e `ANALYZE`.
  2. **Índices nunca usados** (`idx_scan = 0`) — ocupam espaço e atrasam escrita.
  3. **Índices duplicados** (mesmas colunas) — idem.
  4. **TOAST grande** — JSONB/texto/DOCX em base64 inflam I/O.
  5. **Tabelas de log/auditoria sem retenção** — `login_attempts`, `login_challenges`, `user_sessions`, `audit_logs`, `notifications`, `process_sync_log`, `publication_sync_log`, `process_deadline_history`, `backup_logs`, `task_history`, `marketing_logs`.
  6. **Cache hit baixo** e **`seq_scan` alto** — sinal de falta de índice ou de cache pequeno.
  7. **Queries caras** (`pg_stat_statements`) — frente real de consumo.
- **Scripts prontos (pasta `C:\InoveTecnologia\InoveJuris-Backups\AUDITORIA-IO-20261119\`):** `diagnostico_readonly.sql` (seções separadas) e `diagnostico_resumo.sql` (devolve **um único JSON**, mais fácil de enviar). Ambos somente `SELECT`, sem gravar/alterar/apagar nada. Se `extensions.pg_stat_statements` não existir, pedir aval antes de habilitar (é mudança de configuração, pequena mas não read-only).
- **Primeiro retorno recebido (apenas seção de views):** 13 views no schema `public`, todas com "0 bytes" — esperado, pois view é objeto virtual e não armazena dados. O dado relevante é que 4 views são consultadas no mount do dashboard e recalculam joins a cada carga. As 5 views da F7 são apenas parte desse total; as outras 8 ficam como ponto de revisão de segurança **separado**, sem alteração autorizada.
- **Limites assumidos:** não vou reduzir o heartbeat de 20 s nem criar acesso alternativo. Qualquer mudança decorrente do levantamento passa por parecer, backup e rollback.

## 13.10 Resultado do diagnóstico read-only — interpretação (2026-11-19)

Executado o `diagnostico_resumo.sql`. Conclusão principal: **não há "sujeira" de volume que justifique o esgotamento de I/O**. O banco é pequeno (~7 MB nos 30 maiores objetos; maior tabela `audit_logs` com 2,6 MB). O problema é o **padrão de acesso** — quantidade de consultas e escritas —, não armazenamento acumulado.

| Indicador | Valor | Interpretação |
|---|---|---|
| PostgreSQL | 17.6 (aarch64) | Versão atual |
| `shared_buffers` / `effective_cache_size` / `work_mem` | 224 MB / 128 MB / 4 MB | Todo o dados cabe em memória; I/O não vem de leitura de disco em massa |
| `statement_timeout` | 2 min | Explica o erro `57014` do incidente |
| Cache hit | 91,24% (970 blocos amostrados) | Amostra pequena; não conclusiva, mas coerente com banco em cache |
| Órfãos de FK | 0 em 8 | Nada quebrado |
| Tuplas mortas | 0 em todas | Sem inchaço de `UPDATE`/`DELETE` pendente |
| `last_autovacuum` / `last_analyze` | `null` em todas | Estatísticas nunca coletadas ou resetadas — **exige `ANALYZE`**, com aval |
| `seq_scan` alto | só `schema_migrations` (78) e `subscription` (209) | Tabelas internas; nenhuma tabela da app com problema |
| Atividade / transações paradas | apenas a própria consulta / nenhuma | Sem workload preso no momento |
| Views | 13, todas "0 bytes" | Normal (view é virtual); 4 são consultadas no mount do dashboard |
| TOAST | `publications` 376 kB, `system_settings` 272 kB | Pequeno; não explica o consumo |
| `pg_stat_statements` | **1.11 disponível** | Permite medir as queries mais caras |

### Armadilha evitada: NÃO apagar índices

- A consulta de **índices não usados** listou até PKs (`audit_logs_pkey`, `user_sessions_pkey`, `financial_transactions_pkey`) com `idx_scan = 0`. Isso é sinal de **estatísticas resetadas**, não de índices inúteis.
- Os índices trigram (`idx_clients_unaccent_*`, `idx_processes_unaccent_*`, `idx_contracts_unaccent_*`) são usados pelas RPCs `expand_search_all` e `get_clients_summary` via `immutable_unaccent(...) ILIKE` (`migrations/20261116131500_add_unaccent_search_indexes.sql`). Removê-los quebraria a busca sem acentos.
- A consulta de **índices duplicados** deu 11 pares, mas todos são **falsos positivos**: 10 pertencem a `auth`/`storage` (gerenciados pela Supabase) e o par `idx_client_relationships_client` × `idx_client_relationships_primary` difere pelo `WHERE is_primary` (`migrations/20261118140000_client_legal_guardians.sql:28-31`). O mesmo vale para `users_email_key` × `users_email_partial_key`.
- Os scripts `diagnostico_readonly.sql` e `diagnostico_resumo.sql` foram corrigidos para comparar também o predicado (`pg_get_expr(indpred, indrelid)`), eliminando esse falso positivo.

### Próxima medição

Scripts em `C:\InoveTecnologia\InoveJuris-Backups\AUDITORIA-IO-20261119\`: `queries_caras.sql` (seções separadas) e `queries_caras_resumo.sql` (**um único JSON**). Medem tempo total, número de chamadas, escritas (INSERT/UPDATE/DELETE), acesso a tabelas de log, contagem exata das tabelas suspeitas e tamanho total do banco. Com isso dá para separar o que é **leitura repetida** do que é **escrita constante** antes de propor qualquer mudança. Correção aplicada em 19/11: `n_tup_ins` não existe em `pg_stat_database` (é `tup_inserted`); a regex de escritas usa `[[:space:]]` em vez de `\s`.

**Nenhuma alteração foi feita.** Heartbeat de 20 s, acesso alternativo e contas reais continuam fora de escopo.

## 13.11 Primeira leitura de `pg_stat_statements` — amostra contaminada (2026-11-19)

Executado `queries_caras_resumo.sql`. **A amostra não serve para atribuir custo à aplicação**, pelos seguintes motivos:

- `pg_stat_statements_info().stats_reset = 2026-11-19T03:32:23Z` — isto é, a janela começa **depois da recuperação do incidente**. O consumo que derrubou o login não está mais no histórico.
- `pg_stat_database`: `tup_inserted = 32`, `tup_updated = 7`, `tup_deleted = 196`, `xact_commit = 10399`. Números de escrita baixíssimos confirmam que **a aplicação não foi usada** nessa janela — só o SQL Editor e o Studio.
- As queries do topo são **introspecção do Supabase Studio**, não da app:
  - `SELECT name FROM pg_timezone_names` — 8.574 ms em 3 chamadas (2.858 ms cada);
  - `WITH RECURSIVE base_types ...` — 5.446 ms + 3.173 ms;
  - `pgbouncer.get_auth` — 2.044 ms em 5 chamadas (409 ms cada);
  - `pks_fks` / `pg_constraint` — 1.874 ms;
  - Consultas de catálogo do próprio Studio (functions, roles, casts, relations).
- `blks_hit = 1.373.144` contra `blks_read = 1.330` (**99,9% de acerto de cache**). Reforça: leitura de tabela não é o gargalo.
- Tamanho total do banco: **25 MB** — confirma que volume não é o problema.

### Contagem exata corrigiu a estimativa

| Tabela | Linhas reais | Tamanho | Observação |
|---|---|---|---|
| `audit_logs` | 2.201 | 2,6 MB | ~1,2 KB/linha — normal, não é inchaço |
| `system_settings` | 11 | 368 kB | **~33 KB/linha** — desproporcional; candidato a inspeção (sem alteração) |
| `publications` | 56 | 568 kB | ~10 KB/linha, plausível (Publicações com texto) |
| `user_sessions` | 138 | 248 kB | ~1,8 KB/linha, normal |
| `notifications` | 93 | 136 kB | normal |
| `login_attempts` | 17 | 96 kB | normal |

O `n_live_tup = 10` do diagnóstico anterior estava **errado** (estimativa sem `ANALYZE`); a contagem real é 2.201.

### Próxima medição (limpa)

`C:\InoveTecnologia\InoveJuris-Backups\AUDITORIA-IO-20261119\queries_app.sql`. Sequência: fazer login com a **conta de teste**, abrir dashboard, esperar ~30 s, visitar Processos e Publicações, **só então** executar o script. Ele separa queries da aplicação, ruído do Studio, demais chamadas e escritas. Até lá, **nenhuma conclusão sobre qual query da app consome I/O é válida**.

Nenhuma alteração foi feita no banco; heartbeat de 20 s, acesso alternativo e contas reais continuam fora de escopo.

## 13.12 Medição limpa com a app em uso — plano de otimização (2026-11-19)

Amostra coletada após login com conta de teste, dashboard + Processos + Publicações. Dados válidos.

### Onde o tempo da aplicação foi gasto

| Query | Chamadas | Tempo total | Média | Comentário |
|---|---|---|---|---|
| `realtime.list_changes` (Realtime) | **178** | **1.873,91 ms** | 10,53 ms | Maior consumidor agregado; polling do WAL pelas subscriptions |
| `app_heartbeat` | 6 | 437,70 ms | **72,95 ms** | Maior custo **por chamada**; escrita em `user_sessions` |
| `app_validate_session` | 20 | 367,24 ms | 18,36 ms | **Também faz `UPDATE` em `user_sessions`** (linha 341 da migration) |
| `check_daily_birthdays()` | 1 | 185,54 ms | 185,54 ms | Job antigo, não chamado pelo front; 1 chamada na janela |
| `SELECT ... audit_logs ... ORDER BY performed_at LIMIT 5` | 1 | 133,32 ms | 133,32 ms | Dashboard; **sem índice** em `(environment, performed_at DESC)` |
| `app_authenticate` | 4 | 196,69 ms | ~49 ms | Login |
| `app_complete_login` | 1 | 65,99 ms | 65,99 ms | Login |
| `contracts ... ilike '%maternidade%'` | 4 | 45,49 ms | 11,37 ms | Widget de aniversário |
| `clients ... birthDate` | 3 | 38,12 ms | 12,71 ms | Widget de aniversário |
| `system_settings` (2 consultas) | 2 | 26,70 ms | 13,35 ms | 11 linhas com 368 kB de TOAST |
| `set_config(...)` do PostgREST | 93 | 163,83 ms | 1,76 ms | Overhead por requisição HTTP |
| Views F7/dashboard | 1 cada | 0,08–4,06 ms | — | **Baratas — não são gargalo** |

`blks_hit = 1.812.600` × `blks_read = 1.763` → 99,9% de cache. O custo é de **processamento e escrita**, não de leitura de disco.

### Descobertas novas e concretas

1. **`app_validate_session` também grava.** Além do heartbeat de 20 s, toda validação de sessão atualiza `last_seen_at` (`migrations/20261118150000_auth_session_hardening.sql:341-343`). Na janela foram 20 chamadas. É amplificação de escrita — mas mudar isso altera a semântica do controle de 90 s. **Somente com autorização explícita.**
2. **Widget de aniversário duplicado no dashboard.** `BirthdayChecker` (`app/page.tsx:725`) e `BirthdayWidget` (`app/page.tsx:1731`) fazem cada um as mesmas 3 consultas (`components/BirthdayChecker.tsx:34-38` e `components/dashboard/BirthdayWidget.tsx:32-36`). São **6 consultas onde bastavam 3**.
3. **5 canais Realtime só no dashboard** (`app/page.tsx:288-292`), mais `Sidebar`, `SettingsProvider` e páginas de processos/prazos/notificações/calendário — 12 `.channel()` no total. Cada canal alimenta o `realtime.list_changes`.
4. **Falta de índice em `audit_logs`**: há índices em `record_id`, `environment`, `performed_by` e PK, mas nenhum em `(environment, performed_at DESC)`, que é exatamente o `ORDER BY` da consulta do dashboard.
5. **`system_settings`**: 11 linhas, 368 kB de TOAST (~33 kB/linha). Uma chave com JSON grande é lida em toda mount.

### Plano priorizado (ainda NÃO executado)

**Fase 1A — sem mudança de segurança, com backup/rollback, uma de cada vez:**

| # | Ação | Ganho esperado | Risco |
|---|---|---|---|
| 1 | Unificar `BirthdayChecker` + `BirthdayWidget` em um hook compartilhado | −3 consultas por carga do dashboard | Baixo (só leitura, sem mudança de dados) |
| 2 | Consolidar os 5 canais Realtime do dashboard em 1 canal com 5 listeners | Menos polling `realtime.list_changes` | Baixo (precisa validar que os 5 eventos continuam chegando) |
| 3 | Cachear `system_settings` no `SettingsProvider` e eliminar a 2ª consulta | −1 consulta e −368 kB lidos | Baixo |
| 4 | Criar índice `audit_logs (environment, performed_at DESC)` | 133 ms → alguns ms | Baixo, mas é mudança de schema: backup + rollback |
| 5 | `ANALYZE` nas tabelas da app | Estatísticas corretas (o `n_live_tup=10` estava errado) | Muito baixo |

**Fase 1B — somente com sua autorização explícita:**

- Reduzir a escrita duplicada em `app_validate_session` e/ou espaçar o heartbeat de 20 s. **Não farei sem aval**, porque mexe na tolerância de 90 s do controle de sessão.

**Descartado com base em medição:** apagar índices "não usados" ou "duplicados" (falsos positivos), mexer nas views F7 (são baratas), limpar logs por volume (25 MB no total) e migrar para NoSQL.

## 13.13 Execução da Fase 1A — itens 1 a 3 concluídos (2026-11-19)

**Autorização registrada:** usuário aprovou a Fase 1A completa (itens 1–5), um de cada vez, com backup e rollback; optou por **não mexer na Fase 1B** (heartbeat de 20 s e escrita em `app_validate_session` intactos). Nenhuma autenticação, cookie ou acesso alternativo foi alterado.

### Itens 1–3 — código (commit `8cdf51e`, pushed)

- **Item 1 — aniversariantes unificados:** novo `lib/birthdays.ts` com `getBirthdays()` e `invalidateBirthdaysCache()`, cache de 5 min e dedupe de promise em voo. `BirthdayChecker` e `BirthdayWidget` passaram a consumir o módulo; as 6 consultas por carga do dashboard viraram 3. `BirthdayChecker` ainda invalida o cache no foco da janela, preservando o comportamento original.
- **Item 2 — Realtime:** os 5 canais do dashboard (`processes`, `contracts`, `installments`, `transactions`, `process_deadlines`) foram substituídos por um único canal `dashboard-changes` com 5 listeners. A verificação de que os 5 eventos continuam chegando faz parte da validação pendente.
- **Item 3 — `SettingsProvider`:** `fetchSettings` agora deduplica requisições em voo (`useRef`); o callback do Realtime e o rollback do `updateSetting` usam `force=true` para não reaproveitar dados defasados. `refreshSettings` segue exposto normalmente.
- **Backup/rollback:** ponto de restauração `5014dee` (commit imediatamente anterior). Rollback do código: `git revert 8cdf51e`. `npx tsc --noEmit` e `npm run build` passaram (25 páginas).

### Itens 4–5 — banco (scripts prontos, aguardando execução no SQL Editor)

| Item | Forward | Rollback |
|---|---|---|
| 4 — índice `audit_logs (environment, performed_at DESC)` | `C:\InoveTecnologia\InoveJuris-Backups\AUDITORIA-IO-20261119\forward_otim1_index_audit_logs.sql` | `...\rollback_otim1_index_audit_logs.sql` |
| 5 — `ANALYZE` em todas as tabelas `public` | `...\forward_otim2_analyze.sql` | Não necessário (só atualiza estatísticas) |

Os scripts usam `CREATE INDEX IF NOT EXISTS`, não apagam nada e incluem verificação antes/depois (`pg_indexes`, `EXPLAIN ANALYZE`, `pg_stat_user_tables`).

**Item 4 executado pelo usuário em 2026-11-19 — resultado:** `Index Scan using idx_audit_logs_env_performed_at`, `Index Cond: (environment = 'production')`, `Buffers: shared hit=2 read=2`, **Execution Time: 0,766 ms** (contra 133,32 ms na linha de base — ~174× mais rápido). `Planning Time: 7,801 ms` é pago uma vez por query e tende a cair com estatísticas frescas (item 5). Nenhum outro objeto foi alterado.

**Item 5 executado pelo usuário em 2026-11-19 — resultado:** `ANALYZE` aplicado a todas as tabelas `public`; `last_analyze = 2026-11-19 09:38:11 UTC`. `n_live_tup` corrigido: `audit_logs` 2.248, `clients` 113, `publications` 56, `system_settings` 11 (antes: 57/0/0/0 e `last_analyze=null`). Na primeira tentativa foi executada apenas a consulta final do script, sem o bloco `DO $$`; a reexecução do bloco corrigiu. Nenhum dado foi alterado e não há rollback.

**Código publicado em 2026-11-19:** Preview `dpl_4HU25Fp4t6oJYo9vj5UsoJsECC6h` e Production `dpl_325c7tN3ofH2tT8qGKsGv9fzqrXC` (alias `https://inove-juris.vercel.app`). Rotas `/`, `/publicacoes`, `/processos` e `/configuracoes` retornaram `307 → /login` sem cookie. Rollback: promover `dpl_7Tidw9mST2TSU4Fo6xEhk6GiCWAj` / `dpl_AWWbfXvcZNSJaqQcz1bygGfZ5otY`, `git revert 8cdf51e` e `rollback_otim1_index_audit_logs.sql`.

### Validação pendente

1. Executar item 4 e item 5 no SQL Editor, um de cada vez, e conferir a saída.
2. Repetir a medição limpa com a app em uso (comparar `realtime.list_changes`, `audit_logs`, `system_settings` e o total de chamadas).
3. Deploy do código, login com conta de teste, A/B/C com cookie fresco e conferência do console com `Ctrl+Shift+R`.
4. Observar o saldo `Disk IO Balance` nas horas seguintes.

## 13.14 Medição após a Fase 1A — leitura preliminar (2026-11-19)

**Ressalva:** a amostra enviada **não é uma janela limpa**. O `stats_reset` continua `2026-11-19T03:32:23.230869+00:00`, o mesmo da medição anterior — ela acumula DDL, `ANALYZE`, deploys e a própria medição anterior. Ainda assim, a direção dos números é útil:

| Query | Antes (chamadas / total / média) | Depois (chamadas / total / média) | Leitura |
|---|---|---|---|
| `audit_logs` do dashboard | 1 / 133,32 ms / 133,32 ms | 3 / 139,88 ms / **46,63 ms** | −65% por chamada; `EXPLAIN` isolado deu 0,766 ms |
| `realtime.list_changes` | 178 / 1.873,91 ms / 10,53 ms | 2.635 / 17.790,1 ms / **6,75 ms** | −36% por chamada, mas volume 14,8× (janela ~6× maior) |
| `app_heartbeat` | 6 / 437,70 ms / 72,95 ms | 35 / 2.452,08 ms / 70,06 ms | Estável por chamada (não foi alterado) |
| `app_validate_session` | 20 / 367,24 ms / 18,36 ms | 69 / **6.567,39 ms / 95,18 ms** | **Maior custo agora** — é a Fase 1B, não autorizada |
| `system_settings` | 2 / 26,70 ms / 13,35 ms | 8 / 193,02 ms / 24,13 ms | Janela maior; sem redução visível |
| Aniversariantes (`clients birthDate`) | 3 / 38,12 ms | 3 / 38,12 ms | Sem novas chamadas na janela |
| Cache | 99,9% | **99,97%** | `blks_hit` 6.633.186 × `blks_read` 1.860 |

**Achados:**

1. **Índice confirmado:** a consulta do dashboard caiu de 133,32 ms para 46,63 ms de média (e 0,766 ms no `EXPLAIN` isolado). O `queryid` é o mesmo, então é exatamente a mesma consulta.
2. **Realtime continua dominando em agregado** (17,79 s). Consolidar 5 canais em 1 reduziu conexões WebSocket do cliente, **mas o servidor ainda mantém 5 subscriptions** (uma por tabela), então o polling `realtime.list_changes` permanece. Reduzir de verdade exigiria observar menos tabelas — mudança de funcionalidade, **fora do autorizado**.
3. **`app_validate_session` é hoje o maior custo por chamada** (95,18 ms) e o maior volume de escrita (`tup_updated` subiu de 36 para 1.088). É exatamente a Fase 1B, que o usuário optou por **não mexer agora**. Continua intacta.
4. **`system_settings` e aniversariantes** não mostram redução nesta amostra por causa da janela contaminada — a medição limpa dirá.

**Para comparar de forma justa:** executar `C:\InoveTecnologia\InoveJuris-Backups\AUDITORIA-IO-20261119\reset_stats_medicao_limpa.sql`, usar a app por ~10 min e rodar `queries_app.sql`. O reset zera só contadores de monitoramento — nenhum dado é alterado. `pg_stat_reset()` foi removido do script porque o SQL Editor do Supabase retorna `42501: permission denied`; apenas `extensions.pg_stat_statements_reset()` é necessário e foi executado com sucesso às **2026-11-19 09:57:07 UTC**.

# 14. Parecer de banco free — alternativas ao Supabase e alívio de I/O (2026-11-19)

- **Pergunta do usuário:** existe outra solução equiparável ao Supabase, free e com mais recursos, que não trave dessa forma? Foi pedido um parecer que deixasse a decisão menos preocupante, sem implementação.
- **Resposta direta:** existem plataformas parecidas, mas **nenhuma é ao mesmo tempo free, mais robusta que o Nano e transparente para o código atual**. Há sempre um trade-off: trocar o teto de I/O por reescrita de camada de acesso ou por responsabilidade operacional.

## 14.1 Comparativo confirmado em 2026-11-19

| Critério | Supabase Nano (atual) | **Nhost Free** | Appwrite Free | Neon Free | Supabase self-host em VM free |
|---|---|---|---|---|---|
| Postgres real | Sim | **Sim** | Não (MariaDB) | Sim | **Sim (idêntico)** |
| API REST estilo PostgREST | Sim | Não (GraphQL/Hasura) | Não (SDK próprio) | Não | **Sim** |
| Auth pronto | Sim (custom no DB) | Sim | Sim | Não | Sim |
| Storage + Realtime | Sim | Sim | Sim | Não | Sim |
| I/O previsível | Não (burst → 5 MB/s) | Atenção (compute compartilhado) | Atenção (5 GB banda) | Atenção (100 CU-h/mês) | **Sim (disco próprio)** |
| Custo | R$ 0 | R$ 0 | R$ 0 | R$ 0 | R$ 0 (mas opera a VM) |
| Esforço de migração | — | Alto | Muito alto | Alto | Baixo no código / alto na operação |

## 14.2 Nhost Free — substituto gerenciado mais fiel

- Stack: **Postgres + Hasura GraphQL + Auth + Storage + Functions + Realtime**, sob licença MIT.
- Free Starter: **1 projeto, 1 GB de banco, 1 GB de storage, 5 GB de egress, MAU ilimitado**.
- **A favor:** como é Postgres real, o schema, as funções plpgsql (`app_authenticate`, `app_heartbeat`, etc.), as views da F7, as RLS e o `pg_cron` seguem no dump. A lógica de negócio não é reescrita.
- **Contra:** a API gerada é GraphQL do Hasura, não PostgREST; RLS vira permissão Hasura; Storage/Realtime trocam de SDK. Reescrita dos ~40 pontos de `supabase-js` (`.from()`, `.rpc()`, `.channel()`, `createSignedUrl`) e do Proxy de `environment` (`lib/supabase.ts`, `lib/supabase-server.ts`). É um projeto de dias, não uma troca de chave.

## 14.3 Appwrite Free e outros descartados

- **Appwrite Free:** Auth, Databases, Storage, Functions, Realtime, 2 projetos, 1 database/1 bucket/2 functions por projeto, 2 GB de storage, 5 GB de banda, 750 mil execuções e 75 mil MAU. Porém o banco é **MariaDB**: funções plpgsql, views e RLS do InoveJuris não portam. Descartado.
- **Firebase:** NoSQL; reescrita total da modelagem e das consultas. Descartado.
- **PlanetScale:** em 2026 não lista plano free (modelo usage-based). Descartado.
- **CockroachDB Serverless:** compatível com wire protocol do Postgres, mas sem plpgsql/RLS equivalentes. Descartado.
- **Neon Free (já avaliado):** 1 GB por projeto (20 GB no total), 100 CU-hours/mês, autoscaling até 2 CU (~8 GB RAM), 10 branches, scale-to-zero após 5 min, 5 GB de transferência pública. É o melhor "só Postgres" free, mas falta PostgREST/RLS gateway, Storage e Realtime prontos. **Armadilha:** o heartbeat de 20 s (`components/SessionMonitor.tsx:99` → `app_heartbeat`) mantém o compute acordado; a 1 CU contínuo são ~720 CU-hours/mês, que esgotariam os 100 grátis em ~4 dias. Migrar exige reduzir o heartbeat para ~60 s preservando a tolerância de 90 s — somente com parecer e autorização.

## 14.4 Supabase self-host em Oracle Cloud Always Free — "mais recursos, R$ 0"

- Recursos Always Free confirmados: VM ARM **2 OCPU / 12 GB de RAM** (a cota foi reduzida de 4/24 em 2026; algumas contas PAYG ainda mostram 4/24 — confirmar no painel da conta), **3.000 CPU-hours + 18.000 GB-hours/mês**, suficientes para rodar o mês inteiro, block volume e Object Storage. Região **São Paulo** (`sa-saopaulo-1`), próxima ao Vercel `gru1`.
- **Vantagem real:** o Docker Compose do Supabase mantém **100% de paridade** (PostgREST, GoTrue/custom auth, Storage, Realtime, Studio) e o disco é próprio — **sem budget de burst que colapsa para 5 MB/s**.
- **Preço:** virar DBA — backup automatizado, upgrades, TLS, monitoramento e disponibilidade. VM única é ponto único de falha. Para sistema jurídico em produção, somente com backup e rollback bem definidos.

## 14.5 Plano recomendado (nesta ordem)

1. **Fase 1 — gratuita, zero migração (recomendada agora):** otimizar o padrão de acesso que esgota o burst — 14 consultas no mount do dashboard (`app/page.tsx`), 5 canais Realtime na dashboard e mais em processos/prazos/notificações/calendário/settings, settings buscados no mount (`SettingsProvider.tsx`), agregações das views da F7, cache de configurações, índices sob medida e redução do heartbeat de 20 s → 60 s preservando os 90 s (este último só com autorização). Cada passo com parecer, backup e validação.
2. **Fase 2 — paga, minutos:** se a otimização não bastar, upgrade de compute no Supabase (Micro/Small). Cura estrutural imediata, mais barata que dias de migração e mais segura que virar DBA. **Custo real a partir de US$ 25/mês**, não US$ 10 — ver 14.6.
3. **Fase 3 — somente se decidir sair:** POC em paralelo, sem desligar produção. Nhost como substituto gerenciado (banco portável, API reescrita) ou Supabase self-host na Oracle (paridade total, operação nas mãos do time). Promover só após paridade funcional validada, incluindo A/B/C e login.

**Posição técnica:** o travamento não decorre de falta de recurso do Supabase, mas do burst de I/O consumido por acesso excessivo com apenas ~3.800 linhas. Trocar de provedor sem corrigir esse padrão apenas troca o formato do limite. O "alívio free" mais rápido é reduzir o acesso; o plano B está documentado para tirar o peso da decisão, não para ser executado agora.

## 14.6 Correção importante — o Micro não é um plano de US$ 10

- **Micro é um tamanho de compute (add-on), não um plano independente.** Ele só pode ser contratado em uma **organização paga**; o plano Free roda obrigatoriamente em **Nano** (5 MB/s, 500 MB de banco, US$ 0).
- **Custo mínimo real:** plano **Pro a partir de US$ 25/mês** + compute Micro de US$ 10/mês, com **US$ 10/mês de crédito de compute** já incluído no Pro cobrindo exatamente um Micro. Resultado: **US$ 25/mês** para um projeto em Micro — não US$ 10. Em Small (US$ 15): US$ 25 + US$ 15 − US$ 10 = **US$ 30/mês**.
- O Pro inclui ainda 8 GB de disco (contra 500 MB do Free), backups diários de 7 dias, egress de 250 GB, suporte por e-mail, retenção de logs de 7 dias e elegibilidade a read replicas (estas, cobradas à parte).
- Compute é cobrado **por hora**; trocar Nano → Micro em organização paga gera downtime curto (em geral < 2 min). Projetos Free que entram em organização paga podem continuar em Nano, mas passam a ser cobrados como Micro; não é possível lançar Nano novo em plano pago.
- **Atenção:** `Compute Hours` **não** são cobertos pelo Spend Cap (conforme a doc de Manage Compute usage). O crédito é mensal e não acumula.
- **Implicação para a decisão:** "upgrade para Micro" custa US$ 25/mês, não US$ 10. Continua sendo mais barato que dias de migração, mas deixa de ser "quase free" — reforça a Fase 1 (otimização sem custo) como primeira escolha.

**Fontes consultadas em 2026-11-19:** documentação oficial Supabase (compute/disk, pricing, manage compute usage, replicação), Neon (free tier/faqs), Nhost (pricing), Appwrite (pricing/changelog), Oracle Cloud (Always Free resources) e páginas de comparação de BaaS. Limites devem ser reconfirmados no ato de qualquer decisão.

# 15. Parecer NoSQL free — viabilidade para o InoveJuris (2026-11-19)

- **Pergunta do usuário:** se quiser trocar o banco por um NoSQL, qual opção free "comporta todos os recursos" hoje implementados?
- **Resposta direta:** **nenhuma**. Os recursos atuais são implementados em Postgres/Supabase — funções plpgsql (`app_authenticate`, `app_heartbeat`, `app_validate_session`, etc.), RLS, 5 views SQL, joins relacionais em 58 tabelas, `pg_cron`, publication `supabase_realtime`, Storage com URLs assinadas. Não existe NoSQL free que ofereça isso de forma transparente: a migração é uma **reescrita integral da camada de dados e das regras de negócio**, não uma troca de provider.

## 15.1 O que teria que ser reescrito

| Recurso atual | Equivalente NoSQL |
|---|---|
| 15+ funções `SECURITY DEFINER` em plpgsql | Cloud Functions / Functions do BaaS, em TypeScript/JS |
| RLS + filtro `environment` no Proxy | regras de segurança do provedor ou filtro manual em **toda** consulta |
| 5 views SQL dos KPIs | documentos pré-agregados ou funções de agregação |
| Joins relacionais (processos, clientes, prazos, parcelas) | desnormalização ou múltiplas leituras por tela |
| Realtime `postgres_changes` | listeners do Firestore / Realtime do Appwrite |
| Storage privado + signed URLs | SDK de Storage do provedor |
| `pg_cron` (job DataJud) | função agendada do provedor |
| Sessões por cookie + heartbeat de 20 s | lógica explicitamente implementada na aplicação |

## 15.2 Candidatas avaliadas

| Opção | Free? | Veredito |
|---|---|---|
| **Appwrite Cloud Free** | Sim — 2 projetos, 1 database/1 bucket/2 functions por projeto, 2 GB storage, 5 GB banda, 750 mil execuções, 75 mil MAU | **BaaS NoSQL free mais completo** (Auth, document DB, Storage, Functions, Realtime). Ainda exige reescrever RPCs, views, RLS e joins; banda/storage curtos para DOCX/imagens |
| **Firebase Spark** | Parcial — Firestore 1 GiB, 50 mil leituras e 20 mil escritas/dia, 10 GiB egress; Auth 50 mil MAU; Hosting 10 GB/360 MB dia | **Não atende "tudo free"**: na tabela oficial, **Cloud Storage e Cloud Functions aparecem como "Not applicable" no Spark**, exigindo Blaze (pago). Além disso, o padrão atual (heartbeat 20 s ≈ 4.320 escritas/dia **por aba** + 14 consultas no dashboard) consumiria a cota de operações rapidamente |
| **PocketBase self-host** | Sim (software livre, sem custo de cloud) | Single binary Go com SQLite, Auth, Realtime, arquivos, admin UI, hooks JS e cron. Roda em VM Oracle Always Free. Não tem plpgsql, RLS nem views SQL: lógica vira hooks JS. Você opera backup/TLS/upgrades |
| **MongoDB Atlas M0** | Sim — 512 MB compartilhado | Somente database; sem Auth, Storage, Functions ou Realtime prontos. Insuficiente sozinho |

## 15.3 Recomendação

**Não migrar para NoSQL com o objetivo de resolver o problema de I/O.** Isso trocaria um limite de disco por uma reescrita total e por um novo tipo de cota (por leitura/escrita), justamente com o padrão de acesso atual que já é intenso. Manter a **Fase 1 (otimização no Supabase, gratuita)** continua sendo a decisão mais segura.

Se, ainda assim, a decisão for sair do Supabase: **Appwrite Cloud Free** é a opção NoSQL free mais próxima de um BaaS completo; **Firebase** só com Blaze (pago); **PocketBase** se o time aceitar operar o próprio servidor. Nenhuma delas oferece paridade automática com o que está implementado hoje.

**Fontes consultadas em 2026-11-19:** Firebase Pricing (Spark × Blaze), Appwrite Pricing/Changelog, PocketBase Docs, MongoDB Atlas free tier. Limites devem ser reconfirmados no ato de qualquer decisão.
