'use client'

import { cn } from '@/lib/utils'
import { COLOR_OPTIONS, colorBg, colorRing } from '@/lib/colors'

// Re-exporta pra retro-compatibilidade dos imports existentes
export { COLOR_OPTIONS, colorBg, colorRing, colorGradient, colorIconBg } from '@/lib/colors'
export type { ColorName } from '@/lib/colors'

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'w-8 h-8 rounded-full ring-2 ring-offset-2 transition',
            colorBg[color],
            value === color ? colorRing[color] : 'ring-transparent ring-offset-0'
          )}
          aria-label={color}
        />
      ))}
    </div>
  )
}
