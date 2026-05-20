// Resolve um identificador de período em datas concretas (start inclusive, end exclusive).
// Aceita presets ('mes-atual', 'mes-passado', 'trimestre', 'ano') ou range custom via from/to (YYYY-MM-DD).

export type PeriodKey = 'mes-atual' | 'mes-passado' | 'trimestre' | 'ano' | 'custom'

export type ResolvedPeriod = {
  key: PeriodKey
  label: string
  start: Date
  end: Date // exclusivo
  fromInput: string // YYYY-MM-DD (start)
  toInput: string   // YYYY-MM-DD (end - 1 dia, para input <type=date>)
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MONTHS_PT_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function resolvePeriod(params: {
  preset?: string
  from?: string
  to?: string
}): ResolvedPeriod {
  const now = new Date()
  const preset = (params.preset || 'mes-atual') as PeriodKey

  if (preset === 'custom' && params.from && params.to) {
    const start = new Date(params.from)
    const endInclusive = new Date(params.to)
    const end = new Date(endInclusive.getFullYear(), endInclusive.getMonth(), endInclusive.getDate() + 1)
    return {
      key: 'custom',
      label: `${ymd(start)} → ${ymd(endInclusive)}`,
      start,
      end,
      fromInput: ymd(start),
      toInput: ymd(endInclusive),
    }
  }

  if (preset === 'mes-passado') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      key: 'mes-passado',
      label: `${MONTHS_PT_LONG[start.getMonth()]} ${start.getFullYear()}`,
      start,
      end,
      fromInput: ymd(start),
      toInput: ymd(new Date(end.getTime() - 86400000)),
    }
  }

  if (preset === 'trimestre') {
    // Últimos 3 meses (incluindo o atual)
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return {
      key: 'trimestre',
      label: 'Últimos 3 meses',
      start,
      end,
      fromInput: ymd(start),
      toInput: ymd(new Date(end.getTime() - 86400000)),
    }
  }

  if (preset === 'ano') {
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear() + 1, 0, 1)
    return {
      key: 'ano',
      label: `${start.getFullYear()}`,
      start,
      end,
      fromInput: ymd(start),
      toInput: ymd(new Date(end.getTime() - 86400000)),
    }
  }

  // mes-atual (default)
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return {
    key: 'mes-atual',
    label: `${MONTHS_PT_LONG[start.getMonth()]} ${start.getFullYear()}`,
    start,
    end,
    fromInput: ymd(start),
    toInput: ymd(new Date(end.getTime() - 86400000)),
  }
}
