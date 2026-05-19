# Marcola Balancete — Plano do Projeto

Webapp self-hosted para gerir o caixa da oficina, substituindo o atual fluxo em Excel.
Acesso via desktop e mobile, com suporte a múltiplos utilizadores, CRM próprio e
integração futura com Moloni para reconciliação fiscal.

---

## 1. Stack técnica

100% self-hosted no VPS do utilizador, tudo dockerizado, sem dependências externas
(exceto Moloni na última fase).

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend + Backend | **Next.js 15** (App Router, fullstack) | Um único projeto, mobile responsivo nativo, API routes embutidas |
| Banco de dados | **PostgreSQL 16** | Robusto, free, lida bem com relatórios e agregações |
| ORM | **Prisma** | Migrations versionadas, tipagem forte |
| Auth | **Auth.js (NextAuth)** + Credentials Provider | Login email/senha, sessão em cookie, sem serviço externo |
| UI | **Tailwind CSS + shadcn/ui** | Visual moderno, mobile-first |
| Gráficos | **Recharts** | Gauges, linhas, donuts |
| Export | **SheetJS** (Excel) + **pdf-lib** (PDF) | Bibliotecas locais |
| Proxy/HTTPS | **Caddy** | HTTPS automático via Let's Encrypt |
| Orquestração | **docker-compose** | 3 serviços: `app`, `db`, `caddy` |

### Estrutura de pastas prevista

```
marcola-balancete/
├── docker-compose.yml
├── Caddyfile
├── .env.example
├── prototype/                  # protótipo visual atual (HTML/Tailwind)
├── app/                        # Next.js
│   ├── prisma/schema.prisma
│   ├── src/app/...
│   └── Dockerfile
└── PLAN.md
```

---

## 2. Modelo de dados

```
users
├── id, nome, email, senha (bcrypt), role (OWNER | EMPLOYEE)
└── created_at, last_login_at

accounts (caixas)
├── id, nome, tipo (DINHEIRO | BANCO | PIX | CARTAO)
├── saldo_inicial, cor, icone
└── created_at, archived_at

categories
├── id, nome, tipo (RECEITA | DESPESA), cor, icone
└── created_at, archived_at

customers
├── id, nome, telefone, email, nif, morada, observacoes
├── aniversario, tag (VIP | RECORRENTE | NOVO | INATIVO)
└── created_at

vehicles
├── id, customer_id (FK), marca, modelo, ano, placa, cor, km
└── created_at

transactions
├── id, account_id, category_id, user_id, customer_id (opc), vehicle_id (opc)
├── tipo (ENTRADA | SAIDA), valor, descricao, data, observacao
├── moloni_document_id (opc, fase 3)
└── created_at, updated_at

transaction_attachments
├── id, transaction_id, filename, mime_type, size, storage_path
└── uploaded_at, uploaded_by

audit_log
├── id, user_id, entity_type, entity_id, action (CREATE | UPDATE | DELETE)
├── before_json, after_json
└── created_at
```

---

## 3. Permissões

| Ação | OWNER | EMPLOYEE |
|---|:---:|:---:|
| Lançar entrada/saída | ✅ | ✅ |
| Editar/excluir lançamento próprio (mesmo dia) | ✅ | ✅ |
| Editar/excluir qualquer lançamento | ✅ | ❌ |
| Ver dashboard e relatórios | ✅ | ❌ |
| Cadastrar clientes e veículos (CRM) | ✅ | ✅ |
| Gerenciar caixas e categorias | ✅ | ❌ |
| Gerenciar utilizadores | ✅ | ❌ |
| Exportar Excel/PDF | ✅ | ❌ |
| Configurar integração Moloni | ✅ | ❌ |

---

## 4. Telas e fluxos

### Mapa de navegação

```
Login
└── Dashboard (KPIs gerais)
    ├── Lançamentos       (lista + modal de novo)
    ├── CRM               (hub com sidebar própria)
    │   ├── Visão geral   (KPIs CRM, aquisição, segmentação)
    │   ├── Clientes      (lista + ficha com veículos + histórico)
    │   ├── Atividade     (timeline cronológica)
    │   ├── Ordens de serviço  (em breve, fase 2+)
    │   └── Lembretes     (em breve, fase 2+)
    ├── Caixas            (CRUD)
    ├── Categorias        (CRUD, separadas RECEITA/DESPESA)
    ├── Relatórios        (KPIs, gráficos, exports)
    │   └── Reconciliação Moloni  (fase 3)
    │   └── Fiscal               (fase 3)
    └── Utilizadores      (só OWNER)
```

### Componentes-chave do lançamento

- Toggle Entrada/Saída
- Valor (input grande)
- Categoria + Caixa (selects)
- Data/hora (default = agora)
- Cliente/Veículo (opcional, busca por nome ou placa)
- **Comprovante**: upload de foto ou PDF (até 5MB)
- Observação interna

---

## 5. CRM (seção dedicada)

Estilo Pipedrive: ao entrar em "CRM" no menu superior, ganha sidebar lateral própria.

