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

// ─── Tipos para criação de documentos ────────────────────────────────────────

export type MoloniCustomer = {
  customer_id: number
  name: string
  vat: string
  email?: string
  address?: string
  city?: string
  zip_code?: string
  phone?: string
  country_id?: number
}

export type MoloniDocumentSet = {
  document_set_id: number
  name: string
  document_type_id?: number
  document_types_numbers?: Array<{ document_type_id: number }>
}

export type MoloniTax = {
  tax_id: number
  name: string
  value: number
  type: number // 1 = percentagem
}

type MoloniUnit = {
  unit_id: number
  name: string
  short_name: string
}

type MoloniCreateDocumentProduct = {
  product_id?: number
  name: string
  summary?: string
  qty: number
  price: number
  discount?: number
  order?: number
  unit_id?: number
  taxes?: Array<{ tax_id: number; value: number; order: number; cumulative: number }>
  exemption_reason?: string
}

type MoloniCreateDocumentBody = {
  company_id: number
  date: string
  expiration_date?: string
  document_set_id: number
  customer_id: number
  our_reference?: string
  notes?: string
  status: number // 0 = rascunho, 1 = fechado
  products: MoloniCreateDocumentProduct[]
}

type MoloniCreateDocumentResponse = {
  document_id: number
  valid?: number
  errors?: Array<{ code: number; message: string }>
}

// ─── Clientes Moloni ──────────────────────────────────────────────────────────

export async function searchMoloniCustomerByVat(connectionId: string, companyId: number, vat: string) {
  const results = await moloniPost<MoloniCustomer[]>(connectionId, '/customers/getAll/', {
    company_id: companyId,
    qty: 50,
    offset: 0,
    vat,
  })
  if (!Array.isArray(results)) return null
  // Filtrar manualmente — a API pode ignorar o parâmetro vat e devolver todos
  const normalise = (v: string) => v.replace(/\s/g, '').toUpperCase()
  const needle = normalise(vat)
  return results.find((c) => c.vat && normalise(c.vat) === needle) ?? null
}

export async function createMoloniCustomer(
  connectionId: string,
  companyId: number,
  data: {
    name: string
    vat?: string
    email?: string
    phone?: string
    address?: string
  },
) {
  // Buscar método de pagamento e prazo de pagamento padrão
  const [payments, maturities] = await Promise.all([
    moloniPost<Array<{ payment_method_id: number }>>(connectionId, '/paymentMethods/getAll/', { company_id: companyId }).catch(() => []),
    moloniPost<Array<{ maturity_date_id: number }>>(connectionId, '/maturityDates/getAll/', { company_id: companyId }).catch(() => []),
  ])
  const paymentMethodId = Array.isArray(payments) && payments[0] ? payments[0].payment_method_id : 0
  const maturityDateId = Array.isArray(maturities) && maturities[0] ? maturities[0].maturity_date_id : 0

  // Gerar número de cliente único baseado no timestamp
  const customerNumber = `C${Date.now().toString().slice(-8)}`

  const result = await moloniPost<{ customer_id: number; valid?: number; errors?: unknown[] }>(
    connectionId,
    '/customers/insert/',
    {
      company_id: companyId,
      number: customerNumber,
      name: data.name,
      vat: data.vat ?? '999999990', // consumidor final PT
      email: data.email ?? '',
      phone: data.phone ?? '',
      address: data.address ?? 'N/D',
      zip_code: '',
      city: 'N/D',
      country_id: 1, // Portugal
      language_id: 1, // Português
      payment_method_id: paymentMethodId,
      maturity_date_id: maturityDateId,
      salesman_id: 0,
      payment_day: 0,
      discount: 0,
      credit_limit: 0,
      delivery_method_id: 0,
    },
  )
  if (!result.customer_id || result.valid === 0) {
    throw new Error(`Erro ao criar cliente Moloni: ${JSON.stringify(result.errors ?? result)}`)
  }
  return result.customer_id
}

// ─── Document sets ────────────────────────────────────────────────────────────

type MoloniDocumentType = {
  document_type_id: number
  saft_code: string
  name: string
}

export async function fetchMoloniDocumentTypes(connectionId: string) {
  const results = await moloniPost<MoloniDocumentType[]>(connectionId, '/documents/getAllDocumentTypes/', {})
  return Array.isArray(results) ? results : []
}

