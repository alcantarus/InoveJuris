# Parecer — identidade no banco (JWT) para o InoveJuris

> **Status: PAUSADO.** Documento de análise, escrito em 2026-11-19.
> **Nada foi alterado** em código, banco ou deploy por este parecer.
> O tema depende de autorização explícita do usuário para tocar a autenticação.

## 0. Resumo

O login atual protege as **telas**, mas não os **dados**. O navegador fala direto com o
Supabase usando a anon key, que é pública por definição (está no bundle da aplicação), e o
banco não recebe nenhuma identificação de quem está chamando. As policies de tenant
(`auth.jwt() ->> 'organization_id'`, `app.current_organization_id`, `custom.user_id`)
existem, mas nunca são alimentadas — por isso estão inertes e as ~50 tabelas seguem
sustentadas por policies `USING (true)`.

Consequência prática: quem copiar a anon key da página consegue ler clientes, processos,
contratos, Publicações e financeiro pela API REST, sem passar pelo login.

Resolver isso exige duas coisas que só funcionam juntas:

1. o banco saber **quem** está chamando (identidade por requisição);
2. trocar as policies permissivas por policies derivadas dessa identidade.

A opção recomendada é **JWT próprio**: o servidor que já valida a sessão passa a emitir um
token assinado, e o navegador o envia em cada consulta. É a solução para a qual o RLS foi
desenhado, muda pouco do que já existe e concentra o risco em um único ponto.

## 1. O que já existe (reaproveitável)

| Peça | Situação |
|---|---|
| Login próprio com sessão opaca validada no servidor | ✅ pronto — não precisa ser refeito |
| `app_validate_session` e `app_heartbeat` | ✅ prontos — já devolvem o usuário a cada 20 s |
| `users.organization_id` e `users.is_superadmin` | ✅ existem no banco |
| Cliente Supabase centralizado em `lib/supabase.ts` | ✅ **um único ponto** para injetar o token |
| Policies no padrão `auth.jwt() ->> 'organization_id'` | ✅ já existem como exemplo em `clients`, `processes`, `contracts` |
| Chave de assinatura **ES256** publicada pelo projeto (JWKS) | ✅ o projeto já usa o mecanismo moderno |
| `service_role` nas rotas de servidor | ✅ configurada em Production |

O JWKS público do projeto (`https://jhlxzqsgmudkbjkynqdl.supabase.co/auth/v1/.well-known/jwks.json`)
responde `200` com uma chave ES256 (`kid 83b7ae9a-4d5b-45c3-b92d-6ff041e5d73f`).
**Falta confirmar no painel** se a chave privada correspondente é exportável ou se será
preciso criar uma nova. Isso é leitura de painel, sem alteração.

## 2. As 4 peças que faltam

| # | Peça | Onde | O que é |
|---|---|---|---|
| 1 | **Emitir o token** | rota `/api/auth/session` + 1 função SQL pequena | após o login, assinar um token com `sub`, `organization_id`, `is_superadmin`, `environment`, `session_id` e validade curta |
| 2 | **Transportar e renovar** | `lib/supabase.ts`, `lib/auth.ts`, `components/SessionMonitor.tsx` | o navegador passa a enviar o token; o heartbeat de 20 s renova antes de vencer |
| 3 | **Trocar as policies** | banco, tabela por tabela | sair de `USING (true)` para `organization_id = token AND environment = token` |
| 4 | **Fechar a porta** | banco | revogar `anon` das tabelas e remover as policies `true` restantes — só no fim |

Detalhe que mostra o tamanho real: o payload de login **não inclui `organization_id`** hoje.
É um ajuste de uma linha em `_auth_user_payload`, mas precisa ser feito.

## 3. Tamanho real, medido no código

| Medida | Número |
|---|---|
| Chamadas `supabase.from(...)` | **118** |
| Arquivos que falam direto com o banco | **33** |
| Tabelas/views distintas usadas | **34** |
| Operações de escrita (`insert`/`update`/`upsert`/`delete`) | **~150** |
| Funções RPC chamadas pelo app | **30** |
| Canais Realtime (`postgres_changes`) | **8**, em 7 telas |
| Tabelas com policies de isolamento | **40** |
| Views de dashboard | 3 |

## 4. Complexidade por peça

