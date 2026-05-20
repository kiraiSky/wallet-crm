'use client'

import { useEffect, useState } from 'react'
import { X, FileText, Download, ChevronLeft, ChevronRight, Pencil, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR, formatDateTime } from '@/lib/format'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorIconBg } from '@/lib/colors'

export type AttachmentInfo = {
  id: string
  filename: string
  mimeType: string
}

export type ViewerTransaction = {
  id: string
  tipo: 'ENTRADA' | 'SAIDA'
  valor: number
  descricao: string
  data: string // ISO
  observacao: string | null
  agendado?: boolean
  dataAgendada?: string | null
  account: { nome: string; cor?: string; icone?: string }
  category: { nome: string; cor: string; icone: string }
  workOrder?: { id?: string; numero: number; customer?: { nome: string } } | null
  attachments: AttachmentInfo[]
}

interface Props {
  open: boolean
  onClose: () => void
  transaction: ViewerTransaction | null
  initialAttachmentId?: string
  onEdit?: (tx: ViewerTransaction) => void
}

export function AttachmentViewer({ open, onClose, transaction, initialAttachmentId, onEdit }: Props) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!open || !transaction) return
    const start = initialAttachmentId
      ? Math.max(0, transaction.attachments.findIndex((a) => a.id === initialAttachmentId))
      : 0
    setIdx(start)
  }, [open, transaction?.id, initialAttachmentId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (!transaction) return
      const n = transaction.attachments.length
      if (n <= 1) return
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % n)
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + n) % n)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, transaction, onClose])

  if (!open || !transaction) return null
  const attachment = transaction.attachments[idx] ?? null
  const url = attachment ? `/api/uploads/${attachment.id}` : null
  const isImage = attachment?.mimeType.startsWith('image/')
  const isPdf = attachment?.mimeType === 'application/pdf'

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview pane */}
        <div className="relative flex-1 bg-zinc-100 min-h-[50vh] md:min-h-0 flex items-center justify-center overflow-auto">
          {attachment ? (
            <>
              {isImage && url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={attachment.filename} className="max-w-full max-h-[90vh] object-contain" />
              )}
              {isPdf && url && (
                <object data={url} type="application/pdf" className="w-full h-[80vh]">
                  <div className="flex flex-col items-center gap-3 p-8 text-center">
                    <FileText className="w-12 h-12 text-zinc-400" />
                    <p className="text-sm text-zinc-600">Não foi possível pré-visualizar o PDF.</p>
                    <a href={url} target="_blank" rel="noreferrer" className="btn-primary">
                      <ExternalLink className="w-4 h-4" /> Abrir noutro separador
                    </a>
                  </div>
                </object>
              )}
              {!isImage && !isPdf && url && (
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <FileText className="w-12 h-12 text-zinc-400" />
                  <p className="text-sm text-zinc-600">{attachment.filename}</p>
                  <a href={url} target="_blank" rel="noreferrer" className="btn-primary">
                    <Download className="w-4 h-4" /> Descarregar
                  </a>
                </div>
              )}

              {transaction.attachments.length > 1 && (
                <>
                  <button
                    onClick={() => setIdx((i) => (i - 1 + transaction.attachments.length) % transaction.attachments.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIdx((i) => (i + 1) % transaction.attachments.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                    aria-label="Próximo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-zinc-900/70 text-white text-xs px-2 py-0.5 rounded-full">
                    {idx + 1} / {transaction.attachments.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-zinc-500">
              <FileText className="w-12 h-12 text-zinc-300" />
              <p className="text-sm">Sem anexo neste movimento.</p>
            </div>
          )}
        </div>

        {/* Details pane */}
        <aside className="w-full md:w-[360px] border-t md:border-t-0 md:border-l border-zinc-200 flex flex-col">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900">Detalhes do movimento</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                colorIconBg[transaction.category.cor] || colorIconBg.violet
              )}>
                <DynamicIcon name={transaction.category.icone} className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-900 break-words">
                  {transaction.descricao}
                </div>
                <div className="text-xs text-zinc-500">{transaction.category.nome}</div>
              </div>
              <div className={cn(
                'text-base font-bold whitespace-nowrap',
                transaction.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-500'
              )}>
                {transaction.tipo === 'ENTRADA' ? '+ ' : '- '}{formatEUR(transaction.valor)}
              </div>
            </div>

            {transaction.agendado && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <strong>Pagamento agendado</strong> — previsto para{' '}
                {transaction.dataAgendada ? formatDateTime(transaction.dataAgendada) : '—'}
              </div>
            )}

            <Row label="Conta" value={transaction.account.nome} />
            <Row label="Data" value={formatDateTime(transaction.data)} />
            {transaction.observacao && <Row label="Observação" value={transaction.observacao} />}
            {transaction.workOrder && (
              <Row
                label="Folha de obra"
                value={
                  <a
                    href={transaction.workOrder.id ? `/folhas/${transaction.workOrder.id}` : '#'}
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    #{transaction.workOrder.numero}
                    {transaction.workOrder.customer && ` · ${transaction.workOrder.customer.nome}`}
                  </a>
                }
              />
            )}

            {transaction.attachments.length > 1 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mb-1.5">
                  Anexos ({transaction.attachments.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {transaction.attachments.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => setIdx(i)}
                      className={cn(
                        'border rounded-lg overflow-hidden w-14 h-14 flex items-center justify-center bg-zinc-50',
                        i === idx ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-zinc-200'
                      )}
                      title={a.filename}
                    >
                      {a.mimeType.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/uploads/${a.id}`} alt={a.filename} className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-5 h-5 text-zinc-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {attachment && (
              <div className="pt-2 border-t border-zinc-100 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">
                  Ficheiro
                </div>
                <div className="text-xs text-zinc-700 truncate">{attachment.filename}</div>
                <div className="flex gap-2 mt-2">
                  <a
                    href={url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-xs flex-1 justify-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir
                  </a>
                  <a
                    href={url ?? '#'}
                    download={attachment.filename}
                    className="btn-secondary text-xs flex-1 justify-center"
                  >
                    <Download className="w-3.5 h-3.5" /> Descarregar
                  </a>
                </div>
              </div>
            )}
          </div>

          {onEdit && (
            <div className="p-3 border-t border-zinc-100">
              <button onClick={() => onEdit(transaction)} className="btn-primary w-full">
                <Pencil className="w-4 h-4" /> Editar movimento
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">{label}</div>
      <div className="text-sm text-zinc-800 break-words">{value}</div>
    </div>
  )
}

export function AttachmentThumb({
  attachment,
  onClick,
  size = 'sm',
}: {
  attachment: AttachmentInfo
  onClick?: () => void
  size?: 'sm' | 'md'
}) {
  const isImg = attachment.mimeType.startsWith('image/')
  const sizeClass = size === 'md' ? 'w-12 h-12' : 'w-8 h-8'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        sizeClass,
        'rounded-md border border-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center hover:border-emerald-400 transition flex-shrink-0'
      )}
      title={`Ver anexo: ${attachment.filename}`}
    >
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/uploads/${attachment.id}`}
          alt={attachment.filename}
          className="w-full h-full object-cover"
        />
      ) : (
        <FileText className="w-4 h-4 text-zinc-500" />
      )}
    </button>
  )
}