export async function fetchMoloniDocumentSets(connectionId: string, companyId: number) {
  const results = await moloniPost<MoloniDocumentSet[]>(connectionId, '/documentSets/getAll/', {
    company_id: companyId,
  })
  return Array.isArray(results) ? results : []
}

// ─── Taxes ───────────────────────────────────────────────────────────────────

export async function fetchMoloniTaxes(connectionId: string, companyId: number) {
  const results = await moloniPost<MoloniTax[]>(connectionId, '/taxes/getAll/', {
    company_id: companyId,
  })
  return Array.isArray(results) ? results : []
}

// ─── Units ───────────────────────────────────────────────────────────────────

export async function fetchMoloniUnits(connectionId: string, companyId: number) {
  const results = await moloniPost<MoloniUnit[]>(connectionId, '/measurementUnits/getAll/', {
    company_id: companyId,
  })
  return Array.isArray(results) ? results : []
}

// ─── Produto genérico (para linhas livres em faturas) ─────────────────────────

/**
 * Procura ou cria um produto genérico "Serviço" no catálogo Moloni.
 * Usado como product_id base para linhas de fatura sem produto do catálogo.
 */
async function findMarcolarSrvProduct(
  connectionId: string,
  companyId: number,
): Promise<number | null> {
  try {
    // Tentar em páginas até encontrar (a API ignora o filtro reference, filtrar manualmente)
    for (let offset = 0; offset < 500; offset += 100) {
      const page = await moloniPost<Array<{ product_id: number; reference?: string }>>(
        connectionId,
        '/products/getAll/',
        { company_id: companyId, qty: 100, offset },
      )
      if (!Array.isArray(page) || page.length === 0) break
      // Comparação case-insensitive e sem espaços
      const match = page.find(
        (p) => p.reference?.trim().toUpperCase() === 'MARCOLA-SRV',
      )
      if (match?.product_id) return match.product_id
      if (page.length < 100) break // última página
    }
  } catch {
    // Ignorar erros de pesquisa — retorna null e deixa o caller decidir
  }
  return null
}

export async function getOrCreateGenericProduct(connectionId: string, companyId: number): Promise<number> {
  // Procurar produto com referência exacta MARCOLA-SRV (paginar pois a API ignora o filtro)
  const existing = await findMarcolarSrvProduct(connectionId, companyId)
  if (existing) return existing

  // Buscar category_id e unit_id
  const [categories, units] = await Promise.all([
    moloniPost<Array<{ category_id: number }>>(connectionId, '/productCategories/getAll/', { company_id: companyId }).catch(() => []),
    fetchMoloniUnits(connectionId, companyId),
  ])

  // Criar categoria "Serviços" se não existir
  let categoryId = Array.isArray(categories) && categories[0] ? categories[0].category_id : null
  if (!categoryId) {
    const catResult = await moloniPost<{ category_id: number; valid?: number }>(
      connectionId,
      '/productCategories/insert/',
      { company_id: companyId, name: 'Serviços', parent_id: 0 },
    )
    categoryId = catResult.category_id ?? 0
  }

  const unitId = Array.isArray(units) && units[0] ? units[0].unit_id : 0

  const rawProduct = await moloniPost<
    { product_id: number; valid?: number; errors?: unknown[] } | Array<{ code: string; description: string }>
  >(connectionId, '/products/insert/', {
    company_id: companyId,
    category_id: categoryId,
    type: 2, // serviço
    name: 'Serviço / Peça',
    reference: 'MARCOLA-SRV',
    price: 0,
    unit_id: unitId,
    has_stock: 0,
    at_product_category: 'S', // Categoria AT: Serviços
    exemption_reason: 'M99',
    taxes: [],
  })

  // Moloni pode devolver array de erros
  if (Array.isArray(rawProduct)) {
    const msg = rawProduct.map((e) => e.description || e.code).join('; ')
    // Se a referência já existe, o produto foi criado numa tentativa anterior — tentar encontrá-lo
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('reference')) {
      const retry = await findMarcolarSrvProduct(connectionId, companyId)
      if (retry) return retry
      // Último recurso: usar qualquer produto do catálogo
      const fallback = await moloniPost<Array<{ product_id: number }>>(
        connectionId, '/products/getAll/', { company_id: companyId, qty: 1, offset: 0 },
      ).catch(() => null)
      if (Array.isArray(fallback) && fallback[0]?.product_id) return fallback[0].product_id
    }
    throw new Error(`Erro ao criar produto genérico no Moloni: ${msg}`)
  }
  if (!rawProduct.product_id || rawProduct.valid === 0) {
    throw new Error(`Erro ao criar produto genérico: ${JSON.stringify(rawProduct.errors ?? rawProduct)}`)
  }
  return rawProduct.product_id
}

