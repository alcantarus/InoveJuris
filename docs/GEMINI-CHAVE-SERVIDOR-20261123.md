# Gemini — chave única no servidor (23/11/2026)

## Status

- `GEMINI_API_KEY` configurada no Vercel como **Secret** em **Production, Preview e Development**.
- Deploys de produção em 23/11/2026 (todos `READY`, alias `https://inove-juris.vercel.app`):
  `dpl_E5gvpmkScw6Gh95gKDBcFL3F3LZ6` (modelo `gemini-3.8-flash`),
  `dpl_Ha4RnLXEAQFJ969x9D6ZvdnCQtXC` (retry + UI),
  `dpl_GmWPXjCYAqJXVHVnjSTr8Y9KAGhX` (chave única),
  `dpl_xi2CmKwxXxqjnVWGN46tJtnx2gne` (variável de ambiente).
- A chave **não** foi escrita neste repositório. O arquivo temporário usado para a importação
  (`docs/CHAVEGEMINI.txt`) foi apagado e nunca foi commitado.
- Nenhuma chave é exibida em logs, documentos ou mensagens.

## Correção aplicada

Antes existiam três caminhos concorrentes para a chave, e o do navegador ganhava prioridade:

1. `localStorage.gemini_manual_key` (Configurações → Marketing);
2. `localStorage.GEMINI_API_KEY` (Leads);
3. `resolveGeminiKey()` com fallback para `GOOGLE_API_KEY`, `API_KEY` e
   `NEXT_PUBLIC_GEMINI_API_KEY`.

Depois da correção, **a única fonte é `GEMINI_API_KEY` no servidor**:

- `lib/gemini-server.ts` — `resolveGeminiKey()` lê somente `process.env.GEMINI_API_KEY`;
  `generateGeminiText(prompt, config?)` não aceita mais chave manual.
- `app/api/ai/generate/route.ts` — deixou de aceitar `manualKey` no corpo da requisição.
- `lib/actions/gemini.ts` — `analyzeTemplateImage(base64Image)` sem parâmetro de chave;
  removida a server action `getGeminiApiKey()` que devolvia o segredo ao cliente.
- `app/leads/page.tsx` — removidos o estado, o campo “Configuração (Opcional)” e os
  `manualKey` das três chamadas de IA.
- `components/settings/MarketingTab.tsx` — removidos o botão “Configurar IA”, o painel de
  chave manual e o `localStorage`.
- `.env.example` — removida a variável legada `NEXT_PUBLIC_GEMINI_API_KEY`.
- `components/GeminiLegacyCleanup.tsx` — componente invisível montado em `app/layout.tsx` e
  `app/layout-1.tsx` que apaga automaticamente `gemini_manual_key` e `GEMINI_API_KEY` do
  `localStorage` na primeira carga. O usuário **não precisa** rodar comando no console.

## Validação

Sem sessão, o middleware redireciona para `/login` (`307`) antes da rota — isso confirma que o
guard de autenticação continua ativo. Com sessão válida, testar na interface:

- Dashboard → insight de IA;
- Leads → score e insights;
- Configurações → Marketing → análise de imagem.

Interpretação de falhas:

| Resposta | Causa |
|---|---|
| `503` — “Chave do Gemini não configurada no servidor.” | `GEMINI_API_KEY` não chegou ao runtime |
| `500` — “Não foi possível gerar o conteúdo.” | API Gemini recusou a chave (inválida, cota ou modelo sem acesso) |
| `307 → /login` | sessão ausente/expirada; não é problema da chave |

Modelo: variável opcional `GEMINI_MODEL`, padrão **`gemini-3.8-flash`**. Antes: `gemini-3-flash-preview` (503 por demanda) e `gemini-2.5-flash` (404 para contas novas).

## Incidente 503 — modelo preview indisponível (23/11/2026)

- Sintoma: `Tentar Sugestão da IA` retornou `{"error":{"code":503,"message":"This model is currently experiencing high demand...","status":"UNAVAILABLE"}}`.
- Diagnóstico: **a chave está válida**. Erro de autenticação seria `401/403 INVALID_API_KEY`; aqui o provedor recusou o **modelo preview** por alta demanda.
- Correção aplicada:
  - modelo padrão trocado para `gemini-3.8-flash` (substituível por `GEMINI_MODEL`);
  - `geminiWithRetry()` repete falhas transitórias (`UNAVAILABLE`, `429`, `503`) até 3 vezes com backoff de 400/800 ms;
  - `friendlyGeminiError()` traduz `UNAVAILABLE`/`RESOURCE_EXHAUSTED` em mensagens claras e devolve `503` na rota;
  - texto abaixo do botão explica que é preciso enviar uma imagem antes de usar a sugestão.
- O botão desabilitado na captura de tela era comportamento correto: o editor “Nova Arte” estava sem `image_url`. A análise usa a imagem de fundo.

## Incidente 404 — modelo antigo indisponível para contas novas (23/11/2026)

- Sintoma: `{"code":404,"status":"NOT_FOUND","message":"This model models/gemini-2.5-flash is no longer available to new users... use models/gemini-3.8-flash"}`.
- Diagnóstico: a chave continua válida; o Google AI Studio restringe modelos antigos para contas novas.
- Correção: padrão alterado para `gemini-3.8-flash`; `friendlyGeminiError()` agora traduz `NOT_FOUND/404` para uma mensagem que aponta `GEMINI_MODEL`.

## Como a chave foi adicionada (sem expor o valor)

```powershell
$key = (Get-Content -LiteralPath '<arquivo local temporario>' -Raw -Encoding UTF8).Trim()
$key | npx vercel env add GEMINI_API_KEY --environment "production,preview,development" --sensitive --yes
npx vercel --prod
```

O valor entra pelo stdin do CLI, não aparece no histórico do PowerShell nem na conversa.
O arquivo temporário deve ficar **fora do repositório** — por exemplo em
`C:\Users\ALCANTARUS\AppData\Local\Temp\opencode\gemini-key.txt`.

> Atenção: no PowerShell, a lista de ambientes precisa estar entre aspas
> (`"production,preview,development"`); sem aspas o comando é dividido e o CLI responde
> `invalid_environment`.

## Rollback

- Reverter o commit desta correção traz de volta os campos manuais e o fallback legado.
- Remover a variável: `npx vercel env rm GEMINI_API_KEY --environment production` (repetir para
  `preview` e `development`) e redeploy. A aplicação volta a responder `503` nos recursos de IA,
  sem afetar login, dados ou RLS.
- Não reativar `NEXT_PUBLIC_GEMINI_API_KEY`: ela expõe o segredo no bundle do navegador.

## Histórico

- `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md` registra a migração original para o servidor;
  trechos sobre “chave manual” e “fallback legado” descrevem o estado **anterior** a esta data.
