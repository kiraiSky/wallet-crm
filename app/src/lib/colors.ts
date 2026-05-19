// Mapas estáticos de cores (Tailwind precisa de classes literais pra purgar)
// Mantidos em arquivo sem 'use client' pra poder ser importado de Server e Client Components

export const COLOR_OPTIONS = [
  'emerald',
  'violet',
  'orange',
  'sky',
  'rose',
  'amber',
  'teal',
  'pink',
  'cyan',
  'zinc',
] as const

export type ColorName = (typeof COLOR_OPTIONS)[number]

export const colorBg: Record<string, string> = {
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  orange: 'bg-orange-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
  zinc: 'bg-zinc-500',
}

export const colorRing: Record<string, string> = {
  emerald: 'ring-emerald-500',
  violet: 'ring-violet-500',
  orange: 'ring-orange-500',
  sky: 'ring-sky-500',
  rose: 'ring-rose-500',
  amber: 'ring-amber-500',
  teal: 'ring-teal-500',
  pink: 'ring-pink-500',
  cyan: 'ring-cyan-500',
  zinc: 'ring-zinc-500',
}

export const colorGradient: Record<string, string> = {
  emerald: 'from-emerald-500 to-emerald-600',
  violet: 'from-violet-500 to-violet-600',
  orange: 'from-orange-500 to-orange-600',
  sky: 'from-sky-500 to-sky-600',
  rose: 'from-rose-500 to-rose-600',
  amber: 'from-amber-500 to-amber-600',
  teal: 'from-teal-500 to-teal-600',
  pink: 'from-pink-500 to-pink-600',
  cyan: 'from-cyan-500 to-cyan-600',
  zinc: 'from-zinc-500 to-zinc-600',
}

export const colorIconBg: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
  orange: 'bg-orange-100 text-orange-700',
  sky: 'bg-sky-100 text-sky-700',
  rose: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700',
  teal: 'bg-teal-100 text-teal-700',
  pink: 'bg-pink-100 text-pink-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  zinc: 'bg-zinc-100 text-zinc-700',
}

// Mapa de cores pra bg-X-500 puro (pra barras de progresso)
export const colorBgSolid: Record<string, string> = {
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  orange: 'bg-orange-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
  zinc: 'bg-zinc-500',
}
