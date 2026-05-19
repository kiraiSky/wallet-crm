// Storage de anexos no disco local (volume Docker em produção)
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')

export async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function saveUpload(file: File): Promise<{
  filename: string
  storagePath: string
  mimeType: string
  size: number
}> {
  await ensureUploadDir()
  const ext = path.extname(file.name) || ''
  const storageName = `${randomUUID()}${ext}`
  const fullPath = path.join(UPLOAD_DIR, storageName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(fullPath, buffer)
  return {
    filename: file.name,
    storagePath: storageName, // só o nome do arquivo (relativo ao UPLOAD_DIR)
    mimeType: file.type,
    size: file.size,
  }
}

export async function deleteUpload(storagePath: string): Promise<void> {
  const fullPath = path.join(UPLOAD_DIR, storagePath)
  if (existsSync(fullPath)) {
    await unlink(fullPath)
  }
}

export function getUploadFullPath(storagePath: string): string {
  return path.join(UPLOAD_DIR, storagePath)
}
