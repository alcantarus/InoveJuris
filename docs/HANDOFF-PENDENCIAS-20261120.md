# Handoff — pendências adiadas (2026-11-20)

## Decisão registrada

Em 2026-11-20, por falta de tempo e horário avançado, o usuário decidiu **adiar para outra oportunidade** os passos que restavam. **Nenhum deles foi executado nesta sessão.** Não houve alteração em banco, variáveis de ambiente, autenticação ou deploy além do que já estava publicado e validado.

## Atualização de fechamento (2026-11-20) — use esta seção ao retomar

- **Itens 1 e 2 do quadro abaixo foram concluídos:** o usuário validou as Fases 1 a 4 da auditoria de digitação e **realizou o teste financeiro ponta a ponta com sucesso**, com autorização explícita. O agente não executou pagamento/estorno nem alterou código financeiro para o teste.
- **Tarefa em aberto:** exclusivamente **F4b-2c + chave ECC própria** (itens 3 e 4). Item 5 (F3) segue dependente do Supabase Support, sem decisão pendente agora.
- **Próxima interação:** ao pedir continuidade, apresentar **uma única decisão** — autorizar ou não a retomada de F4b-2c/chave ECC própria. Só iniciar inventário de policies, importação de chave ou qualquer alteração de autenticação **após** essa autorização.
- **Estado atual:** deploy `dpl_HvVBpU9Esj88cdXePndR26Dgwdb9` (`READY`, alias `https://inove-juris.vercel.app`); branches alinhadas em `c9faaa4`. O deploy/hash abaixo são os do momento do adiamento e servem como referência histórica.

## Estado congelado neste encerramento

- **Produção (no momento do adiamento):** deploy `dpl_CKcrymP74sp29R5FiQbpifjntjVf` — `READY`, alias `https://inove-juris.vercel.app`. Confirmado após o alinhamento das branches. **Atual:** `dpl_HvVBpU9Esj88cdXePndR26Dgwdb9`.
- **Código:** ponta das branches `fase0-seguranca`, `main` e `trabalho-com-claude` (locais e remotas), sem divergência; o hash exato está no `git log`. **Atual:** `c9faaa4`.
- **Autenticação:** Fase A (`role=anon`) e Fase B (`role=authenticated`) publicadas e validadas. O JWT é injetado no `Authorization` das consultas REST desde `dpl_G1MthzfBKKgh76ToAVFQ2bN5vXXf` (commit `c4d806c`).
- **Intactos:** heartbeat de 20 s, `app_validate_session` e tolerância de 90 s.
- **Sidebar:** Prazos, Calendário e Publicações presentes. Console sem erros.
- **Performance:** a digitação em "Novo Lançamento Financeiro" caiu de 15.765 ms para 1.119 ms em 41 caracteres (~14×). **Auditoria de digitação lenta (Fases 1 a 4) validada e encerrada em 2026-11-20**; parecer mestre em `PERF-AUDIT-20261120\PARECER-AUDITORIA-DIGITACAO-20261120.md`.
- **Nomenclatura:** usar **Publicações**, nunca "Intimações".

## Pendências adiadas

| # | Item | Natureza | Estimativa registrada | Por que ficou para depois |
|---:|---|---|---|---|
| 1 | ~~Validar a digitação no celular~~ | Confirmação do usuário | — | ✅ **Concluído em 2026-11-20:** usuário validou as Fases 1 a 4; auditoria encerrada. |
| 2 | ~~Teste de pagamento/estorno~~ | Validação com efeito financeiro real | — | ✅ **Concluído em 2026-11-20 com sucesso**, com autorização explícita; agente não executou pagamento. Regra permanece: nunca sem autorização. |
| 3 | F4b-2c — trocar as policies `USING (true)` | Segurança de tenant | Preparação 2–3 h (agente) + execução 1–1,5 h (≈11 lotes de 5 tabelas) + margem 30–60 min | Exige inventário fresco e aplicação em lotes com verificação e rollback por lote. |
| 4 | Chave ECC própria (ES256) | Hardening | 1–1,5 h de trabalho; destravar a standby leva 10–15 min no painel ou 1–3 dias úteis via Supabase | A standby `c73f6852-eeca-455d-9549-647afae7e493` bloqueia importar outra chave. Hoje o HS256 funciona como ponte. |
| 5 | F3 — revogar 17 funções `http`/`urlencode` | Dependência externa | ~30 min de trabalho nosso + 1–3 dias úteis de espera do Supabase Support | As funções pertencem a `supabase_admin`; `postgres` não consegue revogar. Pacote do chamado já pronto. |

