import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { LoginForm } from './LoginForm'
import { ShiftLogo } from '@/components/ShiftLogo'
import { EMPLOYEE_HOME } from '@/lib/access'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  let session = null
  try {
    session = await auth()
  } catch {
    // cookie de sessão inválido/expirado — ignora e mostra o login normalmente
  }
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { active: true, role: true },
    })
    if (user?.active) redirect(user.role === 'EMPLOYEE' ? EMPLOYEE_HOME : '/dashboard')
  }

  const { callbackUrl, error } = await searchParams

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg,#1e1b4b,#312e81)' }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <ShiftLogo size={40} />
            <p className="text-zinc-500 text-sm mt-3">Gestão de caixa da oficina</p>
          </div>

          <h2 className="text-lg font-bold text-zinc-900 text-center mb-6">Entrar no Shift</h2>
          <LoginForm callbackUrl={callbackUrl} initialError={error} />
        </div>

        <p className="text-center text-xs text-white/50 mt-6">v0.1 · dev</p>
      </div>
    </div>
  )
}
