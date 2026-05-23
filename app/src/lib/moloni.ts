import { prisma } from './prisma'
import { decryptSecret, encryptSecret } from './crypto'

const MOLONI_AUTH_URL = 'https://www.moloni.pt/ac/root/oauth/'
const MOLONI_GRANT_URL = 'https://api.moloni.pt/v1/grant/'
const MOLONI_API_BASE = 'https://api.moloni.pt/v1'

type MoloniTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export type MoloniCompany = {
  company_id: number
  name: string
  vat?: string
  email?: string
}

export type MoloniDocumentPayload = {
  document_id: number
  document_type_id: number
  document_set_id?: number
  number?: number
  date?: string
  expiration_date?: string | null
  entity_name?: string
  entity_vat?: string
  gross_value?: number
  net_value?: number
  taxes_value?: number
  status?: number
  document_type?: { saft_code?: string; title?: string }
  updated_at?: string
  modified_at?: string
}

// Endpoints Moloni por tipo de documento (SAF-T codes)
// FT = Fatura, FR = Fatura-Recibo, ND = Nota de Débito, NC = Nota de Crédito
// RC = Recibo, VD = Venda a Dinheiro, OR = Orçamento, EC = Encomenda
const DOCUMENT_ENDPOINTS: Array<{ path: string; modifiedPath: string; type: string }> = [
  { path: '/invoices/getAll/',          modifiedPath: '/invoices/getModifiedSince/',          type: 'FT' },
  { path: '/receipts/getAll/',          modifiedPath: '/receipts/getModifiedSince/',          type: 'FR' },
  { path: '/simplifiedInvoices/getAll/', modifiedPath: '/simplifiedInvoices/getModifiedSince/', type: 'FS' },
  { path: '/creditNotes/getAll/',       modifiedPath: '/creditNotes/getModifiedSince/',       type: 'NC' },
  { path: '/debitNotes/getAll/',        modifiedPath: '/debitNotes/getModifiedSince/',        type: 'ND' },
  { path: '/cashSaleInvoices/getAll/',  modifiedPath: '/cashSaleInvoices/getModifiedSince/',  type: 'VD' },
  { path: '/proFormaInvoices/getAll/',  modifiedPath: '/proFormaInvoices/getModifiedSince/',  type: 'PF' },
  { path: '/quotes/getAll/',            modifiedPath: '/quotes/getModifiedSince/',            type: 'OR' },
]

export function getMoloniConfig() {
  const clientId = process.env.MOLONI_CLIENT_ID
  const clientSecret = process.env.MOLONI_CLIENT_SECRET
  const redirectUri = process.env.MOLONI_REDIRECT_URI
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret && redirectUri),
  }
}

export function buildMoloniAuthUrl(state: string) {
  const config = getMoloniConfig()
  if (!config.clientId || !config.redirectUri) throw new Error('Integração Moloni sem configuração')
  const url = new URL(MOLONI_AUTH_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('state', state)
  return url.toString()
}

async function moloniGrant(params: Record<string, string>): Promise<MoloniTokenResponse> {
  const url = new URL(MOLONI_GRANT_URL)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const res = await fetch(url, { method: 'GET', cache: 'no-store' })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || 'Falha na autenticação Moloni')
  }
  return data as MoloniTokenResponse
}

export async function exchangeMoloniCode(code: string) {
  const config = getMoloniConfig()
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error('Integração Moloni sem configuração')
  }
  return moloniGrant({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  })
}

async function refreshMoloniToken(connectionId: string, encryptedRefreshToken: string) {
  const config = getMoloniConfig()
  if (!config.clientId || !config.clientSecret) throw new Error('Integração Moloni sem configuração')
  const tokens = await moloniGrant({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: decryptSecret(encryptedRefreshToken),
  })
  const tokenExpiresAt = new Date(Date.now() + Math.max(0, tokens.expires_in - 60) * 1000)
  await prisma.moloniConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      tokenExpiresAt,
    },
  })
  return tokens.access_token
}

export async function getMoloniAccessToken(connectionId: string) {
  const connection = await prisma.moloniConnection.findUnique({ where: { id: connectionId } })
  if (!connection) throw new Error('Moloni não está conectado')
  if (connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(connection.accessToken)
  }
  return refreshMoloniToken(connection.id, connection.refreshToken)
}

