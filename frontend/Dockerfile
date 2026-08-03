# ── Dependencies ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Docker sets HOSTNAME to the container ID, which the standalone server.js
# uses as its bind address if set — override so it listens on all interfaces.
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextgroup && adduser -S nextuser -G nextgroup

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextuser:nextgroup /app/.next/standalone ./
COPY --from=builder --chown=nextuser:nextgroup /app/.next/static ./.next/static

USER nextuser

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD wget -qO- http://127.0.0.1:3000 || exit 1

CMD ["node", "server.js"]
