import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { prisma } from '@/lib/prisma'
import { getUploadFullPath } from '@/lib/uploads'

export async function GET() {
  const profile = await prisma.companyProfile.findFirst()
  if (!profile?.logoPath) {
    return new NextResponse('Sem logo', { status: 404 })
  }

  const fullPath = getUploadFullPath(profile.logoPath)
  if (!existsSync(fullPath)) {
    return new NextResponse('Arquivo não encontrado', { status: 404 })
  }

  const buffer = await readFile(fullPath)
  const ext = profile.logoPath.split('.').pop()?.toLowerCase() ?? 'png'
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