## Risco residual assumido até a retomada

- As policies permissivas `USING (true)` continuam no banco. O JWT com `role=authenticated` já é enviado, mas as regras ainda **não filtram por organização/ambiente**. O sistema está funcional e sem erros, porém **não pode ser chamado de totalmente seguro**.
- As 17 funções `http`/`urlencode` seguem executáveis por `anon`/`authenticated` (risco de SSRF/exfiltração via chave publicável).
- A assinatura do JWT continua HS256 (`SUPABASE_JWT_SECRET`) como ponte: segredo compartilhado, sem rotação limpa.
- ~~O fluxo de pagamento/estorno não foi testado ponta a ponta desde a Fase B.~~ **Resolvido em 2026-11-20:** teste realizado com sucesso pelo usuário.

Nada disso causou erro visível nas validações feitas. São lacunas silenciosas, não falhas de funcionamento.

## Sequência para retomar

**Ao receber o pedido de continuidade, apresentar uma única decisão:** autorizar ou não a retomada de F4b-2c/chave ECC própria. Não executar nada de autenticação/banco antes da resposta.

1. ~~Usuário confirma a digitação no celular (item 1).~~ ✅ Concluído em 2026-11-20.
2. ~~Item 2 — somente com autorização explícita do usuário.~~ ✅ Teste financeiro concluído com sucesso em 2026-11-20.
3. Item 3 — gerar inventário fresco das policies, classificar e executar em lotes de 5 com `forward`/`verify`/`rollback` por lote.
4. Item 4 — destravar a standby, gerar JWK privado, importar/promover no Supabase, configurar `SUPABASE_JWT_PRIVATE_JWK` na Vercel, validar `alg=ES256` e só então remover `SUPABASE_JWT_SECRET`.
5. Item 5 — abrir o chamado no Supabase Support com o pacote em `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\` (dependência externa; não exige decisão imediata).

## Rollbacks disponíveis

| Mudança | Rollback |
|---|---|
| Auditoria Fase 4 | `git revert 282b3ad`; originais em `PERF-AUDIT-FASE4-20261120\` |
| Auditoria Fase 3 | `git revert f902814`; originais em `PERF-AUDIT-FASE3-20261120\` |
| Auditoria Fase 2 | `git revert f53e690`; originais em `PERF-AUDIT-FASE2-20261120\` |
| Auditoria Fase 1 | `git revert 20ab962`; originais em `PERF-AUDIT-FASE1-20261120\` |
| Performance (digitação) | Promover `dpl_G1MthzfBKKgh76ToAVFQ2bN5vXXf` e `git revert 85dc94b` |
| Injeção do JWT | Promover `dpl_4LKhoEm2NjjKWJ4AHvCT7QLzKM1D` ou restaurar `if (!headers.has('Authorization'))` em `lib/supabase.ts` |
| Fase B | Remover `SUPABASE_JWT_ROLE` na Vercel e republicar |
| Fase A | Remover `SUPABASE_JWT_SECRET` na Vercel; deploy pré-Fase A `dpl_3Z5EZi41FQPWPSZsviw2SLfyM6fs` |
| Payload/superadmin | `rollback_corrige_payload_superadmin.sql` |
| F3 (parte já aplicada) | `rollback_partial.sql`; rollback completo em `rollback.sql` |
| Último recurso | PITR da F0: `2026-11-18 18:01:02.49299+00` |

Os scripts ficam em `C:\InoveTecnologia\InoveJuris-Backups\`. Parecer de performance original em `PERF-20261120\PARECER-DIGITACAO-LENTA-20261120.md`; **parecer mestre da auditoria das demais telas em `PERF-AUDIT-20261120\PARECER-AUDITORIA-DIGITACAO-20261120.md`** (Fases 1 a 4 encerradas); parecer de autenticação em `docs/PARECER-JWT.md`.

## Regras que continuam valendo

- Nenhuma alteração de autenticação sem autorização explícita.
- Nenhuma implementação de tenant sem parecer e decisão de produto.
- Scripts SQL são executados pelo usuário no SQL Editor; o agente não tem credenciais de banco.
- Credenciais, tokens e chaves privadas não devem ser colados no chat nem persistidos em arquivos/documentação.
- **Publicações**, nunca "Intimações".
- Pagamento/estorno tem efeito financeiro real: somente com autorização explícita (teste já realizado com sucesso em 2026-11-20; não repetir sem novo pedido).
- Documento mestre: `docs/STATUS-INOVEJURIS.md`.
