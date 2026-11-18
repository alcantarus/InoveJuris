# InoveJuris — Análise comparativa e Plano de Melhorias (2026-11-17)

> Documento gerado a partir da análise do deploy `https://inove-juris.vercel.app/`, do código local e das 12 telas-sugestão em `Telas para Sugerir/`.
> **Não houve alteração de código** nesta análise. As telas foram lidas por OCR do Windows (o modelo não processa imagem diretamente); alguns rótulos podem ter sido degradados pelo OCR e devem ser confirmados antes da implementação.

## 0. Progresso (atualizado em 2026-11-17)
- Por decisão do usuário, a ordem foi alterada: **começar pelas telas novas**, sem fase de estabilização prévia.
- **Entregue e versionado:** Fase 1 parcial — `/prazos` e `/calendario` com camada de dados compartilhada (`lib/deadlines.ts`). Build OK.
- **Correção DataJud entregue:** unificação em `lib/datajud.ts` + `/api/process-sync`, persistência de andamentos, remoção de chave hardcoded/Apify e criação da tabela `process_sync_log` (a antiga `process_sync_status` é uma VIEW e não serve para gravar status). Build OK.
- **Publicações/Triagem entregue em 2026-11-18** (`/publicacoes`, integração real com o DJEN e criação de prazo mediante confirmação expressa). `/processos/[id]` também entregue em 2026-11-17.
- Ainda pendente das telas novas: cálculo de dias úteis com feriados/recesso; baixa justificada; sincronização automática (agendador).

## 1. Metodologia e limits

- Texto dos 12 PNGs extraído via `Windows.Media.Ocr` (pt-BR) → `ocr_resultado.txt` (temporário).
- Deploy inspecionado com sessão autenticada já existente no navegador: dashboard real, `/processos`, `/relatorios`, `/configuracoes`.
- Código local mapeado: 26 páginas, 18 route handlers, ~95 SQL soltos, 37 migrations.
- Rotas testadas em 2026-11-17: `/publicacoes`, `/prazos`, `/calendario`, `/processos/<id>` → 404 confirmado. Em 2026-11-18: `/prazos`, `/calendario` e `/processos/<id>` entregues; `/publicacoes` entregue com a Fase 3.

## 2. Achados críticos no ambiente atual (P0)

| # | Achado | Evidência | Ação |
|---|---|---|---|
| P0-1 | 3 views retornam HTTP 400 no Supabase | `vw_process_velocity`, `vw_cash_flow_forecast`, `vw_area_efficiency` — network + console warnings | Migration idempotente `CREATE OR REPLACE VIEW` com coluna `environment` + `GRANT`; fallback no front para não poluir console |
| P0-2 | Link do Radar de Prazos quebrado | `app/page.tsx:1110` → `/processos/${d.process_id}` → 404 | Curto prazo: `/processos?process=<id>` + abrir modal. Definitivo: criar `/processos/[id]` |
| P0-3 | Migrations pendentes sem confirmação | `20261116131500`, `20261116140000`, `20261116141000` | SQL de checagem (`schema_migrations`, colunas, funções, trigger, índices, views) antes de qualquer mudança de dados |
| P0-4 | Endpoints com `exec_sql` em produção | `/api/fix-db`, `/api/fix-cancellation`, `/api/diagnose-db`, `/api/check-enum`, `/api/alter-leads` | Proteger por admin/flag ou desabilitar em produção; revisar SQL soltos com RLS `USING(true)` |
| P0-5 | Controle de acesso incompleto | `PERMISSION_MAP` cobre 14 prefixos; `/setup`, `/notificacoes`, `/doencas`, `/clientes-v2` fora do mapa. Sidebar mostra Auditoria/Usuários/Configurações para perfil "Usuário" | Completar mapa e validar permissões reais antes de expor novos módulos |
| P0-6 | Dashboard com cards vazios e warnings do Recharts | `width(-1)/height(-1)` no console; "Sem dados disponíveis", "0.0 dias", "R$ 0,00" | Definir altura mínima dos containers; esconder cards sem dados |
| P0-7 | `console.log` em produção | `app/dashboard-layout.tsx:41`, `app/processos`, `app/contratos`, `app/api/auth/session` etc. | Remover ou condicionar a debug |
| P0-8 | `docs/` fora do git | `?? docs/` | Versionar handoff e este plano |

