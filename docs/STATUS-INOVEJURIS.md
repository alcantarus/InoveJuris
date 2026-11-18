# InoveJuris — Status e Handoff

> Documento de continuidade gerado para retomar o trabalho em futuras sessões.
> Atualizado em: 2026-11-18 (filtro por ambiente entregue e representação legal de menores implementada e validada no cadastro de Clientes).

## Índice da entrega mais recente (2026-11-18)
- Commit desta entrega: `feat(clientes): vinculos de representacao legal e filtro de ambiente em prazos` (hash atual em `git log -1`).
- Migration aplicada em produção: `20261118140000_client_legal_guardians.sql` (`client_relationships`, `v_client_guardians`, `save_client_guardians`).
- Deploys de produção desta sequência: `dpl_HEdGnjmMiKjkAKEJo2wQc4K15TQJ` (Clientes + filtro) e `dpl_9GZuKWe56Dmu8VcgKqPtXhoc73Sy` (endurecimento em `/processos/[id]`), ambos com alias `https://inove-juris.vercel.app`.
- Detalhes: ver seções **"Correção do filtro por ambiente"** e **"Representação legal de menores em Clientes"**.
- Commits anteriores desta sequência: `ed47f32` (exclusão de prazos), `aa675ff` (deploy), `ec6d462` (agendamento), `0165c37` (índice no STATUS).

## Contexto do projeto
- **Stack:** Next.js 15 + Supabase (Postgres), uso de um único escritório (não SaaS/multi-tenant).
- **Ambiente local:** `C:\InoveTecnologia\InoveJuris` (git repo, Windows/PowerShell).
- **Repositório GitHub:** https://github.com/alcantarus/InoveJuris
- **Deploy:** Vercel (conectada ao repo; branch de trabalho efetiva `trabalho-com-claude`, com push também em `main` conforme o histórico abaixo). Variáveis sensíveis/`NEXT_PUBLIC_*` devem estar configuradas na Vercel; migrations devem ser aplicadas no Supabase do ambiente alvo.

## Objetivos/temas trabalhados
- Segurança/performance e recomendações priorizadas (P0/P1/P2) — análise entregue; refactors amplos não executados.
- **Busca acento-insensível** em todo o sistema (`Débora`/`Debora`, `João`/`Joao`, `Ação`/`Acao`): normalização no front (`lib/utils.ts`) e no banco (`unaccent`/`immutable_unaccent`, RPCs/índices).
- **Contas a Receber:** ajuste preciso de data prevista/forecast (mantém `dueDate` como previsão atual, preserva original/metadados, restaurar/prorrogar).
- **Responsividade mobile/iOS:** ajustes base e de telas.
- **GPS:** alertas/contagens não devem considerar contratos inativos (cancelado/cancelada/quitado/arquivado).
- **Fluxo de Caixa → Movimentações:** edição segura da **descrição** (apenas `description`), melhorias de layout dos botões de ação e correção de scroll sobrepondo valores nas listas de distribuição (Entradas/Despesas). Edição de **valor** não implementada (exige estorno/reaplicação, atomicidade e auditoria).
- **Inconsistência de valores no módulo Clientes quando contrato está cancelado:** contrato deve permanecer no sistema com status Cancelado, mas **não** compor valores a receber/recebido/atrasado no cadastro do cliente.
- **Erro ao cancelar contrato:** `BLOQUEADO: OLD=Cancelado , NEW=Aberto. Não é possível alterar um contrato já quitado ou cancelado.` — tratado com correções de app e gatilho de banco.

## O que foi implementado (código/migrations no workspace)

### App / Frontend
- `lib/utils.ts`: `removeAccents`, `normalizeSearchText`, `matchesSearch` e utilitários.
- Busca normalizada em módulos (exemplos): `components/GlobalSearch.tsx` (env-aware via `getAppEnv()`), `app/clientes/page.tsx`, `app/clientes-v2/page.tsx`, `app/advogados/page.tsx`, `app/contas-a-receber/page.tsx`, `app/configuracoes/page.tsx`, `app/processos/page.tsx`, `app/documentos/page.tsx`.
- `app/contas-a-receber/page.tsx`: ajuste/restauração de data prevista.
- Responsividade base: `app/layout.tsx`, `app/globals.css`, `components/Modal.tsx`, `app/dashboard-layout.tsx`, `components/ModuleHeader.tsx`, `components/ui/KPICard.tsx` (entre outros ajustes no working tree).
- GPS: `components/GPSNotificationChecker.tsx`, `components/dashboard/GPSDashboardCard.tsx` excluem status inativos.
- Dashboard resiliente/logs: `components/dashboard/dynamic/ProcessVelocityCard.tsx` (`vw_process_velocity`), `CashFlowForecastCard.tsx` (`vw_cash_flow_forecast`), `AreaEfficiencyCard.tsx` (`vw_area_efficiency`).
- `app/fluxo-caixa/movimentacoes/page.tsx`: botão/modal de **editar descrição** (atualiza só `financial_transactions.description`), layout/área de toque dos botões de ação, cabeçalho/coluna “Ações”, e listas de categoria/valor com `scrollbar-gutter`/espaçamento para não sobrepor valores.
- `lib/supabase.ts`: `processContractCancellation` mais robusto (normaliza status, idempotente se já cancelado, bloqueio claro se quitado, tratamento defensivo de erro do banco).

### Banco / Migrations (arquivos no repo)
- `20261116120000_add_expected_receipt_adjustments_to_installments.sql`: campos/metadados de ajuste de previsão em parcelas.
- `20261116130000_enable_unaccent_and_update_search_all.sql`: base `unaccent`/`search_all` (usuário informou como **aplicada**).
- `20261116130500_update_get_clients_with_process_summary_unaccent.sql`: RPC de resumo de clientes acento-insensível (usuário informou como **aplicada**). Existe variante `-1.sql` no diretório (verificar duplicidade ao aplicar/versionar).
- `20261116131000_expand_search_all_coverage_unaccent.sql`: expansão de busca (pode ficar **redundante** se `31500` for aplicada; variantes `-1.sql` podem existir).
- `20261116131500_add_unaccent_search_indexes.sql`: **canônica/revisada** (`immutable_unaccent`, `search_all` expandido, `get_clients_with_process_summary` atualizado, índices condicionais/trigram quando seguro). Corrigiu erros anteriores `42P17` (IMMUTABLE) e `42703` (`processNumber`). **Pendente de confirmação de aplicação no ambiente alvo** (verificar).
- `20261116140000_exclude_cancelled_contracts_from_client_financials.sql` (**nova**): `get_clients_with_process_summary` passa a **excluir contratos `cancelado/cancelada` apenas do cálculo financeiro** (`total_receivable`, `total_received`, `total_overdue`). **Contratos NÃO são apagados**; permanecem com status cancelado.
- `20261116141000_fix_protect_contracts_status_trigger.sql` (**nova**): recria `fn_protect_contracts_status`/trigger em `contracts` para permitir transição para `Cancelado/Cancelada`, bloquear reabertura de quitado/cancelado, com comparação trim/case-insensível.

## Estado atual conhecido / pendências
- **Build local:** chegou a compilar com sucesso após correções (remoção de `page-1.tsx` legados e ajuste de import `normalizeSearchText` em `app/clientes/page.tsx`). Antes havia falhas no Vercel por commit inconsistente (`page-1.tsx` / export ausente).
- **Git/Deploy (confirmado em 2026-11-17):** branch `trabalho-com-claude` está no mesmo commit de `origin/main`/`origin/HEAD` — `8dcf005 Corrige cancelamento de contratos e totais de clientes`. `git diff --stat origin/main...HEAD` vazio (nada pendente de push). As alterações anteriores (migrations 20261116140000/20261116141000 e `lib/supabase.ts`) já estão publicadas. Pendente apenas: versionar `docs/` (atualmente `?? docs/`).
- **Banco (Supabase de produção/uso):** aplicar/confirmar migrations pendentes conforme ambiente, especialmente `20261116131500_*` (se não aplicada), `20261116140000_*` e `20261116141000_*`. Push no GitHub não aplica migrations automaticamente (salvo CI).
- **Caso Geovanna Bertunes da Rocha Brandão:** contrato **#95** (`Salário-Maternidade`, client_id 80) já consta como **`Cancelado`** no banco (`amountReceived 0`, observação de desistência). Após aplicar `20261116140000` e recarregar, não deve exibir valor a receber no módulo Clientes; o contrato deve permanecer registrado como cancelado.
- **GPS:** correção evita futuros alertas/contagens para status inativos, mas não remove notificações já criadas.
- **Dashboard:** avisos podem persistir se as views `vw_process_velocity`, `vw_cash_flow_forecast`, `vw_area_efficiency` não existirem ou não tiverem permissão.

