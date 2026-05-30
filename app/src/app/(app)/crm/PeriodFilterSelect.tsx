'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type CrmPeriod = 'week' | 'month' | 'quarter' | 'year'

const OPTIONS: { value: CrmPeriod; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Ano' },
]

export function PeriodFilterSelect({ selected }: { selected: CrmPeriod }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function changePeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', value)
    const query = params.toString()
    router.push(query ? `/crm?${query}` : '/crm')
  }

  return (
    <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => changePeriod(option.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
            selected === option.value
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