// ─── Criar fatura ─────────────────────────────────────────────────────────────

/**
 * Cria uma fatura (FT) ou fatura-recibo (FR) no Moloni a partir de uma Folha de Obra.
 * Devolve o document_id criado.
 */
export async function createMoloniInvoiceFromWorkOrder(
  connectionId: string,
  companyId: number,
  documentSetId: number,
  moloniCustomerId: number,
  workOrderNumber: number,
  items: Array<{
    descricao: string
    quantidade: number
    precoUnit: number
    iva: number | null
    isLabor?: boolean
  }>,
  docType: 'invoices' | 'quotes' = 'invoices',
  extraNotes?: string,
) {
  // Buscar taxas, produto genérico e unidades em paralelo
  const [taxes, genericProductId, units] = await Promise.all([
    fetchMoloniTaxes(connectionId, companyId),
    getOrCreateGenericProduct(connectionId, companyId),
    fetchMoloniUnits(connectionId, companyId),
  ])
  const tax23 = taxes.find((t) => Math.round(t.value) === 23 && t.type === 1)

  // Encontrar unidades: "Un." para peças, "Hrs" para mão de obra
  const normalName = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const unitUn = units.find((u) =>
    normalName(u.short_name ?? '').startsWith('un') || normalName(u.name ?? '').startsWith('unid'),
  )
  const unitHrs = units.find((u) =>
    normalName(u.short_name ?? '').startsWith('h') || normalName(u.name ?? '').includes('hora'),
  )
  const fallbackUnit = units[0]

  const products: MoloniCreateDocumentProduct[] = items.map((item, i) => {
    const ivaRate = item.iva ?? 23
    const matchedTax = taxes.find((t) => Math.round(t.value) === ivaRate && t.type === 1) ?? tax23

    const unitId = item.isLabor
      ? (unitHrs?.unit_id ?? fallbackUnit?.unit_id)
      : (unitUn?.unit_id ?? fallbackUnit?.unit_id)

    const productItem: MoloniCreateDocumentProduct = {
      product_id: genericProductId, // produto genérico do catálogo (API exige product_id real)
      name: item.descricao,
      qty: item.quantidade,
      price: Number(item.precoUnit.toFixed(4)),
      order: i + 1,
      unit_id: unitId,
    }

    if (matchedTax) {
      productItem.taxes = [{ tax_id: matchedTax.tax_id, value: matchedTax.value, order: 1, cumulative: 0 }]
    } else {
      productItem.exemption_reason = 'M99'
    }

    return productItem
  })

  const today = new Date().toISOString().slice(0, 10)
  const expDate = new Date()
  expDate.setDate(expDate.getDate() + 30)
  const expirationDate = expDate.toISOString().slice(0, 10)

  const body: MoloniCreateDocumentBody = {
    company_id: companyId,
    date: today,
    expiration_date: expirationDate,
    document_set_id: documentSetId,
    customer_id: moloniCustomerId,
    our_reference: `FO-${workOrderNumber}`,
    notes: [`Folha de Obra nº ${workOrderNumber}`, extraNotes].filter(Boolean).join(' | '),
    status: 1,
    products,
  }

  const raw = await moloniPost<MoloniCreateDocumentResponse | Array<{ code: string; description: string }>>(
    connectionId,
    `/${docType}/insert/`,
    body,
  )

  // Moloni retorna array de erros direto quando falha
  if (Array.isArray(raw)) {
    const errMsg = raw.map((e) => e.description || e.code).join('; ') || 'Erro ao criar documento Moloni'
    throw new Error(errMsg)
  }

  const result = raw as MoloniCreateDocumentResponse
  if (!result.document_id || result.valid === 0) {
    const errMsg = result.errors?.map((e) => e.message).join('; ') ?? 'Erro ao criar documento Moloni'
    throw new Error(errMsg)
  }

  return result.document_id
}

// ─── Fatura-Recibo para Caução (adiantamento) ─────────────────────────────────

