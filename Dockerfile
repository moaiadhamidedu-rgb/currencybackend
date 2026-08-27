FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV DATABASE_URL=file:./template.db
RUN npm run prisma:generate \
    && npm run db:setup \
    && npm run build \
    && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL=file:./data/dev.db
ENV NODE_OPTIONS=--max-old-space-size=160

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/template.db ./template.db
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh
EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
