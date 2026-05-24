'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import { saveUpload, deleteUpload } from '@/lib/uploads'

export async function getCompanyProfile() {
  return prisma.companyProfile.findFirst() ?? null
}

export async function saveCompanyProfile(_prev: unknown, formData: FormData) {
  await requireOwner()

  const nome         = (formData.get('nome')         as string | null)?.trim() ?? ''
  const nif          = (formData.get('nif')          as string | null)?.trim() ?? ''
  const morada       = (formData.get('morada')       as string | null)?.trim() ?? ''
  const codigoPostal = (formData.get('codigoPostal') as string | null)?.trim() ?? ''
  const cidade       = (formData.get('cidade')       as string | null)?.trim() ?? ''
  const pais         = (formData.get('pais')         as string | null)?.trim() ?? 'Portugal'
  const telefone     = (formData.get('telefone')     as string | null)?.trim() ?? ''
  const email        = (formData.get('email')        as string | null)?.trim() ?? ''
  const website      = (formData.get('website')      as string | null)?.trim() ?? ''

  // Upload de logo (opcional)
  const logoFile = formData.get('logo') as File | null
  let logoPath: string | undefined = undefined

  if (logoFile && logoFile.size > 0) {
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(logoFile.type)) {
      return { ok: false, message: 'Formato de logo inválido. Use PNG, JPG, SVG ou WebP.' }
    }
    if (logoFile.size > 2 * 1024 * 1024) {
      return { ok: false, message: 'Logo demasiado grande (máx. 2 MB).' }
    }

    // Apagar logo anterior
    const existing = await prisma.companyProfile.findFirst({ select: { logoPath: true } })
    if (existing?.logoPath) {
      await deleteUpload(existing.logoPath).catch(() => null)
    }

    const saved = await saveUpload(logoFile)
    logoPath = saved.storagePath
  }

  await prisma.companyProfile.upsert({
    where:  { id: 'default' },
    create: { id: 'default', nome, nif, morada, codigoPostal, cidade, pais, telefone, email, website, logoPath },
    update: { nome, nif, morada, codigoPostal, cidade, pais, telefone, email, website, ...(logoPath !== undefined && { logoPath }) },
  })

  revalidatePath('/definicoes/empresa')
  revalidatePath('/api/company-logo')
  return { ok: true }
}

export async function removeLogo() {
  await requireOwner()
  const profile = await prisma.companyProfile.findFirst({ select: { logoPath: true } })
  if (profile?.logoPath) {
    await deleteUpload(profile.logoPath).catch(() => null)
    await prisma.companyProfile.update({ where: { id: 'default' }, data: { logoPath: null } })
  }
  revalidatePath('/definicoes/empresa')
  revalidatePath('/api/company-logo')
  return { ok: true }
}
