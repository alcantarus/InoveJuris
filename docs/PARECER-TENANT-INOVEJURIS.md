# InoveJuris — Parecer técnico: multitenancy (organização/tenant) para locação futura

> **Documento de análise e continuidade.**  
> Emitido em: **2026-11-18**.  
> Branch analisada: `trabalho-com-claude`.  
> HEAD no momento da análise: `ed9103d` (`docs: registrar commit e deploy do logout global`).  
> Status: **somente leitura**. Nenhum arquivo, migration, banco de dados ou deploy foi alterado em razão deste parecer.  
> Deploy de produção considerado como “último ponto bom”: `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs`.

---

## 0. Como usar este documento

Este relatório responde a quatro perguntas:

1. O sistema suporta locations/organizações diferentes hoje? **Não.**
2. É possível adaptar para alugar a aplicação? **Sim, de forma gradual.**
3. O que precisa existir antes de qualquer mudança? **Backup validado + segurança server-side/Camada B.**
4. Como o trabalho do usuário é afetado? **Quase nada no início; uma fatia visual por vez depois.**

As seções 1 a 11 são o parecer entregue ao usuário. Os apêndices contêm o inventário técnico detalhado, os checks sugeridos e os comandos de backup. **Comandos e SQLs documentados aqui não foram executados contra produção.**

---

# 1. Parecer resumido

Sim, é possível transformar o InoveJuris em um sistema locável para vários escritórios. Tecnicamente, o caminho mais adequado hoje é:

> **Um banco Supabase compartilhado + coluna `organization_id`/`tenant_id` + tabela de associação usuário ↔ organização + RLS no banco.**

Mas o sistema atual **não está pronto para SaaS**. Ele foi desenhado explicitamente para **um único escritório**, com separação apenas entre `production` e `test`:

- `docs/STATUS-INOVEJURIS.md:27` — “uso de um único escritório (não SaaS/multi-tenant)”.
- `docs/PLANO-MELHORIAS-INOVEJURIS.md:56` — “Não implementar multi-tenant agora... não criar `office_id` sem necessidade real”.

O isolamento existente depende de filtro no cliente, feito pelos Proxies de `lib/supabase.ts` e `lib/supabase-server.ts`. A maior parte das RLS é permissiva (`USING (true)`). Isso pode funcionar para separar produção/teste de um escritório único, mas **não é suficiente para separar empresas diferentes**.

Portanto:

> **Não começar pelas telas nem pelo seletor de organização.**  
> Começar por **backup**, depois **segurança/server-side**, depois **fundação aditiva de tenant**, e só depois tocar nas telas — uma fatia por vez, com o usuário utilizando o sistema entre cada fatia.

As primeiras fases podem ser praticamente invisíveis. A primeira mudança visual relevante seria um seletor de “Organização” ao lado de “Produção/Teste”, e mesmo assim somente depois que o servidor estiver preparado.

---

# 2. Plano de backup e recuperação — prioridade zero

Como o usuário não pode ficar com o sistema parado, **nenhuma fase pode começar sem ponto de retorno conhecido e testado**.

## 2.1 Pontos de restauração atuais conhecidos

| Tipo | Ponto |
|---|---|
| Código | Commit `ed9103d` — `docs: registrar commit e deploy do logout global` |
| Commit funcional anterior | `119e1e1` — `feat(auth): encerrar todas as sessoes ao fechar aba/janela` |
| Deploy de produção atual | `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` |
| Deploy anterior da Camada A | `dpl_8FnNJ22Za6efpojF5gNqP5vxentp` |
| Deploy anterior de autenticação | `dpl_3uTJ1pycd3GUT4jJtZXggjUpmsrh` |
| Banco | Supabase ref `jhlxzqsgmudkbjkynqdl` |

Antes da primeira fatia de tenant, criar uma tag, por exemplo:

```powershell
git tag pre-tenant-t0
git push origin pre-tenant-t0
```

Registrar também o deploy atual como “último ponto bom”.

## 2.2 Backup lógico do banco

Antes de qualquer DDL, fazer dumps completos, de schema e de dados. Comandos sugeridos — **documentados, não executados**:

```powershell
npx supabase db dump --remote=jhlxzqsgmudkbjkynqdl --file "C:\InoveTecnologia\InoveJuris\backup\pre-tenant-full-20261118.sql"

npx supabase db dump --remote=jhlxzqsgmudkbjkynqdl --schema-only --file "C:\InoveTecnologia\InoveJuris\backup\pre-tenant-schema-20261118.sql"

npx supabase db dump --remote=jhlxzqsgmudkbjkynqdl --data-only --file "C:\InoveTecnologia\InoveJuris\backup\pre-tenant-data-20261118.sql"
```

Depois:

```powershell
Get-FileHash "C:\InoveTecnologia\InoveJuris\backup\pre-tenant-full-20261118.sql" -Algorithm SHA256
```

Regras:

- Não comitar dumps com dados reais no Git.
- Guardar os dumps fora do repositório, em local controlado.
- Registrar data/hora exata do dump.
- Anotar contagens das tabelas principais: `users`, `clients`, `contracts`, `processes`, `process_deadlines`, `publications`, `audit_logs`, `user_sessions`.
- Se o plano Supabase tiver PITR ativo, registrar o timestamp imediatamente antes de cada fatia de maior risco.

## 2.3 Backup de configurações e storage

Além do banco:

- `system_settings` — tema, metas, SMTP, integrações.
- `backup_settings` e `backup_logs`.
- Tokens OAuth de e-mail.
- Buckets de Storage: `templates`, `client_documents`, marketing/imagens.
- Variáveis de ambiente da Vercel e `.env.local`.
- Logo e arquivos estáticos usados pela Sidebar.

Hoje isso é global por ambiente; com tenant, precisará ser por organização.

## 2.4 Restore em staging antes de produção

Regra prática:

> **Nunca testar restore diretamente sobre produção.**

Para cada fatia de maior risco — RLS, unicidades, backup/restore:

1. Criar projeto Supabase de staging ou banco local.
2. Restaurar o dump.
3. Aplicar a migration da fatia.
4. Rodar checks de contagem e integridade.
5. Testar login, cadastro, edição e exclusão.
6. Somente então aplicar em produção.

## 2.5 Matriz de rollback por camada

| Camada | Estratégia de rollback |
|---|---|
| Código | Promover deployment anterior no painel Vercel, ou reverter commit |
| Migration aditiva | Colunas novas começam `NULL`; rollback é dropar coluna/índice |
| Backfill | Parar job; dados antigos permanecem intactos |
| Proxy/cliente | Feature flag para voltar ao proxy anterior |
| RPCs | Manter versão antiga da função em arquivo de rollback |
| RLS | Salvar SQL exato das policies permissivas antes de removê-las |
| Storage | Não apagar paths antigos até após validação |
| Configurações | Restaurar `system_settings` do dump |
| Deploy | `dpl_9T539...` e anteriores como pontos conhecidos |

Cada fatia deve entregar:

1. SQL **forward**.
2. SQL **rollback**.
3. Query de **verificação**.

Sem esses três, a fatia não entra em produção.

---

# 3. Linha de base: como o sistema funciona hoje

## 3.1 Isolamento atual: `environment`, não tenant

Hoje existe apenas o eixo `AppEnv = 'production' | 'test'`:

- `lib/env.ts:3-19`
- `lib/supabase.ts:21-40`
- `lib/supabase-server.ts:6-10`
- `app/setup/page.tsx:1022-1032`

O Proxy client-side injeta `.eq('environment', currentEnv)` em consultas e `environment` em inserções. Porém:

- **RPCs não são interceptadas** — `lib/supabase.ts:125-128`, `lib/supabase-server.ts:89-92`.
- Exceções do Proxy: `users`, `user_sessions`, `geo_cache`, `client_onboarding_tokens`, `contract_diseases`.
- Views, Realtime, service role e rotas administrativas fogem do Proxy.

O filtro de ambiente é, portanto, majoritariamente **client-side**, não uma garantia do banco.

## 3.2 Autenticação e sessão

Fluxo atual:

1. `authenticate` chama `app_authenticate`; bcrypt é comparado no Postgres.
2. `login` trocha `challenge` por `session_id` opaco.
3. Cookies httpOnly: `session_id` e `app_env`, sem expiração persistente.
4. `validate` no carregamento da aplicação.
5. Heartbeat a cada 20s; tolerância de 90s no servidor.
6. `close_session` via `sendBeacon` ao fechar aba/janela encerra todas as sessões do usuário.

Arquivos:

- `lib/auth.ts:15-47`, `:89-154`, `:156-198`, `:200-211`, `:230-256`.
- `app/api/auth/session/route.ts:30-61`, `:67-301`.
- `middleware.ts:7-28`.
- `components/SessionMonitor.tsx:26-166`.
- `supabase/migrations/20261118150000_auth_session_hardening.sql`.
- `supabase/migrations/20261118170000_session_close_all_devices.sql`.

Com tenant:

- A sessão precisa carregar a organização ativa.
- `app_logout_all_user_sessions` precisa ser redefinido: todas as organizações ou apenas a ativa.
- Troca de organização precisa ser validada no servidor, não confiada em cookie.

## 3.3 Permissões

Modelo híbrido:

- Booleanas `canAccess*` em `users` — `lib/auth.ts:20-42`.
- Slugs em `permissions`/`role_permissions`.
- Perfis: Administrador, Advogado, Estagiário etc.
- Camada A entregue para Prazos, Calendário e Publicações.
- `PERMISSION_MAP` e guarda em `app/dashboard-layout.tsx:11-48`.
- Camada B pendente em `docs/PLANO-MELHORIAS-INOVEJURIS.md:122-130`.

Para SaaS, a Camada B deixa de ser desejável e passa a ser **pré-requisito**.

## 3.4 Banco

Grande parte das policies segue o padrão:

```sql
create policy "Allow all access to %I"
for all using (true) with check (true);
```

Exemplos: `publications`, `publication_sync_log`, `process_deadline_history`, `process_sync_log`, `client_relationships`, tarefas, kanban, marketing.

Há ainda:

- Migrations duplicadas com variantes `-1`, `-2`.
- SQLs soltos convivendo com `supabase/migrations/`.
- `supabase_migrations.sql` com estrutura base e RBAC.
- `login_attempts` referenciada, mas sem `CREATE` local encontrado — confirmar no remote.

Antes de qualquer mudança de tenant, é preciso confirmar **qual schema está realmente aplicado em produção**.

---

# 4. Impacto por camada

