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

type MoloniDocumentPayload = {
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
  document_type?: { saft_code?: string }
  updated_at?: string
  modified_at?: string
}

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

export async function fetchMoloniDocuments(connectionId: string, companyId: number, lastModified: Date | null) {
  const path = lastModified ? '/documents/getModifiedSince/' : '/documents/getAll/'
  return moloniPost<MoloniDocumentPayload[]>(connectionId, path, {
    company_id: companyId,
    qty: 50,
    offset: 0,
    ...(lastModified && { lastmodified: lastModified.toISOString().slice(0, 19).replace('T', ' ') }),
  })
}

export function tokenExpiryDate(expiresIn: number) {
  return new Date(Date.now() + Math.max(0, expiresIn - 60) * 1000)
}

export function mapMoloniDocument(raw: MoloniDocumentPayload) {
  return {
    documentId: raw.document_id,
    documentTypeId: raw.document_type_id,
    documentSetId: raw.document_set_id ?? null,
    number: raw.number ?? null,
    date: raw.date ? new Date(raw.date) : null,
    expirationDate: raw.expiration_date ? new Date(raw.expiration_date) : null,
    entityName: raw.entity_name ?? null,
    entityVat: raw.entity_vat ?? null,
    grossValue: raw.gross_value ?? 0,
    netValue: raw.net_value ?? 0,
    taxesValue: raw.taxes_value ?? 0,
    status: raw.status ?? null,
    saftCode: raw.document_type?.saft_code ?? null,
    modifiedAt: raw.modified_at || raw.updated_at ? new Date(raw.modified_at ?? raw.updated_at!) : null,
    raw: raw as object,
  }
}
