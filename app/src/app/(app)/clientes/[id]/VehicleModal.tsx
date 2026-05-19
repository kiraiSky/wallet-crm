'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { saveVehicle } from '../actions'
import type { VehicleRow } from './page'

interface Props {
  open: boolean
  onClose: () => void
  customerId: string
  vehicle: VehicleRow | null
}

function initialState(v: VehicleRow | null) {
  return {
    matricula: v?.matricula ?? '',
    marca: v?.marca ?? '',
    modelo: v?.modelo ?? '',
    ano: v?.ano ? String(v.ano) : '',
    cor: v?.cor ?? '',
    km: v?.km ? String(v.km) : '',
    observacoes: v?.observacoes ?? '',
  }
}

export function VehicleModal({ open, onClose, customerId, vehicle }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const init = initialState(vehicle)
  const [matricula, setMatricula] = useState(init.matricula)
  const [marca, setMarca] = useState(init.marca)
  const [modelo, setModelo] = useState(init.modelo)
  const [ano, setAno] = useState(init.ano)
  const [cor, setCor] = useState(init.cor)
  const [km, setKm] = useState(init.km)
  const [observacoes, setObservacoes] = useState(init.observacoes)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const s = initialState(vehicle)
    setMatricula(s.matricula)
    setMarca(s.marca)
    setModelo(s.modelo)
    setAno(s.ano)
    setCor(s.cor)
    setKm(s.km)
    setObservacoes(s.observacoes)
    setErrors({})
    setError(null)
  }, [open, vehicle?.id])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrors({})
    const fd = new FormData()
    if (vehicle) fd.set('id', vehicle.id)
    fd.set('customerId', customerId)
    fd.set('matricula', matricula)
    fd.set('marca', marca)
    fd.set('modelo', modelo)
    if (ano) fd.set('ano', ano)
    if (cor) fd.set('cor', cor)
    if (km) fd.set('km', km)
    if (observacoes) fd.set('observacoes', observacoes)

    startTransition(async () => {
      const res = await saveVehicle({ ok: false }, fd)
      if (res.ok) {
        onClose()
        router.refresh()
      } else if (res.errors) {
        setErrors(res.errors)
      } else if (res.message) {
        setError(res.message)
      }
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={vehicle ? 'Editar viatura' : 'Nova viatura'} size="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="label">Matrícula *</label>
          <input
            type="text"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value.toUpperCase())}
            placeholder="AA-00-AA"
            required
            autoFocus
            className="input-base !uppercase tracking-wider font-semibold"
          />
          {errors.matricula && <p className="text-xs text-red-500 mt-1">{errors.matricula}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Marca *</label>
            <input
              type="text"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Renault"
              required
              className="input-base"
            />
            {errors.marca && <p className="text-xs text-red-500 mt-1">{errors.marca}</p>}
          </div>
          <div>
            <label className="label">Modelo *</label>
            <input
              type="text"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Clio"
              required
              className="input-base"
            />
            {errors.modelo && <p className="text-xs text-red-500 mt-1">{errors.modelo}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Ano</label>
            <input
              type="text"
              value={ano}
              onChange={(e) => setAno(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="2018"
              inputMode="numeric"
              className="input-base"
            />
          </div>
          <div>
            <label className="label">Cor</label>
            <input
              type="text"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              placeholder="Branco"
              className="input-base"
            />
          </div>
          <div>
            <label className="label">Km</label>
            <input
              type="text"
              value={km}
              onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
              placeholder="125000"
              inputMode="numeric"
              className="input-base"
            />
          </div>
        </div>

        <div>
          <label className="label">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Notas sobre a viatura..."
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
          <button type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? 'A guardar...' : vehicle ? 'Guardar alterações' : 'Adicionar viatura'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