## Verificação do ambiente em produção (sessão 2026-11-17)
- **Solicitação do usuário:** verificar a realidade do sistema em uso em `https://inove-juris.vercel.app/` e, aos poucos, aplicar correções, novas implementações e sugestões a partir de 6 prints (`02-publicacoes`, `03-prazos`, `04-calendario`, `05-processos`, `06-processo`, `07-clientes`) salvos em `C:\Users\ALCANTARUS\Desktop\ALCÂNTARA Advocacia\Desenvolvimento do InoveJuris\Telas para Sugerir\`.
- **Limitação de leitura de imagem:** este modelo não processa PNG (`this model does not support image input`), inclusive ao tentar abrir os arquivos diretamente do disco. Para seguir, o usuário precisa descrever as telas em texto, fornecer HTML/JSON ou disponibilizar login de teste (somente leitura). A pergunta com essas opções foi dispensada na conversa; o usuário pediu apenas para registrar o resumo neste arquivo.
- **Deploy confirmado:** `GET /` retorna `307 Temporary Redirect` para `/login`; a tela de login exibe "Bem-vindo ao InoveJuris / Faça login para acessar o sistema / Acesso restrito a usuários autorizados.". Resposta Vercel em `gru1`, `Server: Vercel`, HSTS ativo (`max-age=63072000; includeSubDomains; preload`). A área autenticada **não** foi inspecionada (sem credenciais; sem tentativa de burlar login).
- **Mapeamento inicial de rotas (código local = deploy):** existem `app/clientes/page.tsx`, `app/clientes/[id]/page.tsx`, `app/processos/page.tsx` (detalhe/prazos em modal), `app/relatorios/page.tsx` (Relatório de Prazos) e "Radar de Prazos" no dashboard (`app/page.tsx`). **Não existem rotas dedicadas** `/publicacoes`, `/prazos` ou `/calendario` — prováveis novas implementações.
- **Migrations — duplicidades extras:** além das variantes `-1` já citadas, existem pares com hash idêntico (`-1`/`-2`) em `20260318000000_create_backup_tables`, `20260318000001_update_backup_settings`, `20260320000000_create_tasks_tables`, `20260320000001_add_set_app_environment_rpc`, `20260325000000_add_original_due_date_to_installments`, `20260618120000_create_cashflow_summary_views`, `20260618130000_create_cashflow_chart_functions`, `20260618140000_create_projection_function`. As versões sem sufixo divergem das `-1`/`-2` (aparentam ser as revisadas). **Não há confirmação de quais estão aplicadas no Supabase de produção** — pendente: montar SQL de checagem (schema_migrations / colunas / funções).
- **Ferramentas locais:** `tesseract` não está instalado, então OCR dos prints não foi possível por aqui.

## Plano para as próximas sessões (trabalho incremental)
1. Usuário fornece o conteúdo dos prints em texto (nome da tela, elementos, o que manter/alterar e prioridade) — ou login de teste/HTML/JSON das telas.
2. Gerar mapa **tela sugerida × tela atual × gaps**, com priorização P0/P1/P2, antes de editar arquivos.
3. Implementar **um item por vez**, executar `npm run build`, commit pequeno e validação do usuário no Vercel.
4. Atualizar este `STATUS-INOVEJURIS.md` (e versioná-lo) a cada entrega.

## Análise comparativa com as 12 telas-sugestão (sessão 2026-11-17)
- As 12 imagens em `Telas para Sugerir/` **não** são legíveis diretamente por este modelo; o texto foi extraído por OCR do Windows (`Windows.Media.Ocr`, pt-BR) — alguns rótulos podem estar degradados e precisam de confirmação antes de codar.
- Deploy inspecionado **com sessão autenticada já existente no navegador**: dashboard real carregou dados de produção. Achados P0 confirmados:
  1. `vw_process_velocity`, `vw_cash_flow_forecast`, `vw_area_efficiency` retornam **HTTP 400** no Supabase (views ausentes/sem coluna `environment`), com warnings no console.
  2. Link do Radar de Prazos (`app/page.tsx:1110`) aponta para `/processos/<id>` → **404**.
  3. `/publicacoes`, `/prazos`, `/calendario` e `/processos/<id>` → **404 confirmado**.
  4. Sidebar exibe Auditoria/Usuários/Configurações para perfil "Usuário"; `/setup`, `/notificacoes`, `/doencas`, `/clientes-v2` fora do `PERMISSION_MAP`.
  5. Recharts com `width(-1)/height(-1)`; dashboard com vários cards "Sem dados disponíveis"/"R$ 0,00".
- **Não há nenhuma implementação de dias úteis/feriados/recesso forense** no repo (busca por `recesso|feriado|businessDay` sem resultados) — é a base conceitual das telas 03/04/06.
- Plano completo (mapa 12 telas × atual × gap, priorização e fases 0-6 com rollout gradual): **`docs/PLANO-MELHORIAS-INOVEJURIS.md`**. Nenhum código foi alterado nesta análise.

## Entrega — telas novas `/prazos` e `/calendario` (2026-11-17)
- Decisão do usuário: **começar pelas telas novas**, sem fase prévia de estabilização. Manter `docs/` versionado.
- Arquivos novos: `lib/deadlines.ts` (camada compartilhada de dados: join `process_deadlines` + `processes` + `contracts` + `clients` + `lawyers`, buckets Vencidos/Hoje/7/30/Em aberto/Concluídos), `app/prazos/page.tsx` (KPIs, filtros, busca acento-insensível, CSV, modal "Novo prazo"), `app/calendario/page.tsx` (grade mensal com `date-fns`, vencidos destacados, lista do dia selecionado).
- Ajustes mínimos: `components/Sidebar.tsx` (itens Prazos e Calendário em "Operacional"), `app/dashboard-layout.tsx` (`PERMISSION_MAP` → `canAccessProcesses`).
- `npm run build`: **OK** (20 páginas; novas rotas listadas). Rotas locais redirecionam para `/login` sem erro de runtime (esperado sem sessão local).
- Versionada e publicada junto com a correção DataJud abaixo.

## Correção DataJud (2026-11-17)
- Diagnóstico confirmado no ar: botão "Sinc" chamava a Edge Function `datajud-sync` (código ausente no repo) e falhava na Apify com `user-or-token-not-found`; `process_sync_status` não tem coluna `environment` (`42703`); `/api/datajud-proxy` apenas fazia fetch e não gravava; `/api/process-consultation` usava chave hardcoded e retornou `429`.
- Implementado: `lib/datajud.ts` (consulta única, sem chave fixa, erros 429/401/400 explicados), `app/api/process-sync/route.ts` (consulta + persistência de `processes.history`, `last_update` como timestamp e da tabela `process_sync_log`).
- `app/processos/page.tsx`: "Sinc" agora chama `/api/process-sync`; removidos os 5 andamentos falsos e o `last_update: 'Agora'`.
- `components/SyncDashboard.tsx`: usa a nova rota, lê `process_sync_log` e exibe erro de carregamento.
- Removidas: `/api/datajud-proxy` e as duplicatas `route-1.ts`.
- Migration `supabase/migrations/20261117150000_fix_datajud_sync.sql`: **corrigida** — `process_sync_status` é uma VIEW (não aceita `ALTER TABLE ADD COLUMN`, erro `42809`), então a migration cria a tabela `process_sync_log` para gravar o status real e corrige registros com `last_update = 'Agora'`.
- `npm run build`: **OK** (rota `/api/process-sync` listada).
- **Publicado em produção:** push em `main` (`cf1f97a`) com deploy automático confirmado. `/prazos` e `/calendario` respondem HTTP 200; `/api/process-sync` responde `500 - DATAJUD_API_KEY não configurada no servidor` (fail-fast esperado).
- **Configuração concluída (2026-11-17):** `DATAJUD_API_KEY` adicionada no Vercel via CLI (ambiente Production) e deploy de produção executado (`dpl_93Fb8dU3TioJUTcBUnKrjVYcwaLV`). Antes disso, o projeto só tinha `DATAJUD_API_TOKEN`/`SCRAPER_API_KEY`, da integração antiga — daí o fail-fast. `SUPABASE_SERVICE_ROLE_KEY` não está configurada; a rota usa anon key + RPC `set_app_environment`.
- **Banco concluído:** migration corrigida aplicada no Supabase; `process_sync_log` existe e responde 200 via REST.
- **Validação final:** `/api/process-consultation` com CNJ real retornou `429 - O DataJud limitou a consulta`; `/api/process-sync` gravou em `process_sync_log` um registro `sync_status=Erro` com `error_message` e `last_sync`. Ou seja, consulta, tratamento de erro e persistência estão funcionando.
- **Único impedimento restante:** a chave disponível é a compartilhada, já limitada pelo CNJ (429 / "processo não encontrado" inconsistente). Para acompanhar andamentos de verdade é necessário obter uma chave de API própria do DataJud e atualizar `DATAJUD_API_KEY` no Vercel.
- **Ainda não implementado (naquele momento):** cálculo de dias úteis com feriados/recesso, baixa justificada de vencidos, Publicações/Triagem (entregues em 2026-11-18, ver abaixo), agendamento automático de sincronização e os achados P0 anteriores.

## Entrega — Módulo de Processos unificado (2026-11-17)
- Decisão do usuário: **foco apenas no módulo de Processos**; remover o Kanban (que não agradou) e unir o que já funciona no InoveJuris com os modelos `05-processos.md` (carteira/lista) e `06-processo.md` (detalhe). Kanban de **tarefas** do dashboard (`TaskKanban`, `TodayFocusWidget`) permanece — é outro módulo.
- **Kanban de Processos removido:** exclusão de `components/KanbanBoard.tsx`; remoção do import, do estado `viewMode`, dos botões Lista/Kanban e da renderização condicional em `app/processos/page.tsx`.
- **Lista (`/processos`):** mantidos `SyncDashboard`, cadastro/edição (judicial e previdenciário), consulta DataJud, exclusão, Sinc e privacy. Novo padrão é a **tabela** (`components/processos/ProcessTable.tsx`) com colunas Cliente/CNJ, Área/Vara, Responsável, Próximo prazo, Valor da causa, Situação, Ações (Abrir/Sinc/Editar/Excluir). A visão em **cards** (`BentoProcessGrid`) foi preservada e enriquecida; o seletor agora é **Lista / Cards** (sem Kanban).
- Busca ampliada para cliente, CNJ, vara e parte adversa; filtros dinâmicos por área, situação e responsável; contadores de vencidos/prazo em 7 dias agora usam cálculo real (o antigo `getNearestDeadlineStatus` era um stub que sempre retornava `Normal`).
- `components/processos/StrategicCockpit.tsx`: KPIs do modelo 05 (Ativos, Com prazo em 7 dias, Segredo de justiça, Valor da carteira) + linha secundária preservando matriz de risco e radar de urgência.
- **Detalhe (`/processos/[id]`) novo:** breadcrumb, dados do processo (área/fase, vara/comarca, tribunal, valor, distribuição, última movimentação, responsável, fonte), segredo de justiça, anotações editáveis, próximo prazo com timeline (DJEN → Publicação → Contagem → Vencimento), confirmação expressa do advogado, lista de prazos, partes e andamentos reais do DataJud.
- Helpers compartilhados em `lib/processes.ts` (`getNextDeadline`, `daysUntilDate`, `getResponsibleName`, `normalizeParties`, `isActiveProcess`).
- **Migration nova:** `supabase/migrations/20261117180000_enhance_processes_detail.sql` — campos em `processes` (`phase`, `comarca`, `tribunal`, `distribution_date`, `source`, `parties`, `secret_justice`) e em `process_deadlines` (`notification_date`, `publication_date`, `count_start_date`, `business_days`, `calculation_memory`, `responsible_id`, `confirmed_at`, `confirmed_by`, `justification`). Idempotente. **Aplicada no Supabase em 2026-11-17** (confirmado por consulta REST às colunas `phase`, `secret_justice`, `confirmed_at`, `business_days`, `calculation_memory` e `notification_date`).
- `npm run build`: **OK** (21 rotas, incluindo `/processos/[id]`). Validação local (porta 3001): `/processos` com Lista/Cards, KPIs e sem Kanban; `/processos/38` com dados, anotações, prazos, partes e andamentos.
- **Publicado (2026-11-17):** commit `72a21de` em `trabalho-com-claude` (push feito) e deploy de produção `dpl_3qyvx9iwnEhDoXeFXrtm1tcHz6Zh` em https://inove-juris.vercel.app. A migration `20261117180000_enhance_processes_detail.sql` foi **aplicada no Supabase** (confirmação em 2026-11-17), habilitando anotações, confirmação de prazos e timeline completa.

## Entrega — Calendário dinâmico (2026-11-17)
- Referência: `04-calendario.md` (controle de prazos com KPIs, Listar/Calendário, prazos vencidos em destaque, grade mensal e exportação).
- `/calendario` reescrito com alternância **Calendário / Listar** na própria página, KPIs **Hoje / Vencidos / 7 dias / Neste mês**, banner de vencidos com atalho para a lista, navegação mensal (anterior/próximo/Hoje), contagem de prazos no mês e **Exportar CSV** da seleção visível.
- Grade mensal dinâmica em `components/calendario/CalendarGrid.tsx`: semana começa no **domingo** (DOM…SÁB, como o modelo), fins de semana com destaque, dia atual marcado, até 3 prazos por dia com cores por bucket (vencido/hoje/7 dias/30 dias/aberto/concluído), indicador de vencido e contador de excedentes.
- Lista em `components/calendario/DeadlineListView.tsx`: busca por prazo/cliente/CNJ/responsável/área, filtro por situação, filtro opcional por data (via "Ver na lista" no painel do dia) e link **Abrir** para o detalhe do processo.
- Painéis inferiores: prazos do dia selecionado (com dias úteis, confirmação do advogado e memória de cálculo quando disponíveis), próximos prazos do mês (clicáveis) e vencidos pendentes de baixa.
- `lib/deadlines.ts`: `DeadlineItem` ganha campos opcionais da migration anterior (`businessDays`, `calculationMemory`, `confirmedAt`, datas de DJEN/publicação/contagem); responsável do prazo passa a preferir `responsible_id` quando existir. Extração compartilhada `exportDeadlinesCsv` usada por `/calendario` e `/prazos`.
- `npm run build`: **OK**. Validação local (porta 3002): KPIs, alternância Listar/Calendário, grade DOM–SÁB, navegação de mês, filtro de vencidos e tabela renderizando corretamente.
- **Ainda não implementado:** cálculo determinístico de dias úteis com feriados nacionais/recessos forenses (o modelo cita, mas a base ainda não tem essa rotina). A migration de prazos já está aplicada; os campos de dias úteis/memória/confirmação aparecem quando preenchidos.
- **Publicado (2026-11-17):** commit `c758490` em `trabalho-com-claude` (push feito) e deploy `dpl_3mU8rYmJZ4ethrY57zsaCSLT543e` em https://inove-juris.vercel.app.

## Entrega — Módulo de Publicações (2026-11-18)
- Referência: `02-publicacoes.md`. Nomenclatura padronizada como **Publicações** em UI, menu, rotas, código e documentação (sem usar o termo anterior como nome de módulo).
- **Regra preservada:** nenhum prazo é criado automaticamente pela importação. A fila apenas recebe as publicações; a criação de prazo exige leitura, classificação e **confirmação expressa** do advogado responsável (campo de justificativa obrigatório).
- Rota `/publicacoes` com KPIs **A triar / Triadas / Ignoradas / Todas** e abas **A triar / Triadas / Ignoradas / Todas** (a aba Triadas é a melhoria acrescentada ao modelo). Colunas da tabela: CNJ, Tribunal, Data, Processo, Advogado e Situação; busca por CNJ/parte/tribunal/texto e filtros por tribunal e origem; exportação CSV da visão filtrada.
- Detalhe da publicação (`components/publicacoes/PublicationDetail.tsx`): **Disponibilidade / Câmara / Página / Importância**, botão **Ler o texto** (teor em texto puro, sem HTML) e link para o inteiro teor no tribunal. Ações: **Criar prazo**, **Classificar sem prazo**, **Ignorar** (com motivo) e **Reabrir para triagem**.
- **Criação de prazo:** grava em `process_deadlines` com `notification_date`, `publication_date`, `count_start_date`, `business_days`, `calculation_memory`, `responsible_id`, `confirmed_at`, `confirmed_by` e `justification`; só depois marca a publicação como `Triada` e grava `deadline_id`. A data sugerida considera apenas fins de semana (sem feriados/recessos) e aparece explicitamente como sugestão revisável.
- **Integração real com o DJEN:** `lib/djen.ts` consulta `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao` (API pública, sem token), com filtros de período, tribunal, processo, OAB, advogado e parte; paginação de 100 itens (limite aceito pela API), teto de segurança de páginas e tratamento de `429` com orientação de esperar ~1 minuto. O teor HTML é convertido em texto e os destinatários/advogados são normalizados.
- `POST /api/djen-sync`: valida filtros, busca no DJEN, vincula publicações a processos pelo CNJ (20 dígitos), insere novas e **atualiza as existentes sem sobrescrever decisão, responsável, leitura ou prazo**, e registra tudo em `publication_sync_log`.
- Cadastro manual na fila (`Nova publicação`) para **Comunica PJe / E-mail / DJEN**, permitindo a fila única prevista no modelo.
- Migration `supabase/migrations/20261118120000_create_publications.sql`: tabelas `publications` e `publication_sync_log`, índices, RLS, grants e comentários. Idempotente. **Aplicada no Supabase em 2026-11-18** via `supabase db query --remote`; tabelas confirmadas por REST (HTTP 200).
- Permissão: `'/publicacoes': 'canAccessProcesses'` em `app/dashboard-layout.tsx`; item **Publicações** no grupo Operacional da sidebar.
- `npm run build`: **OK** (`/publicacoes` e `/api/djen-sync` listados; 21 páginas estáticas geradas).
- **Validação com dados reais (2026-11-17/18):** duas sincronizações DJEN com 100 comunicações cada, ambas `Sincronizado`; a segunda confirmou idempotência (`inserted=0`, `updated=100`) e preservou `status='A triar'`. A correção de entidades HTML case-sensitive gravou corretamente `DESPACHO/DECISÃO` no teor.
- **UI validada em navegador:** `/publicacoes` com 100 registros, KPIs **100 / 0 / 0 / 100**, abas, filtros, busca, colunas CNJ/Tribunal/Data/Processo/Advogado/Situação e detalhe com **Ler o texto** exibindo o teor completo. Nenhum prazo foi criado na validação (`process_deadlines` sem registros para a data consultada). Uma decisão de teste (`Ignorada` / “Teste”) registrada durante a sessão foi revertida para `A triar`.
- Commit `fdc2376` enviado para `trabalho-com-claude` em 2026-11-17 (complemento documental `d61cde3`). **Deploy de produção concluído:** `dpl_4uLoPWGo2mpGXKjb31Vbp5F15N6P`, alias `https://inove-juris.vercel.app`; rota `/publicacoes` respondeu **HTTP 200** em produção. O token antigo da Vercel deve ser revogado definitivamente.