### Sub-seções

**Visão geral**
- KPIs: clientes novos no mês, taxa de retorno, ticket médio, clientes inativos
- Gráfico de aquisição (6 meses)
- Segmentação da base (VIP / Recorrente / Novo / Inativo)
- Clientes a reativar (sem retorno há > 90 dias)
- Aniversariantes do mês

**Clientes**
- Lista lateral pesquisável (nome, telefone, placa)
- Ficha do cliente: dados, veículos vinculados, histórico de serviços, observações

**Atividade**
- Timeline cronológica (Hoje / Ontem / Semana / Antes)
- Eventos: serviço realizado, novo cadastro, alerta de inatividade, aniversário
- Filtros por tipo de evento

### Vínculo com lançamentos

Todo `transaction` pode ter `customer_id` e `vehicle_id` (ambos opcionais).
Isso alimenta automaticamente o histórico do cliente, o ticket médio, a taxa de
retorno e a segmentação.

---

## 6. Fases de entrega

### Fase 1 — MVP (substitui o Excel)
- Auth + roles OWNER/EMPLOYEE
- Caixas, categorias, lançamentos (entrada/saída)
- Dashboard básico
- Anexo de comprovante nos lançamentos
- Deploy dockerizado no VPS

**Critério de pronto**: oficina consegue parar de usar o Excel.

### Fase 2 — CRM completo + Relatórios avançados
- Cadastro de clientes e veículos
- Hub do CRM (Visão geral, Clientes, Atividade)
- Vinculação de lançamentos a clientes/veículos
- Relatórios avançados com gráficos
- Exportação Excel/PDF
- Audit log

**Critério de pronto**: oficina vê histórico por cliente e exporta pra contador.

### Fase 3 — Integração Moloni (última fase)
- Integração read-only com Moloni via OAuth2
- Sync de documentos (faturas, recibos, NC) e clientes (por NIF)
- Tela "Integrações" pra conectar/desconectar
- Reconciliação automática caixa ↔ Moloni
- Análise fiscal (IVA, lucro real vs faturado)

### Fase 4 — Nice-to-have (futuro)
- PWA instalável no celular
- Notificações de aniversário / cliente inativo
- Ordens de serviço formais
- Lembretes recorrentes (revisão, troca de óleo por km)

---

## 7. Integração Moloni (Fase 3 — última)

### Objetivo

O Moloni é a fonte oficial de faturação. O app é a fonte do caixa real.
A integração **só lê** do Moloni (pull-only) e cruza os dados para:

1. **Reconciliar caixa interno vs faturado** — saber quanto entrou de verdade
   versus quanto foi faturado oficialmente, e identificar buracos.
2. **Análise fiscal (IVA, lucro real)** — calcular IVA a entregar e separar
   lucro fiscal (só faturado) do lucro real (todo o caixa).

### Por que ficar pra última fase

- Schema do app precisa estar estável antes (relação `transaction ↔ documento` mexe na base)
- Reconciliação só vale a pena depois que o app já tem meses de histórico
- API do Moloni evolui — melhor integrar com a versão atual no momento da entrega
- Núcleo do app não depende disso: é um módulo plugável

### Como funciona

```
Moloni API ──OAuth2──► Job de sync (cron a cada X horas)
                            │
                            ▼
                    moloni_documents (cópia local)
                            │
                            ▼
                  Algoritmo de matching
                            │
                            ▼
            transactions.moloni_document_id (FK)
                            │
                            ▼
              UI: Relatórios → Reconciliação / Fiscal
```

### O que vai ser puxado

- Faturas, recibos, notas de crédito (totais, IVA, base tributável, datas, cliente)
- Lista de clientes (NIF, contactos, morada)
- Produtos/serviços cadastrados (opcional, pra match de descrição)

### Modelo de dados adicional

```
moloni_integration
├── access_token, refresh_token
├── company_id, last_sync_at, status
└── owner_user_id

moloni_documents
├── moloni_id (unique), tipo, numero
├── data, cliente_nif
├── valor_total, valor_iva, valor_base
└── raw_json (backup)

# Novas FKs (opcionais)
transactions.moloni_document_id  → moloni_documents
customers.moloni_customer_id     → cliente Moloni por NIF
```

### Algoritmo de reconciliação

Para cada **entrada** no caixa do período:
1. Procurar fatura Moloni com mesmo cliente + valor (±2%) + data (±3 dias)
2. Match ✅ → marcar como reconciliado
3. Sem match ⚠️ → flag "Sem fatura emitida" (informal/dinheiro)

Para cada **fatura Moloni** do período:
1. Procurar `transaction` vinculado
2. Sem match ⚠️ → flag "Faturado, não recebido" (conta a receber ou esquecido)

Owner pode forçar match manual quando o algoritmo não bater.

### Novas telas

- **Configurações → Integrações** — conectar/desconectar Moloni, escolher período de sync, ver última sincronização e estado
- **Relatórios → Reconciliação** — três blocos:
  - ✅ Reconciliados (caixa com fatura correspondente)
  - ⚠️ Caixa sem fatura (provável informal)
  - ⚠️ Fatura sem caixa (a receber ou esquecido)
