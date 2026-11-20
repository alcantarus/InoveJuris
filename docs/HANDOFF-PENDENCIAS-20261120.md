# Handoff — pendências adiadas (2026-11-20)

## Decisão registrada

Em 2026-11-20, por falta de tempo e horário avançado, o usuário decidiu **adiar para outra oportunidade** os passos que restavam. **Nenhum deles foi executado nesta sessão.** Não houve alteração em banco, variáveis de ambiente, autenticação ou deploy além do que já estava publicado e validado.

## Estado congelado neste encerramento

- **Produção:** deploy `dpl_CKcrymP74sp29R5FiQbpifjntjVf` — `READY`, alias `https://inove-juris.vercel.app`. Confirmado após o alinhamento das branches.
- **Código:** ponta das branches `fase0-seguranca`, `main` e `trabalho-com-claude` (locais e remotas), sem divergência e com árvore limpa; o hash exato está no `git log`.
- **Autenticação:** Fase A (`role=anon`) e Fase B (`role=authenticated`) publicadas e validadas. O JWT é injetado no `Authorization` das consultas REST desde `dpl_G1MthzfBKKgh76ToAVFQ2bN5vXXf` (commit `c4d806c`).
- **Intactos:** heartbeat de 20 s, `app_validate_session` e tolerância de 90 s.
- **Sidebar:** Prazos, Calendário e Publicações presentes. Console sem erros.
- **Performance:** a digitação em "Novo Lançamento Financeiro" caiu de 15.765 ms para 1.119 ms em 41 caracteres (~14×). Falta apenas a confirmação do usuário no celular.
- **Nomenclatura:** usar **Publicações**, nunca "Intimações".

## Pendências adiadas

| # | Item | Natureza | Estimativa registrada | Por que ficou para depois |
|---:|---|---|---|---|
| 1 | Validar a digitação no celular | Confirmação do usuário | ~2 min | Depende do aparelho do usuário; não é trabalho de código. |
| 2 | Teste de pagamento/estorno | Validação com efeito financeiro real | ~15–30 min **após autorização explícita** | Nunca executar sem autorização: a operação movimenta saldo de verdade. |
| 3 | F4b-2c — trocar as policies `USING (true)` | Segurança de tenant | Preparação 2–3 h (agente) + execução 1–1,5 h (≈11 lotes de 5 tabelas) + margem 30–60 min | Exige inventário fresco e aplicação em lotes com verificação e rollback por lote. |
| 4 | Chave ECC própria (ES256) | Hardening | 1–1,5 h de trabalho; destravar a standby leva 10–15 min no painel ou 1–3 dias úteis via Supabase | A standby `c73f6852-eeca-455d-9549-647afae7e493` bloqueia importar outra chave. Hoje o HS256 funciona como ponte. |
| 5 | F3 — revogar 17 funções `http`/`urlencode` | Dependência externa | ~30 min de trabalho nosso + 1–3 dias úteis de espera do Supabase Support | As funções pertencem a `supabase_admin`; `postgres` não consegue revogar. Pacote do chamado já pronto. |

## Risco residual assumido até a retomada

- As policies permissivas `USING (true)` continuam no banco. O JWT com `role=authenticated` já é enviado, mas as regras ainda **não filtram por organização/ambiente**. O sistema está funcional e sem erros, porém **não pode ser chamado de totalmente seguro**.
- As 17 funções `http`/`urlencode` seguem executáveis por `anon`/`authenticated` (risco de SSRF/exfiltração via chave publicável).
- A assinatura do JWT continua HS256 (`SUPABASE_JWT_SECRET`) como ponte: segredo compartilhado, sem rotação limpa.
- O fluxo de pagamento/estorno não foi testado ponta a ponta desde a Fase B.

Nada disso causou erro visível nas validações feitas. São lacunas silenciosas, não falhas de funcionamento.

## Sequência para retomar

1. Usuário confirma a digitação no celular (item 1).
2. Item 2 — somente com autorização explícita do usuário.
3. Item 3 — gerar inventário fresco das policies, classificar e executar em lotes de 5 com `forward`/`verify`/`rollback` por lote.
4. Item 4 — destravar a standby, gerar JWK privado, importar/promover no Supabase, configurar `SUPABASE_JWT_PRIVATE_JWK` na Vercel, validar `alg=ES256` e só então remover `SUPABASE_JWT_SECRET`.
5. Item 5 — abrir o chamado no Supabase Support com o pacote em `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\`.

## Rollbacks disponíveis

| Mudança | Rollback |
|---|---|
| Performance (digitação) | Promover `dpl_G1MthzfBKKgh76ToAVFQ2bN5vXXf` e `git revert 85dc94b` |
| Injeção do JWT | Promover `dpl_4LKhoEm2NjjKWJ4AHvCT7QLzKM1D` ou restaurar `if (!headers.has('Authorization'))` em `lib/supabase.ts` |
| Fase B | Remover `SUPABASE_JWT_ROLE` na Vercel e republicar |
| Fase A | Remover `SUPABASE_JWT_SECRET` na Vercel; deploy pré-Fase A `dpl_3Z5EZi41FQPWPSZsviw2SLfyM6fs` |
| Payload/superadmin | `rollback_corrige_payload_superadmin.sql` |
| F3 (parte já aplicada) | `rollback_partial.sql`; rollback completo em `rollback.sql` |
| Último recurso | PITR da F0: `2026-11-18 18:01:02.49299+00` |

Os scripts ficam em `C:\InoveTecnologia\InoveJuris-Backups\`. O parecer de performance está em `PERF-20261120\PARECER-DIGITACAO-LENTA-20261120.md` e o parecer de autenticação em `docs/PARECER-JWT.md`.

## Regras que continuam valendo

- Nenhuma alteração de autenticação sem autorização explícita.
- Nenhuma implementação de tenant sem parecer e decisão de produto.
- Scripts SQL são executados pelo usuário no SQL Editor; o agente não tem credenciais de banco.
- Credenciais, tokens e chaves privadas não devem ser colados no chat nem persistidos em arquivos/documentação.
- **Publicações**, nunca "Intimações".
- Pagamento/estorno tem efeito financeiro real: somente com autorização explícita.
- Documento mestre: `docs/STATUS-INOVEJURIS.md`.
