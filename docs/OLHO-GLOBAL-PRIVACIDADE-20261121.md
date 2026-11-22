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
primeiro render.

### 3. Ponto único de formatação

`lib/utils.ts`:

| Função | Comportamento |
|---|---|
| `formatCurrency(valor, visível?)` | Retorna `R$ •••••` se o olhinho local estiver oculto **ou** se o modo global estiver ligado |
| `formatPercent(valor, visível?, casas?)` | Mesma regra para percentuais |
| `formatPercentValue(...)` | Só o número, para KPIs que desenham o `%` à parte |
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
- `app/globals.css` — regra que esmaece e bloqueia olhinhos individuais enquanto
  `data-privacy-hidden="true"`. Botões marcados com `data-privacy-master` (os dois controles globais)
  e `data-privacy-exempt` (ex.: "Ocultar texto" de Publicações) ficam de fora.

## Validação

- `npx tsc --noEmit --pretty false` — OK
- `npm run build` — OK (18 páginas geradas)

### Roteiro de verificação manual

1. Na dashboard, clicar em **Ocultar valores**.
2. Conferir que os cards de KPI (inclusive Ticket Médio e Impacto Social) mostram `••••••` /
   `R$ •••••`, e que percentuais mostram `•••%`.
3. Navegar para Contas a Receber, Contratos, Fluxo de Caixa, Relatórios e Indicadores: valores
   ocultos e botão compacto "Valores ocultos" no topo.
4. Confirmar que os olhinhos individuais estão esmaecidos e não respondem ao clique.
5. Em Contratos, abrir um formulário com campo de moeda e conferir que o valor digitado aparece
   normalmente (exceção de edição).
6. Clicar em **Exibir valores** na dashboard e conferir que os estados individuais anteriores foram
   restaurados.
7. Recarregar a página: o modo global permanece (localStorage).

## Fora do escopo

- PDFs gerados no portal do indicador (export, não exibição em tela).
- Persistência por usuário (hoje é por navegador, igual ao mapa individual).
- Ocultar contagens de processos/parcelas — decisão de manter visíveis.

## Rollback

Reverter o commit desta funcionalidade restaura o comportamento anterior. Não houve alteração de
banco de dados, autenticação ou regras financeiras.
