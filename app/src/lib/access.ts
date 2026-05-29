// Controlo de acesso por perfil.
//
// OWNER (admin) acede a tudo. EMPLOYEE (colaborador) acede apenas à área de CRM
// — clientes e folhas de obra — podendo DISPARAR automações mas não GERI-las.
// Sem painel, sem movimentos/relatórios/contas/categorias, sem gestão de
// automações nem áreas de administração.
//
// Fonte única de verdade, partilhada entre o middleware (barreira de rotas) e
// a UI (navegação). Mantém-se puro (sem dependências de Node) para correr no
// edge runtime do middleware.

export type Role = 'OWNER' | 'EMPLOYEE'

// Prefixos de rota permitidos ao colaborador.
const EMPLOYEE_ALLOWED = [
  '/crm',
  '/clientes',
  '/folhas',
  '/imprimir',
  '/partilha',
  '/api/customers',
  '/api/company-logo',
  '/api/work-order-photos',
]

// Subáreas exclusivas do OWNER mesmo dentro da área permitida.
// O colaborador dispara automações a partir das folhas, mas não as altera.
const EMPLOYEE_DENIED = ['/crm/automacoes']

// Página inicial do colaborador (o /dashboard é exclusivo do OWNER).
export const EMPLOYEE_HOME = '/folhas'

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function canAccess(role: Role, pathname: string): boolean {
  if (role === 'OWNER') return true
  if (EMPLOYEE_DENIED.some((p) => matches(pathname, p))) return false
  return EMPLOYEE_ALLOWED.some((p) => matches(pathname, p))
}
