# Single-stage build — mais simples, sem problemas de copy.
# Imagem fica maior mas é OK pra dev/staging. Otimizar pra prod depois.
FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Cria diretório de uploads e usuário
RUN mkdir -p /data/uploads \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && chown -R nextjs:nodejs /data/uploads

# Instala deps
COPY --chown=nextjs:nodejs package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --no-frozen-lockfile

# Copia o código e builda
COPY --chown=nextjs:nodejs . .
RUN pnpm prisma generate && pnpm build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

USER nextjs
EXPOSE 3000
CMD ["pnpm", "start"]
