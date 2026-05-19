# Marcola Balancete

Webapp para gerir o caixa da oficina. Veja [`PLAN.md`](./PLAN.md) para o plano completo.

## Stack

- Next.js 15 (App Router, fullstack)
- PostgreSQL 16
- Prisma ORM
- Tailwind CSS
- Docker + Caddy (apenas pra deploy)

---

## 🚀 Setup de desenvolvimento (RECOMENDADO)

**Filosofia**: rodar o app nativo com HMR instantâneo. Docker só pro Postgres.

### Pré-requisitos
- Node.js 20+ (já tem)
- Docker (só pro Postgres)
- pnpm — instale uma vez:
  ```bash
  npm config set prefix "$HOME/.npm-global"
  npm install -g pnpm@9.12.3
  export PATH="$HOME/.npm-global:$PATH"   # adicione no seu .bashrc/.zshrc
  ```

### Primeira vez

```bash
cd app
pnpm install
pnpm db:up         # sobe Postgres no Docker (porta 5433)
pnpm db:setup      # cria tabelas + seed
pnpm dev           # http://localhost:3000
```

### Dia-a-dia

```bash
cd app
pnpm db:up    # garante que o DB tá rodando
pnpm dev      # liga o app (HMR instantâneo)
```

### Scripts úteis

| Comando | O que faz |
|---|---|
| `pnpm dev` | Roda o Next.js em dev (HMR) |
| `pnpm db:up` | Liga o Postgres no Docker |
| `pnpm db:down` | Desliga o Postgres |
| `pnpm db:logs` | Streamo logs do Postgres |
| `pnpm db:setup` | Cria/atualiza tabelas + roda seed |
| `pnpm db:reset` | **Apaga tudo** e refaz tabelas + seed |
| `pnpm prisma:studio` | Abre o Prisma Studio (GUI do banco) |

### Arquivo `.env`

Em `app/.env` (não comitar):
```
DATABASE_URL=postgresql://marcola:marcola_dev_pw@localhost:5433/marcola
UPLOAD_DIR=./uploads
```

---

## 📦 Deploy em produção

Deploy via Docker será adicionado quando a Fase 1 (despesas) for validada.
Ver [`PLAN.md`](./PLAN.md) seção 8 pro plano detalhado.

---

## Estado atual

**Fase 1 em construção** — módulo de despesas.

Funcionalidades implementadas:
- ✅ Caixas (CRUD)
- ✅ Categorias (CRUD, separa receita/despesa)
- ✅ Lançamentos com anexo de comprovante
- ✅ Dashboard com KPIs de despesa

Próximos passos (ver `PLAN.md`):
- Lançamentos de receita (já tem o toggle no modal, falta validar UX)
- CRM (clientes e veículos)
- Auth com OWNER/EMPLOYEE
- Relatórios + Exports
- Integração Moloni
