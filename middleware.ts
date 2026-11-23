import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas que não precisam de sessão.
  // Onboarding e portal do indicador usam o token do link (header próprio),
  // não os cookies de sessão; o middleware não pode redirecioná-los para /login.
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    /^\/onboarding\/[^/]+\/?$/.test(pathname) ||
    /^\/portal\/indicador\/[^/]+\/?$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // O cookie é de sessão (sem Max-Age/Expires) e é validado no servidor
  // pela API /api/auth/session ao carregar a aplicação. Aqui apenas
  // bloqueamos requisições que nem chegaram a receber os cookies.
  const sessionId = request.cookies.get('session_id')?.value
  const appEnv = request.cookies.get('app_env')?.value

  if (!sessionId || !appEnv || (appEnv !== 'production' && appEnv !== 'test')) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session_id')
    response.cookies.delete('app_env')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
