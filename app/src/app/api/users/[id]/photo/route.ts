import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { getUploadFullPath } from '@/lib/uploads'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getCurrentUser()

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: { photoFilename: true, photoStoragePath: true, photoMimeType: true },
  })

  if (!user?.photoStoragePath || !user.photoMimeType) {
    return new NextResponse('Foto nao encontrada', { status: 404 })
  }

  const fullPath = getUploadFullPath(user.photoStoragePath)
  if (!existsSync(fullPath)) return new NextResponse('Arquivo nao encontrado', { status: 404 })

  const buffer = await readFile(fullPath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': user.photoMimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(user.photoFilename ?? 'utilizador.jpg')}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
