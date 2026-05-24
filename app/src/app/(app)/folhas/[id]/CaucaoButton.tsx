'use client'

import { useState, useTransition } from 'react'
import { Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createCaucao } from './caucao-actions'
import { getMoloniDocumentSets } from './moloni-actions'

type AccountOption = { id: string; nome: string; cor: string; icone: string }
type CategoryOption = { id: string; nome: string; tipo: 'ENTRADA' | 'SAIDA'; parentId: string | null }

type Props = {
  workOrderId: string
  workOrderNumero: number
  customerNome: string
  customerNif: string | null
  totalRestante: number
  accounts: AccountOption[]
  categories: CategoryOption[]
}

export function CaucaoButton({
  workOrderId,
  customerNome,
  customerNif,
  totalRestante,
  accounts,
  categories,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'done' | 'error'>('form')
  const [message, setMessage] = useState<string | null>(null)

  // Form state
  const [valor, setValor] = useState<string>('')
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState<string>('')

  // Transação
  const categoriasEntrada = categories.filter((c) => c.tipo === 'ENTRADA' && c.parentId === null)
  const [criarTransacao, setCriarTransacao] = useState<boolean>(true)
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string>(categoriasEntrada[0]?.id ?? '')

  // Moloni FR
  const [emitirMoloniFR, setEmitirMoloniFR] = useState<boolean>(false)
  const [moloniSets, setMoloniSets] = useState<Array<{ document_set_id: number; name: string }>>([])
  const [moloniSetId, setMoloniSetId] = useState<number | null>(null)
  const [loadingSets, setLoadingSets] = useState(false)
  const [moloniCustomerMode, setMoloniCustomerMode] = useState<'final' | 'identified'>(
    customerNif ? 'identified' : 'final',
  )
  const [moloniNif, setMoloniNif] = useState<string>(customerNif ?? '')

  function reset() {
    setStep('form')
    setMessage(null)
    setValor('')
    setData(new Date().toISOString().slice(0, 10))
    setNotas('')
    setCriarTransacao(true)
    setAccountId(accounts[0]?.id ?? '')
    setCategoryId(categoriasEntrada[0]?.id ?? '')
    setEmitirMoloniFR(false)
    setMoloniSets([])
    setMoloniSetId(null)
    setMoloniCustomerMode(customerNif ? 'identified' : 'final')
    setMoloniNif(customerNif ?? '')
  }

  function openModal() {
    reset()
    setOpen(true)
  }

  function handleToggleMoloni(checked: boolean) {
    setEmitirMoloniFR(checked)
    if (!checked || moloniSets.length > 0) return
    // Lazy-load das séries Moloni
    setLoadingSets(true)
    startTransition(async () => {
      const result = await getMoloniDocumentSets()
      setLoadingSets(false)
      if (result.ok && result.sets) {
        setMoloniSets(result.sets)
        // Preferir séries do tipo FR
        const fr = result.sets.find((s) => /^FR/i.test(s.name)) ?? result.sets[0]
        setMoloniSetId(fr?.document_set_id ?? null)
      } else {
        setMessage(result.message ?? 'Erro a carregar séries Moloni')
        setEmitirMoloniFR(false)
      }
    })
  }

  function submit() {
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (!isFinite(valorNum) || valorNum <= 0) {
      setMessage('Valor inválido.')
      setStep('error')
      return
    }
    if (criarTransacao && !accountId) {
      setMessage('Escolhe uma conta para a transação.')
      setStep('error')
      return
    }
    if (emitirMoloniFR && !moloniSetId) {
      setMessage('Escolhe a série Moloni.')
      setStep('error')
      return
    }
    if (emitirMoloniFR && moloniCustomerMode === 'identified' && !/^\d{9}$/.test(moloniNif.trim())) {
      setMessage('NIF inválido — deve ter 9 dígitos.')
      setStep('error')
      return
    }

    startTransition(async () => {
      const result = await createCaucao({
        workOrderId,
        valor: valorNum,
        data,
        notas: notas.trim() || null,
        criarTransacao,
        accountId: criarTransacao ? accountId : null,
        categoryId: criarTransacao ? (categoryId || null) : null,
        emitirMoloniFR,
        moloniDocumentSetId: emitirMoloniFR ? moloniSetId : null,
        moloniCustomerMode: emitirMoloniFR ? moloniCustomerMode : undefined,
        moloniOverrideNif: emitirMoloniFR && moloniCustomerMode === 'identified' ? moloniNif.trim() : null,
      })
      if (result.ok) {
        setStep('done')
      } else {
        setMessage(result.message ?? 'Erro ao registar caução.')
        setStep('error')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="btn-secondary inline-flex items-center gap-2 text-sm"
        title="Registar caução / adiantamento"
      >
        <Wallet className="w-4 h-4" />
        Registar caução
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

            {step === 'form' && (
              <>
                <h2 className="text-lg font-semibold text-zinc-900 mb-1">Registar caução</h2>
                <p className="text-sm text-zinc-500 mb-4">
                  Restante a faturar: <span className="font-semibold text-zinc-900">{totalRestante.toFixed(2)} €</span>
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Valor (€)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder="0,00"
                        className="input-base"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="label">Data</label>
                      <input
                        type="date"
                        value={data}
                        onChange={(e) => setData(e.target.value)}
                        className="input-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Notas (opcional)</label>
                    <input
                      type="text"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Ex: 30% adiantado por MB Way"
                      className="input-base"
                    />
                  </div>

                  {/* ─── Toggle: criar transação ─────────────────────────── */}
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={criarTransacao}
                        onChange={(e) => setCriarTransacao(e.target.checked)}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm font-medium text-zinc-800">Registar entrada na conta</span>
                    </label>
                    {criarTransacao && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Conta</label>
                          <select
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            className="input-base"
                          >
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Categoria</label>
                          <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="input-base"
                          >
                            <option value="">— sem categoria —</option>
                            {categoriasEntrada.map((c) => (
                              <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ─── Toggle: emitir FR Moloni ────────────────────────── */}
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emitirMoloniFR}
                        onChange={(e) => handleToggleMoloni(e.target.checked)}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm font-medium text-zinc-800">Emitir Fatura-Recibo (FR) no Moloni</span>
                    </label>
                    <p className="text-xs text-zinc-500 mt-1">
                      Obrigatório por lei: cada adiantamento recebido tem de ter fatura própria (Dec.-Lei 197/2012).
                    </p>
                    {emitirMoloniFR && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="label">Série Moloni</label>
                          {loadingSets ? (
                            <div className="text-sm text-zinc-400 py-2">A carregar séries…</div>
                          ) : (
                            <select
                              value={moloniSetId ?? ''}
                              onChange={(e) => setMoloniSetId(Number(e.target.value))}
                              className="input-base"
                            >
                              <option value="">— escolher —</option>
                              {moloniSets.map((s) => (
                                <option key={s.document_set_id} value={s.document_set_id}>{s.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div>
                          <label className="label">Cliente</label>
                          <div className="flex gap-2">
                            {([
                              { val: 'identified', label: 'Identificado' },
                              { val: 'final', label: 'Consumidor Final' },
                            ] as const).map(({ val, label }) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setMoloniCustomerMode(val)}
                                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                  moloniCustomerMode === val
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {moloniCustomerMode === 'identified' && (
                            <div className="mt-2">
                              <div className="text-xs text-zinc-500 mb-1">{customerNome}</div>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={9}
                                placeholder="NIF (9 dígitos)"
                                value={moloniNif}
                                onChange={(e) => setMoloniNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                className="input-base"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-6 justify-end">
                  <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={pending || !valor}
                    className="btn-primary"
                  >
                    {pending ? 'A guardar…' : 'Registar caução'}
                  </button>
                </div>
              </>
            )}

            {step === 'done' && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-zinc-900 mb-1">Caução registada</h2>
                <p className="text-sm text-zinc-500 mb-4">
                  {emitirMoloniFR ? 'FR emitida no Moloni e ' : ''}
                  {criarTransacao ? 'entrada criada na conta.' : 'registada na folha.'}
                </p>
                <button type="button" onClick={() => setOpen(false)} className="btn-primary">Fechar</button>
              </div>
            )}

            {step === 'error' && (
              <div className="text-center py-4">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-zinc-900 mb-1">Não foi possível</h2>
                <p className="text-sm text-red-600 mb-4">{message}</p>
                <button type="button" onClick={() => setStep('form')} className="btn-secondary mr-2">Voltar</button>
                <button type="button" onClick={() => setOpen(false)} className="btn-primary">Fechar</button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