## 3. Mapa telas-sugestão × sistema atual

| Tela sugerida | Situação hoje | Principal gap | Prioridade |
|---|---|---|---|
| 01 Hoje | Dashboard existe (1.685 linhas, 30+ cards) | Foco: 3 alertas + fila de triagem + agenda da semana; cards vazios poluem | P1 |
| 02 Publicações | **Implementado** em 2026-11-18 (`/publicacoes`) | Fila única DJEN/Comunica PJe/e-mail, triagem humana e integração real com o DJEN | P3 — entregue |
| 03 Prazos | Parcial: `process_deadlines`, Radar, Relatório de Prazos | Rota `/prazos`, dias úteis determinísticos, memória de cálculo, baixa justificada | P1 |
| 04 Calendário | **Inexistente** | Visão mensal + alternância lista/calendário | P4 |
| 05 Processos | Existe (`/processos`, 937 linhas) | Filtros, "próximo prazo", segredo de justiça por permissão | P2 |
| 06 Processo | **Implementado** em 2026-11-17 (`/processos/[id]`) | Detalhe com timeline DJEN → Publicação → Contagem → Vencimento; abas do mockup (Documentos/Financeiro/Auditoria/Partes) ainda não separadas | P2 — entregue parcialmente |
| 07 Clientes | Maduro (`/clientes`, paginação, portal de indicador) | Documentos mascarados, consentimento LGPD, portal do cliente | P6 |
| 08 Financeiro | Maduro (contas a receber, fluxo, movimentações) | Aging visual, maiores saldos, KPIs, baixa auditada | P6 |
| 09 Equipe & segurança | Parcial: 13 abas em `/configuracoes`, `/usuarios`, `/auditoria` | Consolidação + status honesto de MFA/passkey/RLS/hash chain/backup | P5 |
| 10 Diagnóstico | Parcial: `/setup` e APIs `check-db`/`diagnose-db` | Questionário de 16 perguntas + score 0-100 + exportar/imprimir | P5 |
| 11 Busca | `GlobalSearch` (Ctrl+K, `search_all` acento-insensível) | Command palette com "Ações rápidas" e "Ir para"; links de processo corrigidos | P2 |
| 12 Triagem | **Implementada** em 2026-11-18 dentro de `/publicacoes` | Modal de triagem com confirmação expressa; **nenhum prazo criado automaticamente** | P3 — entregue |

## 4. Decisões de produto a preservar

1. **Human-in-the-loop:** a importação de publicações apenas alimenta a fila; prazo só existe após leitura, classificação e confirmação do advogado responsável.
2. **Não trocar a marca:** usar a arquitetura de informação dos mockups, mantendo InoveJuris.
3. **Não implementar multi-tenant agora:** o sistema é de escritório único. "RLS por office_id" do mockup deve ser lido como "política do escritório"; não criar `office_id` sem necessidade real.
4. **Não editar valor financeiro diretamente:** manter a regra já definida (estorno/reaplicação atômica e auditada).
5. **Status honesto:** não exibir "implementado" para MFA/passkey/AES-256/RPO 15 min sem que exista de fato.

## 5. Plano gradual (fases)

Cada fase = 1 commit pequeno → `npm run build` → preview Vercel → validação do usuário → merge em `main`. Novas rotas são **aditivas**; dados existentes não são recalculados automaticamente.

### Fase 0 — Estabilização (P0, ~1-2 dias, risco baixo)
Corrigir os 7 achados P0 acima. Entregável: console limpo, views 200, link do Radar funcionando, SQL de checamento de migrations, `docs/` versionado.

