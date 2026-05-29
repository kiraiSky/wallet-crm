# Relatorio de seguranca - wallet-crm

Data: 2026-05-29
Repositorio: `https://github.com/kiraiSky/wallet-crm.git`
Branch local: `main`
Commit local/remoto: `8cea98e feat: excluir contas das metricas + estados finais nas folhas de obra`

## Estado da versao

Depois de `git fetch origin`, `main` e `origin/main` estao alinhados (`0 0` em `rev-list --left-right --count main...origin/main`).

Ha alteracoes locais nao commitadas:

- `app/src/app/(app)/_components/MobileBottomNav.tsx`
- `app/src/app/(app)/_components/TopNav.tsx`
- `app/src/app/(app)/crm/_components/CrmSubNav.tsx`
- `app/src/app/(app)/crm/automacoes/actions.ts`
- `app/src/app/(app)/crm/automacoes/page.tsx`
- `app/src/app/(app)/folhas/[id]/WorkOrderDetailClient.tsx`
- `app/src/app/(app)/folhas/[id]/page.tsx`
- `app/src/middleware.ts`
- `app/src/lib/access.ts` ainda nao rastreado

Conclusao: o historico Git esta atualizado contra o `origin/main`, mas a copia de trabalho nao representa exatamente o remoto por conter alteracoes locais.

## Superficie de rotas

Rotas publicas pretendidas/encontradas:

- `/login`
- `/partilha/[token]` parece pretendida como partilha publica no schema, mas hoje nao esta em `PUBLIC_PATHS`; portanto exige login pelo middleware.

Rotas protegidas por autenticacao via middleware:

- App interna em `app/src/app/(app)/*`: dashboard, caixas, categorias, clientes, folhas, CRM, relatorios, auditoria, utilizadores, definicoes e integracoes.
- APIs internas: `/api/company-logo`, `/api/customers/[id]/vehicles`, `/api/integrations/moloni/*`.

Rotas excluidas do middleware:

- `_next/static`, `_next/image`, `favicon.ico`, `api/auth`, `api/uploads`.
- Nao encontrei implementacao de `/api/uploads`; se for adicionada no futuro, tera de ter autenticacao propria.

## Autenticacao e autorizacao

Pontos positivos:

- Auth.js/NextAuth usa `Credentials` com `bcrypt.compare`.
- Sessao usa JWT e injeta `id`, `nome` e `role`.
- Usuarios inativos sao bloqueados no login.
- `getCurrentUser()` valida que o usuario ainda existe e esta ativo.
- `requireOwner()` existe e e usado em areas sensiveis como utilizadores, Moloni, definicoes da empresa, auditoria e geracao/revogacao de tokens de partilha.
- Middleware separa `OWNER` e `EMPLOYEE` usando `canAccess()`.

Risco principal:

- O app depende muito do middleware para controle de acesso, mas varias Server Actions fazem escrita/leitura sensivel sem `getCurrentUser()` ou `requireOwner()` dentro da propria action. Isso e especialmente importante porque o projeto usa Next.js `15.0.3`, uma versao vulneravel a bypass de middleware (CVE-2025-29927).

## Achados prioritarios

### P0 - Next.js vulneravel a bypass de middleware

Arquivo: `app/package.json:31`

O projeto usa `next@15.0.3`. A advisory oficial da Vercel/GitHub para CVE-2025-29927 informa que Next.js `15.0 < 15.2.3` e vulneravel a bypass de autorizacao quando a aplicacao depende de middleware. Este app depende fortemente do middleware em `app/src/middleware.ts`.

Impacto:

- Um atacante poderia contornar checks de middleware em versoes vulneraveis.
- Como varias paginas, APIs e Server Actions nao repetem a autorizacao no handler/action, o impacto pode incluir leitura ou alteracao indevida de dados.

Recomendacao:

- Atualizar Next.js imediatamente para uma versao segura. Como em 2026 existem novas advisories para 15.x/16.x, preferir uma linha suportada e atual, por exemplo `15.5.18+` ou `16.2.5+`, validando compatibilidade.
- No proxy/CDN, remover/bloquear header `x-middleware-subrequest`.
- Nao depender apenas do middleware: repetir `getCurrentUser()`/`requireOwner()` nos handlers e Server Actions.

