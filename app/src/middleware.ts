import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { canAccess, EMPLOYEE_HOME, type Role } from '@/lib/access'

const PUBLIC_PATHS = ['/login']

// Lê o token de sessão sem assumir o nome do cookie. Auth.js v5 usa o prefixo
// __Secure- em HTTPS (tunnel Cloudflare/ngrok) e o nome simples em localhost.
// Atrás de um tunnel o x-forwarded-proto nem sempre bate certo com o protocolo
// do request, e adivinhar errado faz o getToken devolver null para uma sessão
// válida. Tentamos as duas variantes — o getToken só encontra um cookie que
// existe, por isso isto nunca cria sessões falsas. Erros de decode (cookie
// corrompido) são tratados como "sem sessão", sem apagar nada à força.
async function readSessionToken(req: NextRequest) {
  for (const secureCookie of [false, true]) {
    try {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
        secureCookie,
      })
      if (token) return token
    } catch {
      // tenta a outra variante; se ambas falharem, segue sem sessão
    }
  }
  return null
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const token = await readSessionToken(req)
  const isLogged = !!token
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Pedidos de prefetch do router nunca devem ser redirecionados: um prefetch
  // que recebe um 3xx nunca fica em cache como resolvido, por isso o Next volta
  // a emiti-lo a cada render — um loop infinito de GET /login enquanto a página
  // está parada. Respondemos com 204 (no-op) para o prefetch; a navegação real
  // (sem este header) continua a ser barrada normalmente em baixo.
  const isPrefetch =
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('purpose') === 'prefetch' ||
    (req.headers.get('sec-purpose') ?? '').includes('prefetch')
  if (isPrefetch && !isLogged && !isPublic) {
    return new NextResponse(null, { status: 204 })
  }

  // Redireciona para login se não autenticado
  if (!isLogged && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // Colaborador (EMPLOYEE): restrito à área de CRM/folhas. Fora dela, redireciona
  // para a sua página inicial. O OWNER passa sempre.
  const role = token?.role as Role | undefined
  if (isLogged && !isPublic && role === 'EMPLOYEE' && !canAccess('EMPLOYEE', pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = EMPLOYEE_HOME
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/uploads).*)'],
}