## Readequação — captura DJEN somente pelos advogados cadastrados (2026-11-17)
- Parecer técnico favorável emitido **antes** da implementação, conforme solicitado: confirmado que `numeroOab` é o filtro efetivo e `ufOab` é complemento obrigatório no envio; `ufOab` sozinho retorna **422**, e múltiplos OABs na mesma requisição não são combinados de forma confiável.
- Swagger oficial consultado: buscas por OAB limitadas a **10.000 resultados**; pelo menos um filtro é obrigatório; rate limit de **20 requisições** por janela, com cabeçalhos `x-ratelimit-*` e orientação de aguardar ~1 minuto após `429`.
- Migration `supabase/migrations/20261118130000_add_lawyer_oab_uf.sql` aplicada no Supabase: coluna `lawyers.uf_oab`, normalização de `oab_number` para somente dígitos, checks `^[0-9]{1,10}$` e `^[A-Z]{2}$`, e Unique `(oab_number, uf_oab, environment)` no lugar das duas constraints antigas duplicadas. `publication_sync_log` ganhou `lawyer_oabs` para rastreabilidade.
- Backfill aplicado aos registros reais: `84503BA → 84503 / BA` (produção e teste) e `12542BA → 12542 / BA` (teste).
- `app/advogados/page.tsx` refatorada: **UF da OAB** e **Número da OAB** agora são campos separados e obrigatórios; validação, busca e duplicidade consideram `(número, UF, ambiente)`. O cartão exibe `OAB/UF`.
- `components/publicacoes/SyncModal.tsx` refatorado: seleção dos **advogados cadastrados no ambiente**, com OAB/UF vinda do cadastro. Os campos manuais de OAB/UF e o tribunal padrão `TJSP` foram removidos; tribunal e processo são refinamentos opcionais.
- `POST /api/djen-sync` refatorado: exige `lawyerIds`, carrega somente advogados válidos do ambiente e executa **uma consulta por advogado** com `numeroOab` + `ufOab`. Inclui deduplicação por `external_id`, pausa curta entre advogados, retentativa limitada em `429`, registro de falhas por advogado e `lawyer_oabs` no log. Reimportações continuam sem sobrescrever decisão, leitura, responsável ou prazo.
- Testes empiricamente repetidos com os OABs cadastrados no período `2026-11-01` a `2026-11-17`: `84503/BA → count 2` e `12542/BA → count 0`, ambos HTTP 200. Nenhuma captura ampla é mais necessária.
- **Limpeza controlada:** os 100 registros DJEN da validação ampla anterior foram removidos porque estavam todos `A triar`, sem leitura, decisão, justificativa, responsável ou prazo. A fila de Publicações ficou com **0 registros**; nenhum prazo foi criado.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas; `/publicacoes` e `/api/djen-sync` listados).
- Commit `5a0106f` enviado para `trabalho-com-claude`. **Deploy de produção concluído:** `dpl_8CVKdyv4RojDCJQsCim6gXQt5VTx`, alias `https://inove-juris.vercel.app`. `vercel curl` em `/publicacoes` e `/advogados` retornou o redirecionamento esperado para `/login` (sem cookie de sessão no CLI). O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Diagnóstico e correção — fila vazia apesar de existirem publicações (2026-11-17)
- Sintoma: `/publicacoes` vazia para `84503/BA`. O checkbox e o rótulo `Advogado #1 - 84503/BA` **não** bloqueavam a captura: o `publication_sync_log` registrava `Erro` com **HTTP 403** do CloudFront do DJEN (`ERROR: The request could not be satisfied`).
- Parâmetros confirmados corretos: `numeroOab=84503`, `ufOab=BA`, período, `pagina` e `itensPorPagina`. O endpoint da Swagger é **GET** (`get_api_v1_comunicacao`); enviar o mesmo corpo por **POST** retorna **401 Unauthenticated** (a escrita é exclusiva dos tribunais). Com GET: `2026-11-10..2026-11-17 → count 2` e `2026-01-16..2026-11-17 → count 56`.
- Causa raiz: bloqueio por IP/egress. O DJEN responde 200 à máquina local, mas 403 à Vercel. A Edge Function `djen-proxy` funciona em `sa-east-1`, porém é alocada em `us-east-1` quando invocada pela Vercel — região também bloqueada.
- Correção: migration `supabase/migrations/20261117173000_djen_fetch_rpc.sql` criou a RPC `public.djen_fetch`, que consulta o DJEN pelo egress **sa-east-1 do Postgres** (extensão síncrona `http`), com host/caminho fixos e somente leitura. `lib/djen.ts` passou a chamar essa RPC pelo REST do Supabase com a chave anônima; a Edge Function permanece apenas como contingência (`DJEN_PROXY_URL`). `tsconfig.json` exclui `supabase/functions` (runtime Deno).
- Apresentação: sem `Advogado #1` — o rótulo é `84503/BA`; com um único advogado válido, a tela mostra `Advogado considerado` + selo `Selecionado` e **nenhum checkbox**. O modal envia `environment` para alinhar cliente e servidor.
- **Validação em produção:** período curto → `inserted: 2`, `failedLawyers: []`; período informado pelo usuário (`2026-01-16..2026-11-17`) → `fetched: 56`, `inserted: 54`, `updated: 2`, `matchedProcesses: 33`, sem falhas. Fila com **56 publicações**, todas `A triar`, **0 prazos**, **0 decisões**.
- `npx tsc --noEmit` e `npm run build`: **OK**. Deploy final: `dpl_GtArPaEhj25bAupCTgLtc6WDTS8X` (`https://inove-juris.vercel.app`). O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Prazos editáveis e sincronia Processos ↔ Prazos ↔ Calendário (2026-11-17)
- Migration `supabase/migrations/20261117190000_editable_deadlines.sql` aplicada em produção: colunas `created_by`/`updated_by` em `process_deadlines`, tabela `process_deadline_history`, índices, RPCs transacionais `create_process_deadline`, `update_process_deadline`, `confirm_process_deadline` e `delete_process_deadline`, e inclusão de `process_deadlines` na publicação Realtime do Supabase.
- **Fonte única da verdade:** a tabela `process_deadlines`. Processos (carteira e detalhe), Prazos e Calendário não guardam cópias locais persistentes; todos recarregam a partir dela e assinam `postgres_changes` para refletir alterações em abas abertas.
- Edição disponível em `/prazos` (ação na linha), `/processos/[id]` (botões “Editar” no próximo prazo e na lista) e `/calendario` (data selecionada e lista). O mesmo modal altera data/hora, descrição, situação e responsável.
- Reagendar exige **justificativa**; a RPC reabre a confirmação (`confirmed_at`/`confirmed_by` zerados, situação volta a `Pendente`) e grava `old_data`, `new_data`, `changed_fields`, motivo, origem e usuário no histórico. A data antiga deixa de ser considerada em qualquer módulo.
- A edição de processos deixou de fazer `DELETE` + `INSERT` de todos os prazos: agora atualiza/insere/exclui apenas o que mudou, preservando `id`, vínculo com `publications.deadline_id`, memória de cálculo e auditoria.
- `getNextDeadline()` e os buckets de Prazos/Calendário usam a mesma regra de situações encerradas; `Confirmado` continua significando ciência do advogado, não baixa do prazo.
- RPCs testadas em produção no ambiente `test`: criar → reagendar sem justificativa (rejeitado com 400) → reagendar com justificativa (confirmação reaberta) → confirmar → excluir; 4 registros no histórico. `npx tsc --noEmit` e `npm run build`: **OK**.
- Commit `598b83e` enviado para `trabalho-com-claude`. Deploy: `dpl_DTQcjAWySHvG9vjU9SWzcXhnp4gU` (`https://inove-juris.vercel.app`). Rotas `/prazos`, `/processos`, `/processos/[id]`, `/calendario` e `/publicacoes` responderam **200** em produção. O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Reorganização da dashboard e aviso de aniversariantes (2026-11-17)
- Ordem dos cards em `app/page.tsx` revisada para priorizar decisões imediatas: **Radar de Prazos → ações críticas (Foco de Hoje, liquidez, gargalos, risco de inadimplência) → Fluxo de Compromissos → Gargalos INSS/Justiça → Parcelas em Atraso e Recebimentos Futuros → Meta Mensal/KPIs/Parecer Virtual → Pipeline de Receita → Risco de Abandono → gráficos analíticos**.
- O card **Aniversariantes de Hoje** (`BirthdayWidget`) saiu do topo e foi para o final da página, logo antes de **Atividades Recentes**. Nenhum card foi removido; apenas reordenado.
- O antigo badge flutuante `Aniversariantes Hoje!` (`fixed top-40 md:top-24 right-4 md:right-6 z-40`, com `animate-bounce`/`animate-pulse`) foi substituído por um **chip inline discreto** no cabeçalho da dashboard, ao lado dos filtros e antes de **Gerar Insights**.
- `BirthdayChecker` passou a viver no fluxo do documento (`app/page.tsx`) em vez de ser global no `DashboardLayout`; por isso não há mais `position: fixed`, `z-index` ou sobreposição com o botão **Gerar Insights** em nenhum breakpoint. O confeti automático ao abrir foi removido (o botão manual “Celebrar!” do modal permanece).
- O mesmo ajuste foi aplicado ao layout legado `app/dashboard-layout-1.tsx` para evitar duplicidade caso ele volte a ser usado.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas).
- Commit `e73767f` enviado para `trabalho-com-claude`. **Deploy de produção concluído:** `dpl_HHaT9kq8RNCLqQkMJkhTSmteJKk9`, alias `https://inove-juris.vercel.app`. `vercel curl` em `/`, `/prazos` e `/publicacoes` retornou **307** com `Location: /login` (redirecionamento esperado sem cookie de sessão). O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Responsividade: tabelas viram cards no celular (2026-11-17)
- **Problema:** em `/contas-a-receber` os registros só apareciam com rolagem horizontal (`overflow-x-auto` + `min-w-[800px]`), enquanto `/clientes` e `/contratos` já exibiam cards empilhados no celular.
- Padrão adotado em todos os módulos convertidos: tabela desktop mantida intacta e marcada como `hidden md:table` (ou `hidden md:block` no wrapper de scroll); lista `md:hidden divide-y divide-slate-100` com cards `p-4 space-y-3`, campos rotulados, `break-words`/`break-all`, `min-w-0` e alvos de toque de no mínimo 40 px. As duas visões consomem a mesma lista filtrada/ordenada e os mesmos helpers de status, cor, privacidade e ações.
- **Contas a Receber** (`app/contas-a-receber/page.tsx`): cards para a carteira de contratos e para as parcelas do contrato. Mantidos busca, filtros (Todos/Abertos/Quitados/Atrasados/Vence Hoje), ordenação, olhos de privacidade, barra de progresso, seleção em lote, ações de Receber/Ajustar/Prorrogar/Estornar e os estados de carregamento/vazio.
- Convertidos também: **Prazos** e a lista do **Calendário**; **Processos** (`ProcessTable`) e **Publicações** (`PublicationTable`, com “Ler e triar”); **Leads** (inclui funil, próxima ação, detalhes expansíveis e ações rápidas); **Indicadores** (lista, Comissões e Links Gerados, inclusive dentro dos modais); **Fluxo de Caixa** (page e Movimentações); **Produtos**, **Doenças**, **Relatórios** (7 tipos via renderizador único), **Auditoria** (`AuditAccessLogs`), **Extrato de Recebimentos**, **Configurações** (Auditoria, Matriz de Notificações, Integridade do banco) e **SyncDashboard**.
- Nenhuma funcionalidade desktop foi removida; nenhuma dependência nova foi adicionada. Em Relatórios, o filtro de divergência GPS passou a ser aplicado de forma consistente às linhas e ao estado vazio.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas). Validação em navegador com as visões mobile forçadas: Contas a Receber (106 contratos + parcelas), Prazos, Leads e Relatórios renderizaram cards com `scrollWidth == clientWidth` (sem rolagem horizontal).
- Commit `f5c39d8` enviado para `trabalho-com-claude`. **Deploy de produção concluído:** `dpl_GPe7mkhhfq9NqryVihnhM9BY3bAT`, alias `https://inove-juris.vercel.app`. `vercel curl` em `/contas-a-receber`, `/prazos` e `/relatorios` retornou **307** para `/login` (esperado sem sessão). O token antigo da Vercel continua considerado comprometido e deve ser revogado.

