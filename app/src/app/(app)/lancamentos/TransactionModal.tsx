'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, X as XIcon, ClipboardList, ChevronDown, CalendarClock } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorIconBg } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { saveTransaction } from './actions'
import type { WorkOrderOption } from './page'

type Account = { id: string; nome: string; cor: string; icone: string }
type Category = {
  id: string
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  cor: string
  icone: string
  parentId?: string | null
}

export type TransactionForModal = {
  id: string
  tipo: 'ENTRADA' | 'SAIDA'
  valor: number
  descricao: string
  data: string
  observacao: string | null
  accountId: string
  categoryId: string
  workOrderId: string | null
  agendado?: boolean
  dataAgendada?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  tipo: 'ENTRADA' | 'SAIDA'
  transaction?: TransactionForModal | null
  accounts: Account[]
  categories: Category[]
  workOrderOptions?: WorkOrderOption[]
  defaultWorkOrderId?: string
  onSaved?: () => void
}

function isoToLocalDatetimeInput(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function TransactionModal({
  open,
  onClose,
  tipo: initialTipo,
  transaction,
  accounts,
  categories,
  workOrderOptions = [],
  defaultWorkOrderId,
  onSaved,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tipo, setTipo] = useState<'ENTRADA' | 'SAIDA'>(transaction?.tipo ?? initialTipo)
  const [valor, setValor] = useState(
    transaction ? transaction.valor.toFixed(2).replace('.', ',') : ''
  )
  const [descricao, setDescricao] = useState(transaction?.descricao ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '')
  const [accountId, setAccountId] = useState(transaction?.accountId ?? (accounts[0]?.id ?? ''))
  const [data, setData] = useState(isoToLocalDatetimeInput(transaction?.data))
  const [observacao, setObservacao] = useState(transaction?.observacao ?? '')
  const [workOrderId, setWorkOrderId] = useState(transaction?.workOrderId ?? defaultWorkOrderId ?? '')
  const [woSearch, setWoSearch] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [agendado, setAgendado] = useState<boolean>(transaction?.agendado ?? false)
  const [dataAgendada, setDataAgendada] = useState(isoToDateInput(transaction?.dataAgendada))
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selectedWO = workOrderOptions.find((wo) => wo.id === workOrderId) ?? null
  const filteredWOs = woSearch
    ? workOrderOptions.filter(
        (wo) =>
          wo.customerNome.toLowerCase().includes(woSearch.toLowerCase()) ||
          wo.problema.toLowerCase().includes(woSearch.toLowerCase()) ||
          String(wo.numero).includes(woSearch)
      )
    : workOrderOptions

  const filteredCategories = categories.filter((c) => c.tipo === tipo)
  const selectedCategory = filteredCategories.find((c) => c.id === categoryId) ?? null
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null
  const selectedCategoryParent = selectedCategory?.parentId
    ? filteredCategories.find((c) => c.id === selectedCategory.parentId) ?? null
    : null

  // Constrói árvore: pais primeiro, depois filhos por baixo
  const categoryTree = (() => {
    const roots = filteredCategories.filter((c) => !c.parentId)
    const list: { cat: Category; child: boolean }[] = []
    for (const r of roots) {
      list.push({ cat: r, child: false })
      const children = filteredCategories
        .filter((c) => c.parentId === r.id)
        .sort((a, b) => a.nome.localeCompare(b.nome))
      for (const c of children) list.push({ cat: c, child: true })
    }
    // Órfãos (parentId aponta para algo fora do filtro, ex: tipo diferente)
    const orphans = filteredCategories.filter(
      (c) => c.parentId && !filteredCategories.some((p) => p.id === c.parentId),
    )
    for (const o of orphans) list.push({ cat: o, child: false })
    return list
  })()

  // Sincroniza o formulário sempre que o modal abre ou muda o movimento a editar
  useEffect(() => {
    if (!open) return
    setTipo(transaction?.tipo ?? initialTipo)
    setValor(transaction ? transaction.valor.toFixed(2).replace('.', ',') : '')
    setDescricao(transaction?.descricao ?? '')
    setCategoryId(transaction?.categoryId ?? '')
    setAccountId(transaction?.accountId ?? (accounts[0]?.id ?? ''))
    setData(isoToLocalDatetimeInput(transaction?.data))
    setObservacao(transaction?.observacao ?? '')
    setWorkOrderId(transaction?.workOrderId ?? defaultWorkOrderId ?? '')
    setWoSearch('')
    setCategoryOpen(false)
    setAccountOpen(false)
    setAgendado(transaction?.agendado ?? false)
    setDataAgendada(isoToDateInput(transaction?.dataAgendada))
    setFile(null)
    setError(null)
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id])

  function reset() {
    setTipo(transaction?.tipo ?? initialTipo)
    setValor(transaction ? transaction.valor.toFixed(2).replace('.', ',') : '')
    setDescricao(transaction?.descricao ?? '')
    setCategoryId(transaction?.categoryId ?? '')
    setAccountId(transaction?.accountId ?? (accounts[0]?.id ?? ''))
    setData(isoToLocalDatetimeInput(transaction?.data))
    setObservacao(transaction?.observacao ?? '')
    setWorkOrderId(transaction?.workOrderId ?? defaultWorkOrderId ?? '')
    setWoSearch('')
    setCategoryOpen(false)
    setAccountOpen(false)
    setAgendado(transaction?.agendado ?? false)
    setDataAgendada(isoToDateInput(transaction?.dataAgendada))
    setFile(null)
    setError(null)
    setErrors({})
  }

  function switchTipo(novoTipo: 'ENTRADA' | 'SAIDA') {
    setTipo(novoTipo)
    // Limpa categoria se ela não pertence ao novo tipo
    const stillValid = categories.find((c) => c.id === categoryId && c.tipo === novoTipo)
    if (!stillValid) setCategoryId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrors({})

    const fd = new FormData()
    if (transaction) fd.set('id', transaction.id)
    fd.set('tipo', tipo)
    fd.set('valor', valor)
    fd.set('descricao', descricao)
    fd.set('data', new Date(data).toISOString())
    fd.set('accountId', accountId)
    fd.set('categoryId', categoryId)
    if (observacao) fd.set('observacao', observacao)
    if (workOrderId) {
      fd.set('workOrderId', workOrderId)
      const wo = workOrderOptions.find((w) => w.id === workOrderId)
      if (wo) fd.set('customerId', wo.customerId)
    }
    if (agendado) {
      fd.set('agendado', 'true')
      if (dataAgendada) fd.set('dataAgendada', dataAgendada)
    }
    if (file) fd.set('attachment', file)

    startTransition(async () => {
      const res = await saveTransaction({ ok: false }, fd)
      if (res.ok) {
        onClose()
        onSaved?.()
        router.refresh()
        reset()
      } else if (res.errors) {
        setErrors(res.errors)
      } else if (res.message) {
        setError(res.message)
      }
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose()
        reset()
      }}
      title={transaction ? 'Editar movimento' : tipo === 'SAIDA' ? 'Nova despesa' : 'Nova receita'}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Toggle tipo */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
          <button
            type="button"
            onClick={() => switchTipo('ENTRADA')}
            className={cn(
              'py-2.5 rounded-lg font-semibold text-sm transition',
              tipo === 'ENTRADA' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-500'
            )}
          >
            ↗ Entrada
          </button>
          <button
            type="button"
            onClick={() => switchTipo('SAIDA')}
            className={cn(
              'py-2.5 rounded-lg font-semibold text-sm transition',
              tipo === 'SAIDA' ? 'bg-white shadow-sm text-rose-600' : 'text-zinc-500'
            )}
          >
            ↙ Saída
          </button>
        </div>

        {/* Valor */}
        <div>
          <label className="label">Valor *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold">€</span>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              required
              autoFocus
              className="input-base !text-2xl !font-bold !py-3 pl-10"
            />
          </div>
          {errors.valor && <p className="text-xs text-red-500 mt-1">{errors.valor}</p>}
        </div>

        {/* Descrição */}
        <div>
          <label className="label">Descrição *</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === 'SAIDA' ? 'Ex: Fatura da luz · EDP' : 'Ex: Salário · Empresa XYZ'}
            required
            className="input-base"
          />
          {errors.descricao && <p className="text-xs text-red-500 mt-1">{errors.descricao}</p>}
        </div>

        {/* Categoria + Caixa */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Categoria *</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoryOpen((v) => !v)}
                className={cn(
                  'input-base text-left flex items-center gap-2 w-full',
                  !categoryId && 'text-zinc-400'
                )}
              >
                {selectedCategory ? (
                  <>
                    <span className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0',
                      colorIconBg[selectedCategory.cor] || colorIconBg.violet
                    )}>
                      <DynamicIcon name={selectedCategory.icone} className="w-3 h-3" />
                    </span>
                    <span className="flex-1 truncate">
                      {selectedCategoryParent ? (
                        <>
                          <span className="text-zinc-400">{selectedCategoryParent.nome}</span>
                          <span className="text-zinc-400 mx-1">›</span>
                          {selectedCategory.nome}
                        </>
                      ) : (
                        selectedCategory.nome
                      )}
                    </span>
                  </>
                ) : (
                  <span className="flex-1">Seleciona...</span>
                )}
                <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              </button>
              {categoryOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCategoryOpen(false)} />
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {categoryTree.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-zinc-400">
                        Sem categorias de {tipo === 'SAIDA' ? 'despesa' : 'receita'}.
                      </div>
                    ) : (
                      categoryTree.map(({ cat: c, child }) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCategoryId(c.id); setCategoryOpen(false) }}
                          className={cn(
                            'w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2.5 text-sm transition',
                            child && 'pl-8',
                            c.id === categoryId && 'bg-zinc-50 font-semibold'
                          )}
                        >
                          {child && <span className="text-zinc-300">└</span>}
                          <span className={cn(
                            'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                            colorIconBg[c.cor] || colorIconBg.violet
                          )}>
                            <DynamicIcon name={c.icone} className="w-3.5 h-3.5" />
                          </span>
                          {c.nome}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            {filteredCategories.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Sem categorias de {tipo === 'SAIDA' ? 'despesa' : 'receita'} registadas.
              </p>
            )}
            {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
          </div>
          <div>
            <label className="label">Conta *</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className={cn(
                  'input-base text-left flex items-center gap-2 w-full',
                  !accountId && 'text-zinc-400'
                )}
              >
                {selectedAccount ? (
                  <>
                    <span className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0',
                      colorIconBg[selectedAccount.cor] || colorIconBg.zinc
                    )}>
                      <DynamicIcon name={selectedAccount.icone} className="w-3 h-3" />
                    </span>
                    <span className="flex-1 truncate">{selectedAccount.nome}</span>
                  </>
                ) : (
                  <span className="flex-1">Seleciona...</span>
                )}
                <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              </button>
              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} />
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
                    {accounts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => { setAccountId(a.id); setAccountOpen(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2.5 text-sm transition',
                          a.id === accountId && 'bg-zinc-50 font-semibold'
                        )}
                      >
                        <span className={cn(
                          'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                          colorIconBg[a.cor] || colorIconBg.zinc
                        )}>
                          <DynamicIcon name={a.icone} className="w-3.5 h-3.5" />
                        </span>
                        {a.nome}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {accounts.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Cria uma conta primeiro.
              </p>
            )}
            {errors.accountId && <p className="text-xs text-red-500 mt-1">{errors.accountId}</p>}
          </div>
        </div>

        {/* Data */}
        <div>
          <label className="label">Data e hora</label>
          <input
            type="datetime-local"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input-base"
          />
        </div>

        {/* Pagamento agendado */}
        <div className={cn(
          'rounded-xl border p-3 transition',
          agendado ? 'bg-amber-50 border-amber-300' : 'bg-zinc-50 border-zinc-200'
        )}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agendado}
              onChange={(e) => setAgendado(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                <CalendarClock className="w-4 h-4 text-amber-600" />
                Pagamento agendado?
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {tipo === 'ENTRADA'
                  ? 'O valor ainda não entrou na conta — fica em amarelo até confirmares.'
                  : 'O pagamento ainda não saiu da conta — fica em amarelo até confirmares.'}
              </div>
            </div>
          </label>
          {agendado && (
            <div className="mt-3 ml-7">
              <label className="label">Data prevista *</label>
              <input
                type="date"
                value={dataAgendada}
                onChange={(e) => setDataAgendada(e.target.value)}
                required
                className="input-base"
              />
              {errors.dataAgendada && (
                <p className="text-xs text-red-500 mt-1">{errors.dataAgendada}</p>
              )}
            </div>
          )}
        </div>

        {/* Folha de obra */}
        {workOrderOptions.length > 0 && (
          <div>
            <label className="label">Folha de obra (opcional)</label>
            {selectedWO ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ClipboardList className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-indigo-900 truncate">
                      #{selectedWO.numero} · {selectedWO.customerNome}
                    </div>
                    <div className="text-xs text-indigo-700 truncate">{selectedWO.problema}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setWorkOrderId(''); setWoSearch('') }}
                  className="text-indigo-600 hover:text-red-500 ml-2 flex-shrink-0"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={woSearch}
                  onChange={(e) => setWoSearch(e.target.value)}
                  placeholder="Pesquisar por cliente ou descrição..."
                  className="input-base"
                />
                {woSearch && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredWOs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-zinc-400">Sem resultados</div>
                    ) : (
                      filteredWOs.slice(0, 8).map((wo) => (
                        <button
                          key={wo.id}
                          type="button"
                          onClick={() => { setWorkOrderId(wo.id); setWoSearch('') }}
                          className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2"
                        >
                          <ClipboardList className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-800">
                              #{wo.numero} · {wo.customerNome}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">{wo.problema}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Upload */}
        <div>
          <label className="label">Comprovativo (opcional)</label>
          {file ? (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <div className="text-sm text-indigo-900 truncate">{file.name}</div>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="text-indigo-700 hover:text-red-600"
                aria-label="Remover"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 px-3 py-4 bg-zinc-50 border-2 border-dashed border-zinc-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-lg cursor-pointer transition">
              <UploadCloud className="w-6 h-6 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-600">Clica para anexar</span>
              <span className="text-[11px] text-zinc-400">JPG, PNG, WebP ou PDF · até 5MB</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          )}
          {errors.attachment && <p className="text-xs text-red-500 mt-1">{errors.attachment}</p>}
        </div>

        {/* Observação */}
        <div>
          <label className="label">Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Notas internas..."
            className="input-base resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onClose()
              reset()
            }}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || accounts.length === 0 || filteredCategories.length === 0}
            className={cn(
              'flex-1',
              tipo === 'SAIDA'
                ? 'btn-danger'
                : 'inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg shadow-sm shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {pending ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
