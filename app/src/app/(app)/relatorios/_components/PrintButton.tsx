'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-secondary print:hidden"
    >
      <Printer className="w-4 h-4" />
      Imprimir / PDF
    </button>
  )
}
