export type Country = {
  iso2: string
  name: string
  dial: string // sem o '+'
  flag: string
}

// Lista curada — países lusófonos + UE comum + vizinhos. Ordenada por relevância.
export const COUNTRIES: Country[] = [
  { iso2: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹' },
  { iso2: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷' },
  { iso2: 'ES', name: 'Espanha', dial: '34', flag: '🇪🇸' },
  { iso2: 'FR', name: 'França', dial: '33', flag: '🇫🇷' },
  { iso2: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧' },
  { iso2: 'DE', name: 'Alemanha', dial: '49', flag: '🇩🇪' },
  { iso2: 'IT', name: 'Itália', dial: '39', flag: '🇮🇹' },
  { iso2: 'NL', name: 'Países Baixos', dial: '31', flag: '🇳🇱' },
  { iso2: 'BE', name: 'Bélgica', dial: '32', flag: '🇧🇪' },
  { iso2: 'CH', name: 'Suíça', dial: '41', flag: '🇨🇭' },
  { iso2: 'LU', name: 'Luxemburgo', dial: '352', flag: '🇱🇺' },
  { iso2: 'IE', name: 'Irlanda', dial: '353', flag: '🇮🇪' },
  { iso2: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
  { iso2: 'CA', name: 'Canadá', dial: '1', flag: '🇨🇦' },
  { iso2: 'AO', name: 'Angola', dial: '244', flag: '🇦🇴' },
  { iso2: 'MZ', name: 'Moçambique', dial: '258', flag: '🇲🇿' },
  { iso2: 'CV', name: 'Cabo Verde', dial: '238', flag: '🇨🇻' },
  { iso2: 'GW', name: 'Guiné-Bissau', dial: '245', flag: '🇬🇼' },
  { iso2: 'ST', name: 'São Tomé e Príncipe', dial: '239', flag: '🇸🇹' },
  { iso2: 'TL', name: 'Timor-Leste', dial: '670', flag: '🇹🇱' },
  { iso2: 'MO', name: 'Macau', dial: '853', flag: '🇲🇴' },
]

export const DEFAULT_COUNTRY = COUNTRIES[0] // PT

export function findCountryByIso2(iso2: string): Country | undefined {
  return COUNTRIES.find((c) => c.iso2 === iso2)
}

/**
 * Tenta extrair o país e a parte local de um telefone guardado.
 * Aceita formatos como "+351 932...", "351 932...", "00351 932...", "932 555 666".
 * Se não conseguir identificar um código de país conhecido, devolve o default (PT)
 * e mantém o número como parte local.
 */
export function parsePhone(stored: string | null | undefined): { country: Country; local: string } {
  if (!stored) return { country: DEFAULT_COUNTRY, local: '' }
  let s = stored.trim()
  // Normaliza: remove "+" inicial ou "00" internacional
  if (s.startsWith('+')) s = s.slice(1)
  else if (s.startsWith('00')) s = s.slice(2)
  const digits = s.replace(/\D/g, '')
  // Tenta encontrar prefixo de país (ordena por dial mais longo primeiro para evitar colisões)
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) {
      const local = digits.slice(c.dial.length)
      // Reconstrói com espaços a cada 3 dígitos para legibilidade
      const formatted = local.replace(/(\d{3})(?=\d)/g, '$1 ').trim()
      return { country: c, local: formatted }
    }
  }
  return { country: DEFAULT_COUNTRY, local: stored }
}

export function joinPhone(country: Country, local: string): string {
  const trimmed = local.trim()
  if (!trimmed) return ''
  return `+${country.dial} ${trimmed}`
}
