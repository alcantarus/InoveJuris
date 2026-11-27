# Modelo de Escopo de Ambiente — produção dedicada por cliente + homologação compartilhada

> **Documento de desenho. Somente proposta; nada foi executado nem alterado no banco.**
> Emitido em: **26/11/2026**.
> Status: aguardando o resultado de `docs/DIAGNOSTICO-TENANT-20261126.sql`.
> **Não executar SQL deste arquivo.**Todo SQL deve ser rodado em arquivo `docs/*.sql`, em uma única célula, no SQL Editor do Supabase.

---

## 1. Premissas confirmadas pelo usuário em 26/11/2026

1. **Banco único:** continua existindo **um único projeto Supabase**. Não haverá um banco físico por cliente. `production` e `test` permanecem sendo **valores da coluna `environment`**, conforme `CONVENCAO-AMBIENTES-BANCO-UNICO.md`.
2. **Homologação compartilhada:** no `environment = 'test'`, um cliente pode **ver e editar** os registros criados por outro cliente. A autoria continua rastreável por `performed_by` / `created_by`.

Consequência direta: o isolamento passa a ser lógico, com duas regras diferentes por ambiente — não é uma troca de `organization_id` no `test`.

---

## 2. O que muda e o que não muda

### Não muda

- Um banco, uma URL, um deploy.
- Os cookies `session_id` e `app_env`.
- A RPC `app_switch_environment` (`app/api/auth/session/route.ts:225-240`): ela continua trocando apenas `production` ↔ `test`.
- A policy restritiva `P0 sessao restritiva` (`supabase/migrations/p0_bloco3/02b_users.sql:22-29`).
- A regra de que nenhuma rotina mistura ambientes sem declarar `environment`.
- Os 180 dias de retenção de `audit_logs` (`audit_hardening.sql:12`).

### Muda

- A regra da portaria (RLS) passa a distinguir ambiente:
  - `production`: só a organização da sessão vê/edita;
  - `test`: qualquer sessão válida vê/edita, com autoria registrada.
- O `organization_id` da sessão passa a ser lido da **sessão validada no banco**, e não de parâmetro do front ou cookie.
- Views, RPCs e funções `SECURITY DEFINER` passam a replicar a mesma regra.

---

## 3. Matriz de regras por ambiente

| Ambiente | Possessão do registro | Leitura | Escrita | Rastreio |
|---|---|---|---|---|
| `production` | `organization_id` do cliente dono | Somente a organização da sessão | Somente a organização da sessão | `audit_logs.organization_id` + `performed_by` |
| `test` | `organization_id` de quem criou | Compartilhada entre clientes autenticados | Compartilhada entre clientes autenticados | `performed_by` / `created_by` continua obrigatório |

Regra permanente derivada: **nenhum dado é identificado somente por `organization_id`; sempre por `(organization_id, environment)`**.

---

## 4. Modelo de dados sugerido

### `organizations` (catálogo único de clientes)

| Coluna | Tipo | Finalidade |
|---|---|---|
| `id` | `uuid` | Identificador estável do cliente |
| `slug` | `text unique` | Chave legível e única (ex.: `inove`, `cliente-b`) |
| `name` | `text` | Nome exibido |
| `active` | `boolean` | Controle de desativação |

A criação é aditiva. Não depende de backfill e não altera dado de negócio.

> **Medição de 26/11:** a tabela `public.organizations` **já existe** no banco e **não possui coluna `environment`** — portanto já é um catálogo global, alinhado a este desenho. O `forward` do T3 deve ser idempotente: criar a tabela se ausente; se já existir, validar a estrutura e acrescentar somente o que faltar, sem recriar ou apagar nada.

### `system_settings` (configuração do escopo)

A tabela já existe com chave primária `(key, environment)` (`supabase_migrations.sql:927-936`). A chave proposta é:

- `tenant_test_scope` → valor `{"mode":"shared"}`.

