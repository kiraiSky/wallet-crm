// Marca Shift — chevron triplo com "rastro" de índigo.
// Reproduz fielmente o construtor do design (Shift Identidade.html):
// três chevrons em x=15/27/39, path "M x 17 L x+14 32 L x 47",
// viewBox 0 0 64 64, stroke arredondado. O degradê claro→escuro
// (#c7d2fe → #818cf8 → #4f46e5) cria a sensação de avanço/velocidade.

export type ShiftVariant = 'trail' | 'ink' | 'white' | 'solid'

const TRAIL: [string, string, string] = ['#c7d2fe', '#818cf8', '#4f46e5']
const INK: [string, string, string] = ['#1e2630', '#1e2630', '#1e2630']
const WHITE: [string, string, string] = ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.78)', '#ffffff']
const SOLID: [string, string, string] = ['#4f46e5', '#4f46e5', '#4f46e5']
const WHITE_TRAIL: [string, string, string] = ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.8)', '#ffffff']

function colorsFor(variant: ShiftVariant): [string, string, string] {
  switch (variant) {
    case 'ink':
      return INK
    case 'white':
      return WHITE
    case 'solid':
      return SOLID
    default:
      return TRAIL
  }
}

export function ShiftMark({
  size = 26,
  variant = 'trail',
  strokeWidth = 5.5,
  whiteTrail = false,
  className,
}: {
  size?: number
  variant?: ShiftVariant
  strokeWidth?: number
  /** Usa o degradê branco (para tiles/ícone de app sobre índigo). */
  whiteTrail?: boolean
  className?: string
}) {
  const [c1, c2, c3] = whiteTrail ? WHITE_TRAIL : colorsFor(variant)
  const path = (x: number, c: string) => (
    <path
      key={x}
      d={`M ${x} 17 L ${x + 14} 32 L ${x} 47`}
      stroke={c}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {path(15, c1)}
      {path(27, c2)}
      {path(39, c3)}
    </svg>
  )
}

export function ShiftLogo({
  size = 26,
  variant = 'trail',
  showName = true,
  className,
}: {
  /** Tamanho do símbolo em px (o nome escala a 0.82×). */
  size?: number
  variant?: ShiftVariant
  showName?: boolean
  className?: string
}) {
  const namePx = Math.round(size * 0.82)
  const nameColor = variant === 'white' ? '#ffffff' : '#1e2630'
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.32) }}
    >
      <ShiftMark size={size} variant={variant} />
      {showName && (
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', var(--font-sans, system-ui), sans-serif",
            fontWeight: 800,
            letterSpacing: '-0.045em',
            lineHeight: 1,
            fontSize: namePx,
            color: nameColor,
          }}
        >
          Shift
        </span>
      )}
    </span>
  )
}
