'use client'

import { useRef, useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Car,
  CheckCircle2,
  ClipboardList,
  ImageIcon,
  Loader2,
  Phone,
  Plus,
  Search,
  UserPlus,
  UserRound,
} from 'lucide-react'
import { Modal } from '@/components/Modal'
import { saveWorkOrder } from './actions'
import { STATUS_META, type WorkOrderStatus } from './status'
import { saveCustomer, saveVehicle } from '../clientes/actions'
import { saveWorkOrderPhoto, type WorkOrderPhotoSlot } from './[id]/photo-actions'
import type { CustomerOption, UserOption } from './page'
import { cn } from '@/lib/utils'
import { compressImageFile } from '@/lib/image-compression'

export type WorkOrderForModal = {
  id: string
  customerId: string
  vehicleId: string | null
  problema: string
  diagnostico: string | null
  trabalho: string | null
  observacoes: string | null
  kmEntrada: number | null
  dataPrevista: string | null // ISO
  responsibleId: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  workOrder: WorkOrderForModal | null
  customers: CustomerOption[]
  users: UserOption[]
  defaultCustomerId?: string
}

type VehicleOption = {
  id: string
  matricula: string
  marca: string
  modelo: string
  ano?: number | null
  cor?: string | null
  km?: number | null
  observacoes?: string | null
  workOrders?: {
    id: string
    numero: number
    estado: string
    problema: string
    dataAbertura: string
    dataConclusao: string | null
  }[]
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function initialState(w: WorkOrderForModal | null, defaultCustomerId?: string) {
  return {
    customerId: w?.customerId ?? defaultCustomerId ?? '',
    vehicleId: w?.vehicleId ?? '',
    problema: w?.problema ?? '',
    diagnostico: w?.diagnostico ?? '',
    trabalho: w?.trabalho ?? '',
    observacoes: w?.observacoes ?? '',
    kmEntrada: w?.kmEntrada !== null && w?.kmEntrada !== undefined ? String(w.kmEntrada) : '',
    dataPrevista: isoToDateInput(w?.dataPrevista ?? null),
    responsibleId: w?.responsibleId ?? '',
  }
}

const INTAKE_PHOTO_SLOTS: {
  slot: WorkOrderPhotoSlot
  title: string
  required?: boolean
}[] = [
  { slot: 'FRONT', title: 'Frente', required: true },
  { slot: 'LEFT_SIDE', title: 'Lado esquerdo' },
  { slot: 'RIGHT_SIDE', title: 'Lado direito' },
  { slot: 'REAR', title: 'Traseira' },
  { slot: 'INTERIOR', title: 'Interior' },
  { slot: 'ODOMETER', title: 'Painel / km' },
  { slot: 'DAMAGE', title: 'Danos / detalhes' },
  { slot: 'EXTRA', title: 'Extra' },
]

export function WorkOrderModal(props: Props) {
  if (!props.workOrder) return <CreateWorkOrderWizard {...props} />
  return <EditWorkOrderModal {...props} workOrder={props.workOrder} />
}

function CreateWorkOrderWizard({
  open,
  onClose,
  customers,
  users,
  defaultCustomerId,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [pending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)
  const busy = pending || submitting

  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '')
  const [createdCustomer, setCreatedCustomer] = useState<CustomerOption | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [vehicleId, setVehicleId] = useState('')
  const [vehicleMode, setVehicleMode] = useState<'new' | 'existing' | null>(null)
  const [creatingVehicle, setCreatingVehicle] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({
    matricula: '',
    marca: '',
    modelo: '',
    ano: '',
    cor: '',
    km: '',
    observacoes: '',
  })

  const [problema, setProblema] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [mainPhoto, setMainPhoto] = useState<File | null>(null)
  const [mainPhotoPreview, setMainPhotoPreview] = useState<string | null>(null)
  const [takeAllPhotos, setTakeAllPhotos] = useState(false)
  const [extraPhotos, setExtraPhotos] = useState<Partial<Record<WorkOrderPhotoSlot, File>>>({})
  const [extraPreviews, setExtraPreviews] = useState<Partial<Record<WorkOrderPhotoSlot, string>>>({})
  const [processingSlot, setProcessingSlot] = useState<WorkOrderPhotoSlot | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const wasOpen = useRef(false)

  const selectedCustomer = useMemo(
    () => createdCustomer ?? customers.find((customer) => customer.id === customerId) ?? null,
    [createdCustomer, customers, customerId]
  )
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
    [vehicles, vehicleId]
  )

  const customerMatches = useMemo(() => {
    const query = normalizeSearch(customerQuery)
    if (!query) return customers.slice(0, 8)
    return customers
      .filter((customer) => {
        const haystack = normalizeSearch([
          customer.nome,
          customer.nif ?? '',
          customer.telefone ?? '',
        ].join(' '))
        return haystack.includes(query)
      })
      .slice(0, 8)
  }, [customers, customerQuery])

  useEffect(() => {
    // Só reinicia o assistente na transição fechado → aberto. Caso contrário, uma
    // server action (ex.: criar cliente) revalida a rota /folhas, troca a referência
    // do array `customers` e este efeito limpava tudo de volta ao passo 1.
    if (!open) {
      wasOpen.current = false
      return
    }
    if (wasOpen.current) return
    wasOpen.current = true

    const initialCustomer = customers.find((customer) => customer.id === defaultCustomerId)
    setStep(1)
    setCustomerId(defaultCustomerId ?? '')
    setCreatedCustomer(null)
    setCustomerQuery(initialCustomer?.nome ?? '')
    setCustomerSearchOpen(false)
    setCreatingCustomer(false)
    setNewCustomerName('')
    setNewCustomerPhone('')
    setVehicles([])
    setVehicleId('')
    setVehicleMode(null)
    setCreatingVehicle(false)
    setVehicleForm({ matricula: '', marca: '', modelo: '', ano: '', cor: '', km: '', observacoes: '' })
    setProblema('')
    setResponsibleId('')
    clearPhotoState()
    setErrors({})
    setError(null)
  }, [open, defaultCustomerId, customers])

  useEffect(() => {
    if (!customerId) {
      setVehicles([])
      setVehicleMode(null)
      return
    }
    let cancelled = false
    fetch(`/api/customers/${customerId}/vehicles`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const nextVehicles = data.vehicles ?? []
          setVehicles(nextVehicles)
          setVehicleMode((current) => current ?? (nextVehicles.length > 0 ? 'existing' : 'new'))
          setCreatingVehicle(nextVehicles.length === 0)
        }
      })
      .catch(() => {
        if (!cancelled) setVehicles([])
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  function clearPhotoState() {
    if (mainPhotoPreview) URL.revokeObjectURL(mainPhotoPreview)
    Object.values(extraPreviews).forEach((url) => {
      if (url) URL.revokeObjectURL(url)
    })
    setMainPhoto(null)
    setMainPhotoPreview(null)
    setTakeAllPhotos(false)
    setExtraPhotos({})
    setExtraPreviews({})
    setProcessingSlot(null)
  }

  function selectCustomer(customer: CustomerOption) {
    setCustomerId(customer.id)
    setCreatedCustomer(null)
    setCustomerQuery(customer.nome)
    setCustomerSearchOpen(false)
    setCreatingCustomer(false)
    setVehicleId('')
    setVehicleMode(null)
    setErrors((current) => omitKeys(current, ['customerId', 'nome', 'telefone']))
  }

  function chooseCreateCustomer() {
    const name = customerQuery.trim()
    setCreatingCustomer(true)
    setCustomerId('')
    setCreatedCustomer(null)
    setNewCustomerName(name)
    setCustomerSearchOpen(false)
  }

  function goToCustomerStep() {
    setStep(1)
  }

  function goToVehicleStep() {
    setError(null)
    setErrors({})

    if (customerId) {
      setStep(2)
      return
    }

    if (!creatingCustomer) {
      setErrors({ customerId: 'Escolhe um cliente ou cria um novo.' })
      return
    }

    const fd = new FormData()
    fd.set('nome', newCustomerName.trim())
    if (newCustomerPhone.trim()) fd.set('telefone', newCustomerPhone.trim())
    fd.set('tag', 'NOVO')
    fd.set('linguagem', 'pt')

    startTransition(async () => {
      const res = await saveCustomer({ ok: false }, fd)
      if (res.ok && res.id) {
        const customer = {
          id: res.id,
          nome: newCustomerName.trim(),
          telefone: newCustomerPhone.trim() || null,
          nif: null,
          createdAt: new Date().toISOString(),
        }
        setCreatedCustomer(customer)
        setCustomerId(res.id)
        setCustomerQuery(customer.nome)
        setStep(2)
      } else if (res.errors) {
        setErrors(res.errors)
      } else {
        setError(res.message ?? 'Nao foi possivel criar o cliente.')
      }
    })
  }

  function goToPhotoStep() {
    setError(null)
    setErrors({})

    if (vehicleId) {
      setStep(3)
      return
    }

    const shouldCreateVehicle = vehicleMode === 'new' || creatingVehicle || vehicles.length === 0
    if (!shouldCreateVehicle) {
      setErrors({ vehicleId: 'Escolhe uma viatura ou cria uma nova.' })
      return
    }

    const fd = new FormData()
    fd.set('customerId', customerId)
    fd.set('matricula', vehicleForm.matricula)
    fd.set('marca', vehicleForm.marca)
    fd.set('modelo', vehicleForm.modelo)
    if (vehicleForm.ano) fd.set('ano', vehicleForm.ano)
    if (vehicleForm.cor) fd.set('cor', vehicleForm.cor)
    if (vehicleForm.km) fd.set('km', vehicleForm.km)
    if (vehicleForm.observacoes) fd.set('observacoes', vehicleForm.observacoes)

    startTransition(async () => {
      const res = await saveVehicle({ ok: false }, fd)
      if (res.ok && res.id) {
        const vehicle: VehicleOption = {
          id: res.id,
          matricula: vehicleForm.matricula.toUpperCase().trim(),
          marca: vehicleForm.marca.trim(),
          modelo: vehicleForm.modelo.trim(),
          ano: vehicleForm.ano ? Number(vehicleForm.ano) : null,
          cor: vehicleForm.cor.trim() || null,
          km: vehicleForm.km ? Number(vehicleForm.km) : null,
          observacoes: vehicleForm.observacoes.trim() || null,
        }
        setVehicles((current) => [vehicle, ...current])
        setVehicleId(vehicle.id)
        setVehicleMode('existing')
        setCreatingVehicle(false)
        setStep(3)
      } else if (res.errors) {
        setErrors(res.errors)
      } else {
        setError(res.message ?? 'Nao foi possivel criar a viatura.')
      }
    })
  }

  async function handlePhotoSelected(slot: WorkOrderPhotoSlot, file: File | null) {
    if (!file) return
    setProcessingSlot(slot)
    setError(null)
    try {
      const compressed = await compressImageFile(file, { fallbackName: `foto-${slot.toLowerCase()}` })
      const preview = URL.createObjectURL(compressed)
      if (slot === 'FRONT') {
        if (mainPhotoPreview) URL.revokeObjectURL(mainPhotoPreview)
        setMainPhoto(compressed)
        setMainPhotoPreview(preview)
      } else {
        const previous = extraPreviews[slot]
        if (previous) URL.revokeObjectURL(previous)
        setExtraPhotos((current) => ({ ...current, [slot]: compressed }))
        setExtraPreviews((current) => ({ ...current, [slot]: preview }))
      }
    } catch (err) {
      console.error(err)
      setError('Nao foi possivel compactar esta foto.')
    } finally {
      setProcessingSlot(null)
    }
  }

  function finishCreation() {
    setError(null)
    setErrors({})

    if (!mainPhoto) {
      setErrors({ photo: 'A foto principal da frente e obrigatoria.' })
      return
    }
    if (!problema.trim()) {
      setErrors({ problema: 'Descreve o motivo da entrada da viatura.' })
      return
    }

    const fd = new FormData()
    fd.set('customerId', customerId)
    fd.set('vehicleId', vehicleId)
    fd.set('problema', problema.trim())
    if (responsibleId) fd.set('responsibleId', responsibleId)
    if (selectedVehicle?.km) fd.set('kmEntrada', String(selectedVehicle.km))

    setSubmitting(true)
    startTransition(async () => {
      try {
        const res = await saveWorkOrder({ ok: false }, fd)
        if (!res.ok || !res.id) {
          if (res.errors) setErrors(res.errors)
          setError(res.message ?? 'Nao foi possivel abrir a folha.')
          return
        }

        const photoEntries: [WorkOrderPhotoSlot, File][] = [
          ['FRONT', mainPhoto],
          ...Object.entries(extraPhotos).map(([slot, file]) => [slot as WorkOrderPhotoSlot, file as File] as [WorkOrderPhotoSlot, File]),
        ]

        for (const [slot, file] of photoEntries) {
          const photoData = new FormData()
          photoData.set('workOrderId', res.id)
          photoData.set('slot', slot)
          photoData.set('photo', file)
          const photoRes = await saveWorkOrderPhoto({ ok: false }, photoData)
          if (!photoRes.ok && slot === 'FRONT') {
            setError(photoRes.message ?? 'A folha foi criada, mas a foto principal falhou.')
            router.push(`/folhas/${res.id}`)
            return
          }
        }

        onClose()
        router.push(`/folhas/${res.id}`)
      } finally {
        setSubmitting(false)
      }
    })
  }

  const canContinueCustomer = Boolean(customerId || (creatingCustomer && newCustomerName.trim()))
  const canContinueVehicle = vehicleMode === 'new' || Boolean(vehicleId)
  const canFinish = Boolean(mainPhoto && problema.trim() && !busy && !processingSlot)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 1 ? 'Nova folha de obra' : step === 2 ? 'Adicionar viatura' : 'Fotos da viatura'}
      size="xl"
      hideTitle
    >
      <div className="p-5 space-y-5">
        <StepHeader step={step} onGoToStep={setStep} />

        {step === 1 && (
          <section className="space-y-4">
            <div>
              <label className="label">Cliente</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  value={customerQuery}
                  onFocus={() => setCustomerSearchOpen(true)}
                  onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value)
                    setCustomerId('')
                    setCreatedCustomer(null)
                    setCreatingCustomer(false)
                    setCustomerSearchOpen(true)
                  }}
                  placeholder="Escreve o nome do cliente..."
                  className={cn('input-base pl-10', errors.customerId && 'border-red-300')}
                  autoFocus
                />
                {customerSearchOpen && (
                  <div className="relative z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
                    {customerQuery.trim() && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={chooseCreateCustomer}
                        className="w-full px-3 py-3 text-left bg-emerald-50 hover:bg-emerald-100 border-b border-emerald-100"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                          <UserPlus className="w-4 h-4" />
                          Criar cliente "{customerQuery.trim()}"
                        </div>
                        <div className="text-xs text-emerald-700 mt-0.5">Nesta fase basta confirmar nome e telefone.</div>
                      </button>
                    )}
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                      {customerQuery.trim() ? 'Clientes existentes' : 'Clientes recentes'}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {customerMatches.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-zinc-500">Nenhum cliente encontrado.</div>
                      ) : (
                        customerMatches.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectCustomer(customer)}
                            className="w-full px-3 py-2.5 text-left hover:bg-indigo-50 border-b border-zinc-100 last:border-b-0"
                          >
                            <div className="font-medium text-sm text-zinc-900 truncate">{customer.nome}</div>
                            <CustomerMeta customer={customer} />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
            </div>

            {creatingCustomer && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <UserPlus className="w-4 h-4" />
                  Novo cliente
                </div>
                <div>
                  <label className="label">Nome *</label>
                  <input
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="input-base bg-white"
                    placeholder="Nome do cliente"
                  />
                  {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
                </div>
                <div>
                  <label className="label">Telefone</label>
                  <input
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="input-base bg-white"
                    placeholder="+351 900 000 000"
                    inputMode="tel"
                  />
                  {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
                </div>
              </div>
            )}

            {selectedCustomer && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
                  <UserRound className="w-4 h-4 text-indigo-700" />
                  {selectedCustomer.nome}
                </div>
                <CustomerMeta customer={selectedCustomer} className="mt-1 text-indigo-900/70" />
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <UserRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cliente selecionado</div>
                  <div className="text-base font-semibold text-zinc-900 truncate">{selectedCustomer?.nome}</div>
                  {selectedCustomer && <CustomerMeta customer={selectedCustomer} />}
                </div>
              </div>
              <button
                type="button"
                onClick={goToCustomerStep}
                className="btn-secondary text-xs px-3 py-1.5 sm:w-auto"
              >
                Alterar cliente
              </button>
            </div>

            <div>
              <div className="mb-2">
                <h4 className="text-sm font-semibold text-zinc-900">Adicionar viatura</h4>
                <p className="text-sm text-zinc-500">Escolha se vai criar uma viatura nova ou usar uma já registada.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setVehicleMode('new')
                    setCreatingVehicle(true)
                    setVehicleId('')
                    setErrors((current) => omitKeys(current, ['vehicleId']))
                  }}
                  className={cn(
                    'rounded-xl border p-4 text-left transition flex items-center justify-between gap-4',
                    vehicleMode === 'new'
                      ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-zinc-200 hover:bg-zinc-50'
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Car className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-zinc-900">Nova viatura</span>
                      <span className="block text-sm text-zinc-500">Adicionar uma viatura que ainda não existe</span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex-shrink-0',
                      vehicleMode === 'new' ? 'border-indigo-600 bg-indigo-600 ring-4 ring-indigo-100' : 'border-zinc-300'
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleMode('existing')
                    setCreatingVehicle(false)
                    setErrors((current) => omitKeys(current, ['vehicleId']))
                  }}
                  className={cn(
                    'rounded-xl border p-4 text-left transition flex items-center justify-between gap-4',
                    vehicleMode === 'existing'
                      ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100'
                      : 'border-zinc-200 hover:bg-zinc-50'
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-zinc-900">Viatura existente</span>
                      <span className="block text-sm text-zinc-500">Selecionar uma viatura já registada</span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex-shrink-0',
                      vehicleMode === 'existing' ? 'border-emerald-600 bg-emerald-600 ring-4 ring-emerald-100' : 'border-zinc-300'
                    )}
                  />
                </button>
              </div>
            </div>

            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-apple',
                vehicleMode === 'existing' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={cn(
                    'space-y-3 transition-all duration-300 ease-apple',
                    vehicleMode === 'existing' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                  )}
                >
                  {vehicles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
                      Este cliente ainda não tem viaturas registadas.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {vehicles.map((vehicle) => (
                        <VehicleHistoryCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          selected={vehicle.id === vehicleId}
                          onSelect={() => {
                            setVehicleId(vehicle.id)
                            setErrors((current) => omitKeys(current, ['vehicleId']))
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-apple',
                vehicleMode === 'new' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={cn(
                    'rounded-xl border border-zinc-200 p-4 space-y-3 transition-all duration-300 ease-apple',
                    vehicleMode === 'new' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-zinc-700" />
                    <div>
                      <div className="text-base font-semibold text-zinc-900">Dados da viatura</div>
                      <div className="text-sm text-zinc-500">Preencha as informações principais da viatura.</div>
                    </div>
                  </div>
                  <div>
                    <label className="label">Matrícula *</label>
                    <input
                      value={vehicleForm.matricula}
                      onChange={(e) => setVehicleForm((v) => ({ ...v, matricula: e.target.value.toUpperCase() }))}
                      className="input-base !uppercase tracking-wider font-semibold"
                      placeholder="AA-00-AA"
                    />
                    {errors.matricula && <p className="text-xs text-red-500 mt-1">{errors.matricula}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Marca *</label>
                      <input
                        value={vehicleForm.marca}
                        onChange={(e) => setVehicleForm((v) => ({ ...v, marca: e.target.value }))}
                        className="input-base"
                        placeholder="Seat"
                      />
                      {errors.marca && <p className="text-xs text-red-500 mt-1">{errors.marca}</p>}
                    </div>
                    <div>
                      <label className="label">Modelo *</label>
                      <input
                        value={vehicleForm.modelo}
                        onChange={(e) => setVehicleForm((v) => ({ ...v, modelo: e.target.value }))}
                        className="input-base"
                        placeholder="Ibiza"
                      />
                      {errors.modelo && <p className="text-xs text-red-500 mt-1">{errors.modelo}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Ano</label>
                      <input
                        value={vehicleForm.ano}
                        onChange={(e) => setVehicleForm((v) => ({ ...v, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        className="input-base"
                        inputMode="numeric"
                        placeholder="2020"
                      />
                    </div>
                    <div>
                      <label className="label">Cor</label>
                      <input
                        value={vehicleForm.cor}
                        onChange={(e) => setVehicleForm((v) => ({ ...v, cor: e.target.value }))}
                        className="input-base"
                        placeholder="Branco"
                      />
                    </div>
                    <div>
                      <label className="label">Km</label>
                      <input
                        value={vehicleForm.km}
                        onChange={(e) => setVehicleForm((v) => ({ ...v, km: e.target.value.replace(/\D/g, '') }))}
                        className="input-base"
                        inputMode="numeric"
                        placeholder="125000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Observações</label>
                    <textarea
                      value={vehicleForm.observacoes}
                      onChange={(e) => setVehicleForm((v) => ({ ...v, observacoes: e.target.value }))}
                      className="input-base resize-none"
                      rows={2}
                      placeholder="Notas sobre a viatura..."
                    />
                  </div>
                </div>
              </div>
            </div>
            {errors.vehicleId && <p className="text-xs text-red-500">{errors.vehicleId}</p>}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Viatura</div>
              <div className="text-sm font-semibold text-zinc-900">
                {selectedVehicle?.matricula} · {selectedVehicle?.marca} {selectedVehicle?.modelo}
              </div>
            </div>

            <div>
              <label className="label">Responsavel</label>
              <select
                value={responsibleId}
                onChange={(e) => setResponsibleId(e.target.value)}
                className="input-base"
              >
                <option value="">Quem criar a folha</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nome}{user.role === 'OWNER' ? ' - Admin' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Problema reportado *</label>
              <textarea
                value={problema}
                onChange={(e) => setProblema(e.target.value)}
                className="input-base resize-none"
                rows={3}
                placeholder="Ex: Cliente relata barulho ao travar..."
              />
              {errors.problema && <p className="text-xs text-red-500 mt-1">{errors.problema}</p>}
            </div>

            <PhotoInputCard
              title="Foto principal da frente"
              required
              preview={mainPhotoPreview}
              busy={processingSlot === 'FRONT'}
              onFile={(file) => handlePhotoSelected('FRONT', file)}
            />
            {errors.photo && <p className="text-xs text-red-500">{errors.photo}</p>}

            <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 cursor-pointer hover:bg-zinc-50">
              <span>
                <span className="block text-sm font-semibold text-zinc-900">Tirar fotos completas agora</span>
                <span className="block text-xs text-zinc-500">Lados, traseira, interior, painel e detalhes.</span>
              </span>
              <input
                type="checkbox"
                checked={takeAllPhotos}
                onChange={(e) => setTakeAllPhotos(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {takeAllPhotos && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INTAKE_PHOTO_SLOTS.filter((item) => item.slot !== 'FRONT').map((item) => (
                  <PhotoInputCard
                    key={item.slot}
                    title={item.title}
                    preview={extraPreviews[item.slot] ?? null}
                    busy={processingSlot === item.slot}
                    compact
                    onFile={(file) => handlePhotoSelected(item.slot, file)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step === 1 ? (
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={step === 2 ? goToCustomerStep : () => setStep(2)}
              className="btn-secondary flex-1"
              disabled={busy}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          )}

          {step === 1 && (
            <button type="button" onClick={goToVehicleStep} disabled={!canContinueCustomer || busy} className="btn-primary flex-1">
              {busy ? 'A guardar...' : 'Continuar'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === 2 && (
            <button type="button" onClick={goToPhotoStep} disabled={busy || !canContinueVehicle} className="btn-primary flex-1">
              {busy ? 'A guardar...' : 'Continuar'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === 3 && (
            <button type="button" onClick={finishCreation} disabled={!canFinish} className="btn-primary flex-1">
              {busy ? 'A abrir...' : 'Abrir folha'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function EditWorkOrderModal({
  open,
  onClose,
  workOrder,
  customers,
  users,
  defaultCustomerId,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const init = initialState(workOrder, defaultCustomerId)
  const [customerId, setCustomerId] = useState(init.customerId)
  const [vehicleId, setVehicleId] = useState(init.vehicleId)
  const [problema, setProblema] = useState(init.problema)
  const [diagnostico, setDiagnostico] = useState(init.diagnostico)
  const [trabalho, setTrabalho] = useState(init.trabalho)
  const [observacoes, setObservacoes] = useState(init.observacoes)
  const [kmEntrada, setKmEntrada] = useState(init.kmEntrada)
  const [dataPrevista, setDataPrevista] = useState(init.dataPrevista)
  const [responsibleId, setResponsibleId] = useState(init.responsibleId)
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customers, customerId]
  )

  const customerMatches = useMemo(() => {
    const query = normalizeSearch(customerQuery)
    if (!query) return customers.slice(0, 8)

    return customers
      .filter((customer) => {
        const haystack = normalizeSearch([
          customer.nome,
          customer.nif ?? '',
          customer.telefone ?? '',
        ].join(' '))
        return haystack.includes(query)
      })
      .slice(0, 8)
  }, [customers, customerQuery])

  useEffect(() => {
    if (!open) return
    const s = initialState(workOrder, defaultCustomerId)
    setCustomerId(s.customerId)
    setVehicleId(s.vehicleId)
    setProblema(s.problema)
    setDiagnostico(s.diagnostico)
    setTrabalho(s.trabalho)
    setObservacoes(s.observacoes)
    setKmEntrada(s.kmEntrada)
    setDataPrevista(s.dataPrevista)
    setResponsibleId(s.responsibleId)
    const initialCustomer = customers.find((customer) => customer.id === s.customerId)
    setCustomerQuery(initialCustomer?.nome ?? '')
    setCustomerSearchOpen(false)
    setErrors({})
    setError(null)
  }, [open, workOrder?.id, defaultCustomerId, customers])

  // Carrega viaturas quando o cliente muda
  useEffect(() => {
    if (!customerId) {
      setVehicles([])
      return
    }
    let cancelled = false
    fetch(`/api/customers/${customerId}/vehicles`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setVehicles(data.vehicles ?? [])
      })
      .catch(() => {
        if (!cancelled) setVehicles([])
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrors({})
    const fd = new FormData()
    if (workOrder) fd.set('id', workOrder.id)
    fd.set('customerId', customerId)
    if (vehicleId) fd.set('vehicleId', vehicleId)
    fd.set('problema', problema)
    if (diagnostico) fd.set('diagnostico', diagnostico)
    if (trabalho) fd.set('trabalho', trabalho)
    if (observacoes) fd.set('observacoes', observacoes)
    if (kmEntrada) fd.set('kmEntrada', kmEntrada)
    if (dataPrevista) fd.set('dataPrevista', dataPrevista)
    if (responsibleId) fd.set('responsibleId', responsibleId)

    startTransition(async () => {
      const res = await saveWorkOrder({ ok: false }, fd)
      if (res.ok) {
        onClose()
        if (res.id && !workOrder) {
          router.push(`/folhas/${res.id}`)
        } else {
          router.refresh()
        }
      } else if (res.errors) {
        setErrors(res.errors)
      } else if (res.message) {
        setError(res.message)
      }
    })
  }

  function selectCustomer(customer: CustomerOption) {
    setCustomerId(customer.id)
    setCustomerQuery(customer.nome)
    setVehicleId('')
    setCustomerSearchOpen(false)
    setErrors((current) => {
      const next = { ...current }
      delete next.customerId
      return next
    })
  }

  function clearCustomer() {
    setCustomerId('')
    setCustomerQuery('')
    setVehicleId('')
    setCustomerSearchOpen(true)
  }

  return (
    <Modal open={open} onClose={onClose} title={workOrder ? 'Editar folha de obra' : 'Nova folha de obra'} size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Cliente *</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                value={customerQuery}
                onFocus={() => setCustomerSearchOpen(true)}
                onChange={(e) => {
                  setCustomerQuery(e.target.value)
                  setCustomerId('')
                  setVehicleId('')
                  setCustomerSearchOpen(true)
                }}
                placeholder="Pesquisar por nome, NIF ou telefone..."
                required
                className={cn('input-base pl-10', errors.customerId && 'border-red-300 focus:ring-red-500')}
              />
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={clearCustomer}
                  className="absolute right-2 top-2 px-2 py-1 rounded-md text-xs font-medium text-zinc-500 hover:bg-zinc-100"
                >
                  Trocar
                </button>
              )}

              {customerSearchOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                    {customerQuery.trim() ? 'Resultados' : 'Clientes recentes'}
                  </div>
                  {customerMatches.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-zinc-500">
                      Nenhum cliente encontrado.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {customerMatches.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectCustomer(customer)}
                          className="w-full px-3 py-2.5 text-left hover:bg-indigo-50 border-b border-zinc-100 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-zinc-900 truncate">{customer.nome}</div>
                              <CustomerMeta customer={customer} />
                            </div>
                            {customer.id === customerId && (
                              <BadgeCheck className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
                  <UserRound className="w-4 h-4 text-indigo-700" />
                  {selectedCustomer.nome}
                </div>
                <CustomerMeta customer={selectedCustomer} className="mt-1 text-indigo-900/70" />
              </div>
            )}
            {customers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Regista um cliente primeiro.</p>
            )}
            {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
          </div>
          <div>
            <label className="label">Viatura</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={!customerId || vehicles.length === 0}
              className="input-base disabled:opacity-50"
            >
              <option value="">{vehicles.length === 0 ? '—' : 'Seleciona...'}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.matricula} · {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Responsavel pela folha</label>
          <select
            value={responsibleId}
            onChange={(e) => setResponsibleId(e.target.value)}
            className="input-base"
          >
            <option value="">Manter responsavel atual</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nome}{user.role === 'OWNER' ? ' - Admin' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Problema reportado *</label>
          <textarea
            value={problema}
            onChange={(e) => setProblema(e.target.value)}
            rows={3}
            placeholder="Ex: Travões a chiar quando trava com força..."
            required
            className="input-base resize-none"
          />
          {errors.problema && <p className="text-xs text-red-500 mt-1">{errors.problema}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Km à entrada</label>
            <input
              type="text"
              value={kmEntrada}
              onChange={(e) => setKmEntrada(e.target.value.replace(/\D/g, ''))}
              placeholder="125000"
              inputMode="numeric"
              className="input-base"
            />
          </div>
          <div>
            <label className="label">Data prevista de entrega</label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="input-base"
            />
          </div>
        </div>

        {workOrder && (
          <>
            <div>
              <label className="label">Diagnóstico</label>
              <textarea
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                rows={2}
                placeholder="Conclusão técnica após inspeção..."
                className="input-base resize-none"
              />
            </div>
            <div>
              <label className="label">Trabalho efetuado</label>
              <textarea
                value={trabalho}
                onChange={(e) => setTrabalho(e.target.value)}
                rows={2}
                placeholder="Descrição do que foi feito..."
                className="input-base resize-none"
              />
            </div>
          </>
        )}

        <div>
          <label className="label">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Notas internas, recomendações..."
            className="input-base resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || customers.length === 0}
            className="btn-primary flex-1"
          >
            {pending ? 'A guardar...' : workOrder ? 'Guardar alterações' : 'Abrir folha'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StepHeader({ step, onGoToStep }: { step: 1 | 2 | 3; onGoToStep: (s: 1 | 2 | 3) => void }) {
  const steps = [
    { value: 1, label: 'Cliente' },
    { value: 2, label: 'Viatura' },
    { value: 3, label: 'Fotos' },
  ] as const

  return (
    <div className="px-1 sm:px-10 py-2">
      <div className="grid grid-cols-[minmax(72px,1fr)_minmax(32px,1.4fr)_minmax(72px,1fr)_minmax(32px,1.4fr)_minmax(72px,1fr)] items-start">
        {steps.map((item, index) => {
          const active = step === item.value
          const done = step > item.value
          const reached = step >= item.value
          const status = done ? 'Concluído' : active ? 'Em preenchimento' : 'Pendente'

          return (
            <FragmentStep
              key={item.value}
              showConnector={index < steps.length - 1}
              connectorActive={step > item.value}
            >
              <button
                type="button"
                onClick={() => done && onGoToStep(item.value)}
                disabled={!done}
                  className={cn(
                    'group flex w-full flex-col items-center text-center transition-all duration-700 ease-apple',
                  done ? 'cursor-pointer' : 'cursor-default',
                  active && 'scale-[1.02]'
                )}
              >
                <span
                  className={cn(
                    'w-12 h-12 rounded-full border flex items-center justify-center text-sm font-bold transition-all duration-1000 ease-apple',
                    done && 'border-emerald-200 bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200',
                    active && 'border-indigo-500 bg-white text-indigo-700 ring-4 ring-indigo-100 shadow-sm',
                    !reached && 'border-zinc-200 bg-zinc-50 text-zinc-500'
                  )}
                >
                  {done ? <CheckCircle2 className="w-5 h-5" /> : item.value}
                </span>
                <span
                  className={cn(
                    'mt-2 text-sm font-semibold transition-colors duration-700',
                    done && 'text-emerald-700',
                    active && 'text-indigo-700',
                    !reached && 'text-zinc-600'
                  )}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 text-xs text-zinc-500 transition-opacity duration-700">
                  {status}
                </span>
              </button>
            </FragmentStep>
          )
        })}
      </div>
    </div>
  )
}

function FragmentStep({
  children,
  showConnector,
  connectorActive,
}: {
  children: React.ReactNode
  showConnector: boolean
  connectorActive: boolean
}) {
  return (
    <>
      <div>{children}</div>
      {showConnector && (
        <div className="pt-6 px-2 sm:px-4">
          <div className="h-0.5 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-apple"
              style={{ width: connectorActive ? '100%' : '0%' }}
            />
          </div>
        </div>
      )}
    </>
  )
}

function VehicleHistoryCard({
  vehicle,
  selected,
  onSelect,
}: {
  vehicle: VehicleOption
  selected: boolean
  onSelect: () => void
}) {
  const history = vehicle.workOrders ?? []

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-xl border p-4 text-left transition bg-white',
        selected
          ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100'
          : 'border-zinc-200 hover:bg-zinc-50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 flex-shrink-0">
          <Car className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold tracking-wider text-zinc-900">{vehicle.matricula}</div>
              <div className="text-sm text-zinc-700 truncate">{vehicle.marca} {vehicle.modelo}</div>
              <div className="text-xs text-zinc-500">
                {[vehicle.ano, vehicle.cor, vehicle.km ? `${vehicle.km} km` : null].filter(Boolean).join(' · ') || 'Sem detalhes extra'}
              </div>
            </div>
            <span
              className={cn(
                'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1',
                selected ? 'border-emerald-600 bg-emerald-600 ring-4 ring-emerald-100' : 'border-zinc-300'
              )}
            />
          </div>

          <div className="mt-3 border-t border-zinc-100 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Histórico de obra
            </div>
            {history.length === 0 ? (
              <div className="text-xs text-zinc-400">Sem folhas anteriores para esta viatura.</div>
            ) : (
              <div className="space-y-1.5">
                {history.map((wo) => {
                  const meta = STATUS_META[wo.estado as WorkOrderStatus]
                  const openedAt = formatShortDate(wo.dataAbertura)
                  return (
                    <div key={wo.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate" title={`#${wo.numero} · ${wo.problema}`}>
                        <span className="font-semibold text-zinc-700">#{wo.numero}</span>
                        <span className="text-zinc-500"> · {wo.problema}</span>
                        {openedAt && <span className="text-zinc-400"> · {openedAt}</span>}
                      </span>
                      <span className={cn('px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', meta?.chip ?? 'bg-zinc-100 text-zinc-600')}>
                        {meta?.label ?? wo.estado}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}

function PhotoInputCard({
  title,
  required = false,
  preview,
  busy,
  compact = false,
  onFile,
}: {
  title: string
  required?: boolean
  preview: string | null
  busy: boolean
  compact?: boolean
  onFile: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-3 flex gap-3',
        required && !preview ? 'border-amber-200' : preview ? 'border-emerald-200' : 'border-zinc-200',
        compact ? 'items-center' : 'items-stretch'
      )}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center text-zinc-400 hover:text-sky-600 hover:bg-sky-50 transition',
          compact ? 'w-16 h-16' : 'w-28 h-24'
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={title} className="w-full h-full object-cover" />
        ) : busy ? (
          <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
        ) : (
          <ImageIcon className="w-5 h-5" />
        )}
      </button>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-sm text-zinc-900 truncate">{title}</div>
          {required && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
              Obrigatória
            </span>
          )}
          {preview && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> OK
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-secondary text-xs px-2 py-1.5 mt-2 w-fit"
        >
          <Camera className="w-3.5 h-3.5" />
          {preview ? 'Trocar foto' : 'Tirar foto'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function omitKeys<T extends Record<string, string>>(source: T, keys: string[]) {
  const next = { ...source }
  keys.forEach((key) => {
    delete next[key]
  })
  return next
}

function CustomerMeta({
  customer,
  className,
}: {
  customer: CustomerOption
  className?: string
}) {
  const hasNif = Boolean(customer.nif)
  const hasPhone = Boolean(customer.telefone)

  if (!hasNif && !hasPhone) {
    return <div className={cn('text-xs text-zinc-400', className)}>Sem NIF ou telefone registado</div>
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500', className)}>
      {hasNif && (
        <span className="inline-flex items-center gap-1">
          <BadgeCheck className="w-3 h-3" />
          NIF {customer.nif}
        </span>
      )}
      {hasPhone && (
        <span className="inline-flex items-center gap-1">
          <Phone className="w-3 h-3" />
          {customer.telefone}
        </span>
      )}
    </div>
  )
}
