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

/**
 * Converte um número de telefone para o formato internacional usado no wa.me.
 * Aceita formatos pt-PT comuns ("932 555 666", "+351 932 555 666", "00351...").
 * Default country code: Portugal (351). Devolve `null` se não der para extrair dígitos.
 */
export function whatsappUrl(phone: string | null | undefined, defaultCountryCode = '351'): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  // Drop leading 00 (international prefix)
  if (digits.startsWith('00')) digits = digits.slice(2)
  // Add default country code if missing (PT mobile/fixed numbers are 9 digits)
  if (digits.length === 9) digits = defaultCountryCode + digits
  return `https://wa.me/${digits}`
}
