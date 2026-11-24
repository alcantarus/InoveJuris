# Timeline unificada de processo — 24/11/2026

Feature entregue no detalhe do processo: **Andamentos e publicações** em uma única linha do tempo, com procedência explícita.

## O que mudou

- O detalhe do processo deixou de mostrar apenas `processes.history` (DataJud) e passou a mesclar:
  - **DataJud** → movimentações oficiais (`processes.history`);
  - **DJEN** → publicações e intimações (`publications`);
  - **Prazos** → `process_deadlines` (confirmados) e `suggested_days` (sugeridos);
  - **Manuais** → registros internos.
- Nenhum item do DJEN é gravado em `processes.history`. Publicação continua sendo publicação, com selo próprio.
- Inferências (ex.: “possível sentença”) aparecem em âmbar, com confiança e aviso de que não são ato oficial.
- Lacunas de sincronização são sinalizadas — o sistema não inventa dados para completar o histórico.

## Novos arquivos

| Arquivo | Função |
|---|---|
| `lib/process-timeline.ts` | Normalização pura e merge das fontes; sem banco/rede |
| `lib/publications-sync.ts` | Payload de upsert de publicações — somente campos de fonte |
| `app/api/processes/[id]/timeline/route.ts` | Leitura da timeline já normalizada |
| `app/api/processes/[id]/refresh-publications/route.ts` | Refresh DJEN **de um único CNJ**, sem varrer carteira |
| `components/processos/ProcessTimeline.tsx` | Hero com contagem de prazo, mapa de 30 dias, filtros e timeline |

## Refresh por processo

Antes, o único caminho era `/api/djen-sync`: varria a carteira dos advogados selecionados, com 1 requisição por OAB, até 20 páginas de 100 itens e pausas de 250 ms/400 ms.

Agora o detalhe do processo tem **“Atualizar publicações”**, que chama:

```http
POST /api/processes/[id]/refresh-publications
{ "days": 7 }
```

- filtra pelo número CNJ de 20 dígitos do processo;
- sem OAB, sem varredura de carteira, sem carregar 10.000 processos;
- até 3 páginas de 100 itens;
- upsert em lotes de 200 pela chave `(source, external_id, environment)`;
- status, decisão, responsável, leitura, prazo e importância continuam sob controle humano;
- log em `publication_sync_log` fechado com `after()`.

O botão antigo **“Sincronizar movimentações”** continua chamando `/api/process-sync` e gravando em `processes.history` — não foi alterado.

## Acabamento aplicado no mesmo dia

- **Status do DataJud no hero:** a rota `/timeline` agora devolve `sync` (`status`, `lastSync`, `error`) lido de `process_sync_log`. O badge mostra `DataJud · OK`, `indisponível` ou `cota 429`, com detalhes no tooltip.
- **Realtime de publicações:** o canal do detalhe agora escuta `publications` filtrado por `process_id` e recarrega a timeline automaticamente quando o DJEN grava algo.
- **Cooldown de 60 s:** ambos os botões “Atualizar publicações” ficam desabilitados por 60 s após um refresh, com contador, para evitar 429 e IO desnecessário.
- **Fila “A triar”:** contador de publicações pendentes com link para `/publicacoes`, reforçando que a importação não cria prazo.
- **Heatmap clicável:** clicar em um dia filtra a timeline; clicar de novo limpa o filtro.
- **Responsável no hero:** nome vem de `getResponsibleName(process, lawyers)`, já usado na página — sem nova consulta.
- **Criar prazo inline (melhoria 8):** o botão aparece apenas em publicações DJEN com `status = 'A triar'`, sem prazo oficial vinculado. Ele reutiliza `fetchPublications()` + `PublicationDetail`: o mesmo modal e a mesma mutação validada de `/publicacoes`, com justificativa obrigatória e `confirmed_at`/`confirmed_by`. Após salvar, a página recarrega o processo e a timeline. Nenhuma regra de prazo foi duplicada.

## Validação

- `npx tsc --noEmit` — limpo.
- `npm run build` — sucesso. Rotas novas listadas no build.
- Nenhuma migration ou alteração de banco foi executada.

## Como conferir

1. Abrir um processo em `/processos/[id]`.
2. Ver a seção **Andamentos e publicações**.
3. Clicar em **Atualizar publicações** e observar o toast com inseridas/atualizadas.
4. Conferir que o selo de cada evento mostra a origem e que itens inferidos estão em âmbar.