| Camada | Situação hoje | Impacto com tenant | Prioridade |
|---|---|---|---|
| Sessão | `session_id` + `app_env` | Precisa de organização ativa validada no servidor | Alta |
| Login | E-mail único global | Definir se e-mail pode repetir por organização | Alta |
| Permissões | Booleanas em `users` + RBAC global | Virar `(usuário, organização)` | Alta |
| RLS | Majoritariamente permissiva | Trocar por RLS de membership | Crítica |
| RPCs | `SECURITY DEFINER` sem tenant | Todas precisam validar tenant da sessão | Crítica |
| Proxy | Injeta só `environment` | Precisa injetar/validar organization | Alta |
| APIs | Muitas sem sessão real | Toda escrita precisa de tenant validado | Crítica |
| Views | KPIs sem tenant | Recriar com `organization_id` e `security_invoker` | Alta |
| Realtime | Canais por usuário/ambiente | Canais precisam incluir tenant | Média/Alta |
| Storage | Buckets públicos/sem prefixo | Path `tenant_id/...` + policy de membership | Alta |
| `system_settings` | Chave `(key, environment)` | Virar `(key, environment, organization_id)` | Alta |
| Auditoria | Sem tenant; `performed_by` vem da linha | Incluir tenant, sessão e autor real | Alta |
| Backup/restore | Sem sessão; restore faz `upsert` direto | Bloquear e tornar por tenant | Crítica |
| DJEN/DataJud | Body define ambiente/IDs | Tenant precisa vir da sessão/admin | Alta |
| Gemini | Chave exposta no browser | Mover para servidor e separar uso por tenant | Média |
| Portais por token | Tokens globais | Token precisa resolver tenant | Média |
| Branding | Logo/WhatsApp fixos | Configurável por organização | Média |
| Legado | `/setup`, `route-1.ts`, `clientes-v2`, `doencas` | Congelar ou remover antes de escalar | Média |

---

# 5. Pontos críticos de segurança antes de tenant

Esses itens precisam ser resolvidos **antes** de qualquer seletor de organização:

1. **`exec_sql` exposto** em `/api/fix-db`, `/api/diagnose-db`, `/api/check-enum`, `/api/alter-leads`, `/api/fix-cancellation` e variantes `route-1.ts`. Com tenant, isso é acesso total a todas as organizações.
2. **`/api/backup/restore`** faz `upsert(data)` direto, sem sessão e sem filtro — `app/api/backup/restore/route.ts:7-58`.
3. **`/api/backup/generate`** aceita `userId` no body e usa service role — `app/api/backup/generate/route.ts:18-36`.
4. **`/api/settings/audit/cleanup`** apaga logs só por ambiente e data — `app/api/settings/audit/cleanup/route.ts:6-39`.
5. **`/api/djen-sync` e `/api/process-sync`** recebem ambiente/IDs pelo body.
6. **`search_all`** com `p_environment IS NULL` busca tudo.
7. **RLS permissiva** em grande parte das tabelas.
8. **Camada B pendente** — autorização server-side por módulo.

Se tenants forem adicionados sem isso, a interface parecerá separada, mas o banco continuará permitindo acesso cruzado.

---

# 6. Modelo recomendado de tenant

## 6.1 Escolha arquitetural

| Modelo | Vantagem | Desvantagem | Recomendação |
|---|---|---|---|
| Coluna `organization_id` + RLS | Simples, incremental, um deploy, um banco | Exige disciplina rigorosa de RLS/RPCs | **Recomendado agora** |
| Schema por tenant | Isolamento maior | ~60 tabelas por cliente, migrations complexas, backup chato | Futuro distante |
| Banco por tenant | Isolamento máximo | Provisionamento, custo, conexões, PITR e deploy por cliente | Só para clientes regulatórios grandes |

## 6.2 Estrutura sugerida

```text
organizations
  id uuid PK
  slug text unique
  name text
  status text
  plan text
  created_at
  ...

organization_members
  organization_id uuid FK
  user_id bigint FK
  role_id / role_slug
  status text
  is_default boolean
  created_at
  PK (organization_id, user_id)
```

Regras:

- `users` continua como identidade global.
- Um usuário pode pertencer a várias organizações.
- A sessão carrega **uma organização ativa por vez**.
- `environment` continua como segundo eixo: `production`/`test`.
- Chaves únicas passam a incluir organização:

| Tabela | Unique atual | Unique sugerido |
|---|---|---|
| `users` | `email` | Global ou `(organization_id, email)` — decisão pendente |
| `clients` | `(document, environment)` | `(organization_id, environment, document)` |
| `processes` | `(number, environment)` | `(organization_id, environment, number)` |
| `lawyers` | `(oab_number, uf_oab, environment)` | `(organization_id, environment, oab_number, uf_oab)` |
| `publications` | `(source, external_id, environment)` | `(organization_id, environment, source, external_id)` |
| `system_settings` | `(key, environment)` | `(organization_id, environment, key)` |
| `permissions` | `slug` | Catálogo global ou por tenant — decisão pendente |

## 6.3 O que nunca fazer

Não criar algo como:

```sql
set_app_organization('id-do-outro-tenant')
```

sendo essa função chamada diretamente pelo cliente. O tenant precisa ser derivado da **sessão validada no banco**, não de parâmetro do front nem de cookie confiável.

Cookie pode existir como dica de UI; a autoridade tem que ser a sessão no Postgres.

---

# 7. Impacto no fluxo de trabalho do usuário

## Antes

