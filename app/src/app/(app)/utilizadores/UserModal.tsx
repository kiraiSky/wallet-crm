'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import { saveUser } from './actions'
import type { UserRow } from './page'
import {
  Camera,
  Crown,
  Eye,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  UserRound,
  X,
} from 'lucide-react'
import { compressImageFile } from '@/lib/image-compression'

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
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [processingPhoto, setProcessingPhoto] = useState(false)
  const [pending, start] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  useEffect(() => {
    if (open) {
      setNome(editing?.nome ?? '')
      setEmail(editing?.email ?? '')
      setRole(editing?.role ?? 'EMPLOYEE')
      setSenha('')
      setPhotoFile(null)
      setPhotoPreview(editing?.photoUrl ?? null)
      setRemovePhoto(false)
      setErrors({})
      setErrorMsg(null)
    }
  }, [open, editing])

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  async function handlePhoto(file: File | null) {
    if (!file) return
    setProcessingPhoto(true)
    setErrors((current) => {
      const next = { ...current }
      delete next.photo
      return next
    })
    try {
      const compressed = await compressImageFile(file, { fallbackName: 'foto-utilizador' })
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
      setPhotoFile(compressed)
      setPhotoPreview(URL.createObjectURL(compressed))
      setRemovePhoto(false)
    } catch (e) {
      console.error(e)
      setErrors((current) => ({ ...current, photo: 'Nao foi possivel compactar esta foto.' }))
    } finally {
      setProcessingPhoto(false)
    }
  }

  function clearPhoto() {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    setRemovePhoto(Boolean(editing?.photoUrl))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.delete('photo')
    if (photoFile) formData.set('photo', photoFile)
    if (removePhoto) formData.set('removePhoto', '1')
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

  const displayName = nome.trim() || editing?.nome || 'Novo utilizador'
  const displayEmail = email.trim() || editing?.email || 'email@oficina.pt'
  const modalTitle = editing ? 'Editar utilizador' : 'Novo utilizador'
  const modalDescription = editing
    ? 'Edite as informacoes e permissoes do utilizador.'
    : 'Crie uma nova conta de acesso a oficina.'

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="xl" hideHeader>
      <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <input
          ref={fileInputRef}
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
        />

        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserRound className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-950">{modalTitle}</h2>
              <p className="text-sm text-zinc-500 mt-0.5">{modalDescription}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 flex items-center justify-center flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid md:grid-cols-[320px_1fr]">
            <aside className="border-b border-zinc-200 bg-zinc-50/40 p-6 md:border-b-0 md:border-r md:p-8">
              <div className="flex flex-col items-center text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-36 h-36 rounded-full bg-zinc-100 border border-zinc-200 overflow-visible flex items-center justify-center text-zinc-400 group"
                  title="Escolher foto"
                >
                  <span className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-zinc-100">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt="Foto do utilizador" className="w-full h-full object-cover" />
                    ) : processingPhoto ? (
                      <Loader2 className="w-7 h-7 animate-spin" />
                    ) : (
                      <UserRound className="w-12 h-12" />
                    )}
                  </span>
                  <span className="absolute bottom-1 right-1 w-12 h-12 rounded-full bg-white shadow-lg border border-zinc-100 flex items-center justify-center text-zinc-700 group-hover:text-indigo-600">
                    <Camera className="w-5 h-5" />
                  </span>
                </button>

                <div className="mt-7 text-2xl font-bold text-zinc-950">{displayName}</div>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
                  {role === 'OWNER' ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  {role === 'OWNER' ? 'Proprietario' : 'Colaborador'}
                </div>
                <div className="mt-5 flex max-w-full items-center gap-2 text-sm text-zinc-500">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{displayEmail}</span>
                </div>
              </div>

              <div className="mt-8 border-t border-zinc-200 pt-7">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fotografia</div>
                <p className="mt-4 text-sm leading-6 text-zinc-600">
                  JPG, PNG ou WEBP. A imagem sera compactada automaticamente.
                </p>
                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processingPhoto}
                    className="h-12 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {processingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {photoPreview ? 'Alterar fotografia' : 'Adicionar fotografia'}
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="h-11 rounded-xl px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover fotografia
                    </button>
                  )}
                </div>
                {errors.photo && <p className="text-xs text-rose-600 mt-2">{errors.photo}</p>}
              </div>
            </aside>

            <main className="p-6 md:p-8">
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <User className="w-5 h-5 text-zinc-800" />
                  <h3 className="text-lg font-bold text-zinc-950">Informacao pessoal</h3>
                </div>

                <div className="grid gap-5">
                  <FieldError label="Nome completo" error={errors.nome}>
                    <div className="relative">
                      <input
                        name="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-4 pr-11 text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      />
                      <User className="absolute right-4 top-1/2 w-5 h-5 -translate-y-1/2 text-zinc-400" />
                    </div>
                  </FieldError>

                  <FieldError label="E-mail" error={errors.email}>
                    <div className="relative">
                      <input
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-4 pr-11 text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      />
                      <Mail className="absolute right-4 top-1/2 w-5 h-5 -translate-y-1/2 text-zinc-400" />
                    </div>
                  </FieldError>
                </div>
              </section>

              <section className="mt-9 border-t border-zinc-200 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="w-5 h-5 text-zinc-800" />
                  <h3 className="text-lg font-bold text-zinc-950">Acesso e permissoes</h3>
                </div>

                <label className="block text-sm font-medium text-zinc-800 mb-3">Funcao / Papel</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <RoleCard
                    selected={role === 'OWNER'}
                    icon={<Crown className="w-5 h-5" />}
                    title="Proprietario"
                    description="Acesso total a todas as funcionalidades."
                    onClick={() => setRole('OWNER')}
                  />
                  <RoleCard
                    selected={role === 'EMPLOYEE'}
                    icon={<User className="w-5 h-5" />}
                    title="Colaborador"
                    description="Acesso limitado conforme permissoes atribuidas."
                    onClick={() => setRole('EMPLOYEE')}
                  />
                </div>
                <input type="hidden" name="role" value={role} />

                <div className="mt-7">
                  <label className="block text-sm font-medium text-zinc-800 mb-1.5">
                    {editing ? 'Alterar senha (opcional)' : 'Senha'}
                  </label>
                  <p className="text-sm text-zinc-500 mb-3">
                    {editing ? 'Deixe em branco para manter a senha atual.' : 'Minimo 6 caracteres para acesso inicial.'}
                  </p>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 w-5 h-5 -translate-y-1/2 text-zinc-400" />
                    <input
                      name="senha"
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder={editing ? 'Nova senha' : 'Minimo 6 caracteres'}
                      className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-11 text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    />
                    <Eye className="absolute right-4 top-1/2 w-5 h-5 -translate-y-1/2 text-zinc-400" />
                  </div>
                  {errors.senha && <p className="text-xs text-rose-600 mt-1.5">{errors.senha}</p>}
                </div>
              </section>

              {errorMsg && (
                <div className="mt-6 bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2 rounded-lg">
                  {errorMsg}
                </div>
              )}
            </main>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="h-12 min-w-36 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || processingPhoto}
            className="h-12 min-w-48 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {pending ? 'A guardar...' : editing ? 'Guardar alteracoes' : 'Criar utilizador'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function FieldError({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-800 mb-2">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
    </div>
  )
}

function RoleCard({
  selected,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-28 rounded-xl border p-4 text-left transition flex items-center gap-4 ${
        selected
          ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/10'
          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
      }`}
    >
      <span
        className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          selected ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-600'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-zinc-950">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-zinc-500">{description}</span>
      </span>
      <span
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-indigo-600 bg-indigo-600' : 'border-zinc-300 bg-white'
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
    </button>
  )
}
