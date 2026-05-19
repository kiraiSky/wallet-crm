'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const CategorySchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório').max(40),
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  cor: z.string().default('violet'),
  icone: z.string().default('package'),
})

export type CategoryFormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
}

export async function saveCategory(
  prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const parsed = CategorySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.errors.forEach((e) => {
      errors[e.path.join('.')] = e.message
    })
    return { ok: false, errors }
  }
  const data = parsed.data

  try {
    if (data.id) {
      await prisma.category.update({
        where: { id: data.id },
        data: { nome: data.nome, tipo: data.tipo, cor: data.cor, icone: data.icone },
      })
    } else {
      await prisma.category.create({
        data: { nome: data.nome, tipo: data.tipo, cor: data.cor, icone: data.icone },
      })
    }
    revalidatePath('/categorias')
    revalidatePath('/lancamentos')
    return { ok: true }
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return { ok: false, message: 'Já existe uma categoria com esse nome e tipo.' }
    }
    return { ok: false, message: 'Erro ao guardar categoria' }
  }
}

export async function deleteCategory(id: string): Promise<CategoryFormState> {
  const count = await prisma.transaction.count({ where: { categoryId: id } })
  if (count > 0) {
    await prisma.category.update({ where: { id }, data: { archived: true } })
    revalidatePath('/categorias')
    return { ok: true, message: `Categoria arquivada (${count} movimentos associados).` }
  }
  await prisma.category.delete({ where: { id } })
  revalidatePath('/categorias')
  return { ok: true }
}
