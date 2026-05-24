'use client'

import { useActionState, useRef, useState } from 'react'
import { Building2, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { saveCompanyProfile, removeLogo } from './actions'
import Image from 'next/image'

type Profile = {
  id: string
  nome: string
  nif: string
  morada: string
  codigoPostal: string
  cidade: string
  pais: string
  telefone: string
  email: string
  website: string
  logoPath: string | null
} | null

export function EmpresaForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(saveCompanyProfile, null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [hasLogo, setHasLogo] = useState(!!profile?.logoPath)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleRemoveLogo() {
    setRemovingLogo(true)
    await removeLogo()
    setHasLogo(false)
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
    setRemovingLogo(false)
  }

  const logoSrc = previewUrl ?? (hasLogo ? `/api/company-logo?t=${Date.now()}` : null)

  return (
    <form action={action} className="space-y-6">
      {/* Feedback */}
      {state?.ok === true && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Dados guardados com sucesso.
        </div>
      )}
      {state?.ok === false && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {state.message}
        </div>
      )}

      {/* Logo */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Logo da Empresa
        </h2>
        <div className="flex items-start gap-4">
          <div className="w-32 h-20 border-2 border-dashed border-zinc-200 rounded-lg flex items-center justify-center bg-zinc-50 overflow-hidden flex-shrink-0">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
            ) : (
              <span className="text-xs text-zinc-400 text-center px-2">Sem logo</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={handleFileChange}
              className="hidden"
              id="logo-input"
            />
            <label
              htmlFor="logo-input"
              className="btn-secondary inline-flex items-center gap-2 text-sm cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {logoSrc ? 'Alterar logo' : 'Carregar logo'}
            </label>
            {(logoSrc) && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={removingLogo}
                className="ml-2 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                {removingLogo ? 'A remover…' : 'Remover'}
              </button>
            )}
            <p className="text-xs text-zinc-400">PNG, JPG, SVG ou WebP · Máx. 2 MB</p>
          </div>
        </div>
      </div>

      {/* Dados */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 mb-2">Dados da Empresa</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Nome da empresa *</label>
            <input
              name="nome"
              defaultValue={profile?.nome ?? ''}
              className="input-base mt-1"
              placeholder="Realidade Visionária - unipessoal lda"
              required
            />
          </div>

          <div>
            <label className="label">NIF / Contribuinte</label>
            <input
              name="nif"
              defaultValue={profile?.nif ?? ''}
              className="input-base mt-1"
              placeholder="518624935"
            />
          </div>

          <div>
            <label className="label">Telefone</label>
            <input
              name="telefone"
              defaultValue={profile?.telefone ?? ''}
              className="input-base mt-1"
              placeholder="+351 912 345 678"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">E-mail</label>
            <input
              name="email"
              type="email"
              defaultValue={profile?.email ?? ''}
              className="input-base mt-1"
              placeholder="Marcola.garagem@gmail.com"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Morada</label>
            <input
              name="morada"
              defaultValue={profile?.morada ?? ''}
              className="input-base mt-1"
              placeholder="Caminho da Cascalheira s/n"
            />
          </div>

          <div>
            <label className="label">Código Postal</label>
            <input
              name="codigoPostal"
              defaultValue={profile?.codigoPostal ?? ''}
              className="input-base mt-1"
              placeholder="8125-018"
            />
          </div>

          <div>
            <label className="label">Cidade</label>
            <input
              name="cidade"
              defaultValue={profile?.cidade ?? ''}
              className="input-base mt-1"
              placeholder="Quarteira"
            />
          </div>

          <div>
            <label className="label">País</label>
            <input
              name="pais"
              defaultValue={profile?.pais ?? 'Portugal'}
              className="input-base mt-1"
            />
          </div>

          <div>
            <label className="label">Website</label>
            <input
              name="website"
              defaultValue={profile?.website ?? ''}
              className="input-base mt-1"
              placeholder="www.marcolagaragem.com"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'A guardar…' : 'Guardar alterações'}
        </button>
      </div>
    </form>
  )
}