## Consolidação integral da sessão — checkpoint 2026-11-17
Esta seção reúne as decisões, identificadores, detalhes de implementação e incidentes da sessão para garantir continuidade completa.

### Regras de negócio e decisões consolidadas
- Nome obrigatório **Publicações**, nunca "Intimações", em UI, menu, documentação e identificadores user-facing.
- DJEN **não cria prazos automaticamente**: captura → leitura → classificação → **confirmação expressa** do advogado responsável (com justificativa obrigatório) antes de gravar em `process_deadlines`.
- Captura DJEN somente pelos **advogados cadastrados**, usando `numeroOab` + `ufOab`, com **uma consulta por advogado**. `numeroOab` é o filtro efetivo; `ufOab` é complemento obrigatório.
- Endpoint correto: **GET** `https://comunicaapi.pje.jus.br/api/v1/comunicacao` (POST retorna `401 Unauthenticated`). Consulta em produção via RPC `public.djen_fetch` pelo REST do Supabase (egress `sa-east-1`); a Edge Function `djen-proxy` ficou apenas como contingência (`DJEN_PROXY_URL`).
- `process_deadlines` é a **fonte única da verdade** para Processos, Prazos e Calendário. Alterações passam pelas RPCs transacionais `create_process_deadline`, `update_process_deadline`, `confirm_process_deadline` e `delete_process_deadline`.
- Reagendar exige **justificativa**; alterar a data reabre a confirmação (`confirmed_at`/`confirmed_by` zerados, situação volta a `Pendente`) e registra `old_data`, `new_data`, `changed_fields`, motivo, origem e usuário em `process_deadline_history`.
- `Confirmado` significa ciência do advogado, **não** baixa do prazo; situações concluídas/canceladas não aparecem em “Próximo prazo”.
- Dashboard reorganizada: Radar de Prazos e ações críticas em destaque; balão de aniversariantes substituído por chip inline discreto no header, sem sobrepor “Gerar Insights”.
- No celular, os registros devem aparecer como **cards empilhados** (padrão Clientes/Contratos), sem rolagem horizontal.

