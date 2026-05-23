'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { selectMoloniCompany, syncMoloniDocuments } from './actions'

type Company = { company_id: number; name: string; vat?: string }

export function MoloniClient({
  connectionId,
  companies,
  selectedCompanyId,
}: {
  connectionId: string
  companies: Company[]
  selectedCompanyId: number | null
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function sync() {
    setMessage(null)
    startTransition(async () => {
      const result = await syncMoloniDocuments(connectionId)
      setMessage(result.ok
        ? `Sincronização concluída: ${result.documentsSaved ?? 0} documentos guardados.`
        : result.message ?? 'Erro ao sincronizar')
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
                if (!result.ok) setMessage(result.message ?? 'Erro ao escolher empresa')
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sync}
          disabled={pending || !selectedCompanyId}
          className="btn-primary"
        >
          <RefreshCw className="w-4 h-4" />
          {pending ? 'A sincronizar...' : 'Sincronizar documentos'}
        </button>
        <form method="post" action="/api/integrations/moloni/disconnect">
          <button type="submit" disabled={pending} className="btn-secondary text-red-600 hover:bg-red-50">
            Desligar Moloni
          </button>
        </form>
      </div>

      {message && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {message}
        </div>
      )}

      <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900 flex gap-2">
        <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>Tokens ficam cifrados no banco e a integração é apenas leitura nesta fase.</p>
      </div>
    </div>
  )
}
