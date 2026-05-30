'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hideTitle?: boolean
  hideHeader?: boolean
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-5xl',
}

export function Modal({ open, onClose, title, children, size = 'md', hideTitle = false, hideHeader = false }: ModalProps) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      let id2 = 0
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(id1)
        if (id2) cancelAnimationFrame(id2)
      }
    }
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), 200)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      window.addEventListener('keydown', onEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4',
        'transition-opacity duration-200 ease-apple',
        visible ? 'opacity-100' : 'opacity-0'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto',
          'transition-[opacity,transform] duration-300 ease-apple will-change-transform',
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideHeader && (
          <div className="flex items-center justify-between p-5 border-b border-zinc-100">
            <h3 className={cn('font-bold text-zinc-900', hideTitle && 'sr-only')}>{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
