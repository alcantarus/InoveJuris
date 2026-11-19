// Token de sessão mantido apenas em memória no navegador (Fase A da identidade).
//
// Sem token, o cliente Supabase se comporta exatamente como antes: envia a
// chave publicável e o banco trata a requisição como `anon`. Com token, o
// header Authorization passa a levar o crachá assinado. O token nunca vai para
// localStorage: recarregar a página pede um novo na validação de sessão.

let currentToken: string | null = null

export function setSessionToken(token: string | null | undefined) {
  currentToken = typeof token === 'string' && token.trim() ? token : null
}

export function getSessionToken(): string | null {
  return currentToken
}