- **Relatórios → Fiscal** — IVA por taxa (6% / 13% / 23%), base tributável,
  comparativo lucro fiscal vs lucro real

### Indicadores visuais

Nos lançamentos, um pequeno chip:
- 🟢 Reconciliado
- 🟡 Pendente de sync
- 🔴 Divergente (precisa atenção)

### Cálculos que se tornam possíveis

| Métrica | Fórmula |
|---|---|
| Lucro fiscal | Σ faturado − Σ despesas dedutíveis |
| Lucro real | Σ caixa entradas − Σ caixa saídas |
| IVA a entregar | Σ IVA das faturas do período |
| % informal | Σ caixa não-faturado / Σ caixa total |
| A receber | Σ faturas Moloni sem entrada no caixa |
| Ticket médio com NIF | Média de faturas com NIF preenchido |
| Ticket médio sem NIF | Média de entradas no caixa sem fatura |

### Riscos e pontos de atenção

- **Tokens OAuth expiram**: refresh automático + UI de "reconectar"
- **Rate limit Moloni** (~60 req/min): primeira sync em batches
- **Match não é 100%**: sempre haverá caso ambíguo (mesmo valor, mesmo dia,
  clientes diferentes) — UI precisa permitir override manual
- **Histórico vs novo**: ao conectar, owner escolhe "puxar desde quando" — não
  tentar puxar 5 anos de dados de uma vez
- **Mudanças no Moloni**: se editar manualmente lá, precisa re-sync pra
  refletir no app

---

## 8. Deploy

Tudo no VPS do utilizador, com Docker já instalado e domínio apontado.

```yaml
# docker-compose.yml (esquema)
services:
  app:       # Next.js standalone build
  db:        # postgres:16-alpine, volume persistente
  caddy:     # reverse proxy + HTTPS Let's Encrypt
```

**Backup**: dump diário do Postgres + cópia dos anexos pra outra pasta/serviço.

---

## 9. Protótipo visual atual

Protótipo navegável em HTML/Tailwind (CDN) no diretório `prototype/`:

| Tela | Arquivo |
|---|---|
| Login | `prototype/index.html` |
| Dashboard geral | `prototype/dashboard.html` |
| Lançamentos (com modal + anexo + vínculo cliente) | `prototype/transactions.html` |
| CRM · Visão geral | `prototype/crm.html` |
| CRM · Clientes | `prototype/customers.html` |
| CRM · Atividade (timeline) | `prototype/crm-timeline.html` |
| Caixas | `prototype/accounts.html` |
| Categorias | `prototype/categories.html` |
| Relatórios | `prototype/reports.html` |
| Utilizadores | `prototype/users.html` |

Abrir `prototype/index.html` no navegador → "Entrar" → navegar pelo menu superior
(desktop) ou bottom nav (mobile).

---

## 10. Estado atual da implementação

### ✅ Implementado (Fase 1 — Despesas)

- **Foundation**: Next.js 15 + TypeScript + Tailwind + Prisma + Postgres + Docker
- **Schema do banco** (`app/prisma/schema.prisma`):
  `User`, `Account`, `Category`, `Transaction`, `TransactionAttachment`
- **Seed** (`app/prisma/seed.ts`): OWNER padrão + 3 caixas + 11 categorias
- **Tela Caixas** (`/caixas`): CRUD com cards coloridos, saldo atual, movimento do mês
- **Tela Categorias** (`/categorias`): CRUD em colunas (receita/despesa) com ícones e cores
- **Tela Lançamentos** (`/lancamentos`): listagem com filtros e busca, KPIs, modal de novo/editar/duplicar/excluir, upload de comprovante (5MB, JPG/PNG/WebP/PDF)
- **Dashboard** (`/dashboard`): saldo consolidado, KPIs do mês, top despesas, últimos lançamentos
- **API de anexos** (`/api/uploads/[id]`): serve comprovantes do volume local
- **Componentes compartilhados**: `Modal`, `DynamicIcon`, `ColorPicker`
- **Storage de anexos**: disco local (`/data/uploads` no Docker, `./uploads` em dev)

### Comandos para rodar

```bash
# Dev local (precisa de Postgres rodando)
cd app && pnpm install
cp ../.env.example .env  # ajustar DATABASE_URL
pnpm prisma migrate dev --name init
pnpm prisma db seed
pnpm dev   # http://localhost:3000

# Via Docker (recomendado)
cp .env.example .env
docker compose up -d --build
docker compose exec app pnpm prisma migrate deploy
docker compose exec app pnpm prisma db seed
```

## 11. Próximos passos

1. Validar Fase 1 com a oficina (substituir o Excel)
2. **Fase 2**: CRM (clientes/veículos) + Relatórios avançados + Exports + Audit log + Auth real (OWNER/EMPLOYEE)
3. **Fase 3**: Integração Moloni (read-only, reconciliação, análise fiscal)
4. **Fase 4**: PWA, ordens de serviço, lembretes
