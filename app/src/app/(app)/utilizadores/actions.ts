'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'

const UserSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório').max(80),
  email: z.string().email('E-mail inválido').max(120),
  role: z.enum(['OWNER', 'EMPLOYEE']),
  senha: z.string().optional(),
})

export type UserFormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
}

export async function saveUser(prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireOwner()

  const raw = Object.fromEntries(formData)
  const parsed = UserSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.errors.forEach((e) => {
      errors[e.path.join('.')] = e.message
    })
    return { ok: false, errors }
  }
  const data = parsed.data
  const email = data.email.toLowerCase().trim()

  try {
    if (data.id) {
      const update: { nome: string; email: string; role: 'OWNER' | 'EMPLOYEE'; senha?: string } = {
        nome: data.nome,
        email,
        role: data.role,
      }
      if (data.senha && data.senha.length > 0) {
        if (data.senha.length < 6) {
          return { ok: false, errors: { senha: 'Mínimo 6 caracteres' } }
        }
        update.senha = await bcrypt.hash(data.senha, 10)
      }
      await prisma.user.update({ where: { id: data.id }, data: update })
    } else {
      if (!data.senha || data.senha.length < 6) {
        return { ok: false, errors: { senha: 'Senha obrigatória (mínimo 6 caracteres)' } }
      }
      const senha = await bcrypt.hash(data.senha, 10)
      await prisma.user.create({
        data: { nome: data.nome, email, senha, role: data.role },
      })
    }
    revalidatePath('/utilizadores')
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'E-mail já registado.' : 'Erro ao guardar utilizador.'
    return { ok: false, message: msg, errors: msg === 'E-mail já registado.' ? { email: msg } : undefined }
  }
}

export async function toggleUserActive(id: string): Promise<UserFormState> {
  const owner = await requireOwner()
  if (owner.id === id) {
    return { ok: false, message: 'Não podes desativar a tua própria conta.' }
  }
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return { ok: false, message: 'Utilizador não encontrado.' }
  await prisma.user.update({ where: { id }, data: { active: !user.active } })
  revalidatePath('/utilizadores')
  return { ok: true }
}

export async function deleteUser(id: string): Promise<UserFormState> {
  const owner = await requireOwner()
  if (owner.id === id) {
    return { ok: false, message: 'Não podes eliminar a tua própria conta.' }
  }
  const count = await prisma.transaction.count({ where: { userId: id } })
  if (count > 0) {
    await prisma.user.update({ where: { id }, data: { active: false } })
    revalidatePath('/utilizadores')
    return { ok: true, message: `Utilizador desativado (${count} movimentos associados).` }
  }
  await prisma.user.delete({ where: { id } })
  revalidatePath('/utilizadores')
  return { ok: true }
}
