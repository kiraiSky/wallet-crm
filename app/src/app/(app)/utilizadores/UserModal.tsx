'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Modal } from '@/components/Modal'
import { saveUser } from './actions'
import type { UserRow } from './page'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  editing: UserRow | null
  onSaved: () => void
}

export function UserModal({ open, onClose, editing, onSaved }: Props) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'OWNER' | 'EMPLOYEE'>('EMPLOYEE')
  const [senha, setSenha] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  useEffect(() => {
    if (open) {
      setNome(editing?.nome ?? '')
      setEmail(editing?.email ?? '')
      setRole(editing?.role ?? 'EMPLOYEE')
      setSenha('')
      setErrors({})
      setErrorMsg(null)
    }
  }, [open, editing])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    start(async () => {
      const result = await saveUser({ ok: false }, formData)
      if (result.ok) {
        onSavedRef.current()
      } else {
        setErrors(result.errors ?? {})
        setErrorMsg(result.message ?? null)
      }
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar utilizador' : 'Novo utilizador'}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {editing && <input type="hidden" name="id" value={editing.id} />}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nome</label>
          <input
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
          {errors.nome && <p className="text-xs text-rose-600 mt-1">{errors.nome}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">E-mail</label>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
          {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Papel</label>
          <div className="grid grid-cols-2 gap-2">
            {(['OWNER', 'EMPLOYEE'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                  role === r
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {r === 'OWNER' ? 'Proprietário' : 'Colaborador'}
              </button>
            ))}
          </div>
          <input type="hidden" name="role" value={role} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            {editing ? 'Nova senha (deixar vazio para manter)' : 'Senha'}
          </label>
          <input
            name="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={editing ? '••••••••' : 'mínimo 6 caracteres'}
            className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
          {errors.senha && <p className="text-xs text-rose-600 mt-1">{errors.senha}</p>}
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2 rounded-lg">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {pending ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