### Ambiente e identificadores
- Vercel: projeto `inove-juris`, produção `https://inove-juris.vercel.app`; CLI autenticada como `alcantarus`.
- Supabase: ref `jhlxzqsgmudkbjkynqdl`.
- Git: branch `trabalho-com-claude`; último commit `afa61a4`; working tree limpa ao final da sessão.
- Advogado de produção: `id=1`, `oab_number='84503'`, `uf_oab='BA'`, `name=null`.
- Comandos usuais: `npx tsc --noEmit`, `npm run build`, `npx vercel --prod --yes`, `npx vercel curl <url>`.
- **PowerShell não aceita `&&` neste ambiente** — usar `;`.
- O token antigo da Vercel continua considerado comprometido e deve ser revogado definitivamente.

### Detalhes da responsividade mobile (por arquivo)
- `app/contas-a-receber/page.tsx`: helpers extraídos `getContractRowStatus`, `filteredContracts` (`useMemo`), `getInstallmentFlags` e `openContract`; tabela desktop oculta com `hidden md:block overflow-x-auto`; cards da carteira (106 contratos validados) e das parcelas, com Receber / Ajustar previsão / Prorrogar / Estornar em `min-h-[40px]`.
- `app/prazos/page.tsx`: `Loader2`, `PriorityBadge`, `StatusBadge`, `DeadlineActions` (variante mobile) e `MobileField`; cards alimentados pela mesma lista filtrada da tabela.
- `components/calendario/DeadlineListView.tsx`: `daysLabel`, `daysClass`, `StatusBadge`, `DeadlineActions` e `MobileField`; sete colunas convertidas em campos rotulados.
- `components/processos/ProcessTable.tsx`: `getRowData`, `StatusBadge`, `DeadlineInfo`, `ResponsibleInfo` e `MobileField`; ações Abrir/Sinc/Editar/Excluir em grid de duas colunas. O seletor Lista/Cards da página permanece intacto.
- `components/publicacoes/PublicationTable.tsx`: `StatusBadge`, `SourceBadge`, `DeadlineRef` e `MobileField`; card inteiro clicável e CTA “Ler e triar”. As ações de triagem continuam em `PublicationDetail`.
- `app/leads/page.tsx`: `FUNNEL_STAGES`/`getFunnelIndex`, `getNextActionInfo`, `getLeadRowTone`, `MobileField`, `FunnelStage`, `WhatsappTemplatesMenu`, `AgendaMenu` e `LeadExpandedDetails`. Os popovers de ação rápida ficam no nível do card (`absolute left-4 right-4 top-16`) para não serem cortados pelo `overflow-hidden`.
- `app/indicadores/page.tsx`: `MobileField`, `getCommissionRowState` e `getTokenStatus`; cards na lista principal, em Comissões e em Links Gerados (inclusive dentro dos modais).
- `app/fluxo-caixa/page.tsx` e `app/fluxo-caixa/movimentacoes/page.tsx`: `CardField`, `TransactionTypeIcon` e `TransactionActions` (alvos de 40 px). As tabelas pequenas de Distribuição de Entradas/Despesas foram mantidas porque não estouram a largura no celular.
- `app/produtos/page.tsx` e `app/doencas/page.tsx`: `CardField`, `getProductAreaName`, `ProductActions`, `getAccessoryCids` e `DiseaseActions`; descrições longas de CID quebram linha.
- `app/relatorios/page.tsx`: `ReportCardField`, `getReportRows`, `getReportColumns` e `reportRows` — um único renderizador para os 7 tipos de relatório. Ajuste visual: `p-4` removido dos `cellClassName` (42 linhas) e aplicado no `<td>` via `cn("p-4", column.cellClassName)`, evitando padding duplicado nos cards. O filtro de divergência GPS passou a ser aplicado de forma consistente às linhas e ao estado vazio.
- `components/AuditAccessLogs.tsx`, `components/contas-a-receber/ContractStatementModal.tsx`, `components/settings/AuditLogsTab.tsx`, `components/settings/IntegrationsApiTab.tsx`, `components/settings/SystemTab.tsx` e `components/SyncDashboard.tsx`: cards para sessões/tentativas falhas, extrato de recebimentos, auditoria, matriz de notificações, integridade do banco e status DataJUD. Em `SystemTab`, `orphanResults = integrityCheckResults?.filter(...) ?? []` corrigiu `TS18047: 'integrityCheckResults' is possibly 'null'`.
- Os checkboxes da Matriz de Notificações continuam **não controlados** (comportamento original), portanto os estados desktop e mobile são independentes.

