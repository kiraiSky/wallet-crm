import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PATHS = ['/login']

// Nomes dos cookies de sessão do Auth.js
const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Auth.js v5: cookie name depends on HTTPS, not on NODE_ENV. Behind a HTTPS
  // tunnel (Cloudflare, ngrok) the cookie is __Secure-authjs.session-token; in
  // plain localhost dev it's authjs.session-token. Detect via x-forwarded-proto
  // (trusted because AUTH_TRUST_HOST=true) with a fallback to the request URL.
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
  const useSecureCookie = proto === 'https'

  let token = null
  let cookieError = false
  try {
    token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      secureCookie: useSecureCookie,
    })
  } catch {
    cookieError = true
  }

  const isLogged = !!token
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Cookie corrompido — apaga via redirect para forçar novo request sem cookie
  if (cookieError) {
    const url = req.nextUrl.clone()
    if (!isPublic) url.pathname = '/login'
    const res = NextResponse.redirect(url)
    SESSION_COOKIE_NAMES.forEach((name) => res.cookies.delete(name))
    return res
  }

  // Redireciona para login se não autenticado
  if (!isLogged && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // Redireciona para dashboard se já autenticado e vai para /login
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/uploads).*)'],
}
