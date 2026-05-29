'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, ShieldCheck, Clock } from 'lucide-react'
import { selectMoloniCompany, syncMoloniDocuments, updateAutoSync } from './actions'

type Company = { company_id: number; name: string; vat?: string }

export function MoloniClient({
  connectionId,
  companies,
  selectedCompanyId,
  autoSyncEnabled,
  autoSyncInterval,
}: {
  connectionId: string
  companies: Company[]
  selectedCompanyId: number | null
  autoSyncEnabled: boolean
  autoSyncInterval: number
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(autoSyncEnabled)
  const [syncInterval, setSyncInterval] = useState(autoSyncInterval)

  function sync() {
    setMessage(null)
    startTransition(async () => {
      const result = await syncMoloniDocuments(connectionId)
      setIsError(!result.ok)
      if (result.ok) {
        const parts = [`${result.documentsSaved ?? 0} documentos guardados`]
        if ((result.customersMatched ?? 0) > 0) {
          parts.push(`${result.customersMatched} clientes ligados automaticamente`)
        }
        setMessage(`Sincronização concluída: ${parts.join(' • ')}`)
      } else {
        setMessage(result.message ?? 'Erro ao sincronizar')
      }
    })
  }

  function saveAutoSync(enabled: boolean, interval: number) {
    startTransition(async () => {
      await updateAutoSync(connectionId, enabled, interval)
    })
  }

  return (
    <div className="space-y-4">
      {companies.length > 0 && (
        <div>
          <label className="label">Empresa Moloni</label>
          <select
            value={selectedCompanyId ?? ''}
            onChange={(e) => {
              const value = Number(e.target.value)
              startTransition(async () => {
                const result = await selectMoloniCompany(connectionId, value)
                if (!result.ok) { setIsError(true); setMessage(result.message ?? 'Erro ao escolher empresa') }
              })
            }}
            className="input-base max-w-lg"
          >
            <option value="">Selecionar empresa...</option>
            {companies.map((company) => (
              <option key={company.company_id} value={company.company_id}>
                {company.name}{company.vat ? ` • NIF ${company.vat}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sync automático */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="text-sm font-medium text-zinc-700">Sincronização automática</span>
          <label className="ml-auto flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-indigo-600"
              checked={syncEnabled}
              disabled={pending || !selectedCompanyId}
              onChange={(e) => {
                setSyncEnabled(e.target.checked)
                saveAutoSync(e.target.checked, syncInterval)
              }}
            />
            <span className="text-sm text-zinc-600">{syncEnabled ? 'Ativa' : 'Inativa'}</span>
          </label>
        </div>
        {syncEnabled && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">A cada</span>
            <select
              className="input-base w-auto text-sm"
              value={syncInterval}
              disabled={pending}
              onChange={(e) => {
                const val = Number(e.target.value)
                setSyncInterval(val)
                saveAutoSync(syncEnabled, val)
              }}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hora</option>
              <option value={240}>4 horas</option>
              <option value={1440}>1 dia</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sync}
          disabled={pending || !selectedCompanyId}
          className="btn-primary"
        >
          <RefreshCw className="w-4 h-4" />
          {pending ? 'A sincronizar...' : 'Sincronizar agora'}
        </button>
        <form method="post" action="/api/integrations/moloni/disconnect">
          <button type="submit" disabled={pending} className="btn-secondary text-red-600 hover:bg-red-50">
            Desligar Moloni
          </button>
        </form>
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>
          {message}
        </div>
      )}

      <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-indigo-900 flex gap-2">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
        <p>Tokens ficam cifrados na base de dados. Ao sincronizar, os clientes são ligados automaticamente por NIF.</p>
      </div>
    </div>
  )
}
