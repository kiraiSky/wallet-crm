// Formatadores EUR e datas (pt-PT)
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

export function formatEUR(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(num)
}

export function parseEURToCents(input: string): number {
  // Aceita "1.234,56" ou "1234.56" ou "1234,56"
  const cleaned = input.replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  return Math.round(parseFloat(normalized) * 100)
}

export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function formatDate(date: Date | string, pattern = "dd/MM/yyyy"): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, pattern, { locale: pt })
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, "dd/MM/yyyy HH:mm")
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { locale: pt, addSuffix: true })
}
