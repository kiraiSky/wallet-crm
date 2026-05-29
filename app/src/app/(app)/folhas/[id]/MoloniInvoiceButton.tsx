'use client'

import { useState, useTransition } from 'react'
import { FileText, ChevronDown, CheckCircle2, AlertTriangle, ExternalLink, Printer } from 'lucide-react'
import { getMoloniDocumentSets, createMoloniInvoice, getMoloniInvoicePdfUrl } from './moloni-actions'

type Props = {
  workOrderId: string
  moloniDocumentId: number | null
  moloniDocumentType: string | null
  total: number
  customerNome: string
  customerNif: string | null
}

export function MoloniInvoiceButton({ workOrderId, moloniDocumentId, moloniDocumentType, total, customerNome, customerNif }: Props) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'idle' | 'chooseSeries' | 'done' | 'error'>('idle')
  const [sets, setSets] = useState<Array<{ document_set_id: number; name: string }>>([])
  const [selectedSet, setSelectedSet] = useState<number | null>(null)
  const [docType, setDocType] = useState<'invoices' | 'quotes'>('invoices')
  const [customerMode, setCustomerMode] = useState<'final' | 'identified'>(customerNif ? 'identified' : 'final')
  const [customNif, setCustomNif] = useState<string>(customerNif ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [createdDocId, setCreatedDocId] = useState<number | null>(null)

  // Já faturada — mostrar badge + botão de imprimir
  if (moloniDocumentId) {
    return (
      <div className="inline-flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-2 text-sm text-indigo-700 font-medium bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4" />
          Faturado no Moloni ({moloniDocumentType} #{moloniDocumentId})
        </div>
        <PrintInvoiceButton workOrderId={workOrderId} />
      </div>
    )
  }

  function loadSets(currentDocType: 'invoices' | 'quotes' = docType) {
    startTransition(async () => {
      const result = await getMoloniDocumentSets()
      if (result.ok && result.sets) {
        setSets(result.sets)
        const prefix = DOC_TYPE_META[currentDocType].prefix
        const match = result.sets.find((s) => s.name.toUpperCase().startsWith(prefix)) ?? result.sets[0]
        setSelectedSet(match?.document_set_id ?? null)
      } else {
        setMessage(result.message ?? 'Erro ao carregar séries')
        setStep('error')
      }
    })
  }

  function openModal() {
    setStep('chooseSeries')
    setMessage(null)
    // Reset com base nos dados do cliente da folha
    setCustomerMode(customerNif ? 'identified' : 'final')
    setCustomNif(customerNif ?? '')
    setOpen(true)
    loadSets()
  }

  const DOC_TYPE_META = {
    invoices: { label: 'Fatura (FT)', prefix: 'FT' },
    quotes:   { label: 'Orçamento (OR)', prefix: 'OR' },
  } as const

  function handleDocTypeChange(type: 'invoices' | 'quotes') {
    setDocType(type)
    // Seleccionar automaticamente a 1ª série compatível
    const prefix = DOC_TYPE_META[type].prefix
    const match = sets.find((s) => s.name.toUpperCase().startsWith(prefix)) ?? sets[0]
    if (match) setSelectedSet(match.document_set_id)
  }

  // Séries filtradas pelo tipo de documento seleccionado
  const filteredSets = sets.filter((s) =>
    s.name.toUpperCase().startsWith(DOC_TYPE_META[docType].prefix)
  ).length > 0
    ? sets.filter((s) => s.name.toUpperCase().startsWith(DOC_TYPE_META[docType].prefix))
    : sets

  function submit() {
    if (!selectedSet) return
    // Validação rápida do NIF quando identificado
    if (customerMode === 'identified') {
      const trimmed = customNif.trim()
      if (!/^\d{9}$/.test(trimmed)) {
        setMessage('NIF inválido — deve ter 9 dígitos.')
        setStep('error')
        return
      }
    }
    startTransition(async () => {
      const result = await createMoloniInvoice(workOrderId, selectedSet, docType, {
        customerMode,
        overrideNif: customerMode === 'identified' ? customNif.trim() : null,
      })
      if (result.ok) {
        setCreatedDocId(result.documentId ?? null)
        setStep('done')
      } else {
        setMessage(result.message ?? 'Erro ao criar fatura')
        setStep('error')
      }
    })
  }

  // Componente interno: botão de imprimir PDF da fatura já criada

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
                <h2 className="text-lg font-semibold text-zinc-900 mb-1">Criar documento Moloni</h2>
                <p className="text-sm text-zinc-500 mb-4">Total: <span className="font-semibold text-zinc-900">{total.toFixed(2)} €</span></p>

                <div className="space-y-4">
                  <div>
                    <label className="label">Tipo de documento</label>
                    <div className="flex gap-2 mt-1">
                      {(['invoices', 'quotes'] as const).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleDocTypeChange(val)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            docType === val
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          {DOC_TYPE_META[val].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Cliente</label>
                    <div className="flex gap-2 mt-1">
                      {([
                        { val: 'identified', label: 'Cliente identificado' },
                        { val: 'final', label: 'Consumidor Final' },
                      ] as const).map(({ val, label }) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCustomerMode(val)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            customerMode === val
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {customerMode === 'identified' ? (
                      <div className="mt-2">
                        <div className="text-xs text-zinc-500 mb-1">{customerNome}</div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={9}
                          placeholder="NIF (9 dígitos)"
                          value={customNif}
                          onChange={(e) => setCustomNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
                          className="input-base"
                        />
                        {!customerNif && (
                          <p className="text-xs text-amber-600 mt-1">Cliente sem NIF gravado — preencha para faturar identificado.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 mt-2">Será emitido como Consumidor Final (NIF 999999990).</p>
                    )}
                  </div>

                  <div>
                    <label className="label">Série documental</label>
                    {pending ? (
                      <div className="text-sm text-zinc-400 py-2">A carregar séries...</div>
                    ) : filteredSets.length === 0 ? (
                      <div className="text-sm text-amber-600">Nenhuma série encontrada no Moloni.</div>
                    ) : (
                      <select
                        className="input-base mt-1"
                        value={selectedSet ?? ''}
                        onChange={(e) => setSelectedSet(Number(e.target.value))}
                      >
                        {filteredSets.map((s) => (
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
                    {pending ? 'A criar...' : `Criar ${DOC_TYPE_META[docType].label}`}
                  </button>
                </div>
              </>
            )}

            {step === 'done' && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-zinc-900 mb-1">{DOC_TYPE_META[docType].label} criada!</h2>
                <p className="text-sm text-zinc-500 mb-4">
                  Documento #{createdDocId} criado no Moloni com sucesso.
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

// ─── Botão de impressão do PDF Moloni ─────────────────────────────────────────

function PrintInvoiceButton({ workOrderId }: { workOrderId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handlePrint() {
    setError(null)
    startTransition(async () => {
      const result = await getMoloniInvoicePdfUrl(workOrderId)
      if (result.ok && result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
      } else {
        setError(result.message ?? 'Erro ao obter PDF')
      }
    })
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handlePrint}
        disabled={pending}
        className="btn-secondary inline-flex items-center gap-2 text-sm"
        title="Abrir PDF da fatura no Moloni"
      >
        <Printer className="w-4 h-4" />
        {pending ? 'A obter PDF...' : 'Imprimir Fatura'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