### Sequência final: validação, commit e deploy
1. `npx tsc --noEmit` acusou `TS18047` em `components/settings/SystemTab.tsx:897`; corrigido com optional chaining → **OK**.
2. `npm run build`: **OK** (21 páginas).
3. Validação em navegador com visões mobile forçadas por CSS injetado: `/contas-a-receber` (106 contratos; clique em “Ver Parcelas” abriu o card da parcela), `/prazos`, `/leads` (estado vazio também em card) e `/relatorios` — todos com `scrollWidth == clientWidth`, sem rolagem horizontal.
4. Commit `f5c39d8` (`feat(mobile): cards responsivos substituem tabelas com scroll horizontal`) e commit `afa61a4` (`docs: registra deploy dos cards responsivos`), ambos enviados para `trabalho-com-claude`.
5. Deploy `npx vercel --prod --yes` → `dpl_GPe7mkhhfq9NqryVihnhM9BY3bAT` → `https://inove-juris.vercel.app`. `vercel curl` em `/contas-a-receber`, `/prazos` e `/relatorios` retornou **307** para `/login` (esperado sem sessão no CLI).
6. `tsconfig.tsbuildinfo` foi restaurado com `git checkout --` (artefato local não versionado). O servidor `npm run dev` na porta 3000 foi encerrado ao final.

### Interrupção e retomada (registro do incidente)
- Uma rotina de validação no navegador que navegava por 12 rotas em sequência foi **abortada por limite de execução da ferramenta**. Isso **não travou o sistema** e não afetou arquivos, build ou deploy.
- A retomada foi feita com navegações curtas e medições pontuais. A aba antiga foi descartada (`browser.tab_unavailable`) e uma nova foi aberta. O log final do `npm run dev` confirmou `GET /contas-a-receber`, `/prazos`, `/leads` e `/relatorios` com `200`.

