# Olhinho global de privacidade — InoveJuris (21/11/2026)

## Objetivo

Um único liga/desliga na **dashboard** que oculta valores financeiros em **todos os módulos**,
inclusive cards de KPI, tabelas, tooltips de gráficos e extratos. Nas demais páginas existe um
indicador compacto no topo para desligar sem voltar à dashboard.

Decisões confirmadas:

- Controle completo na dashboard + indicador compacto no topo dos outros módulos.
- Escopo: **valores monetários e percentuais**. Contagens (ex.: "12 contratos") continuam visíveis.
- Com o modo global ligado, os olhinhos individuais ficam **desabilitados** (visualmente esmaecidos,
  clique bloqueado e `toggleVisibility` sem efeito).

## Como funciona

### 1. Store compartilhado

`lib/privacy-store.ts` guarda um booleano em memória (`globallyHidden`) e o publica como
`document.body.dataset.privacyHidden`. É um módulo TypeScript simples — sem React, sem Supabase —
para que as funções de formatação possam consultar o modo sem receber um hook.

Chave de persistência: `localStorage['privacy_global_hidden']` (por navegador).

### 2. Provider

`components/providers/PrivacyProvider.tsx` (já envolvia todo o app em `app/layout.tsx`) passou a
expor:

- `isGloballyHidden`
- `toggleGlobalVisibility()`
- `isVisible(id)` → `!globalHidden && mapa[id] !== false` (o global tem precedência)
- `toggleVisibility(id)` → não faz nada enquanto o global estiver ligado

O estado é aplicado ao store **antes de renderizar os filhos**, evitando flash dos valores no
primeiro render. O toggle também atualiza o store **sincronamente** no handler de clique (ver
"Varredura profunda" abaixo) e, ao desligar, **limpa o mapa individual**.

### 3. Ponto único de formatação

`lib/utils.ts`:

| Função | Comportamento |
|---|---|
| `formatCurrency(valor, visível?)` | Retorna `R$ •••••` se o olhinho local estiver oculto **ou** se o modo global estiver ligado |
| `formatPercent(valor, visível?, casas?)` | Mesma regra para percentuais |
| `formatPercentValue(...)` | Só o número, para KPIs que desenham o `%` à parte |
| `formatCurrencyWith(valor, fn)` | Aplica a regra de privacidade a formatações próprias (eixos de gráfico) |
| `formatCurrencyEditable(valor)` | **Ignora** o modo global; usado apenas em campos de digitação |

Isso cobre automaticamente as ~126 chamadas de `formatCurrency` existentes, inclusive as que antes
não passavam nenhum parâmetro de visibilidade (clientes, extratos, cards dinâmicos do dashboard,
alertas de fluxo de caixa, relatórios).

### 4. Exceções de edição

Campos onde o valor precisa continuar legível foram migrados para `formatCurrencyEditable`:

- `components/CurrencyInput.tsx`
- `components/cashflow/NewTransactionModal.tsx`
- `app/contratos/page.tsx` (componente local `CurrencyInput`)

Exibições em Contratos que forçavam `formatCurrency(..., true)` passaram a chamar sem o `true`,
ficando sujeitas ao modo global.

### 5. Percentuais

Percentuais que eram montados à mão (`toFixed(1)}%`) passaram a usar `formatPercent`:

- `app/page.tsx` (insights, "Êxito Estimado", "Taxa de Sucesso", "Taxa de Êxito INSS")
- `components/dashboard/DashboardReceivablesCards.tsx`
- `app/relatorios/page.tsx` (comissões)
- `components/leads/LeadKpiHeader.tsx`
- `components/portal/CommissionTable.tsx`

### 6. UI

- `components/GlobalPrivacyToggle.tsx` — botão com `Eye`/`EyeOff`, variantes `full` (dashboard) e
  `compact` (topo dos módulos).
- `app/page.tsx` — botão completo ao lado dos filtros.
- `app/dashboard-layout.tsx` — botão compacto no topo de todas as páginas exceto `/`.
- `app/portal/indicador/[token]/page.tsx` — botão compacto e KPIs via `formatCurrency` (o portal não
  usa `DashboardLayout`, por isso precisou do controle próprio).
- `app/globals.css` — regra que esmaece e bloqueia olhinhos individuais enquanto
  `data-privacy-hidden="true"`. Botões marcados com `data-privacy-master` (os dois controles globais)
  e `data-privacy-exempt` (ex.: "Ocultar texto" de Publicações) ficam de fora.

## Varredura profunda — correção do relato "números continuam ocultos ao Exibir valores"

Foram identificadas **quatro causas independentes**, todas corrigidas:

1. **Chaves individuais antigas.** O `localStorage['privacy_visibility_map']` guardava chaves como
   `dashboard_finance: false` de antes da funcionalidade. Ao desligar o global, `isVisible(id)`
   continuava retornando `false` para essas chaves. Correção: `toggleGlobalVisibility()` limpa o
   mapa quando o modo é desligado.
