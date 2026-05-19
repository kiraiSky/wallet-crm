'use client'

import { useState, useTransition } from 'react'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { loginAction } from './actions'

export function LoginForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl?: string
  initialError?: string
}) {
  const [email, setEmail] = useState('joao@carteira.app')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState<string | null>(initialError ? 'Erro ao entrar.' : null)
  const [pending, start] = useTransition()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const result = await loginAction({ email, senha, callbackUrl })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">E-mail</label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Senha</label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
          />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg shadow-sm shadow-emerald-500/20 transition inline-flex items-center justify-center gap-2"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {pending ? 'A entrar…' : 'Entrar'}
      </button>
    </form>
  )
}