**Configuração canônica:** linha com `environment = 'production'`. O helper `_rls_test_shared()` lê essa linha explicitamente, declarando o ambiente. Um espelho em `test` pode existir para documentação, mas a leitura do helper é sempre da linha canônica.

Valores possíveis:

- `shared` → homologação compartilhada (decisão atual);
- `dedicated` → volta a filtrar `test` por `organization_id`.

Trocar esse valor é mudança de configuração: entra com `forward` / `verify` / `rollback` próprio.

### Helpers novos

Ao lado dos `_rls_*` atuais (`supabase/migrations/p0_bloco3/00_fundacao.sql`):

- `_rls_organization_id()` — lê a organização da sessão validada; nunca aceita parâmetro do front;
- `_rls_test_shared()` — lê `tenant_test_scope` em `system_settings`.

Se `multi-membership` for aprovado depois, `organization_members(user_id, organization_id, role, active)` entra como acréscimo; `users.organization_id` permanece como organização padrão/ativa.

---

## 5. RLS — formato conceitual (não executar)

Padrão para cada tabela de negócio que possua `organization_id` e `environment`:

```sql
using (
  public._rls_can_access(environment)
  and (
    (environment = 'production' and organization_id = public._rls_organization_id())
    or
    (environment = 'test' and public._rls_test_shared())
  )
)
```

A política restritiva `P0 sessao restritiva` continua combinada por `AND`. A ativação é feita em duas fatias:

1. **Braço `test` primeiro:** policy permissiva nova, `environment = 'test' and public._rls_test_shared()`. Isso só amplia a visibilidade da homologação; produção fica intacta.
2. **Braço `production` depois:** policy restritiva nova, `environment <> 'production' or organization_id = public._rls_organization_id()`. Para `test` ela é sempre verdadeira e não desfaz o compartilhamento; para produção ela trava o cliente.

**Gate obrigatório antes do passo 2:** o diagnóstico precisa mostrar `0` linhas com `organization_id IS NULL` em `production`. Se houver nulos, eles são preenchidos antes, com `UPDATE` autorizado e scripts próprios — nunca automaticamente.

Decisão pendente: se `_rls_is_superadmin()` deve constar como exceção no braço `production`. Enquanto não houver lista explícita de bypass, a recomendação é **não** incluir exceção genérica.

---

## 6. Sessão, JWT e troca de ambiente

- `lib/jwt.ts:122-128,144-150` já assina `organization_id`; `app/api/auth/session/route.ts:81-87` já lê `user.organization_id`.
- `withSessionToken` passa a ler a organização **da sessão validada**, não de `user.organization_id` solto.
- `lib/server-auth.ts` passa a expor a organização em `SessionContext`.
- `_auth_user_payload` (versão atual do repositório) passa a emitir `organization_id`, alinhando-se ao JWT já assinado em produção.
- `app_switch_environment` continua sem parâmetro de organização.
- RPCs `SECURITY DEFINER` que recebem `p_environment` validam internamente:
  - `production` → exige `organization_id` da sessão;
  - `test` → aceita o escopo compartilhado.

Motivo: os proxies de `lib/supabase.ts` e `lib/supabase-server.ts` interceptam `.from(...)`, mas **não interceptam `.rpc(...)`**.

---

## 7. Views, auditoria, storage e backup

