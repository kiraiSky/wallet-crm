/**
 * Pequeno componente para mostrar a bandeira de um país.
 * Usa o CDN flagcdn.com (SVG) para garantir que renderiza no Windows,
 * onde os emojis 🇵🇹 etc. não têm desenho na fonte padrão.
 */
interface FlagProps {
  iso2: string
  className?: string
  alt?: string
}

export function Flag({ iso2, className, alt }: FlagProps) {
  const code = iso2.toLowerCase()
  return (
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={alt ?? iso2.toUpperCase()}
      width={20}
      height={15}
      loading="lazy"
      className={
        className ??
        'w-5 h-[15px] rounded-[2px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] object-cover flex-shrink-0'
      }
    />
  )
}
