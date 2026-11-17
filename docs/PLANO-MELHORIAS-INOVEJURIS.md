# InoveJuris — Análise comparativa e Plano de Melhorias (2026-11-17)

> Documento gerado a partir da análise do deploy `https://inove-juris.vercel.app/`, do código local e das 12 telas-sugestão em `Telas para Sugerir/`.
> **Não houve alteração de código** nesta análise. As telas foram lidas por OCR do Windows (o modelo não processa imagem diretamente); alguns rótulos podem ter sido degradados pelo OCR e devem ser confirmados antes da implementação.

## 0. Progresso (atualizado em 2026-11-17)
- Por decisão do usuário, a ordem foi alterada: **começar pelas telas novas**, sem fase de estabilização prévia.
- **Entregue e versionado:** Fase 1 parcial — `/prazos` e `/calendario` com camada de dados compartilhada (`lib/deadlines.ts`). Build OK.
- **Correção DataJud entregue:** unificação em `lib/datajud.ts` + `/api/process-sync`, persistência de andamentos, remoção de chave hardcoded/Apify e da migration de `process_sync_status.environment`. Build OK.
- Ainda pendente das telas novas: Publicações, Triagem e `/processos/[id]`; cálculo de dias úteis com feriados/recesso; baixa justificada; sincronização automática.

## 1. Metodologia e limits

- Texto dos 12 PNGs extraído via `Windows.Media.Ocr` (pt-BR) → `ocr_resultado.txt` (temporário).
- Deploy inspecionado com sessão autenticada já existente no navegador: dashboard real, `/processos`, `/relatorios`, `/configuracoes`.
- Código local mapeado: 26 páginas, 18 route handlers, ~95 SQL soltos, 37 migrations.
- Rotas testadas: `/publicacoes`, `/prazos`, `/calendario`, `/processos/<id>` → **404 confirmado**.

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
| 02 Publicações | **Inexistente** (só string de mock em `process-consultation/route.ts:173`) | Fila única DJEN/Comunica PJe/e-mail, triagem humana | P3 |
| 03 Prazos | Parcial: `process_deadlines`, Radar, Relatório de Prazos | Rota `/prazos`, dias úteis determinísticos, memória de cálculo, baixa justificada | P1 |
| 04 Calendário | **Inexistente** | Visão mensal + alternância lista/calendário | P4 |
| 05 Processos | Existe (`/processos`, 937 linhas) | Filtros, "próximo prazo", segredo de justiça por permissão | P2 |
| 06 Processo | Modal dentro de `/processos`; rota 404 | `/processos/[id]` com abas (Resumo/Prazos/Intimações/Documentos/Financeiro/Auditoria/Partes) e timeline | P2 |
| 07 Clientes | Maduro (`/clientes`, paginação, portal de indicador) | Documentos mascarados, consentimento LGPD, portal do cliente | P6 |
| 08 Financeiro | Maduro (contas a receber, fluxo, movimentações) | Aging visual, maiores saldos, KPIs, baixa auditada | P6 |
| 09 Equipe & segurança | Parcial: 13 abas em `/configuracoes`, `/usuarios`, `/auditoria` | Consolidação + status honesto de MFA/passkey/RLS/hash chain/backup | P5 |
| 10 Diagnóstico | Parcial: `/setup` e APIs `check-db`/`diagnose-db` | Questionário de 16 perguntas + score 0-100 + exportar/imprimir | P5 |
| 11 Busca | `GlobalSearch` (Ctrl+K, `search_all` acento-insensível) | Command palette com "Ações rápidas" e "Ir para"; links de processo corrigidos | P2 |
| 12 Triagem | **Inexistente** | Modal de triagem com confirmação expressa; **nenhum prazo criado automaticamente** | P3 |

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

### Fase 3 — Intimações e triagem (P2, ~5-8 dias, risco médio)
- Tabelas novas: `intakes` e `intake_reviews` (fonte, CNJ, tribunal, vara, teor, hash, status, quem leu/decidiu, motivo).
- Rotas `/publicacoes` (fila: A triar/Triadas/Ignoradas/Todas) e triagem comCalcular / Confirmar / Ignorar (com motivo) / Cancelar.
- Sincronização DJEN **simulada/CSV primeiro**; integração real depois. Flag `modules.intakes.enabled`, começar em TESTE.
- Nenhuma escrita em `process_deadlines` sem confirmação expressa.

### Fase 4 — Calendário (P2, ~2-3 dias, risco baixo)
- `/calendario` mensal reaproveitando os dados de `/prazos`; toggle Calendário/Lista; vencidos destacados; CSV. `date-fns` já está no projeto.

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
