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
  const photo = await prisma.workOrderPhoto.findUnique({ where: { id } })
  if (!photo) return new NextResponse('Foto nao encontrada', { status: 404 })

  const fullPath = getUploadFullPath(photo.storagePath)
  if (!existsSync(fullPath)) return new NextResponse('Arquivo nao encontrado', { status: 404 })

  const buffer = await readFile(fullPath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': photo.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(photo.filename)}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
