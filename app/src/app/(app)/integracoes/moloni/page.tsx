import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, User } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import { fetchMoloniCompanies, getMoloniConfig } from '@/lib/moloni'
import { formatEUR, formatDateTime } from '@/lib/format'
import { MoloniClient } from './MoloniClient'

export const dynamic = 'force-dynamic'

const DOC_TYPE_LABEL: Record<string, string> = {
  FT: 'Fatura',
  FR: 'Fatura-Recibo',
  FS: 'Fatura Simplificada',
  NC: 'Nota de Crédito',
  ND: 'Nota de Débito',
  VD: 'Venda a Dinheiro',
  PF: 'Pró-Forma',
  OR: 'Orçamento',
}

export default async function MoloniPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireOwner()
  const params = await searchParams
  const config = getMoloniConfig()
  const publicAppUrl = config.redirectUri ? new URL(config.redirectUri).origin : null
  const connection = await prisma.moloniConnection.findFirst({
    orderBy: { connectedAt: 'desc' },
    include: {
      _count: { select: { documents: true } },
      syncLogs: { orderBy: { startedAt: 'desc' }, take: 5 },
    },
  })
  const documents = connection
    ? await prisma.moloniDocument.findMany({
        where: { connectionId: connection.id },
        orderBy: { date: 'desc' },
        take: 10,
        include: { customer: { select: { id: true, nome: true } } },
      })
    : []
  const companies = connection ? await fetchMoloniCompanies(connection.id).catch(() => []) : []

  // Estatísticas rápidas
  const stats = connection
    ? await prisma.moloniDocument.groupBy({
        by: ['documentType'],
        where: { connectionId: connection.id },
        _count: true,
        _sum: { grossValue: true },
      })
    : []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Integração Moloni</h1>
        <p className="text-sm text-zinc-500">
          Sincronização de faturação Moloni com cruzamento automático de clientes e caixa.
        </p>
      </div>

      {params.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          {errorMessage(params.error)}
        </div>
      )}

      {!config.configured && (
        <div className="card p-5 border-amber-200 bg-amber-50/60">
          <h2 className="font-semibold text-zinc-900 mb-2">Configuração em falta</h2>
          <p className="text-sm text-zinc-600 mb-3">
            Define <code>MOLONI_CLIENT_ID</code>, <code>MOLONI_CLIENT_SECRET</code>, <code>MOLONI_REDIRECT_URI</code> e{' '}
            <code>MOLONI_TOKEN_ENCRYPTION_KEY</code> no ambiente do servidor.
          </p>
          <p className="text-xs text-zinc-500">
            Callback recomendado: <code>/api/integrations/moloni/callback</code>
          </p>
        </div>
      )}

      {!connection ? (
        <div className="card p-5">
          <h2 className="font-semibold text-zinc-900 mb-2">Conectar conta Moloni</h2>
          <p className="text-sm text-zinc-500 mb-4">
            A ligação usa OAuth2. A palavra-passe Moloni nunca passa por esta aplicação.
          </p>
          {publicAppUrl && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 mb-4">
              Para conectar, abre e faz login pela URL pública do túnel:{' '}
              <Link href={`${publicAppUrl}/integracoes/moloni`} className="font-semibold underline">
                {publicAppUrl}
              </Link>
            </div>
          )}
          <Link
            href="/api/integrations/moloni/connect"
            className={config.configured ? 'btn-primary inline-flex' : 'btn-secondary inline-flex pointer-events-none opacity-60'}
          >
            Conectar Moloni <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                Moloni conectado
              </div>
              <h2 className="font-semibold text-zinc-900">
                {connection.companyName ?? 'Empresa por escolher'}
              </h2>
              <p className="text-sm text-zinc-500">
                {connection.companyVat ? `NIF ${connection.companyVat} • ` : ''}
                {connection._count.documents} documentos importados
                {connection.lastSyncAt ? ` • última sync ${formatDateTime(connection.lastSyncAt)}` : ''}
              </p>
            </div>
          </div>
          <MoloniClient
            connectionId={connection.id}
            companies={companies}
            selectedCompanyId={connection.companyId}
            autoSyncEnabled={connection.autoSyncEnabled}
            autoSyncInterval={connection.autoSyncInterval}
          />
        </div>
      )}

      {connection && stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.documentType ?? 'outro'} className="card p-4">
              <div className="text-xs text-zinc-500 mb-1">
                {DOC_TYPE_LABEL[s.documentType ?? ''] ?? s.documentType ?? 'Outro'}
              </div>
              <div className="text-lg font-bold text-zinc-900">{s._count}</div>
              <div className="text-xs text-zinc-500">{formatEUR(Number(s._sum.grossValue ?? 0))}</div>
            </div>
          ))}
        </div>
      )}

      {connection && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="font-semibold text-zinc-900 mb-3">Últimos documentos</h2>
            {documents.length === 0 ? (
              <div className="text-sm text-zinc-400 py-8 text-center">Ainda sem documentos sincronizados.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-2.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 truncate">
                        {doc.entityName ?? 'Sem cliente'}
                        {doc.number ? ` #${doc.number}` : ''}
                        {doc.documentType && (
                          <span className="ml-1.5 text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                            {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 flex items-center gap-1">
                        {doc.entityVat ? `NIF ${doc.entityVat} • ` : ''}
                        {doc.date ? formatDateTime(doc.date) : 'Sem data'}
                        {doc.customer && (
                          <Link
                            href={`/clientes/${doc.customer.id}`}
                            className="ml-1 inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
                          >
                            <User className="w-3 h-3" />
                            {doc.customer.nome}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-zinc-900 shrink-0">
                      {formatEUR(Number(doc.grossValue))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-zinc-900 mb-3">Histórico de sincronização</h2>
            {connection.syncLogs.length === 0 ? (
              <div className="text-sm text-zinc-400 py-8 text-center">Ainda sem sincronizações.</div>
            ) : (
              <div className="space-y-2">
                {connection.syncLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-zinc-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className={log.status === 'SUCCESS' ? 'text-sm font-semibold text-indigo-700' : 'text-sm font-semibold text-red-600'}>
                        {log.status === 'SUCCESS' ? 'Sucesso' : 'Erro'}
                      </span>
                      <span className="text-xs text-zinc-400">{formatDateTime(log.startedAt)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {log.message ?? `${log.documentsSaved}/${log.documentsSeen} documentos guardados`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function errorMessage(error: string) {
  if (error === 'missing_config') return 'Configuração Moloni em falta no servidor.'
  if (error === 'invalid_state') return 'Validação de segurança OAuth falhou. Tenta conectar novamente.'
  if (error === 'callback_failed') return 'Não foi possível concluir a ligação ao Moloni.'
  if (error === 'wrong_origin') return 'Abre a app pela URL pública configurada no callback antes de conectar o Moloni.'
  return 'Erro na integração Moloni.'
}
