import { prisma } from './prisma'
import { auth } from './auth'

export type AuditEntity =
  | 'TRANSACTION'
  | 'CUSTOMER'
  | 'VEHICLE'
  | 'WORK_ORDER'
  | 'WORK_ORDER_ITEM'
  | 'USER'
  | 'ACCOUNT'
  | 'CATEGORY'
  | 'MOLONI_CONNECTION'

export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'STATUS_CHANGE'

// Decimals e Dates não são serializáveis directamente — converte tudo a JSON-safe.
function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if (typeof (value as { toJSON?: () => unknown }).toJSON === 'function') {
      return (value as { toJSON: () => unknown }).toJSON()
    }
    if (Array.isArray(value)) return value.map(toJsonSafe)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v)
    return out
  }
  return value
}

export async function logAudit(params: {
  entityType: AuditEntity
  entityId: string
  action: AuditActionType
  summary?: string
  before?: unknown
  after?: unknown
}) {
  try {
    const session = await auth()
    await prisma.auditLog.create({
      data: {
        userId: session?.user?.id ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        summary: params.summary ?? null,
        before: params.before !== undefined ? (toJsonSafe(params.before) as object) : undefined,
        after: params.after !== undefined ? (toJsonSafe(params.after) as object) : undefined,
      },
    })
  } catch (e) {
    console.error('[audit] falhou a registar entrada', e)
  }
}