### Fase 1 — Fundação de prazos (P1, ~3-5 dias, risco médio)
- Tabela `holidays` (feriados nacionais + recesso forense) e RPC determinístico `add_business_days`.
- Colunas novas em `process_deadlines` (com DEFAULT): `calculation_memory` JSONB, `responsible_user_id`, `confirmed_by`, `confirmed_at`, `publication_version`, `status`, `justification`, `closed_at`.
- Rota `/prazos` reaproveitando `process_deadlines`: filtros Vencidos/Hoje/7/30/Em aberto/Concluídos, responsável, CSV.
- Banner "prazos vencidos sem baixa" com registro de providência **auditada**.
- **Sem backfill automático**; cálculo novo só para prazos criados depois da migration.

### Fase 2 — Processo 360° e busca (P1/P2, ~3-4 dias, risco baixo-médio)
- Extrair o modal atual para componente compartilhado; criar `/processos/[id]` com as abas do mockup e timeline de movimentações.
- Melhorar `/processos`: filtros e coluna "Próximo prazo"; segredo de justiça por permissão.
- `GlobalSearch` → command palette com ações rápidas e links de processo apontando para `/processos/[id]`.

### Fase 3 — Publicações e triagem (P2, ~5-8 dias, risco médio) — ENTREGUE em 2026-11-18
- Tabelas criadas: `publications` e `publication_sync_log` (fonte, CNJ, tribunal, órgão, teor, hash/id externo, status, quem leu/decidiu, motivo, prazo resultante e log de sincronização).
- Rota `/publicacoes` com fila **A triar / Triadas / Ignoradas / Todas** e triagem com **Criar prazo / Classificar sem prazo / Ignorar (com motivo) / Reabrir**.
- Sincronização DJEN **real** contra a API pública `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao`, sem token, com paginação controlada e tratamento de `429`. Desde 2026-11-17, a captura usa **somente os advogados cadastrados** (`numeroOab` + `ufOab`), um request por advogado, com deduplicação; o Módulo Advogados passou a armazenar UF e número separadamente.
- O DJEN bloqueia o egress da Vercel com `403`; a consulta é feita pela RPC `public.djen_fetch` no egress sa-east-1 do Postgres do Supabase (Edge Function como contingência). `POST` no endpoint retorna `401`; o método correto é `GET`.
- Nenhuma escrita em `process_deadlines` sem confirmação expressa do advogado responsável; a sugestão de dias úteis desconsidera apenas fins de semana.
- Pendente desta fase: agendador automático de sincronização e cálculo determinístico com feriados/recessos forenses.

### Fase 4 — Calendário (P2, ~2-3 dias, risco baixo)
- `/calendario` mensal reaproveitando os dados de `/prazos`; toggle Calendário/Lista; vencidos destacados; CSV. `date-fns` já está no projeto.

### Fase 4.1 — Prazos editáveis e módulos sincronizados — ENTREGUE em 2026-11-17
- `process_deadlines` é a fonte única da verdade para Processos, Prazos e Calendário; Realtime recarrega as três telas quando um prazo muda.
- Edição de data/hora, descrição, situação e responsável a partir de `/prazos`, `/processos/[id]` e `/calendario`, com justificativa obrigatória para reagendamento e reabertura da confirmação do advogado.
- Histórico imutável por prazo (`process_deadline_history`) e RPCs transacionais de criar/editar/confirmar/excluir; a edição de processos parou de recriar prazos (preserva IDs, vínculos e auditoria).

### Fase 4.2 — Dashboard orientada a prioridades — ENTREGUE em 2026-11-17
- Cards de ação imediata no topo (prazos, Foco de Hoje, liquidez, gargalos, inadimplência, compromissos), análises e auditoria ao final.
- Aviso de aniversariantes deixou de ser um badge flutuante e passou a ser um chip discreto no cabeçalho da dashboard, sem sobrepor **Gerar Insights**.