| Peça | Complexidade | Por quê |
|---|---|---|
| 1. Emitir o token | **Baixa** | uma rota, uma função SQL, uma chave; não muda tela nenhuma |
| 2. Transportar/renovar | **Baixa-média** | o cliente é centralizado; o risco é o token vencer no meio da sessão |
| 3. Policies por tabela | **Média** | trabalho repetitivo, não conceitual; o problema são as exceções |
| 4. Fechar o `anon` | **Baixa** | só pode ser feito depois de 3 estar validado |
| Realtime | **Média-alta** | o canal ao vivo precisa do token e pode cair quando ele vence |

## 5. Exceções que dão trabalho

1. **Tabelas sem `organization_id`** — `contract_diseases`, `product_diseases`, `diseases`.
   A policy precisa passar pela tabela-pai.
2. **Views** — as 3 do dashboard precisam de `security_invoker` e herdam a RLS da base.
3. **Fluxo público de onboarding** — `client_onboarding_tokens` é acessado **sem login**, por
   link. Precisa de exceção explícita, senão o cliente não consegue preencher a ficha.
4. **RPCs chamadas pelo navegador** — hoje rodam como `anon`; com o token passam a rodar como
   `authenticated`. Os grants precisam ser conferidos antes, senão pagamento/estorno param.
5. **Ambiente produção/teste** — o token precisa carregar o ambiente; sem isso o isolamento
   entre os dois desaparece.

## 6. O que **não** é necessário

- ❌ reescrever as telas;
- ❌ refazer o login;
- ❌ migrar para BFF;
- ❌ fazer tudo de uma vez (big bang).

## 7. Riscos e contenção

| Risco | Contenção |
|---|---|
| Token vazado | validade curta (sugerido 10 min) + renovação no heartbeat; logout apaga o token do navegador |
| Logout não invalida o token na hora | limitação do JWT; validade curta reduz a janela. Revogação imediata exige conferir `session_id` na operação sensível |
| Realtime cair quando o token vence | renovar e reconectar no heartbeat; teste dedicado antes do rollout |
| Policy errada esconder/derrubar uma tabela | ligar **5 tabelas por vez**, testar, com rollback SQL do estado anterior |
| Fluxo público quebrar | exceções mapeadas antes (onboarding, login) |
| Regressão silenciosa em RPC | conferir grants de `authenticated` antes de trocar o `role` do token |

## 8. Fases e esforço

| Fase | O que entrega | Esforço |
|---|---|---|
| **A** | token emitido e transportado, policies intactas | 2–3 dias |
| **B** | piloto em 3–5 tabelas + Realtime validado | 2–3 dias |
| **C** | rollout das ~30 tabelas restantes, em lotes | 8–12 dias |
| **D** | revogar `anon`, remover as policies `true`, teste ponta a ponta | 2–3 dias |

**Total: ~15 a 21 dias úteis de trabalho focado.** É estimativa técnica, não prazo de
calendário — depende das janelas de teste.

## 9. Primeiro passo seguro (Fase A)

1. Emitir o token com `role = anon` — **mesmo privilégio de hoje**. Serve só para provar
   assinatura e transporte. **Nenhuma policy muda.**
2. Depois, trocar para `role = authenticated` e conferir as 30 RPCs e as 34 tabelas.
3. Se algo der errado, remove-se o cabeçalho e o sistema volta ao estado atual em um deploy.

Só depois disso entra a Fase B.

## 10. Pré-requisitos / decisões do usuário

1. **Autorizar** mexer na autenticação (emissão do token).
2. **Confirmar no painel Supabase** a disponibilidade da chave privada ES256.
3. **Escolher a validade** do token (sugestão: 10 minutos).
4. **Definir a janela de teste** no ambiente `test`.
5. Manter intactos até a Fase B: heartbeat de 20 s, `app_validate_session`, tolerância de 90 s.

## 11. Relação com o estado atual do banco

- A F4b-1 fechou **integridade** (auditoria e `system_settings` não são mais graváveis pelo
  cliente). Ver seção 17 de `docs/PARECER-IMPACTO-CORRECOES-INOVEJURIS.md`.
- A F4b-2b (identidade) é o que falta para fechar **isolamento de leitura**.
- A F4b-2c (dropar as policies `true`) **não pode ser executada sozinha**: sem identidade por
  requisição, clientes, prazos, Publicações, contratos e financeiro param.
- Enquanto isso não for decidido, o risco residual permanece: **a anon key continua pública e
  as ~50 tabelas continuam abertas para leitura via REST**.
