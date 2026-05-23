import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptSecret } from '@/lib/crypto'
import { requireOwner } from '@/lib/current-user'
import { exchangeMoloniCode, fetchMoloniCompanies, getMoloniConfig, tokenExpiryDate } from '@/lib/moloni'
import { logAudit } from '@/lib/audit'

function appUrl(req: NextRequest, path: string) {
  // Prefer the configured public callback origin so the browser stays on the
  // tunnel URL after OAuth instead of being kicked back to localhost. Fall
  // back to forwarded headers, then NEXTAUTH_URL, then localhost.
  const redirectUri = process.env.MOLONI_REDIRECT_URI
  if (redirectUri) {
    try { return new URL(path, new URL(redirectUri).origin) } catch {}
  }
  const fwdHost = req.headers.get('x-forwarded-host')
  const fwdProto = req.headers.get('x-forwarded-proto') ?? 'https'
  if (fwdHost) return new URL(path, `${fwdProto}://${fwdHost}`)
  return new URL(path, process.env.NEXTAUTH_URL || 'http://localhost:3000')
}

export async function GET(req: NextRequest) {
  await requireOwner()
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expectedState = req.cookies.get('moloni_oauth_state')?.value

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(appUrl(req,'/integracoes/moloni?error=invalid_state'))
  }

  const config = getMoloniConfig()
  if (!config.clientId || !config.redirectUri) {
    return NextResponse.redirect(appUrl(req,'/integracoes/moloni?error=missing_config'))
  }

  try {
    const tokens = await exchangeMoloniCode(code)
    const connection = await prisma.moloniConnection.create({
      data: {
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: tokenExpiryDate(tokens.expires_in),
      },
    })

    const companies = await fetchMoloniCompanies(connection.id).catch(() => [])
    const firstCompany = companies[0]
    if (firstCompany) {
      await prisma.moloniConnection.update({
        where: { id: connection.id },
        data: {
          companyId: firstCompany.company_id,
          companyName: firstCompany.name,
          companyVat: firstCompany.vat ?? null,
        },
      })
    }

    await logAudit({
      entityType: 'MOLONI_CONNECTION',
      entityId: connection.id,
      action: 'CREATE',
      summary: 'Moloni conectado',
      after: { companyId: firstCompany?.company_id, companyName: firstCompany?.name },
    })

    const res = NextResponse.redirect(appUrl(req,'/integracoes/moloni?connected=1'))
    res.cookies.delete('moloni_oauth_state')
    return res
  } catch (e) {
    console.error('[moloni] callback error', e)
    return NextResponse.redirect(appUrl(req,'/integracoes/moloni?error=callback_failed'))
  }
}
