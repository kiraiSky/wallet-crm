import { getTemplates, getRecentLogs } from './actions'
import { AutomacoesClient } from './AutomacoesClient'

export const metadata = { title: 'Automações — Carteira' }

export default async function AutomacoesPage() {
  const [templates, logs] = await Promise.all([getTemplates(), getRecentLogs()])
  return <AutomacoesClient templates={templates} logs={logs} />
}