```text
Login → E-mail/senha → Produção ou Teste → Sistema
```

## Depois, com mais de uma organização

```text
Login → E-mail/senha → Organização → Produção ou Teste → Sistema
```

Se o usuário pertencer a apenas uma organização, a seleção pode ser automática — sem clique extra.

| Momento | O que o usuário percebe |
|---|---|
| Fase de backup e segurança | Nada visual |
| Criação das tabelas de organização | Nada visual |
| Colunas `organization_id` nullable + backfill | Nada visual |
| Sessão com organização ativa | Pode aparecer organização no banner/Sidebar |
| Proxy/RPCs com tenant | Nada visual, mas mais segurança |
| RLS restritiva | Nada visual se tudo estiver correto; pode gerar 403 se algo faltou |
| Telas adaptadas | Filtros/KPIs mostram só a organização ativa |
| Branding por tenant | Logo/nome/contato podem mudar por organização |
| Backup/restore | Exportação/importação passam a ser por organização |

Cadência recomendada:

> uma fatia pequena → build → preview → uso real → validação → aprovação → próxima fatia.

---

# 8. Plano gradual recomendado

## Fase T0 — Backup + pré-requisitos de segurança

Ações:

- Dumps full/schema/data.
- Confirmar PITR e registrar timestamp.
- Tag no Git e deploy conhecido.
- Salvar SQL de rollback das policies atuais.
- Conferir migrations `-1`/`-2` aplicadas.
- Confirmar estrutura real de `login_attempts`.
- Proteger/desabilitar `exec_sql`.
- Travar `/api/backup/restore`.
- Revisar APIs sem sessão.
- Iniciar Camada B.

**Percepção:** nenhuma mudança visual.  
**Checkpoint:** usuário continua usando o sistema normalmente.

---

## Fase T1 — Decisões de produto + fundação aditiva

Ações:

- Decidir modelo de negócio e identidade.
- Criar `organizations` e `organization_members`.
- Criar tenant padrão com todos os dados atuais.
- Vincular usuários existentes ao tenant padrão.
- Nenhuma coluna em tabelas de domínio ainda, ou apenas colunas `NULL`.

**Percepção:** nenhuma.  
**Rollback:** dropar tabelas novas.

---

## Fase T2 — Expand: colunas e índices

Ações:

- Adicionar `organization_id uuid NULL` nas tabelas de domínio, em lotes.
- Criar índices `CONCURRENTLY`.
- Criar novos índices únicos com tenant, mantendo os antigos.
- Backfill em lotes pequenos.

Ordem sugerida:

1. `clients`, `lawyers`, `law_areas`, `products`, `diseases`.
2. `processes`, `contracts`, `installments`, `payments`, financeiro.
3. `process_deadlines`, `publications`, `client_relationships`, `tasks`, `notifications`.
4. Logs, auditoria, históricos e sync.
5. Views e storage.

**Percepção:** nenhuma; app continua igual.

**Validação:**

```sql
select count(*) from public.<tabela> where organization_id is null;
```

---

## Fase T3 — Sessão e contexto

Ações:

- `organization_id` em `user_sessions`.
- Payload de usuário com organização ativa e membrosias.
- Troca de organização validada no servidor.
- Sidebar/EnvBanner mostram organização ativa.
- Redefinir logout global.
- Corrigir impersonação para ser por organização e auditada.

**Percepção:** primeira mudança visual — seletor/banner de organização.

**Validação:** login, reload, troca de organização, troca de ambiente, logout global e duas sessões simultâneas.

---

## Fase T4 — Enforcement em modo observação

Ações:

- Proxy client/server passa a enviar organization.
- RPCs passam a aceitar e validar organization derivada da sessão.
- Logs de observação para acesso fora do tenant.
- Feature flag para ligar/desligar.
- Ajustar `search_all`, RPCs financeiras, prazos, Publicações, representação legal, backup etc.

**Percepção:** nada, além de log interno.  
**Objetivo:** descobrir consultas que esqueceram o filtro antes de aplicar RLS restritiva.

---

## Fase T5 — RLS restritiva

Ações:

- Remover policies permissivas antigas.
- Criar policies por membership.
- Recriar views com tenant.
- Ajustar Realtime.
- Ajustar Storage com path `organization_id/...`.
- Ajustar `system_settings`.
- Ajustar auditoria.

**Percepção:** idealmente nada. Se alguma tela faltou, pode dar `403`.  
**Validação mínima:** duas organizações de teste, tentativa deliberada de acessar ID da outra e confirmação de bloqueio.

---

## Fase T6 — Telas em lotes

Um módulo por ciclo:

1. Dashboard.
2. Clientes.
3. Processos.
4. Prazos e Calendário.
5. Publicações.
6. Contratos e Financeiro.
7. Relatórios e Indicadores.
8. Documentos.
9. Configurações e Usuários.
10. Auditoria.

Cada lote deve preservar o padrão atual de tabela desktop + cards mobile.

**Percepção:** pequenas mudanças visuais de um módulo por vez.  
**Cadência ideal:** após cada lote, usar o sistema por um ou dois dias antes de liberar o próximo.

---

## Fase T7 — Operação realmente locável

Ações:

- Onboarding de novo tenant.
- Admin/dono por organização.
- Convite de usuários.
- Limites por plano, se desejar.
- White-label: logo, nome, WhatsApp, tema.
- Backup/exportação por tenant.
- Política de retenção/LGPD por tenant.
- Portais por token com tenant.
- Congelar ou remover legado.

