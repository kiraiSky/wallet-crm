import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireOwner } from '@/lib/current-user'
import { buildMoloniAuthUrl, getMoloniConfig } from '@/lib/moloni'

export async function GET(req: NextRequest) {
  await requireOwner()
  const config = getMoloniConfig()
  if (!config.configured) {
    return NextResponse.redirect(new URL('/integracoes/moloni?error=missing_config', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }
  // Behind a HTTPS tunnel (Cloudflare/ngrok) req.url is the local origin
  // (http://localhost:3000), not the public one. Reconstruct from forwarded
  // headers so the origin check actually compares public-to-public.
  const fwdHost = req.headers.get('x-forwarded-host')
  const fwdProto = req.headers.get('x-forwarded-proto')
  const host = fwdHost ?? req.headers.get('host')
  const proto = fwdProto ?? new URL(req.url).protocol.replace(':', '')
  const isHttps = proto === 'https'
  const requestOrigin = host ? `${proto}://${host}` : new URL(req.url).origin

  if (config.redirectUri) {
    const callbackOrigin = new URL(config.redirectUri).origin
    if (requestOrigin !== callbackOrigin) {
      return NextResponse.redirect(new URL('/integracoes/moloni?error=wrong_origin', callbackOrigin))
    }
  }

  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(buildMoloniAuthUrl(state))
  res.cookies.set('moloni_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 10 * 60,
  })
  return res
}