### Fase 4.3 — Responsividade das listas — ENTREGUE em 2026-11-17
- Padrão único de tabela desktop + cards mobile (`hidden md:table` / `md:hidden divide-y divide-slate-100`) aplicado a Contas a Receber, Prazos, Calendário, Processos, Publicações, Leads, Indicadores, Fluxo de Caixa, Produtos, Doenças, Relatórios, Auditoria, Extrato, Configurações e SyncDashboard.
- Sem rolagem horizontal no celular; campos rotulados, quebras de linha e alvos de toque de 40 px. A lógica de filtro/ordenação/ações é compartilhada entre as duas visões.

### Fase 4.4 — Exclusão de prazos reativada — ENTREGUE em 2026-11-17
- Ação explícita de **excluir prazo/perícia/cumprimento** restaurada em `/prazos` e `/processos/[id]` e estendida a `/calendario`, preservando a consistência das três telas que usam `process_deadlines`.
- Modal de confirmação reutilizável (`components/prazos/DeleteDeadlineModal.tsx`) com resumo do prazo e **motivo opcional**, registrado na auditoria pela RPC existente `delete_process_deadline` — sem migration nova.
- Validação E2E em ambiente de teste: RPC HTTP `200`, remoção do prazo temporário e histórico `criar` + `excluir` confirmados por SQL.

### Fase 4.5 — Filtro por ambiente e representação legal — ENTREGUE em 2026-11-18
- `fetchDeadlines(env = getAppEnv())` filtra `process_deadlines`, `processes`, `contracts`, `clients` e `lawyers` pelo ambiente ativo. Validação em `/prazos`: consulta com `environment=eq.production` retornou HTTP `200`.
- **Representação legal de menores**: pai/mãe/tutor/curador passa a ser outro Cliente relacionado, não texto copiado. Migration `20261118140000_client_legal_guardians.sql` aplicada em produção cria `client_relationships`, `v_client_guardians` e a RPC transacional `save_client_guardians`.
- Cadastro de Clientes ganhou o editor “Vínculos de Representação Legal” (busca de responsáveis do mesmo ambiente, parentesco, rótulo da cláusula, principal e vigência), aviso legado revisável e exibição dos vínculos no painel do cliente.
- E2E validada com `client_id=93` (Anny) e responsável `client_id=94` (Arlene): RPC `204`, recarga persistida e `v_client_guardians` conferida por SQL. Detalhes em `docs/STATUS-INOVEJURIS.md`.

### Próximo passo — Módulo Documentos / “Modelo Vivo”
- Pré-requisito de Clientes concluído: o catálogo de dados do Modelo Vivo poderá consumir `v_client_guardians` para projetar “representado por ...” a partir de registros relacionados.
- Retomar o parecer `Relatorio-Modulo-Documentos.md`: corrigir o achado F3 (mesmo problema de ambiente já resolvido), definir o catálogo auto-descoberto, blocos determinísticos (texto/variável/condição/repetição/cláusula/assinatura), biblioteca de cláusulas versionada e governança com hash/QR/snapshot.
- Regra mantida: **zero IA** na geração; cada valor do documento deve ser rastreável até um registro do banco.

### Fase 5 — Confiança e diagnóstico (P2, ~4-6 dias, risco baixo)
- `/diagnostico` com 16 perguntas e score (pode ser 100% front, sem banco — ótima primeira entrega segura).
- Consolidação "Equipe & segurança": status real de MFA TOTP/passkey, dispositivos confiáveis, verificação de hash da trilha de auditoria, backup RPO/RTO e LGPD.

### Fase 6 — Refinos financeiros e de clientes (P3, risco baixo)
- Aging de recebíveis, maiores saldos, baixa auditada e export CSV.
- Máscara de documentos, consentimento LGPD e portal do cliente somente leitura.

## 6. Mecanismo de rollout

- Usar `getAppEnv()` + `system_settings` para feature flags por módulo; sidebar e `PERMISSION_MAP` atualizados no mesmo commit da rota.
- Novas colunas sempre `NULL`/DEFAULT; backfill manual, revisável e em transaction.
- Nenhuma `DROP TABLE`, nenhuma mudança destrutiva em migrations novas.
- Validar sempre em PREVIEW do Vercel antes de promover; manter este documento atualizado a cada entrega.