2. **Componentes que não re-renderizam.** `MemoDefaultRiskCard` (comparador customizado),
   `CashFlowForecastCard`, `AreaEfficiencyCard` (`React.memo` sem props) e páginas como Clientes não
   consomem `PrivacyContext`. Mesmo com o store atualizado, a string mascarada antiga permanecia na
   tela. Correção: `lib/usePrivacyVersion.ts` usa `useSyncExternalStore` para inscrever esses
   componentes no store e forçar o re-render. O retorno do hook não é usado de propósito — a
   inscrição é o mecanismo.
3. **Store atualizado tarde.** O `setPrivacyGloballyHidden()` estava apenas em `useEffect`. No clique
   para **Exibir valores**, o contexto já dizia "visível" mas `formatCurrency()` ainda lia o valor
   antigo do store; componentes que só consomem o contexto não renderizavam uma segunda vez.
   Correção: o store é atualizado **sincronamente no handler do toggle** (o `useEffect` permanece só
   para persistência).
4. **Formatações manuais.** KPIs do portal do indicador, tooltip do gráfico de comissões e ticks de
   eixo (`R$ 12k`) escapavam de `formatCurrency`. Correção: todos passaram a usar
   `formatCurrency` / `formatCurrencyWith`.

Arquivos tocados nesta rodada, além dos já listados: `lib/usePrivacyVersion.ts` (novo),
`lib/privacy-store.ts`, `components/providers/PrivacyProvider.tsx`, `lib/utils.ts`,
`app/portal/indicador/[token]/page.tsx`, `components/portal/CommissionChart.tsx`,
`app/fluxo-caixa/page.tsx`, cards dinâmicos do dashboard, KPIs de Processos/Clientes/Leads,
`ContractStatementModal`, `components/ui/KPICard.tsx`.

Varredura automatizada: todos os arquivos que chamam `formatCurrency`/`formatPercent` foram cruzados
com os que assinam `usePrivacyVersion` ou `usePrivacy`. Restaram apenas as exceções intencionais de
edição (`CurrencyInput`, `NewTransactionModal`, `PaymentFields`) e os próprios `lib/utils.ts` /
`lib/privacy-store.ts`.

## Validação

- `npx tsc --noEmit --pretty false` — OK
- `npm run build` — OK (18 páginas geradas)

### Validação em navegador (harness temporário, removido ao final)

Como o repositório não registra credenciais de teste e o bootstrap exige sessão válida no servidor,
foi usada uma página temporária sob `/login` (rota pública) importando o **código real** do provider,
do store e dos formatadores. Resultados:

| Cenário | Resultado |
|---|---|
| Chaves antigas (`old_key: false`) + global desligado | `isVisible('old_key') === false` (override individual preservado) |
| Clicar em **Ocultar valores** | `R$ •••••`, `•••%`, `R$ •••••` no eixo; `body[data-privacy-hidden="true"]` |
| Clicar em **Exibir valores** | `R$ 1.234,56`, `12.3%`, `R$ 12k`; mapa individual limpo (`{}`); `oldKeyVisible === true`; body flag `false` |
| Recarregar com o modo ligado | Modo persistido e valores mascarados já no primeiro render |
| CSS dos olhinhos individuais com o global ligado | `opacity: 0.4` e `pointer-events: none` confirmados via `getComputedStyle` |
| Assinatura externa | Componente com `usePrivacyVersion()` re-renderizou em ambas as direções |

Não foi possível validar as telas autenticadas (dashboard, Contas a Receber etc.) de ponta a ponta
sem credenciais; a verificação nelas é a do roteiro manual abaixo.

### Roteiro de verificação manual

1. Na dashboard, clicar em **Ocultar valores**.
2. Conferir que os cards de KPI (inclusive Ticket Médio e Impacto Social) mostram `••••••` /
   `R$ •••••`, e que percentuais mostram `•••%`.
3. Navegar para Contas a Receber, Contratos, Fluxo de Caixa, Relatórios e Indicadores: valores
   ocultos e botão compacto "Valores ocultos" no topo.
4. Confirmar que os olhinhos individuais estão esmaecidos e não respondem ao clique.
5. Em Contratos, abrir um formulário com campo de moeda e conferir que o valor digitado aparece
   normalmente (exceção de edição).
6. Clicar em **Exibir valores** na dashboard e conferir que **todos** os valores aparecem (os
   overrides individuais antigos são descartados de propósito).
7. Recarregar a página: o modo global permanece (localStorage).

## Fora do escopo

- PDFs gerados no portal do indicador (export, não exibição em tela).
- Persistência por usuário (hoje é por navegador, igual ao mapa individual).
- Ocultar contagens de processos/parcelas — decisão de manter visíveis.

## Rollback

Reverter o commit desta funcionalidade restaura o comportamento anterior. Não houve alteração de
banco de dados, autenticação ou regras financeiras.