**Percepção:** passa a existir uma experiência de “cliente/tenant” de verdade.

---

# 9. Riscos principais e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Começar pelo seletor de organização | Falsa sensação de isolamento | Fazer sessão/RLS antes |
| Reaproveitar RLS `USING (true)` | Vazamento entre escritórios | Dropar policies permissivas explicitamente |
| `organization_id` do body | Troca de tenant por qualquer usuário | Derivar sempre da sessão |
| RPCs `SECURITY DEFINER` sem tenant | Operações cruzadas | Validar membership dentro da RPC |
| Migration duplicada `-1/-2` | Aplicar DDL sobre schema errado | Inventariar schema real antes |
| Unique global de e-mail/slug | Bloqueio de cadastros iguais em tenants | Decidir modelo de identidade |
| Restore de backup | Sobrescrita de outro tenant | Restore só em staging; export por tenant |
| Storage público | Documentos vazados | Path por tenant + policy |
| Auditoria sem tenant | Impossibilidade de responsabilizar ações | Incluir `organization_id` e `session_id` |
| Big bang | Sistema parado | Uma fatia por commit/deploy/checkpoint |

---

# 10. Decisões pendentes do usuário

Antes da Fase T1:

1. **Modelo de negócio:** um tenant por escritório pagante, ou um escritório com várias unidades/filiais?
2. **Usuário pertence a vários tenants?** Se sim, troca de organização na Sidebar ou por convite separado?
3. **E-mail pode se repetir entre organizações?** Exemplo: `admin@admin.com` em cada escritório.
4. **Superadmin é global ou por organização?** Admin de uma organização pode criar usuários em outra?
5. **`production/test` continua para todos os tenants**, ou cada tenant terá seus próprios ambientes lógicos?
6. **Auditoria e backup são por tenant**, ou o operador da plataforma vê tudo?
7. **Logout global** encerra todas as organizações ou apenas a ativa?
8. **White-label** é necessário desde o início ou pode vir depois?
9. **Legado** (`/setup`, `clientes-v2`, `doencas`, `route-1.ts`, migrations `-1/-2`) deve ser congelado antes ou depois?

A decisão mais estrutural é a **nº 3**. Ela define se `users.email` continua único globalmente ou se vira único por organização. Essa mudança é caríssima depois de popular dados.

---

# 11. Conclusão

O InoveJuris **pode sim** evoluir para um sistema locável. O caminho mais seguro é:

```text
Backup → Segurança/Camada B → Fundação aditiva de tenant
→ Sessão com organização → Proxy/RPCs → RLS → Telas em lotes → Operação SaaS
```

O maior cuidado não é criar a coluna `organization_id`. O maior cuidado é garantir que **toda leitura, toda escrita, toda RPC, toda view, todo canal Realtime, todo storage e todo backup** respeitem a organização ativa — e que isso seja validado no servidor, não apenas no front.

Na rotina do usuário:

- no início, nenhuma mudança visível;
- depois, um seletor de organização;
- depois, módulos adaptados um por um;
- sempre com build, preview, uso real e checkpoint antes de continuar.

O ponto atual de produção — commit `ed9103d` e deploy `dpl_9T539S8prQ6NQ4pwMpPZcfW1T3qs` — deve ser tratado como o primeiro “ponto bom” antes dessa jornada.

---

# Apêndice A — Inventário técnico detalhado

## A.1 Autenticação, sessão e permissões

| Arquivo | Papel |
|---|---|
| `lib/auth.ts` | `useAuth()`, `User`, bootstrap/validação, login, logout, impersonação, troca de ambiente |
| `app/api/auth/session/route.ts` | Ações `authenticate`, `login`, `validate`, `close_session`, `heartbeat`, `logout`, `switch_environment`, admin e segurança |
| `middleware.ts` | Apenas presença/formato de `session_id`/`app_env`; whitelist `/api/auth` |
| `components/SessionMonitor.tsx` | Heartbeat 20s, idle timeout, `sendBeacon` de `close_session` |
| `app/dashboard-layout.tsx` | `PERMISSION_MAP`, checagem client-side de módulo |
| `components/Sidebar.tsx` | Navegação, notificações, troca de ambiente, perfil, logo/suporte fixos |
| `app/usuarios/page.tsx` | Listagem de `users`, `roles`, `user_roles`, formulário, anti-elevação client-side |
| `components/UserTable.tsx` | `canEditUser`/`canDeleteUser`, nomes protegidos hardcoded, badges de permissões |
| `supabase/migrations/20261118150000_auth_session_hardening.sql` | RPCs de auth, payload, sessões, dispositivos, anti-elevação, grants |
| `supabase/migrations/20261118160000_module_permissions.sql` | Flags de Prazos/Calendário/Publicações, slugs, anti-elevação, auditoria de diff |
| `supabase/migrations/20261118170000_session_close_all_devices.sql` | TTL 90s e logout global |

Observações relevantes:

- `_auth_user_payload()` devolve `role_name: null`.
- Perfis reais vivem em `roles`/`user_roles` e aparecem na tela de Usuários via join separado.
- `Sidebar.tsx` compara `role_name === 'admin'` e sempre cai em “Usuário”.
- Impersonação na UI só é habilitada para `admin@admin.com` na prática.
- Nomes protegidos hardcoded em `components/UserTable.tsx` e `app/usuarios/page.tsx`.
- `app_logout_all_user_sessions()` encerra sessões de todos os dispositivos, sem noção de tenant.

