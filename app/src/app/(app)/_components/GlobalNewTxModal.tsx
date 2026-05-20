'use client'

import { useEffect, useState } from 'react'
import { TransactionModal } from '@/app/(app)/lancamentos/TransactionModal'
import { NEW_TX_EVENT, type NewTxDetail } from '@/lib/newTxBus'
import type { WorkOrderOption } from '@/app/(app)/lancamentos/page'

type Account = { id: string; nome: string; cor: string; icone: string }
type Category = {
  id: string
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  cor: string
  icone: string
  parentId?: string | null
}

interface Props {
  accounts: Account[]
  categories: Category[]
  workOrderOptions: WorkOrderOption[]
}

export function GlobalNewTxModal({ accounts, categories, workOrderOptions }: Props) {
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<'ENTRADA' | 'SAIDA'>('SAIDA')

  useEffect(() => {
    function onNew(e: Event) {
      const detail = (e as CustomEvent<NewTxDetail>).detail
      setTipo(detail?.tipo ?? 'SAIDA')
      setOpen(true)
    }
    window.addEventListener(NEW_TX_EVENT, onNew)
    return () => window.removeEventListener(NEW_TX_EVENT, onNew)
  }, [])

  return (
    <TransactionModal
      open={open}
      onClose={() => setOpen(false)}
      tipo={tipo}
      transaction={null}
      accounts={accounts}
      categories={categories}
      workOrderOptions={workOrderOptions}
    />
  )
}
