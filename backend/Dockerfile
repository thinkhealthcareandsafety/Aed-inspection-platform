# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only install production deps
COPY package*.json ./
RUN npm ci --only=production --prefer-offline && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
    CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/server.js"]