async function moloniPost<T>(connectionId: string, path: string, body: Record<string, unknown>) {
  const accessToken = await getMoloniAccessToken(connectionId)
  const url = new URL(`${MOLONI_API_BASE}${path}`)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('json', 'true')
  url.searchParams.set('human_errors', 'true')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || data?.error) {
    throw new Error(data?.error_description || data?.error || `Erro Moloni em ${path}`)
  }
  return data as T
}

export async function fetchMoloniCompanies(connectionId: string) {
  return moloniPost<MoloniCompany[]>(connectionId, '/companies/getAll/', {})
}

/**
 * Busca todos os tipos de documentos suportados.
 * Cada doc vem acompanhado do campo `_documentType` com o código SAF-T.
 */
export async function fetchAllMoloniDocuments(
  connectionId: string,
  companyId: number,
  lastModified: Date | null,
): Promise<Array<MoloniDocumentPayload & { _documentType: string }>> {
  const results: Array<MoloniDocumentPayload & { _documentType: string }> = []

  for (const endpoint of DOCUMENT_ENDPOINTS) {
    try {
      const path = lastModified ? endpoint.modifiedPath : endpoint.path
      const body: Record<string, unknown> = {
        company_id: companyId,
        qty: 100,
        offset: 0,
      }
      if (lastModified) {
        body.lastmodified = lastModified.toISOString().slice(0, 19).replace('T', ' ')
      }
      const docs = await moloniPost<MoloniDocumentPayload[]>(connectionId, path, body)
      if (Array.isArray(docs)) {
        for (const doc of docs) {
          results.push({ ...doc, _documentType: endpoint.type })
        }
      }
    } catch {
      // endpoint pode não existir ou não ter documentos — ignorar silenciosamente
    }
  }

  return results
}

/** Mantido para compatibilidade — usa o endpoint genérico de documentos */
export async function fetchMoloniDocuments(
  connectionId: string,
  companyId: number,
  lastModified: Date | null,
) {
  return fetchAllMoloniDocuments(connectionId, companyId, lastModified)
}

export function tokenExpiryDate(expiresIn: number) {
  return new Date(Date.now() + Math.max(0, expiresIn - 60) * 1000)
}

export function mapMoloniDocument(
  raw: MoloniDocumentPayload & { _documentType?: string },
) {
  return {
    documentId: raw.document_id,
    documentTypeId: raw.document_type_id,
    documentSetId: raw.document_set_id ?? null,
    documentType: raw._documentType ?? raw.document_type?.saft_code ?? null,
    number: raw.number ?? null,
    date: raw.date ? new Date(raw.date) : null,
    expirationDate: raw.expiration_date ? new Date(raw.expiration_date) : null,
    entityName: raw.entity_name ?? null,
    entityVat: raw.entity_vat ?? null,
    grossValue: raw.gross_value ?? 0,
    netValue: raw.net_value ?? 0,
    taxesValue: raw.taxes_value ?? 0,
    status: raw.status ?? null,
    saftCode: raw.document_type?.saft_code ?? raw._documentType ?? null,
    modifiedAt: raw.modified_at || raw.updated_at
      ? new Date((raw.modified_at ?? raw.updated_at)!)
      : null,
    raw: raw as object,
  }
}

/**
 * Após sync, faz match automático entre MoloniDocument.entityVat e Customer.nif
 * e preenche customerId nos documentos ainda sem customer.
 */
export async function matchMoloniDocumentsToCustomers(connectionId: string) {
  // Buscar docs sem customer que tenham NIF
  const unmatched = await prisma.moloniDocument.findMany({
    where: { connectionId, customerId: null, entityVat: { not: null } },
    select: { id: true, entityVat: true },
  })

  if (unmatched.length === 0) return 0

  // Buscar todos os customers com NIF
  const customers = await prisma.customer.findMany({
    where: { nif: { not: null } },
    select: { id: true, nif: true },
  })

  const nifMap = new Map(customers.map((c) => [c.nif!.replace(/\s/g, ''), c.id]))

  let matched = 0
  for (const doc of unmatched) {
    const vat = doc.entityVat!.replace(/\s/g, '')
    const customerId = nifMap.get(vat)
    if (customerId) {
      await prisma.moloniDocument.update({
        where: { id: doc.id },
        data: { customerId },
      })
      matched++
    }
  }

  return matched
}
