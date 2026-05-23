'use client'

import { useState, useTransition } from 'react'
import { FileText, ChevronDown, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import { getMoloniDocumentSets, createMoloniInvoice } from './moloni-actions'

type Props = {
  workOrderId: string
  moloniDocumentId: number | null
  moloniDocumentType: string | null
  total: number
}

export function MoloniInvoiceButton({ workOrderId, moloniDocumentId, moloniDocumentType, total }: Props) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'idle' | 'chooseSeries' | 'done' | 'error'>('idle')
  const [sets, setSets] = useState<Array<{ document_set_id: number; name: string }>>([])
  const [selectedSet, setSelectedSet] = useState<number | null>(null)
  const [docType, setDocType] = useState<'invoices' | 'receipts'>('invoices')
  const [message, setMessage] = useState<string | null>(null)
  const [createdDocId, setCreatedDocId] = useState<number | null>(null)

  // Já faturada
  if (moloniDocumentId) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        <CheckCircle2 className="w-4 h-4" />
        Faturado no Moloni ({moloniDocumentType} #{moloniDocumentId})
      </div>
    )
  }

  function openModal() {
    setStep('chooseSeries')
    setMessage(null)
    setOpen(true)
    startTransition(async () => {
      const result = await getMoloniDocumentSets()
      if (result.ok && result.sets) {
        setSets(result.sets)
        if (result.sets.length > 0) setSelectedSet(result.sets[0].document_set_id)
      } else {
        setMessage(result.message ?? 'Erro ao carregar séries')
        setStep('error')
      }
    })
  }

  function submit() {
    if (!selectedSet) return
    startTransition(async () => {
      const result = await createMoloniInvoice(workOrderId, selectedSet, docType)
      if (result.ok) {
        setCreatedDocId(result.documentId ?? null)
        setStep('done')
      } else {
        setMessage(result.message ?? 'Erro ao criar fatura')
        setStep('error')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={pending}
        className="btn-secondary inline-flex items-center gap-2 text-sm"
      >
        <FileText className="w-4 h-4" />
        Faturar no Moloni
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>

            {step === 'chooseSeries' && (
              <>
                <h2 className="text-lg font-semibold text-zinc-900 mb-1">Criar fatura Moloni</h2>
                <p className="text-sm text-zinc-500 mb-4">Total: <span className="font-semibold text-zinc-900">{total.toFixed(2)} €</span></p>

                <div className="space-y-4">
                  <div>
                    <label className="label">Tipo de documento</label>
                    <div className="flex gap-2 mt-1">
                      {([['invoices', 'Fatura (FT)'], ['receipts', 'Fatura-Recibo (FR)']] as const).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setDocType(val)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            docType === val
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Série documental</label>
                    {pending ? (
                      <div className="text-sm text-zinc-400 py-2">A carregar séries...</div>
                    ) : sets.length === 0 ? (
                      <div className="text-sm text-amber-600">Nenhuma série encontrada no Moloni.</div>
                    ) : (
                      <select
                        className="input-base mt-1"
                        value={selectedSet ?? ''}
                        onChange={(e) => setSelectedSet(Number(e.target.value))}
                      >
                        {sets.map((s) => (
                          <option key={s.document_set_id} value={s.document_set_id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-6 justify-end">
                  <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={pending || !selectedSet}
                    className="btn-primary"
                  >
                    {pending ? 'A criar...' : 'Criar fatura'}
                  </button>
                </div>
              </>
            )}

            {step === 'done' && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-zinc-900 mb-1">Fatura criada!</h2>
                <p className="text-sm text-zinc-500 mb-4">
                  Documento #{createdDocId} criado no Moloni e folha marcada como faturada.
                </p>
                <a
                  href="https://www.moloni.pt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  Ver no Moloni <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button type="button" onClick={() => setOpen(false)} className="btn-primary ml-2">Fechar</button>
              </div>
            )}

            {step === 'error' && (
              <div className="text-center py-4">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-zinc-900 mb-1">Erro ao criar fatura</h2>
                <p className="text-sm text-red-600 mb-4">{message}</p>
                <button type="button" onClick={() => setStep('chooseSeries')} className="btn-secondary mr-2">Tentar de novo</button>
                <button type="button" onClick={() => setOpen(false)} className="btn-primary">Fechar</button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