Fontes:

- https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw
- https://github.com/vercel/next.js/security/advisories

### P0 - Server Actions sensiveis sem autenticacao/autorizacao local

Arquivos principais:

- `app/src/app/(app)/caixas/actions.ts:26` (`saveAccount`) nao chama `getCurrentUser()`/`requireOwner()`.
- `app/src/app/(app)/caixas/actions.ts:190` (`deleteAccount`) nao chama `getCurrentUser()`/`requireOwner()`.
- `app/src/app/(app)/categorias/actions.ts:22` (`saveCategory`) nao chama `getCurrentUser()`/`requireOwner()`.
- `app/src/app/(app)/categorias/actions.ts:81` (`deleteCategory`) nao chama `getCurrentUser()`/`requireOwner()`.
- `app/src/app/(app)/clientes/actions.ts` tem criacao/edicao/remocao de clientes e veiculos sem `getCurrentUser()`.
- `app/src/app/(app)/folhas/actions.ts:42`, `118`, `142`, `179`, `283`, `368`, `420` expoem operacoes de folha/itens/preview sem `getCurrentUser()`.
- `app/src/app/(app)/crm/automacoes/actions.ts:18`, `25`, `33`, `79`, `87` tem leituras/disparo de automacoes sem `getCurrentUser()`; mutacoes de template usam `requireOwner()`.

Impacto:

- Acesso indevido se uma Server Action ficar chamavel fora da tela esperada.
- Maior gravidade quando combinado com vulnerabilidade de middleware ou future regressions no matcher.
- `EMPLOYEE` pode estar autorizado a CRM/folhas/clientes, mas o modelo de permissao deve ficar explicito por action, nao apenas por pagina.

Recomendacao:

- Criar helpers:
  - `requireAuth()` para actions permitidas a qualquer usuario autenticado.
  - `requireOwner()` para financeiro/admin.
  - `requireRole(['OWNER','EMPLOYEE'])` para CRM/folhas/clientes.
- Aplicar no inicio de toda Server Action e toda API route.
- Para actions financeiras (`caixas`, `categorias`, `lancamentos`, `relatorios`, `Moloni`, `utilizadores`, `definicoes`), usar `requireOwner()`.
- Para `clientes` e `folhas`, usar no minimo `getCurrentUser()` e regras explicitas para o que `EMPLOYEE` pode alterar.

### P1 - Endpoint de sync Moloni pode ficar aberto por configuracao ausente

Arquivo: `app/src/app/api/integrations/moloni/sync/route.ts:13`

O endpoint so exige `Authorization: Bearer <MOLONI_SYNC_SECRET>` se `MOLONI_SYNC_SECRET` existir. Se a variavel nao estiver configurada, qualquer usuario autenticado que passe middleware pode disparar sync. Se houver bypass de middleware, vira endpoint externo aberto.

Recomendacao:

- Falhar fechado: se `MOLONI_SYNC_SECRET` nao estiver definido, retornar `503`/`500` e nao executar sync.
- Considerar `requireOwner()` para chamadas manuais autenticadas e secret obrigatorio para cron externo.
- Rate limit por IP/origem se ficar exposto publicamente.

### P1 - Uploads confiam em MIME informado pelo cliente

Arquivos:

- `app/src/lib/uploads.ts:15`
- `app/src/app/(app)/lancamentos/actions.ts` permite JPG/PNG/WebP/PDF ate 5 MB.
- `app/src/app/(app)/definicoes/empresa/actions.ts` permite SVG no logo.
- `app/src/app/api/company-logo/route.ts:20` serve SVG como `image/svg+xml`.

Riscos:

- `file.type` e controlado pelo cliente e nao prova o conteudo real.
- SVG pode conter script ou payload ativo dependendo do contexto de renderizacao/navegador.
- `company-logo` publica cache public e serve o logo a qualquer usuario autenticado; se `/partilha` virar publica, o logo fica publico tambem.

Recomendacao:

- Validar magic bytes para imagens/PDF.
- Evitar SVG upload, ou sanitizar SVG com biblioteca propria antes de salvar.
- Servir anexos/logos com `X-Content-Type-Options: nosniff`.
- Para SVG, considerar `Content-Disposition: attachment` ou converter para PNG/WebP.

### P1 - Senha padrao no seed

Arquivo: `app/prisma/seed.ts:8-19`

O seed cria/atualiza OWNER com email fixo e senha `admin123`. Se seed rodar em ambiente acessivel ou producao por engano, a conta fica comprometida.

Recomendacao:

- Exigir `SEED_OWNER_EMAIL` e `SEED_OWNER_PASSWORD` via ambiente.
- Recusar rodar seed em `NODE_ENV=production` sem flag explicita.
- Nunca logar a senha no console.

### P1 - Sem rate limiting/login throttling

Arquivo: `app/src/lib/auth.ts:38-47`

O login valida senha com bcrypt, mas nao ha limite de tentativas, atraso progressivo, bloqueio temporario, CAPTCHA ou registro de falhas.

Recomendacao:

- Adicionar rate limit por IP + email.
- Registrar tentativas falhadas.
- Considerar lockout temporario progressivo.

### P2 - Token de partilha e status de publicidade inconsistentes

Arquivos:

- `app/prisma/schema.prisma` comenta `shareToken` como partilha publica.
- `app/src/middleware.ts:6` so deixa `/login` publico.
- `app/src/app/partilha/[token]/page.tsx` expoe dados da folha via token.

Hoje o middleware exige login para `/partilha/[token]`, entao a partilha com cliente provavelmente nao funciona fora da equipa. Se a intencao for tornar publica, a rota deve ser adicionada a `PUBLIC_PATHS` com revisao de dados expostos.

Recomendacao:

- Decidir: publico real ou apenas autenticado.
- Se publico: manter token aleatorio forte, adicionar expiracao opcional, revogacao, cache `no-store`, logging de acesso, e limitar dados pessoais expostos.
- Se autenticado: remover textos/comentarios que indicam "publica" para evitar configuracao errada depois.

### P2 - Headers de seguranca ausentes

Nao encontrei configuracao em `next.config.mjs` para headers como CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` e `X-Content-Type-Options`.

Recomendacao:

- Adicionar headers globais em `next.config.mjs` ou no proxy.
- CSP deve ser testada com cuidado por causa de Next.js, scripts e imagens.

### P2 - Dependencias antigas/experimentais

Arquivo: `app/package.json:31-34`

- `next@15.0.3` esta muito atrasado e vulneravel.
- `react`/`react-dom` estao em RC antigo.
- `next-auth@5.0.0-beta.31` esta em beta.

Nao executei `pnpm audit` porque a chamada ao registry npm foi bloqueada por risco de enviar metadados do projeto a terceiro. A avaliacao acima usa package.json local e advisories publicas.

Recomendacao:

- Planejar upgrade de Next/React/Auth.js em branch separada.
- Ativar Dependabot/Renovate e revisao semanal.
- Rodar audit em CI aprovado pelo dono do projeto.

## Pontos fortes observados

- Prisma e usado de forma parametrizada; nao encontrei SQL raw perigoso.
- Zod valida varios formularios.
- Tokens Moloni sao cifrados com AES-256-GCM e chave derivada de segredo.
- OAuth Moloni usa `state` em cookie `httpOnly`/`sameSite=lax`.
- Auditoria registra varias mutacoes.
- Uploads usam nomes aleatorios (`randomUUID`) e nao salvam diretamente o nome original como caminho.

## Plano de correcao sugerido

1. Atualizar `next` para versao corrigida e bloquear `x-middleware-subrequest` no proxy.
2. Adicionar checks de autorizacao em todas as Server Actions e API routes.
3. Corrigir `MOLONI_SYNC_SECRET` para falhar fechado.
4. Proteger upload/logo com sniffing real, bloquear/sanitizar SVG e adicionar `nosniff`.
5. Substituir senha padrao do seed por variaveis obrigatorias.
6. Adicionar rate limit no login.
7. Definir explicitamente o comportamento de `/partilha/[token]`.
8. Adicionar headers de seguranca.
9. Rodar auditoria de dependencias em ambiente aprovado.

