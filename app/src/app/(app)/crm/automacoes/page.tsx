import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { getTemplates, getRecentLogs } from './actions'
import { AutomacoesClient } from './AutomacoesClient'

export const metadata = { title: 'Automações — Shift' }

export default async function AutomacoesPage() {
  const me = await getCurrentUser()
  if (me.role !== 'OWNER') redirect('/crm')

  const [templates, logs] = await Promise.all([getTemplates(), getRecentLogs()])
  return <AutomacoesClient templates={templates} logs={logs} />
}
