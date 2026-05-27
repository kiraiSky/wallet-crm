export type WorkOrderStatus =
  | 'ABERTA'
  | 'EM_DIAGNOSTICO'
  | 'AGUARDA_PECAS'
  | 'EM_REPARACAO'
  | 'CONCLUIDA'
  | 'FATURADA'
  | 'CANCELADA'
  | 'FINALIZADA'
  | 'PERDIDA'

// Estados que ficam no quadro Kanban
export const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'ABERTA',
  'EM_DIAGNOSTICO',
  'AGUARDA_PECAS',
  'EM_REPARACAO',
  'CONCLUIDA',
  'FATURADA',
  'CANCELADA',
]

// Estados terminais — saem do Kanban e vão para o Arquivo
export const ARQUIVO_STATUSES: WorkOrderStatus[] = ['FINALIZADA', 'PERDIDA']

export const STATUS_LIST: WorkOrderStatus[] = [...ACTIVE_STATUSES, ...ARQUIVO_STATUSES]

// Fluxo "feliz" — usado para sugerir próximo estado e botão de avançar no Kanban
export const STATUS_FLOW: WorkOrderStatus[] = [
  'ABERTA',
  'EM_DIAGNOSTICO',
  'AGUARDA_PECAS',
  'EM_REPARACAO',
  'CONCLUIDA',
  'FATURADA',
]

export const STATUS_META: Record<
  WorkOrderStatus,
  { label: string; chip: string; dot: string; ring: string }
> = {
  ABERTA: {
    label: 'Aberta',
    chip: 'bg-sky-100 text-sky-700',
    dot: 'bg-sky-500',
    ring: 'ring-sky-500',
  },
  EM_DIAGNOSTICO: {
    label: 'Em diagnóstico',
    chip: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
    ring: 'ring-violet-500',
  },
  AGUARDA_PECAS: {
    label: 'Aguarda peças',
    chip: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500',
  },
  EM_REPARACAO: {
    label: 'Em reparação',
    chip: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500',
  },
  CONCLUIDA: {
    label: 'Concluída',
    chip: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500',
  },
  FATURADA: {
    label: 'Faturada',
    chip: 'bg-teal-100 text-teal-700',
    dot: 'bg-teal-500',
    ring: 'ring-teal-500',
  },
  CANCELADA: {
    label: 'Cancelada',
    chip: 'bg-zinc-100 text-zinc-600',
    dot: 'bg-zinc-400',
    ring: 'ring-zinc-400',
  },
  FINALIZADA: {
    label: 'Finalizada',
    chip: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-600',
    ring: 'ring-emerald-600',
  },
  PERDIDA: {
    label: 'Perdida',
    chip: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    ring: 'ring-red-500',
  },
}

export function nextStatus(current: WorkOrderStatus): WorkOrderStatus | null {
  const idx = STATUS_FLOW.indexOf(current)
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}
