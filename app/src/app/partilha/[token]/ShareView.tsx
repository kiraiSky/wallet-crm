'use client'

import { Car, Wrench, Package, CheckCircle2, Clock, AlertCircle, Phone } from 'lucide-react'

type Item = {
  referencia?: string | null
  descricao: string
  quantidade: number
  precoUnit: number
  iva: number
  total: number
}

type Data = {
  numero: number
  estado: string
  problema: string
  diagnostico: string | null
  trabalho: string | null
  observacoes: string | null
  dataAbertura: string
  dataPrevista: string | null
  dataConclusao: string | null
  customer: { nome: string; telefone: string | null }
  vehicle: {
    matricula: string
    marca: string
    modelo: string
    ano: number | null
    km: number | null
  } | null
  pecas: Item[]
  maoObra: Item[]
  baseTotal: number
  ivaEntries: [number, number][]
  totalComIva: number
  faturada: boolean
  company: { nome: string; telefone: string; email: string; hasLogo: boolean }
}

const STATUS_LABEL: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ABERTA:    { label: 'Aberta',       icon: <Clock className="w-4 h-4" />,        color: 'text-blue-600 bg-blue-50 border-blue-200' },
  DIAGNOSTICO: { label: 'Em diagnóstico', icon: <AlertCircle className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  AGUARDA_PECAS: { label: 'Aguarda peças', icon: <Package className="w-4 h-4" />,  color: 'text-orange-600 bg-orange-50 border-orange-200' },
  EM_REPARACAO: { label: 'Em reparação',  icon: <Wrench className="w-4 h-4" />,    color: 'text-violet-600 bg-violet-50 border-violet-200' },
  CONCLUIDA: { label: 'Concluída',    icon: <CheckCircle2 className="w-4 h-4" />,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  FATURADA:  { label: 'Faturada',     icon: <CheckCircle2 className="w-4 h-4" />,  color: 'text-emerald-700 bg-emerald-100 border-emerald-300' },
  ENTREGUE:  { label: 'Entregue',     icon: <CheckCircle2 className="w-4 h-4" />,  color: 'text-zinc-600 bg-zinc-100 border-zinc-300' },
  CANCELADA: { label: 'Cancelada',    icon: <AlertCircle className="w-4 h-4" />,   color: 'text-red-600 bg-red-50 border-red-200' },
}

function fmt(n: number) {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function ShareView({ data }: { data: Data }) {
  const status = STATUS_LABEL[data.estado] ?? { label: data.estado, icon: null, color: 'text-zinc-600 bg-zinc-100 border-zinc-300' }
  const hasItems = data.pecas.length > 0 || data.maoObra.length > 0

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header da oficina */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.company.hasLogo && (
              <img src="/api/company-logo" alt="Logo" className="h-10 w-auto object-contain" />
            )}
            <div>
              <div className="font-bold text-zinc-900 text-sm leading-tight">{data.company.nome || 'Oficina'}</div>
              {data.company.telefone && (
                <a
                  href={`tel:${data.company.telefone}`}
                  className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5"
                >
                  <Phone className="w-3 h-3" /> {data.company.telefone}
                </a>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-400">Folha de obra</div>
            <div className="text-lg font-bold text-zinc-900">#{data.numero}</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Estado */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${status.color}`}>
          {status.icon}
          {status.label}
        </div>

        {/* Datas */}
        <div className="text-sm text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>Aberta a {fmtDate(data.dataAbertura)}</span>
          {data.dataPrevista && !data.dataConclusao && (
            <span>· Prazo previsto: {fmtDate(data.dataPrevista)}</span>
          )}
          {data.dataConclusao && (
            <span>· Concluída a {fmtDate(data.dataConclusao)}</span>
          )}
        </div>

        {/* Veículo */}
        {data.vehicle && (
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              <Car className="w-3.5 h-3.5" /> Veículo
            </div>
            <div className="font-bold text-zinc-900 text-lg">{data.vehicle.matricula}</div>
            <div className="text-sm text-zinc-600">
              {data.vehicle.marca} {data.vehicle.modelo}
              {data.vehicle.ano ? ` · ${data.vehicle.ano}` : ''}
            </div>
            {data.vehicle.km && (
              <div className="text-xs text-zinc-400 mt-0.5">
                KM entrada: {data.vehicle.km.toLocaleString('pt-PT')} km
              </div>
            )}
          </div>
        )}

        {/* Problema / Diagnóstico / Trabalho */}
        <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
          <div className="p-4">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
              Problema / Sintoma
            </div>
            <p className="text-sm text-zinc-800">{data.problema}</p>
          </div>
          {data.diagnostico && (
            <div className="p-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                Diagnóstico
              </div>
              <p className="text-sm text-zinc-800">{data.diagnostico}</p>
            </div>
          )}
          {data.trabalho && (
            <div className="p-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                Trabalho realizado
              </div>
              <p className="text-sm text-zinc-800">{data.trabalho}</p>
            </div>
          )}
          {data.observacoes && (
            <div className="p-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                Observações
              </div>
              <p className="text-sm text-zinc-800">{data.observacoes}</p>
            </div>
          )}
        </div>

        {/* Itens */}
        {hasItems && (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Orçamento / Trabalhos
              </div>
            </div>

            {data.pecas.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-zinc-50 text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                  <Package className="w-3 h-3" /> Peças / Materiais
                </div>
                {data.pecas.map((item, i) => (
                  <div key={i} className="px-4 py-3 border-t border-zinc-100 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {item.referencia && (
                        <span className="text-xs text-zinc-400 font-mono mr-1">[{item.referencia}]</span>
                      )}
                      <span className="text-sm text-zinc-800">{item.descricao}</span>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {item.quantidade} × {fmt(item.precoUnit)} + IVA {item.iva}%
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-zinc-900 whitespace-nowrap">
                      {fmt(item.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.maoObra.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-zinc-50 text-xs font-semibold text-zinc-500 flex items-center gap-1.5 border-t border-zinc-100">
                  <Wrench className="w-3 h-3" /> Mão de Obra
                </div>
                {data.maoObra.map((item, i) => (
                  <div key={i} className="px-4 py-3 border-t border-zinc-100 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-800">{item.descricao}</span>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {item.quantidade} h × {fmt(item.precoUnit)} + IVA {item.iva}%
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-zinc-900 whitespace-nowrap">
                      {fmt(item.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totais */}
            <div className="border-t border-zinc-200 px-4 py-3 space-y-1.5 bg-zinc-50">
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Subtotal (sem IVA)</span>
                <span>{fmt(data.baseTotal)}</span>
              </div>
              {data.ivaEntries.map(([taxa, valor]) => (
                <div key={taxa} className="flex justify-between text-sm text-zinc-500">
                  <span>IVA {taxa}%</span>
                  <span>{fmt(valor)}</span>
                </div>
              ))}
              <div className="flex justify-between text-base font-bold text-zinc-900 pt-1.5 border-t border-zinc-300">
                <span>Total</span>
                <span>{fmt(data.totalComIva)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <p className="text-center text-xs text-zinc-400 pt-2 pb-6">
          Este é um resumo da sua folha de obra partilhado por {data.company.nome || 'a oficina'}.
          {data.company.email && ` Contacto: ${data.company.email}`}
        </p>
      </div>
    </div>
  )
}
