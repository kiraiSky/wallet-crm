'use client'

import { useState, useTransition } from 'react'
import { Share2, Copy, Check, X, Link as LinkIcon, Trash2 } from 'lucide-react'
import { generateShareToken, revokeShareToken } from './share-actions'

type Props = {
  workOrderId: string
  numero: number
  initialToken: string | null
}

export function ShareButton({ workOrderId, numero, initialToken }: Props) {
  const [pending, startTransition] = useTransition()
  const [token, setToken] = useState<string | null>(initialToken)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/partilha/${token}`
    : null

  function handleOpen() {
    setOpen(true)
    if (!token) {
      startTransition(async () => {
        const res = await generateShareToken(workOrderId)
        if (res.ok && res.token) setToken(res.token)
      })
    }
  }

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleWhatsApp() {
    if (!shareUrl) return
    const msg = encodeURIComponent(
      `Olá! Aqui está o estado da sua folha de obra #${numero}: ${shareUrl}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  function handleRevoke() {
    if (!confirm('Desativar o link? Quem tiver o link deixa de conseguir aceder.')) return
    startTransition(async () => {
      await revokeShareToken(workOrderId)
      setToken(null)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="btn-secondary inline-flex items-center gap-2 text-sm"
        title="Partilhar folha com cliente"
      >
        <Share2 className="w-4 h-4" />
        Partilhar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-500" />
                Partilhar folha #{numero}
              </h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-zinc-500 mb-4">
              O cliente pode ver o estado da folha sem precisar de conta.
            </p>

            {pending && !token ? (
              <div className="text-sm text-zinc-400 text-center py-4">A gerar link…</div>
            ) : shareUrl ? (
              <div className="space-y-3">
                {/* Link */}
                <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-zinc-600 truncate flex-1 font-mono">{shareUrl}</span>
                  <button
                    onClick={handleCopy}
                    className="text-zinc-400 hover:text-zinc-700 flex-shrink-0"
                    title="Copiar link"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 btn-secondary text-sm inline-flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button
                    onClick={handleWhatsApp}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </button>
                </div>

                {/* Revogar */}
                <button
                  onClick={handleRevoke}
                  disabled={pending}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-red-500 mt-1 py-1 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Desativar link
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