## A.2 Banco, RLS, RPCs e views

Tabelas core definidas em `supabase_migrations.sql`:

| Tabela | Linha | Observação para tenant |
|---|---:|---|
| `users` | `:9` | `email UNIQUE` global; flags; `is_superadmin`; exceção no Proxy |
| `clients` | `:99` | `UNIQUE (document, environment)` |
| `indicators` | `:132` | `UNIQUE (cpf, environment)` |
| `law_areas` | `:155` | `UNIQUE (name, environment)` |
| `products` | `:166` | — |
| `contracts` | `:177` | `client_id ON DELETE CASCADE` |
| `installments` | `:213` | `contract_id ON DELETE CASCADE` |
| `processes` | `:230` | `UNIQUE (number, environment)` |
| `bank_accounts` | `:249` | — |
| `financial_categories` | `:262` | — |
| `financial_transactions` | `:273` | `account_id`/`destination_account_id` com cascade |
| `payments` | `:289` | `installment_id ON DELETE CASCADE` |
| `audit_logs` | `:304` | `record_id TEXT`, `old_data`, `new_data`, `changed_fields`, `performed_by`, `environment` |
| `system_settings` | `:927` | `PK (key, environment)` |
| `roles`, `permissions`, `role_permissions`, `user_roles` | `:1015+` | RBAC não tenant-aware |
| `document_templates`, `template_variables` | `:1046+` | Policies permissivas |
| `client_documents`, `client_interactions`, `client_tags`, `client_onboarding_tokens` | `:1188+` | Onboarding com leitura/escrita pública |

Tabelas adicionais por domínio:

| Tabela | Origem | Observação |
|---|---|---|
| `commission_payments`, `indicator_tokens` | `supabase_setup.sql:33`, `:54` | `indicator_tokens` com leitura pública |
| `notifications`, `process_deadlines` | `supabase_deadlines_fix.sql:26`, `:37` | `USING (true)` |
| `tasks`, `task_history` | `20260320000000_create_tasks_tables.sql` | RLS por `auth.uid()` inconsistente com sessão opaca |
| `backup_settings`, `backup_logs` | `20260318000000_create_backup_tables.sql` | Config por ambiente |
| `process_sync_log` | `20261117150000_fix_datajud_sync.sql` | `USING (true)` |
| `process_deadline_history` | `20261117190000_editable_deadlines.sql` | `USING (true)` |
| `publications`, `publication_sync_log` | `20261118120000_create_publications.sql` | `UNIQUE (source, external_id, environment)` |
| `client_relationships` | `20261118140000_client_legal_guardians.sql` | `related_client_id ON DELETE RESTRICT` |
| `lawyers` | `supabase_add_lawyers.sql`, `20261118130000_add_lawyer_oab_uf.sql` | `UNIQUE (oab_number, uf_oab, environment)` |
| `login_challenges`, `login_attempts`, `trusted_devices`, `user_sessions` | `20261118150000...` | `login_attempts` sem `CREATE` local encontrado |
| `installment_history` | `phase1_contas_a_receber.sql` | Único caso de RLS com `app.current_env` |
| `kanban_boards`, `kanban_columns` | `setup_kanban_phase1.sql` | `USING (true)` |
| `diseases`, `product_diseases`, `contract_diseases` | SQLs de diseases | `USING (true)` |
| `birthday_templates`, `birthday_messages`, `marketing_logs` | `fix_marketing_complete.sql` | Várias variantes recriam policies permissivas |
| `leads` | `create_leads_table.sql` | `fix_leads_rls.sql` usa `auth.role()` |
| `geo_cache` | `geo_cache.sql` | Global por natureza |
| `integration_logs` | `create_api_logs.sql` | Log sem tenant |

Views que precisarão de tenant:

- `vw_process_velocity`
- `vw_cash_flow_forecast`
- `vw_area_efficiency`
- `vw_indicator_commission_status`
- `contract_receivables_summary`
- `vw_dashboard_receivables_metrics`
- `vw_dashboard_receivables_forecast`
- `vw_dashboard_top_defaulters`
- `process_deadlines_view`
- `v_client_guardians`

RPCs sensíveis sem tenant hoje:

- Auth/admin: `app_authenticate`, `app_complete_login`, `app_validate_session`, `app_heartbeat`, `app_logout`, `app_switch_environment`, `app_admin_save_user`, `app_admin_delete_user`, `app_admin_impersonate`, `app_admin_terminate_session`, `app_admin_trust_device`, `app_get_security_data`, `app_get_my_trusted_devices`, `app_remove_my_trusted_device`, `app_logout_all_user_sessions`.
- Domínio: `search_all`, `get_clients_with_process_summary`, `process_installment_payment`, `process_installment_estorno`, `rpc_recebimento_com_desdobramento`, `create/update/confirm/delete_process_deadline`, `save_client_guardians`, `get_financial_summary`, `get_financial_chart_data`, `get_future_receivables_projection`, `update_account_balance`.
- Infra: `set_app_environment`, `get_db_size`, `djen_fetch`, `exec_sql`.

Storage:

- Buckets `templates`, `client_documents`, marketing.
- Policies não usam prefixo de tenant.
- Paths precisarão virar `organization_id/...`.

