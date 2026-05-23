# Carteira

Webapp self-hosted para gerir o caixa, clientes e folhas de obra de uma oficina.
O objetivo é substituir o fluxo em Excel por uma aplicação simples para desktop e mobile, com histórico financeiro, CRM e relatórios.

## Stack

- Next.js 15 com App Router
- React 19 RC
- PostgreSQL 16
- Prisma ORM
- Auth.js / NextAuth com login por email e senha
- Tailwind CSS
- Docker Compose para Postgres em desenvolvimento
- Docker + Caddy preparados para deploy

## Funcionalidades atuais

- Login com utilizadores ativos/inativos e roles `OWNER` / `EMPLOYEE`
- Dashboard com KPIs, entradas, saídas, saldo e pagamentos agendados
- Caixas/contas com CRUD, saldo inicial, transferência entre contas e ajuste de saldo
- Categorias de entrada/saída com cores, ícones e hierarquia simples
- Lançamentos financeiros com anexos de comprovantes, cliente, folha de obra e agendamento
- Clientes com ficha, contactos, NIF, morada, observações, tags e arquivo
- Viaturas associadas a clientes
- Folhas de obra com estados, itens de peças/mão de obra, totais e movimentos ligados
- CRM com visão geral, atividade, clientes, folhas e automações
- Automações de mensagens por template e webhook n8n
- Auditoria de ações importantes
- Relatórios por período com export CSV compatível com Excel e impressão/PDF pelo navegador

## Estrutura

```text
.
├── app/                    # Aplicação Next.js
│   ├── prisma/             # Schema e seeds
│   ├── src/app/            # Rotas, páginas e server actions
│   ├── src/components/     # Componentes partilhados
│   └── src/lib/            # Auth, Prisma, uploads, formatadores e helpers
├── prototype/              # Protótipos HTML antigos
├── backups/                # Backups locais
├── docker-compose.dev.yml  # Postgres local para desenvolvimento
├── docker-compose.yml      # Base de deploy
├── Caddyfile               # Proxy/HTTPS para produção
└── PLAN.md                 # Plano original do projeto
```

## Setup de desenvolvimento

### Pré-requisitos

- Node.js 20+
- Docker
- pnpm 9.12.3

```bash
corepack enable
corepack prepare pnpm@9.12.3 --activate
```

### Primeira vez

```bash
cd app
pnpm install
pnpm db:up
pnpm db:setup
pnpm dev
```

A aplicação fica disponível em `http://localhost:3000`.

### Login de desenvolvimento

O seed cria um utilizador OWNER:

```text
Email: joao@carteira.app
Senha: admin123
```

### Ambiente

Use `app/.env.example` como base para `app/.env`:

```env
DATABASE_URL=postgresql://marcola:marcola_dev_pw@localhost:5433/marcola
UPLOAD_DIR=./uploads
```

O `docker-compose.dev.yml` sobe apenas o Postgres na porta `5433`; a aplicação roda nativa com HMR via `pnpm dev`.
Antes de produção, definir também um segredo seguro para o Auth.js/NextAuth conforme o ambiente de deploy.

## Scripts úteis

Execute dentro de `app/`.

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Roda o Next.js em desenvolvimento |
| `pnpm build` | Gera build de produção |
| `pnpm start` | Roda a build de produção |
| `pnpm db:up` | Sobe o Postgres local |
| `pnpm db:down` | Desliga o Postgres local |
| `pnpm db:logs` | Mostra logs do Postgres |
| `pnpm db:setup` | Aplica o schema e roda seed |
| `pnpm db:reset` | Apaga dados, recria schema e roda seed |
| `pnpm prisma:generate` | Gera Prisma Client |
| `pnpm prisma:studio` | Abre o Prisma Studio |

## O que podemos fazer a seguir

Prioridade sugerida:

1. Corrigir encoding dos textos existentes
   - Há vários ficheiros com acentos corrompidos (`GestÃ£o`, `JoÃ£o`, etc.). Vale normalizar tudo para UTF-8 antes de mexer muito na UI, porque isso afeta páginas, seeds, Docker e documentação.

2. Fechar validação do MVP financeiro
   - Testar fluxo completo: criar caixa, categoria, lançamento com anexo, transferência, ajuste de saldo, agendamento, confirmação e relatório.
   - Adicionar testes ou pelo menos uma checklist manual para evitar regressões nos saldos.

3. Melhorar relatórios e exportação
   - O export atual é CSV para Excel. Próximo passo natural: export XLSX real, resumo mensal por caixa/categoria e PDF/print mais polido.

4. Configurar produção
   - Rever `docker-compose.yml`, variáveis de ambiente, uploads persistentes, HTTPS via Caddy, backups do Postgres e seed seguro sem senha padrão.

5. Endurecer segurança e permissões
   - Rever o que `EMPLOYEE` pode criar, editar ou apagar.
   - Garantir que ações sensíveis exigem OWNER no servidor, não só na interface.

6. Tornar automações configuráveis
   - Mover o webhook n8n para variável de ambiente.
   - Adicionar modo de teste, reenvio e logs mais legíveis por folha/cliente.

7. Polir UX mobile da oficina
   - Priorizar ações rápidas: novo lançamento, abrir folha, anexar comprovante, mudar estado e enviar mensagem.
   - Validar botões, tabelas e modais em telemóvel real.

8. Integração Moloni
   - Deixar para depois do núcleo estabilizar.
   - Primeiro mapear documentos, clientes por NIF e regras de reconciliação caixa vs faturação.

## Notas

- `PLAN.md` guarda o plano original e continua útil como contexto histórico.
- O nome técnico do pacote ainda é `carteira`; o repositório remoto atual é `wallet-crm`.
- Antes de produção, trocar segredos, remover credenciais padrão e validar backups.