| Área | Regra deste modelo |
|---|---|
| **Views com `environment`** | Precisam expor `organization_id` e replicar o predicado da seção 5, mantendo `security_invoker=on`. Sem isso, uma view pode vazar produção mesmo com RLS correta na tabela base. |
| **Unicidades** | Índices `UNIQUE` de código/external id passam a incluir `(organization_id, environment)`. Em `test` compartilhado, códigos iguais criados por clientes diferentes podem colidir — medir antes. |
| **`audit_logs`** | Ganha `organization_id` do autor; em `test`, `performed_by` é a forma de identificar quem criou/editou. Manter 180 dias. |
| **Storage** | Medição de 26/11: `client_documents`, `marketing` e `templates` estão com `public = false` (`templates` com limite de 10 MB). O script antigo `supabase_storage_setup.sql:27-51` ainda registra `templates` como público, mas **o estado real é privado** — não inverter esse flag. Em homologação compartilhada, usar prefixo `test/shared/...`; nunca guardar arquivo sensível de produção ali. |
| **Backup** | Tag `pre-tenant-20261126` antes do T3. Export por cliente apenas para `(organization_id, environment='production')`. `test` compartilhado é um único conjunto. **Plano Free confirmado em 26/11: sem PITR e sem backups automáticos. Decisão do usuário: seguir sem custo.** Gate compensatório obrigatório: dumps com hashes + Storage + configuração + restore testado em banco novo + segunda cópia em local físico diferente. Ver `BACKUP-PRE-TENANT-20261126.md`. |

---

## 8. Sequência de implantação

| Fase | Artefato | Quem executa | Gate |
|---|---|---|---|
| **T0** | Backup próprio (sem PITR no Free) + export de policies | Usuário | Tag `pre-tenant-20261126` registrada; restore testado; segunda cópia |
| **T1** | `docs/DIAGNOSTICO-TENANT-20261126.sql` | Usuário | Inventário real conferido |
| **T2** | Este documento | Ninguém | Premissas confirmadas (já feito) |
| **T3** | `FORWARD` / `VERIFY` / `ROLLBACK-ESCOPO-FUNDACAO` | Usuário | Objetos criados; zero linhas alteradas |
| **T4a** | Helpers `_rls_organization_id()` / `_rls_test_shared()` | Usuário | Helpers testados |
| **T4b** | Braço `test` compartilhado | Usuário | Produção inalterada; teste entre clientes |
| **T4c** | Braço `production` dedicado | Usuário | Zero nulos em produção; isolamento confirmado |
| **T4d** | Views e RPCs | Usuário | `security_invoker=on`; RPCs validando tenant |
| **T5** | Backfill condicional do tenant padrão | Usuário | Somente com autorização explícita de `UPDATE` |
| **T6** | Servidor/código | Git/Vercel | `tsc` + `build` OK |
| **T7** | Front (opcional) | Git/Vercel | Smoke tests OK |
| **T8** | `VERIFY-FINAL-ESCOPO` | Usuário | Vazamento zero; rollback disponível |

Rollback de código: `git revert` do commit. Rollback de deploy: promover `dpl_5BBYQfEocqQwg39abxgSYCP7uK1Z` (commit `0644289`). Rede de segurança para policies: `backup_policies_tenant_20261119.sql` (83 policies em 40 tabelas).

---

## 9. Regras de segurança permanentes

- Usuário executa todo SQL; o agente apenas prepara scripts.
- Nenhuma credencial no chat; `GEMINI_API_KEY` é a única fonte autorizada da chave Gemini.
- Nenhum `UPDATE` / `DELETE` em dado de negócio sem autorização explícita.
- SQL completo em uma única célula; `docs/*.sql` no SQL Editor, nunca `.md`.
- Script somente leitura termina em `rollback`; mudança estrutural exige `forward` / `verify` / `rollback`.
- **Não reintroduzir `USING (true)`** e **não reaplicar `app/setup/page.tsx`** sem revisão tenant-aware (`USING (true)` em `:394`, `:405-408`, `:576`, `:587`). O aparecimento de "50 policies com `true`" em 26/11 foi **falso positivo do detector**: o regex capturava o argumento `true` de `current_setting('request.jwt.claims'::text, true)`. As 50 policies listadas são `P0 sessao` / `P0 somente leitura` com filtro de sessão e `environment`. Com o detector corrigido (expressão inteira igual a `true`), o baseline de **0 policies `USING (true)`** permanece válido.
- Toda rotina declara e filtra/traz `environment`.

---

## 10. Medição de 26/11/2026 — resultados do diagnóstico

