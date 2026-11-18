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
