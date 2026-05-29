'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Expand,
  ImageIcon,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImageFile } from '@/lib/image-compression'
import type { WorkOrderPhotoRow } from './page'
import { deleteWorkOrderPhoto, saveWorkOrderPhoto, type WorkOrderPhotoSlot } from './photo-actions'

const PHOTO_GUIDE: {
  slot: WorkOrderPhotoSlot
  title: string
  hint: string
  required: boolean
}[] = [
  { slot: 'FRONT', title: 'Frente', hint: 'Matricula e para-choques visiveis.', required: true },
  { slot: 'LEFT_SIDE', title: 'Lado esquerdo', hint: 'Apanha portas, jantes e riscos.', required: true },
  { slot: 'RIGHT_SIDE', title: 'Lado direito', hint: 'Repete o enquadramento do outro lado.', required: true },
  { slot: 'REAR', title: 'Traseira', hint: 'Matricula, tampa e para-choques.', required: true },
  { slot: 'INTERIOR', title: 'Interior', hint: 'Bancos, consola e estado geral.', required: true },
  { slot: 'ODOMETER', title: 'Painel / km', hint: 'Mostra quilometragem e avisos.', required: true },
  { slot: 'DAMAGE', title: 'Danos / detalhes', hint: 'Riscos, mossas, luzes ou pneus.', required: false },
  { slot: 'EXTRA', title: 'Extra', hint: 'Qualquer angulo que ajude a documentar.', required: false },
]

type Props = {
  workOrderId: string
  photos: WorkOrderPhotoRow[]
}