### Observações finais / pendências leves
- Durante a validação local apareceu no log: `SQL Error: { code: '42501', message: 'must be owner of table leads' }` em `GET /api/fix-db`. Não bloqueou rotas nem a entrega; investigar se esse endpoint voltar a ser usado.
- As imagens anexadas pelo usuário (`clientes.jpeg`, `contratos.jpeg`) não foram interpretadas visualmente por este modelo. O padrão de cards foi extraído diretamente do código de `/clientes` e `/contratos` e replicado nos demais módulos.
- Para retomar em nova sessão: ler este arquivo e `docs/PLANO-MELHORIAS-INOVEJURIS.md` e seguir a partir do estado final acima.

## Reativação da exclusão de prazos — 2026-11-17
- O usuário relatou que, após as implementações de prazos editáveis e cards mobile, tinha deixado de existir a ação de **excluir um prazo, perícia, cumprimento etc.** em Prazos e Processos. A funcionalidade foi reativada e estendida ao Calendário (as três telas consomem `process_deadlines`).
- Investigação: o backend já possuía a RPC transacional `delete_process_deadline(p_id, p_environment, p_edited_by, p_reason, p_source)` e o wrapper `deleteDeadlineRecord(...)` em `lib/deadline-mutations.ts`, mas nenhuma tela ligava um botão explícito a eles. O único botão de exclusão remanescente era o `Trash2` do modal de edição de processo (`app/processos/page.tsx`), que só removia a linha localmente até o "Salvar Alterações".
- Implementação: novo modal reutilizável `components/prazos/DeleteDeadlineModal.tsx` (confirmação, resumo do prazo, **motivo opcional** gravado no histórico, toast e execução da RPC). Ações adicionadas em:
  - `app/prazos/page.tsx`: botão "Excluir prazo" na tabela desktop e nos cards mobile.
  - `app/processos/[id]/page.tsx`: botões em "Próximo prazo" e na lista "Prazos do processo".
  - `components/calendario/DeadlineListView.tsx` + `app/calendario/page.tsx`: botão na lista e no painel do dia selecionado.
- Nenhuma migration nova: a exclusão é **hard delete** pela RPC existente, registrando `action='excluir'` em `process_deadline_history`; `publications.deadline_id` usa `ON DELETE SET NULL`. O motivo não é obrigatório no banco.
- Validação E2E em `/prazos` com prazo temporário no ambiente `test`: criação (id `61`), abertura do modal, chamada `POST /rest/v1/rpc/delete_process_deadline` com HTTP `200` e resposta `true`, lista atualizada de 3 para 2 prazos. Histórico confirmado por SQL: id `11` (`criar`) e id `12` (`excluir`, `justification: "Validacao automatizada da exclusao"`, `source: "prazos"`).
- Conferência visual em `/processos/39` (dois botões, modal abre e cancela) e em `/calendario` (botão na lista após navegar para dezembro/2026, modal abre e cancela).
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas). Atenção naquele momento: `fetchDeadlines()` não filtrava por ambiente; como `getAppEnv()` vem de `document.documentElement.dataset.env`, excluir um prazo de ambiente divergente falhava com `P0002` ("Prazo não encontrado neste ambiente.") — comportamento preexistente, corrigido em 2026-11-18 na seção abaixo.
- Commit `ed47f32` enviado para `trabalho-com-claude`. **Deploy de produção concluído:** `dpl_6RQzU9K8xCBVx8Xyadvk9gKgHt1c`, alias `https://inove-juris.vercel.app`. `vercel curl` em `/prazos`, `/processos` e `/calendario` retornou `Redirecting...` para `/login` (esperado sem sessão no CLI). O token antigo da Vercel continua considerado comprometido e deve ser revogado.
- O servidor local `npm run dev` da porta 3000 foi encerrado ao final da validação.

## Correção do filtro por ambiente — ENTREGUE em 2026-11-18
- Corrigido o comportamento preexistente em que `fetchDeadlines()` carregava registros de **todos os ambientes**, enquanto as RPCs de mutação usam `getAppEnv()`. Isso misturava prazos `test`/`production`, oferecia processos do outro ambiente no modal "Novo prazo" e podia gerar `P0002` na criação/exclusão.
- Implementação em `lib/deadlines.ts`: import de `getAppEnv`/`AppEnv`, assinatura `fetchDeadlines(env: AppEnv = getAppEnv())` e `.eq('environment', env)` nas cinco consultas (`process_deadlines`, `processes`, `contracts`, `clients`, `lawyers`).
- A chamada continua ocorrendo somente em efeitos cliente (`/prazos`, `/calendario`); no servidor `getAppEnv()` cai em `production`, por isso não foi move-la para renderização server-side.
- **Endurecimento em `app/processos/[id]/page.tsx`:** o detalhe agora filtra o próprio processo, os `process_deadlines` embutidos e as consultas auxiliares de `lawyers`, `contracts` e `clients` pelo mesmo `getAppEnv()`. Sem isso, era possível abrir pela URL um processo de outro ambiente e tentar editar/excluir prazos incompatíveis.
- Validação completa com sessão autenticada, alternando **PRODUÇÃO → TESTE → PRODUÇÃO** pela Sidebar:
  - `/prazos` em `production`: `process_deadlines?...&environment=eq.production` → HTTP `200`, **0 prazos**; “Novo prazo” ofereceu somente processos de produção (20 opções; nenhuma com id `29`/`30`).
  - `/prazos` em `test`: mesma consulta com `environment=eq.test` → HTTP `200`, **2 prazos vencidos**; “Novo prazo” ofereceu exatamente os processos `29` e `30`.
  - `/processos/29` em `production`: consulta com `environment=eq.production` + `process_deadlines.environment=eq.production` retornou `.single()` sem linhas (HTTP `406` esperado) e a tela exibiu “Processo não encontrado neste ambiente.”
  - Após trocar para `test` pela Sidebar, o mesmo `/processos/29` abriu normalmente, com o prazo “Juntar CTPS” e a consulta usando `environment=eq.test`.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas). Não foi necessária migration nova.
- Deploy do endurecimento: `dpl_9GZuKWe56Dmu8VcgKqPtXhoc73Sy`, alias `https://inove-juris.vercel.app`.

## Representação legal de menores em Clientes — ENTREGUE em 2026-11-18
- Decisão de produto: o menor continua sendo uma parte no cadastro; pai/mãe/tutor/curador é **outro registro de Cliente**, relacionado por aresta. A frase usada pelos futuros documentos (“representado por...”) projeta campos do responsável — nunca texto copiado no menor.
- `supabase/migrations/20261118140000_client_legal_guardians.sql` (aplicada em produção com `npx supabase db query --remote=jhlxzqsgmudkbjkynqdl --yes --file ...`; conferido `tabela=1`, `view=1`, `rpc=1`):
  - `client_relationships`: vínculo por `environment`, `client_id`, `related_client_id`, `relationship_type` (`pai|mae|tutor|curador|outro`), rótulo livre para o texto da cláusula, tipo de guarda, `is_primary`, vigência e auditoria. Um relacionamento principal por menor por ambiente.
  - `v_client_guardians`: expõe menor + responsável ao cadastro e, depois, ao catálogo do módulo Documentos.
  - `save_client_guardians(p_client_id, p_environment, p_guardians JSONB, p_edited_by)`: substitui os vínculos em transação, valida mesmo `environment` para menor e responsáveis, rejeita vínculo consigo mesmo e mais de um principal.
  - `clients."legalRepresentative"` permanece como legado; **não há backfill automático nem criação automática de clientes**.
- Frontend: `lib/client-guardians.ts` (tipos, rótulos, leitura/escrita), `components/clients/GuardianPicker.tsx` (busca de clientes do mesmo ambiente), editor **“Vínculos de Representação Legal”** no modal de Cliente, aviso revisável quando existe texto legado sem vínculo, lista/filtro “Assistidos” e `ClientSlideOver` projetando `mãe (principal): Nome · CPF`.
- Validação E2E em produção com o menor real **Anny Gabrielle Carvalho Borges** (`client_id=93`, legado “Arlene Carvalho de Santana Borges”):
  1. Abrir edição: aviso legado exibido corretamente.
  2. Buscar e selecionar **Arlene Carvalho de Santana Borges** (`client_id=94`), manter `mae` e principal, adicionar vínculo e salvar.
  3. `POST /rest/v1/rpc/save_client_guardians` retornou **204**; modal fechou após recarregar a lista.
  4. Recarregar a página e abrir o painel do cliente: `Representação legal — mãe (principal): Arlene Carvalho de Santana Borges · 032.448.265-55`; nenhum aviso de legado.
  5. SQL confirmou `client_relationships.id=1`, `client_id=93`, `related_client_id=94`, `relationship_type='mae'`, `is_primary=true`, `environment='production'`, `created_by=2`, e a linha correspondente em `v_client_guardians`.