/**
 * Emite uma Fatura-Recibo (FR) no Moloni para um adiantamento/caução.
 * - O documento sai logo fechado e pago (payment_method default).
 * - O valor passado é o BRUTO (com IVA); o preço unitário é convertido para base.
 * - Cumpre o Dec.-Lei 197/2012 (uma fatura por cada adiantamento recebido).
 */
export async function createMoloniInvoiceReceiptForCaucao(
  connectionId: string,
  companyId: number,
  documentSetId: number,
  moloniCustomerId: number,
  workOrderNumber: number,
  valorComIva: number,
  ivaRate: number = 23,
  extraNotes?: string,
): Promise<number> {
  const [taxes, genericProductId, payments] = await Promise.all([
    fetchMoloniTaxes(connectionId, companyId),
    getOrCreateGenericProduct(connectionId, companyId),
    moloniPost<Array<{ payment_method_id: number }>>(
      connectionId, '/paymentMethods/getAll/', { company_id: companyId },
    ).catch(() => []),
  ])
  const paymentMethodId = Array.isArray(payments) && payments[0] ? payments[0].payment_method_id : null
  if (!paymentMethodId) {
    throw new Error('Sem método de pagamento configurado no Moloni — necessário para Fatura-Recibo.')
  }

  // FR: o utilizador introduz o valor com IVA; o preço unitário no Moloni é sem IVA.
  const base = Number((valorComIva / (1 + ivaRate / 100)).toFixed(4))
  const matchedTax = taxes.find((t) => Math.round(t.value) === ivaRate && t.type === 1)

  const productLine: MoloniCreateDocumentProduct = {
    product_id: genericProductId,
    name: `Adiantamento — FO nº ${workOrderNumber}`,
    qty: 1,
    price: base,
    order: 1,
  }
  if (matchedTax) {
    productLine.taxes = [{ tax_id: matchedTax.tax_id, value: matchedTax.value, order: 1, cumulative: 0 }]
  } else {
    productLine.exemption_reason = 'M99'
  }

  const today = new Date().toISOString().slice(0, 10)

  const body = {
    company_id: companyId,
    date: today,
    expiration_date: today,
    document_set_id: documentSetId,
    customer_id: moloniCustomerId,
    our_reference: `FO-${workOrderNumber}-CAUCAO`,
    notes: [`Adiantamento — Folha de Obra nº ${workOrderNumber}`, extraNotes].filter(Boolean).join(' | '),
    status: 1,
    products: [productLine],
    payments: [{ payment_method_id: paymentMethodId, date: today, value: Number(valorComIva.toFixed(2)) }],
  }

  const raw = await moloniPost<MoloniCreateDocumentResponse | Array<{ code: string; description: string }>>(
    connectionId, '/invoiceReceipts/insert/', body,
  )
  if (Array.isArray(raw)) {
    const errMsg = raw.map((e) => e.description || e.code).join('; ') || 'Erro ao criar FR Moloni'
    throw new Error(errMsg)
  }
  const result = raw as MoloniCreateDocumentResponse
  if (!result.document_id || result.valid === 0) {
    throw new Error(result.errors?.map((e) => e.message).join('; ') ?? 'Erro ao criar FR Moloni')
  }
  return result.document_id
}

// ─── PDF de documento ────────────────────────────────────────────────────────

const DOC_TYPE_TO_ENDPOINT: Record<string, string> = {
  FT: '/invoices/getPDFLink/',
  FS: '/simplifiedInvoices/getPDFLink/',
  FR: '/receipts/getPDFLink/',
  NC: '/creditNotes/getPDFLink/',
  ND: '/debitNotes/getPDFLink/',
  VD: '/cashSaleInvoices/getPDFLink/',
  OR: '/quotes/getPDFLink/',
}

export async function getMoloniDocumentPdfUrl(
  connectionId: string,
  companyId: number,
  documentId: number,
  docType: string,
): Promise<string> {
  const endpoint = DOC_TYPE_TO_ENDPOINT[docType] ?? '/invoices/getPDFLink/'
  const result = await moloniPost<{ url?: string; pdfPublicLink?: string }>(
    connectionId,
    endpoint,
    { company_id: companyId, document_id: documentId },
  )
  const url = result.url ?? result.pdfPublicLink
  if (!url) throw new Error('A API Moloni não devolveu URL do PDF')
  return url
}

// ─── Customer matching ────────────────────────────────────────────────────────

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
