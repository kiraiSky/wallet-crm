'use client'

import { useEffect } from 'react'
import { Printer, X } from 'lucide-react'

type Item = {
  tipo: 'PECA' | 'MAO_OBRA'
  referencia: string | null
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
  kmEntrada: number | null
  dataAbertura: string
  dataPrevista: string | null
  dataConclusao: string | null
  customer: {
    nome: string
    nif: string | null
    telefone: string | null
    email: string | null
    morada: string | null
  }
  vehicle: {
    matricula: string
    marca: string
    modelo: string
    ano: number | null
    km: number | null
  } | null
  items: Item[]
  totalPecas: number
  totalMaoObra: number
  totalSemIva: number
  totalComIva: number
  moloniDocumentId: number | null
  moloniDocumentType: string | null
  company: {
    companyName: string
    companyNif: string
    companyAddress: string
    companyPhone: string
    companyEmail: string
    hasLogo: boolean
  }
}

function fmt(n: number) {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT')
}

export function PrintClient({ data }: { data: Data }) {
  // Auto-imprimir ao abrir
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  const pecas   = data.items.filter((i) => i.tipo === 'PECA')
  const maoObra = data.items.filter((i) => i.tipo === 'MAO_OBRA')

  // Calcular totais sem IVA
  const baseTotal = data.items.reduce((s, i) => s + i.precoUnit * i.quantidade, 0)

  // Agrupar IVA por taxa
  const ivaMap = new Map<number, number>()
  for (const item of data.items) {
    const base = item.precoUnit * item.quantidade
    const ivaVal = base * (item.iva / 100)
    ivaMap.set(item.iva, (ivaMap.get(item.iva) ?? 0) + ivaVal)
  }

  return (
    <>
      {/* Barra de controlo — apenas no ecrã, escondida ao imprimir */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-zinc-800 text-white flex items-center justify-between px-4 py-2 shadow print:hidden">
        <span className="text-sm font-medium">
          Pré-visualização — Folha de Obra #{data.numero}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-white text-zinc-800 text-sm font-medium px-3 py-1.5 rounded hover:bg-zinc-100"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 bg-zinc-600 text-white text-sm px-3 py-1.5 rounded hover:bg-zinc-500"
          >
            <X className="w-4 h-4" /> Fechar
          </button>
        </div>
      </div>

      {/* Documento */}
      <div className="pt-12 print:pt-0 bg-white min-h-screen">
        <div className="max-w-3xl mx-auto p-8 print:p-6 print:max-w-none">

          {/* Cabeçalho */}
          <div className="flex justify-between items-start mb-8 border-b border-zinc-200 pb-6">
            <div>
              {data.company.hasLogo && (
                <img
                  src="/api/company-logo"
                  alt="Logo"
                  className="max-h-16 max-w-48 object-contain mb-2"
                />
              )}
              <h1 className="text-xl font-bold text-zinc-900">{data.company.companyName}</h1>
              {data.company.companyAddress && (
                <p className="text-sm text-zinc-500 mt-0.5">{data.company.companyAddress}</p>
              )}
              {data.company.companyPhone && (
                <p className="text-sm text-zinc-500">Tel: {data.company.companyPhone}</p>
              )}
              {data.company.companyEmail && (
                <p className="text-sm text-zinc-500">E-mail: {data.company.companyEmail}</p>
              )}
              {data.company.companyNif && (
                <p className="text-sm text-zinc-500">Contribuinte: {data.company.companyNif}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-zinc-900">
                FOLHA DE OBRA #{data.numero}
              </div>
              {data.moloniDocumentId && (
                <div className="text-sm font-medium text-indigo-600 mt-1">
                  {data.moloniDocumentType} #{data.moloniDocumentId}
                </div>
              )}
              <div className="text-sm text-zinc-500 mt-1">
                Data: {fmtDate(data.dataAbertura)}
              </div>
              {data.dataConclusao && (
                <div className="text-sm text-zinc-500">
                  Conclusão: {fmtDate(data.dataConclusao)}
                </div>
              )}
              {data.dataPrevista && !data.dataConclusao && (
                <div className="text-sm text-zinc-500">
                  Prazo: {fmtDate(data.dataPrevista)}
                </div>
              )}
            </div>
          </div>

          {/* Cliente + Veículo */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Cliente</h3>
              <p className="font-semibold text-zinc-900">{data.customer.nome}</p>
              {data.customer.nif && (
                <p className="text-sm text-zinc-600">NIF: {data.customer.nif}</p>
              )}
              {data.customer.morada && (
                <p className="text-sm text-zinc-600">{data.customer.morada}</p>
              )}
              {data.customer.telefone && (
                <p className="text-sm text-zinc-600">Tel: {data.customer.telefone}</p>
              )}
              {data.customer.email && (
                <p className="text-sm text-zinc-600">{data.customer.email}</p>
              )}
            </div>
            {data.vehicle && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Veículo</h3>
                <p className="font-semibold text-zinc-900">{data.vehicle.matricula}</p>
                <p className="text-sm text-zinc-600">
                  {data.vehicle.marca} {data.vehicle.modelo}
                  {data.vehicle.ano ? ` (${data.vehicle.ano})` : ''}
                </p>
                {data.vehicle.km && (
                  <p className="text-sm text-zinc-600">KM entrada: {data.vehicle.km.toLocaleString('pt-PT')} km</p>
                )}
                {data.kmEntrada && !data.vehicle.km && (
                  <p className="text-sm text-zinc-600">KM entrada: {data.kmEntrada.toLocaleString('pt-PT')} km</p>
                )}
              </div>
            )}
          </div>

          {/* Problema / Diagnóstico / Trabalho */}
          <div className="mb-6 space-y-3">
            <div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Problema / Sintoma</span>
              <p className="text-sm text-zinc-800 mt-0.5">{data.problema}</p>
            </div>
            {data.diagnostico && (
              <div>
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Diagnóstico</span>
                <p className="text-sm text-zinc-800 mt-0.5">{data.diagnostico}</p>
              </div>
            )}
            {data.trabalho && (
              <div>
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Trabalho realizado</span>
                <p className="text-sm text-zinc-800 mt-0.5">{data.trabalho}</p>
              </div>
            )}
          </div>

          {/* Tabela de itens */}
          {data.items.length > 0 && (
            <div className="mb-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-zinc-100 text-zinc-600 text-xs uppercase">
                    <th className="text-left px-3 py-2 font-semibold rounded-tl">Descrição</th>
                    <th className="text-right px-3 py-2 font-semibold">Qtd.</th>
                    <th className="text-right px-3 py-2 font-semibold">Preço Unit.</th>
                    <th className="text-right px-3 py-2 font-semibold">IVA</th>
                    <th className="text-right px-3 py-2 font-semibold rounded-tr">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-zinc-500 bg-zinc-50 border-t border-zinc-200">
                          Peças / Materiais
                        </td>
                      </tr>
                      {pecas.map((item, i) => (
                        <tr key={i} className="border-t border-zinc-100">
                          <td className="px-3 py-2 text-zinc-800">
                            {item.referencia && (
                              <span className="text-xs text-zinc-400 mr-1">[{item.referencia}]</span>
                            )}
                            {item.descricao}
                          </td>
                          <td className="px-3 py-2 text-right text-zinc-700">{item.quantidade}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{fmt(item.precoUnit)}</td>
                          <td className="px-3 py-2 text-right text-zinc-500">{item.iva}%</td>
                          <td className="px-3 py-2 text-right font-medium text-zinc-800">{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                  {maoObra.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-zinc-500 bg-zinc-50 border-t border-zinc-200">
                          Mão de Obra
                        </td>
                      </tr>
                      {maoObra.map((item, i) => (
                        <tr key={i} className="border-t border-zinc-100">
                          <td className="px-3 py-2 text-zinc-800">{item.descricao}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{item.quantidade} h</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{fmt(item.precoUnit)}</td>
                          <td className="px-3 py-2 text-right text-zinc-500">{item.iva}%</td>
                          <td className="px-3 py-2 text-right font-medium text-zinc-800">{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Totais */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Subtotal (sem IVA)</span>
                <span>{fmt(baseTotal)}</span>
              </div>
              {Array.from(ivaMap.entries()).map(([taxa, valor]) => (
                <div key={taxa} className="flex justify-between text-sm text-zinc-600">
                  <span>IVA {taxa}%</span>
                  <span>{fmt(valor)}</span>
                </div>
              ))}
              <div className="flex justify-between text-base font-bold text-zinc-900 border-t border-zinc-300 pt-2 mt-2">
                <span>Total</span>
                <span>{fmt(data.totalComIva)}</span>
              </div>
            </div>
          </div>

          {/* Observações */}
          {data.observacoes && (
            <div className="border-t border-zinc-200 pt-4 mb-6">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Observações</h3>
              <p className="text-sm text-zinc-700">{data.observacoes}</p>
            </div>
          )}

          {/* Assinaturas */}
          <div className="border-t border-zinc-200 pt-8 mt-8 grid grid-cols-2 gap-12">
            <div>
              <div className="border-b border-zinc-400 h-12 mb-2" />
              <p className="text-xs text-zinc-500 text-center">Assinatura do cliente</p>
            </div>
            <div>
              <div className="border-b border-zinc-400 h-12 mb-2" />
              <p className="text-xs text-zinc-500 text-center">Assinatura da oficina</p>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>
    </>
  )
}