export function VehiclePhotosSection({ workOrderId, photos }: Props) {
  const required = PHOTO_GUIDE.filter((item) => item.required)
  const completedRequired = required.filter((item) => photos.some((photo) => photo.slot === item.slot)).length
  const [expanded, setExpanded] = useState(false)
  const [viewer, setViewer] = useState<WorkOrderPhotoRow | null>(null)

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full px-4 py-3 flex flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between hover:bg-zinc-50 transition"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900">Fotos da viatura</h3>
            <span className="text-xs text-zinc-500">
              {completedRequired}/{required.length} essenciais
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-zinc-400 transition-transform',
                expanded && 'rotate-180'
              )}
            />
          </div>
          <div
            className={cn(
              'text-xs text-zinc-500 mt-0.5 truncate leading-4 transition-opacity duration-200',
              expanded ? 'opacity-0' : 'opacity-100'
            )}
            aria-hidden={expanded}
          >
            {photos.length > 0
              ? `${photos.length} ${photos.length === 1 ? 'foto guardada' : 'fotos guardadas'}`
              : 'Sem fotos guardadas'}
          </div>
        </div>
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden sm:w-40">
          <div
            className="h-full bg-sky-500 transition-all"
            style={{ width: `${Math.round((completedRequired / required.length) * 100)}%` }}
          />
        </div>
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-500 ease-apple',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              'p-3 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-2 transition-all duration-500 ease-apple',
              expanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
            )}
          >
          {PHOTO_GUIDE.map((guide) => (
            <PhotoSlotCard
              key={guide.slot}
              guide={guide}
              workOrderId={workOrderId}
              photos={photos.filter((photo) => photo.slot === guide.slot)}
              onView={setViewer}
            />
          ))}
          </div>
        </div>
      </div>

      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setViewer(null)}
        >
          <div className="relative max-w-5xl max-h-[94vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setViewer(null)}
              className="absolute -top-2 -right-2 z-10 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-zinc-600 hover:text-zinc-900"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/work-order-photos/${viewer.id}`}
              alt={viewer.filename}
              className="max-w-full max-h-[94vh] rounded-xl object-contain bg-white"
            />
            {viewer.note && (
              <div className="absolute left-3 right-3 bottom-3 bg-white/95 rounded-lg px-3 py-2 text-sm text-zinc-700 shadow">
                {viewer.note}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PhotoSlotCard({
  guide,
  workOrderId,
  photos,
  onView,
}: {
  guide: (typeof PHOTO_GUIDE)[number]
  workOrderId: string
  photos: WorkOrderPhotoRow[]
  onView: (photo: WorkOrderPhotoRow) => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const latest = photos[0] ?? null
  const done = photos.length > 0
  const busy = pending || processing || uploading

  async function handleSelectedPhoto(nextFile: File) {
    setMessage(null)
    setProcessing(true)
    try {
      const compressed = await compressImageFile(nextFile, { fallbackName: 'foto-viatura' })
      setFile(compressed)
      uploadPhoto(compressed, '')
    } catch (error) {
      console.error(error)
      setMessage('Nao foi possivel compactar esta foto.')
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } finally {
      setProcessing(false)
    }
  }

  function uploadPhoto(nextFile: File, nextNote = note) {
    setMessage(null)

    const fd = new FormData()
    fd.set('workOrderId', workOrderId)
    fd.set('slot', guide.slot)
    fd.set('photo', nextFile)
    if (nextNote.trim()) fd.set('note', nextNote.trim())

    setUploading(true)
    startTransition(async () => {
      try {
        const res = await saveWorkOrderPhoto({ ok: false }, fd)
        if (res.ok) {
          setFile(null)
          setNote('')
          if (inputRef.current) inputRef.current.value = ''
          router.refresh()
        } else {
          setMessage(res.message ?? 'Nao foi possivel guardar a foto.')
        }
      } finally {
        setUploading(false)
      }
    })
  }

  function submitPhoto(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      inputRef.current?.click()
      return
    }
    uploadPhoto(file)
  }

  function removePhoto(photo: WorkOrderPhotoRow) {
    if (!confirm(`Remover foto "${guide.title}"?`)) return
    startTransition(async () => {
      const res = await deleteWorkOrderPhoto(photo.id)
      if (!res.ok) setMessage(res.message ?? 'Nao foi possivel remover a foto.')
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={submitPhoto}
      className={cn(
        'rounded-xl border bg-white p-2 flex gap-2 min-h-[100px]',
        done ? 'border-sky-200' : guide.required ? 'border-amber-200' : 'border-zinc-200'
      )}
    >
      <div className="relative w-24 h-24 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0">
        {latest ? (
          <div className="group/photo w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/work-order-photos/${latest.id}`}
              alt={latest.filename}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onView(latest)}
              className="absolute right-1 top-1 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center text-zinc-700 hover:bg-white"
              aria-label="Ver foto"
            >
              <Expand className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removePhoto(latest)}
              disabled={busy}
              className="absolute left-1 top-1 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center text-red-600 opacity-0 transition hover:bg-red-50 group-hover/photo:opacity-100 focus:opacity-100 disabled:opacity-50"
              aria-label={`Remover foto ${guide.title}`}
              title="Remover foto"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-sky-600 hover:bg-sky-50 transition"
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Sem foto</span>
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-zinc-900 text-sm leading-tight">{guide.title}</div>
              <p className="text-[11px] text-zinc-500 mt-1 leading-snug line-clamp-2">{guide.hint}</p>
            </div>
            {done ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                <CheckCircle2 className="w-3 h-3" /> OK
              </span>
            ) : guide.required ? (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                Essencial
              </span>
            ) : null}
          </div>
        </div>

        {photos.length > 1 && (
          <div className="flex gap-1 overflow-x-auto">
            {photos.map((photo) => (
              <div key={photo.id} className="relative w-8 h-8 rounded-md border border-zinc-200 overflow-hidden flex-shrink-0 group/thumb">
                <button
                  type="button"
                  onClick={() => onView(photo)}
                  className="w-full h-full"
                  title={photo.filename}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/work-order-photos/${photo.id}`} alt={photo.filename} className="w-full h-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  disabled={pending}
                  className="absolute inset-0 bg-red-600/85 text-white flex items-center justify-center opacity-0 transition group-hover/thumb:opacity-100 focus:opacity-100 disabled:opacity-50"
                  aria-label={`Remover foto ${guide.title}`}
                  title="Remover foto"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const nextFile = e.target.files?.[0] ?? null
            setMessage(null)
            if (nextFile) void handleSelectedPhoto(nextFile)
          }}
        />

        <div className="space-y-1.5 mt-auto">
          {(file || processing) && busy && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 border border-zinc-200 px-2 py-1">
              <span className="text-xs text-zinc-600 truncate">
                {processing ? 'A compactar foto...' : file?.name}
              </span>
              <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin flex-shrink-0" />
            </div>
          )}

          {file && !busy && (
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota opcional"
              className="input-base text-xs py-1.5"
              maxLength={160}
            />
          )}

          {message && <div className="text-xs text-red-600">{message}</div>}

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-secondary text-xs px-2 py-1.5"
              disabled={busy}
            >
              <Camera className="w-3.5 h-3.5" />
              {done ? 'Nova foto' : 'Tirar foto'}
            </button>
            {file && !busy && (
              <button
                type="submit"
                className="btn-primary px-2 py-1.5"
                title="Guardar nota na foto"
              >
                <UploadCloud className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