## A.3 Telas e componentes

Inventário atual: **30 arquivos `app/**/page.tsx`**, **20 arquivos `app/api/**/route.ts`**.

Telas maiores:

| Tela | Arquivo | Linhas aproximadas |
|---|---|---:|
| Dashboard | `app/page.tsx` | 1.798 |
| Contratos | `app/contratos/page.tsx` | 2.899 |
| Relatórios | `app/relatorios/page.tsx` | 2.150 |
| Clientes | `app/clientes/page.tsx` | 1.607 |
| Contas a Receber | `app/contas-a-receber/page.tsx` | 1.417 |
| Setup | `app/setup/page.tsx` | 1.393 |
| Processos | `app/processos/page.tsx` | 1.225 |

Áreas e impactos:

| Área | Arquivos | Impacto |
|---|---|---|
| Dashboard | `app/page.tsx`, componentes de KPI | 15 consultas paralelas + 5 canais Realtime; views e KPIs por tenant |
| Clientes | `app/clientes/page.tsx`, `app/clientes/[id]/page.tsx` | Lista, RPC, CEP, documentos, tags, interações, storage |
| Contratos | `app/contratos/page.tsx` | Formulário grande; parcelas, doenças, contas, categorias, RPCs financeiras |
| Processos | `app/processos/page.tsx`, `app/processos/[id]/page.tsx` | DataJud, notificações, Realtime, detalhe por URL |
| Prazos/Calendário | `lib/deadlines.ts`, `app/prazos/page.tsx`, `app/calendario/page.tsx` | Já filtra por ambiente; precisa ganhar tenant; canais Realtime hoje não filtram |
| Publicações | `lib/publications.ts`, `components/publicacoes/*` | Triagem, criação de prazo, sync DJEN com `environment` |
| Financeiro | `app/contas-a-receber/page.tsx`, `app/fluxo-caixa/*` | Pagamentos, estornos, saldos, RPCs |
| Relatórios | `app/relatorios/page.tsx` | Vários tipos; consultas diretas + RPCs |
| Indicadores | `app/indicadores/page.tsx` | Tokens públicos, comissões, marketing |
| Documentos | `app/documentos/page.tsx` | Templates, variáveis, storage |
| Configurações | `app/configuracoes/page.tsx` | 13 abas, incluindo backup, integrações, LGPD |
| Usuários | `app/usuarios/page.tsx` | Booleanas ↔ slugs, admin, impersonate |
| Portais | `app/onboarding/[token]`, `app/portal/indicador/[token]` | Tokens precisam resolver tenant |
| Setup/Legado | `app/setup`, `clientes-v2`, `doencas` | Congelar/remover antes de escalar |

Componentes sensíveis:

| Componente | Impacto |
|---|---|
| `components/Sidebar.tsx` | Ponto natural do seletor de organização; notificações hoje por `user_id`; logo/suporte fixos |
| `components/EnvBanner.tsx` | Hoje mostra só ambiente; precisa mostrar organização sem poluir mobile |
| `components/providers/SettingsProvider.tsx` | `system_settings` com `onConflict: 'key,environment'`; precisa virar `(key, environment, organization_id)` |
| `components/tasks/TaskKanban.tsx`, `TodayFocusWidget.tsx` | `user_id` do `localStorage`; boards globais |
| `components/GlobalSearch.tsx` | `search_all` com `p_environment`; faltará `p_organization_id` |
| `components/BirthdayChecker.tsx`, `BirthdayWidget.tsx` | Clientes, indicadores, contratos e marketing por tenant |
| `components/GPSNotificationChecker.tsx` | Contratos e notificações por tenant |
| `components/reports/AIInsightsWidget.tsx` | Usa chave Gemini no browser; revisto com tenant |
| Padrão mobile | Tabela desktop + cards mobile consomem a mesma lista filtrada;tenant precisa ser aplicado antes dos dois renderizadores |

## A.4 APIs e integrações

| Rota | Situação | Risco com tenant |
|---|---|---|
| `/api/auth/session` | RPCs com `session_id` | Precisa validar membership e tenant ativo |
| `/api/djen-sync` | `environment` e `lawyerIds` do body; service role opcional | Pode gravar em outra organização |
| `/api/process-sync` | `process_id`/`process_number` do body | Mesmo risco |
| `/api/process-consultation` | Consulta DataJud; sem sessão | Baixo risco de dados, mas precisa de rate limit |
| `/api/check-deadlines` | Cria notificações, `user_id: null` | Notificações cruzadas |
| `/api/backup/generate` | `userId` do body; service role | Exportação indevida |
| `/api/backup/restore` | ZIP → `upsert(data)` | Crítico: sobrescreve qualquer tabela |
| `/api/settings/smtp/test` | Credenciais no body; sem sessão | SMTP precisa ser por tenant e restrito a admin |
| `/api/auth/email/url` e `/callback` | Tokens em `system_settings`, `environment: 'production'` fixo | Config global; precisa de `state`, tenant e criptografia |
| `/api/settings/audit/cleanup` | Delete por ambiente/data | Destruição cruzada de evidências |
| `/api/db/status`, `/api/check-db` | Informação de infra | Deixar de ser global |
| Rotas `exec_sql` | SQL arbitrário | Comprometimento total de todos os tenants |

Integrações:

