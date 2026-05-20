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
  parentId: z.string().optional(),
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
  const parentId = data.parentId && data.parentId !== '' ? data.parentId : null

  // Validações: pai tem que existir, mesmo tipo, e não pode ele próprio ter pai (2 níveis)
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } })
    if (!parent) return { ok: false, errors: { parentId: 'Categoria pai inválida' } }
    if (parent.tipo !== data.tipo)
      return { ok: false, errors: { parentId: 'Categoria pai tem de ser do mesmo tipo' } }
    if (parent.parentId)
      return { ok: false, errors: { parentId: 'Só são permitidos 2 níveis de subcategoria' } }
    if (data.id && parent.id === data.id)
      return { ok: false, errors: { parentId: 'Uma categoria não pode ser pai de si mesma' } }
  }

  // Não permitir que uma categoria que JÁ TEM FILHOS ganhe um pai (forçaria 3 níveis)
  if (parentId && data.id) {
    const childCount = await prisma.category.count({ where: { parentId: data.id } })
    if (childCount > 0)
      return {
        ok: false,
        errors: { parentId: 'Esta categoria já tem subcategorias, não pode virar subcategoria.' },
      }
  }

  try {
    if (data.id) {
      await prisma.category.update({
        where: { id: data.id },
        data: { nome: data.nome, tipo: data.tipo, cor: data.cor, icone: data.icone, parentId },
      })
    } else {
      await prisma.category.create({
        data: { nome: data.nome, tipo: data.tipo, cor: data.cor, icone: data.icone, parentId },
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
