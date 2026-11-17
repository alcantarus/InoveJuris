# InoveJuris — Status e Handoff

> Documento de continuidade gerado para retomar o trabalho em futuras sessões.
> Atualizado em: 2026-11-17 (contexto desta conversa).

## Contexto do projeto
- **Stack:** Next.js 15 + Supabase (Postgres), uso de um único escritório (não SaaS/multi-tenant).
- **Ambiente local:** `C:\InoveTecnologia\InoveJuris` (git repo, Windows/PowerShell).
- **Repositório GitHub:** https://github.com/alcantarus/InoveJuris
- **Deploy:** Vercel (conectada ao repo/branch `main`, conforme uso do usuário). Variáveis sensíveis/`NEXT_PUBLIC_*` devem estar configuradas na Vercel; migrations devem ser aplicadas no Supabase do ambiente alvo.

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
