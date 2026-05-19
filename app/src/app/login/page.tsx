import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from './LoginForm'
import { Wallet } from 'lucide-react'

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
  if (session) redirect('/dashboard')

  const { callbackUrl, error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/30 mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Carteira</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestão de caixa da oficina</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
          <h2 className="text-xl font-semibold text-zinc-900 mb-6">Entrar na conta</h2>
          <LoginForm callbackUrl={callbackUrl} initialError={error} />
        </div>

        <p className="text-center text-xs text-zinc-400 mt-6">v0.1 · dev</p>
      </div>
    </div>
  )
}