Executado pelo usuário às **14:41:01 UTC**, PG **17.6**, banco único, `production + test`:

| Item | Resultado | Consequência |
|---|---|---|
| `organizations` | Existe; colunas `id`, `name`, `slug`, `is_demo`, `created_at`; sem `environment`; 2 linhas: `Alcântara Advocacia` (`eaf29983-1998-40a4-bd07-03ea09b4adfa`, `is_demo=false`) e `InoveJuris Demonstração` (`cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd`, `slug=inovejuris-demo-homologacao`, `is_demo=true`) | Catálogo global confirmado; cliente real e demo já separados. O tenant padrão de `production` tende a ser `Alcântara Advocacia`; a demo é o candidato natural ao escopo de homologação. |
| Views | **13 views**, todas com `security_invoker=on` | Não é preciso religar `security_invoker`; falta replicar o predicado de tenant. |
| Helpers | `_rls_organization_id()` e `_rls_test_shared()` **ausentes**; `get_auth_organization()` existe | Criação aditiva no T4a. |
| `tenant_test_scope` | Ausente em `production` e `test` | Criar configuração canônica em `production`. |
| Policies | `63` no total; as "50 com `true`" foram falso positivo do detector (`current_setting(..., true)`) | Nenhuma `USING (true)` real identificada na listagem. Detector corrigido para expressão inteira igual a `true`. |
| `clients` | `production`: 107 linhas / **37 nulas**; `test`: 6 / 0 | Backfill obrigatório antes do braço `production`. |
| `contracts` | `production`: 106 / **43 nulas**; `test`: 19 / 8 | Backfill obrigatório antes do braço `production`. |
| `payments` | `production`: 124 / **119 nulas**; `test`: 57 / 45 | Backfill obrigatório antes do braço `production`. |
| Storage | `client_documents`, `marketing`, `templates` com `public=false`; `templates` com 10 MB | Manter privados; definir prefixo `test/shared/...`. |

**Gate revisado:** o braço `test` compartilhado pode ser preparado sem backfill. O braço `production` **não pode** ser ativado antes do backfill autorizado das nulas acima.

---

## 11. Decisões ainda pendentes

1. Multi-membership: um usuário pertence a uma ou várias organizações?
2. E-mail por tenant: global único ou repetido por cliente?
3. Superadmin: lista explícita de tabelas em que pode burlar o filtro de tenant.
4. Auditoria/backup: manter 180 dias globalmente ou retenção por contrato.
5. White-label: adiar, leve ou completo.
6. Legado: tenant padrão + backfill somente se a medição mostrar nulos em produção.
7. F4b-2c / chave ECC própria: HS256 continua como ponte; standby `c73f6852-eeca-455d-9549-647afae7e493` bloqueia importação.
8. `user_organizations`: a tabela já existe e **não será recriada**. Colunas: `id`, `user_id`, `organization_id`, `role_id`, `created_at`. Medição de 26/11: 2 linhas, ambas do `user_id=2` — vínculo com `Alcântara Advocacia` (`role_id=1`) e com `InoveJuris Demonstração` (`role_id=104`). Ou seja, **multi-membership já existe nos dados**, mas ainda não é propagado para a sessão/JWT. Decidir se ela será a fonte oficial de membership (recomendado) ou se virará `organization_members`.

---

## 12. Arquivos desta rodada

- `docs/MODELO-ESCOPO-AMBIENTE-TENANT-20261126.md` — este desenho.
- `docs/DIAGNOSTICO-TENANT-20261126.sql` — inventário completo, somente leitura.
- `docs/DIAGNOSTICO-TENANT-CRITICO-20261126.sql` — resumo em JSON com os dados de gate.
- `docs/DIAGNOSTICO-TENANT-POLICIES-20261126.sql` — lista de `organizations` e das policies com `true` literal.

Nenhuma policy, view, RPC, função, storage bucket, dado de negócio ou deploy foi alterado para produzir estes arquivos.
