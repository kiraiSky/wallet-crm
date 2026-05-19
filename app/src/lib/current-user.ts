// Sem auth ainda. Retorna o OWNER padrão criado no seed.
// Quando adicionarmos Auth.js, troca-se a implementação aqui sem mexer no resto do app.

import { prisma } from './prisma'

export async function getCurrentUser() {
  const user = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
  })
  if (!user) {
    throw new Error('Nenhum OWNER encontrado. Rode "pnpm prisma db seed" primeiro.')
  }
  return user
}
