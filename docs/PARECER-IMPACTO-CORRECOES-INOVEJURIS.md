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