- O vínculo de teste foi **mantido** porque reflete dado real correto.
- `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas).
- Deploy de produção concluído: `dpl_HEdGnjmMiKjkAKEJo2wQc4K15TQJ`, alias `https://inove-juris.vercel.app`.
- Pré-requisito para o módulo Documentos/“Modelo Vivo” concluído: o catálogo de dados poderá consumir `v_client_guardians` sem depender de texto livre.

## Blindagem de login, senhas e sessão — ENTREGUE em 2026-11-18
- Solicitação do usuário: validar com “toda a segurança necessária” a tela de login, evitar vazamento de chaves/senhas e corrigir o auto-login após fechar o navegador sem clicar em **Sair do Sistema**. Decisões confirmadas: aplicar mudanças direto em produção; sessão deve encerrar ao fechar janela/aba; **sem MFA agora**.
- **Auditoria do código anterior** (achados confirmados):
  - `bcryptjs` comparava a senha no navegador e o cliente selecionava `password` do banco; havia fallback para texto plano.
  - `select('*')` e logs traziam/exibiam hash, e-mail e estrutura de permissões no console.
  - Identificador da sessão ficava em `localStorage` e era enviado no body do heartbeat/logout; cookie `app_env` usava `sameSite: 'none'`.
  - Rate limit e verificação de expiração eram apenas client-side; presença de cookie/localStorage bastava para considerar autenticado.
  - RLS permissiva em `users`, `user_sessions`, `login_attempts` e `trusted_devices`.
- **Migration aplicada em produção:** `supabase/migrations/20261118150000_auth_session_hardening.sql` (`npx supabase db query --remote=jhlxzqsgmudkbjkynqdl --yes --file ...`). Antes da alteração foi criado o snapshot `_auth_hardening_policy_backup_20261118` com as policies originais.
  - Tabela `login_challenges` e funções auxiliares `_auth_*`.
  - RPCs `SECURITY DEFINER`: `app_authenticate`, `app_complete_login`, `app_validate_session`, `app_heartbeat`, `app_logout`, `app_switch_environment`, `app_admin_save_user`, `app_admin_delete_user`, `app_admin_impersonate`, `app_admin_terminate_session`, `app_admin_trust_device`, `app_get_security_data`, `app_get_my_trusted_devices`, `app_remove_my_trusted_device`.
  - Comparação bcrypt acontece no Postgres (`extensions.crypt`). Os 4 hashes reais usavam `$2b$`; a função `_auth_normalize_bcrypt` converte apenas o prefixo para `$2a$`, exigido pelo `pgcrypto` do Supabase (teste direto: `$2b$` falhou e `$2a$` passou). Nenhum texto plano foi encontrado.
  - Coluna `users.password` deixou de ser selecionável por `anon` (`GET /rest/v1/users?select=password...` → **401 permission denied**; colunas seguras → **200**). Escrita direta em `users` foi revogada e policies permissivas de sessões/tentativas/dispositivos foram removidas. `audit_logs` manteve policies de compatibilidade (resíduo a revisar).
  - Fluxo de dois passos preservado: `authenticate` devolve `challenge` sem senha/hash; `login` troca o challenge por `sessionId` e grava sessão no banco.
- **Sessão:** `session_id` e `app_env` passaram a ser cookies **httpOnly, SameSite=Lax, Secure em produção e sem Max-Age/Expires** (cookie de sessão). Cabeçalho real conferido: `session_id=...; Path=/; HttpOnly; SameSite=lax`. O `app_env` saiu de `sameSite: 'none'`. O `sessionId` não vai mais para `localStorage` nem para o body de heartbeat/logout.
- **Validação server-side:** `useAuth()` chama `app_validate_session` no bootstrap; `middleware.ts` exige ambos os cookies; `SessionMonitor` usa heartbeat por cookie e encerra a sessão se o servidor responder `401`. Sessões expiram após 12 h, 10 min sem heartbeat, logout, troca de ambiente indevida ou data de expiração do usuário.
- **Auto-login ao fechar o navegador:** marker em `sessionStorage` + `session_last_activity`; se o navegador restaurar a aba sem marker e com gap > 2 min, a aplicação chama `logout`, limpa estado local e redireciona para `/login?reason=session`.
- **Código alterado:** `lib/auth.ts` (sem bcrypt/hash/sessionId no cliente), `app/api/auth/session/route.ts` (todas as ações via RPC, sem logs de body/email/permissões), `middleware.ts`, `app/login/page.tsx`, `components/SessionMonitor.tsx`, `app/usuarios/page.tsx`, `components/AuditAccessLogs.tsx` e `components/settings/TrustedDevicesTab.tsx`. Senha é limpa do state React assim que o challenge é recebido.
- **Testes SQL em produção:** fluxo completo `app_authenticate` → `app_complete_login` → `app_validate_session` → `app_heartbeat` → `app_logout` passou; após logout, `app_validate_session` retornou `valid=false`. Teste REST anônimo: 5 senhas erradas → `invalid_credentials`, 6ª → `rate_limited`. Usuário temporário `auth-check@inovejuris.local` removido.
- **E2E no dev (`localhost:3000`)** com usuário temporário `e2e@inovejuris.local` (removido ao final): login em dois passos, dashboard, reload mantido, alternância PRODUÇÃO → TESTE → PRODUÇÃO pela Sidebar, heartbeat `200`, criação e exclusão administrativa de usuário via `admin_save_user`/`admin_delete_user` (HTTP `200`), logout pela UI e `validate` sem cookies retornando `valid=false`. O teste de restauração simulada (sem marker + atividade antiga) redirecionou para `/login?reason=session` e marcou a sessão como encerrada no banco. O travamento observado durante o E2E veio da automação de preenchimento do campo (e-mail duplicado/senha limpa após o challenge), não da aplicação.
- Confirmação final em banco: **4 usuários reais**, **0 temporários**, **0 sessões ativas** após a limpeza. `npx tsc --noEmit` e `npm run build`: **OK** (21 páginas).
- `SUPABASE_SERVICE_ROLE_KEY` **não** foi necessária nem configurada. **Pendência:** revogar o token antigo da Vercel, considerar MFA/“lembrar de mim” em uma próxima fase e revisar as policies restantes de `audit_logs`.

## Comandos úteis (PowerShell, em `C:\InoveTecnologia\InoveJuris`)
```powershell
git remote -v
git branch --show-current
git status

npm run build

git add -A
git commit -m "Mensagem"
git fetch origin
git pull --rebase origin main   # ou: git rebase origin/main
# resolver conflitos: editar -> git add <arquivos> -> git rebase --continue
git push -u origin main         # ou: git push origin trabalho-com-claude:main
```

## Notas importantes
- **Não commitar segredos** (`.env`, `.env.local`, tokens/chaves).
- O erro `BLOQUEADO: OLD=Cancelado, NEW=Aberto...` indica tentativa de reabrir contrato já cancelado/quitado (protegido). Cancelamento válido é transição para `Cancelado`; reabertura exige fluxo específico se desejado.
- Cancelamento no app bloqueia contratos com parcelas recebidas (regra de negócio).
- Este arquivo é um resumo operacional; detalhes finos de schema/regras podem variar conforme o banco em produção.
- **Continuidade de conversas:** este assistente não mantém memória persistente automática entre sessões. Para "armazenar" o histórico/continuidade, mantenha este arquivo (`docs/STATUS-INOVEJURIS.md`) atualizado e versionado no repositório, e ao iniciar uma nova sessão peça para ler este documento e retomar a partir dele. Se desejar, registre também decisões/resumos adicionais em arquivos no repo (ex.: `docs/`).
