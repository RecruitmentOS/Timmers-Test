# ── Stage 1: base ──────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

# ── Stage 2: deps ─────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/permissions/package.json packages/permissions/

RUN pnpm install --frozen-lockfile

# ── Stage 3: builder ─────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app .
COPY apps/web/ apps/web/
COPY packages/ packages/
COPY tsconfig.base.json .

ENV NEXT_TELEMETRY_DISABLED=1

RUN cd apps/web && pnpm build

# ── Stage 4: runner ──────────────────────────────────────────────
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S web && adduser -S web -G web

WORKDIR /app

# Standalone output places server.js at apps/web/.next/standalone root
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

USER web

EXPOSE 3002

CMD ["node", "apps/web/server.js"]