- DJEN: OABs cadastradas; `environment` do body; escrita em Publicações; `djen_fetch` sem tenant.
- DataJud: gravação via API sem sessão; `process_sync_log` sem tenant.
- Gemini: chave exposta no browser; custo/uso e dados precisam ser separados por tenant.
- SMTP/OAuth: config por ambiente; precisa virar por tenant.
- Storage: buckets e URLs públicos sem prefixo de tenant.
- Viacep: externo, sem estado; apenas logging auditável se necessário.

## A.5 Histórico relevante

Existe histórico Git de tentativa anterior de multiorganização:

- `organization_id` em `clients`, `contracts`, `products`.
- RLS por `current_setting('custom.organization_id', true)` e depois `app.current_organization_id`.
- `OrganizationProvider`, cookie/localStorage `app_org`, painel Super Admin e kanban isolado.
- Commits antigos: `eab8a87`, `507d471`, `a234f2e`, `be31467`, `342c88b`, `8f635ee`, `ec13e35`, `726c753`, `6e0c5e7`, `1ff0e8e`, `af9beee`, `39d266a`, `f8878b1` entre outros.

No working tree atual não há `organization_id`, `app_org` ou `OrganizationProvider`. A limpeza foi explícita em:

- `supabase/migrations/20261118150000_auth_session_hardening.sql:890-915`

Foram removidas policies com nomes:

- `Filter by organization`
- `Isolamento por Tenant em ...`
- `Isolamento_Definitivo_Tenant`

Isso serve de alerta: reintroduzir o modelo antigo sem as correções atuais de sessão repetiria o problema.

---

# Apêndice B — Checks sugeridos (documentados, não executados)

```sql
-- 1) Tabelas sem organization_id (após decidir o nome final da coluna)
select table_name
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = t.table_name
      and c.column_name = 'organization_id'
  );

-- 2) Linhas órfãs de tenant por tabela
select count(*) from public.<tabela> where organization_id is null;

-- 3) Policies permissivas ainda presentes
select schemaname, tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true' or qual is null);

-- 4) Funções SECURITY DEFINER e search_path
select p.proname, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;

-- 5) Grants amplos a anon/authenticated
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated');

-- 6) Views e dependências
select distinct dependent_ns.nspname || '.' || dependent.classid::regclass
from pg_depend d
join pg_class dependent on dependent.oid = d.objid
join pg_namespace dependent_ns on dependent_ns.oid = dependent.relnamespace
where d.refobjid in (
  select oid from pg_class
  where relname in ('clients','contracts','installments')
);

-- 7) Duplicatas antes de trocar unicidades
select email, count(*) from public.users group by email having count(*) > 1;
select slug, count(*) from public.permissions group by slug having count(*) > 1;

-- 8) Validação de RLS com tenant simulado
begin;
set local app.current_organization = '<uuid>';
set local role authenticated;
select count(*) from public.clients;
rollback;

-- 9) Storage com paths fora do padrão de tenant
select bucket_id, name
from storage.objects
where bucket_id in ('templates','client_documents')
  and split_part(name, '/', 1) not in (select id::text from public.organizations);
```

---

# Apêndice C — Padrão de RLS sugerido

Somente reference; não aplicar sem decisões e backup.

```sql
create or replace function public.current_organization_id()
returns uuid
language sql stable
set search_path = public, pg_temp
as $$
  select nullif(current_setting('app.current_organization', true), '')::uuid
$$;

create or replace function public.is_organization_member(p_organization uuid)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization
      and om.user_id = public.current_user_id()
  )
$$;

create policy tenant_isolation on public.clients
for all to authenticated
using (
  organization_id = public.current_organization_id()
  and public.is_organization_member(organization_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.is_organization_member(organization_id)
);
```

Atenção:

- `public.current_user_id()` precisa resolver a identidade da **sessão opaca**, não `auth.uid()`.
- O GUC `app.current_organization` precisa ser setado por função `SECURITY DEFINER` a partir da sessão validada.
- Não basta adicionar a policy: é preciso **dropar** as policies permissivas anteriores.
- Toda RPC `SECURITY DEFINER` deve validar membership explicitamente, não só confiar no GUC.

---

# Apêndice D — Referência rápida de decisões

| # | Decisão | Por que é estrutural |
|---:|---|---|
| 1 | Um tenant por escritório pagante ou filiais? | Define hierarquia e herança |
| 2 | Usuário pertence a vários tenants? | Define se login terá seletor |
| 3 | E-mail pode se repetir entre tenants? | Define unicidade de `users.email` |
| 4 | Superadmin global ou por tenant? | Define poder de admin e impersonação |
| 5 | `production/test` por tenant ou global? | Define chaves únicas e sessão |
| 6 | Auditoria/backup por tenant? | Define responsabilização e LGPD |
| 7 | Logout global ou por tenant? | Define comportamento do `close_session` |
| 8 | White-label desde o início? | Define `system_settings` e Sidebar |
| 9 | Legado antes ou depois? | Define superfície de ataque a limpar |

---

## Registro de guardado

Este arquivo é a fonte canônica do parecer de multitenancy do InoveJuris. Atualizações futuras devem ser feitas aqui e referenciadas em:

- `docs/STATUS-INOVEJURIS.md`
- `docs/PLANO-MELHORIAS-INOVEJURIS.md`

Nenhuma recomendação deste documento foi executada em código, banco ou deploy até o momento deste registro.
