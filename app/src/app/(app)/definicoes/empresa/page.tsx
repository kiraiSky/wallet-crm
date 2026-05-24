import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import { EmpresaForm } from './EmpresaForm'

export const dynamic = 'force-dynamic'

export default async function EmpresaPage() {
  await requireOwner()
  const profile = await prisma.companyProfile.findFirst()
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Perfil da Empresa</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Estes dados aparecem nos documentos de impressão das folhas de obra.
        </p>
      </div>
      <EmpresaForm profile={profile} />
    </div>
  )
}
