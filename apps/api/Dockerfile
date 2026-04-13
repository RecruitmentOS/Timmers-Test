# ── Stage 1: base ──────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

# ── Stage 2: deps ─────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/permissions/package.json packages/permissions/

RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 3: builder ─────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app .
COPY apps/api/ apps/api/
COPY packages/ packages/
COPY tsconfig.base.json .

RUN cd apps/api && pnpm build

# ── Stage 4: runner ──────────────────────────────────────────────
FROM node:22-alpine AS runner

ENV NODE_ENV=production

RUN addgroup -S api && adduser -S api -G api

WORKDIR /app

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY apps/api/drizzle ./apps/api/drizzle
COPY apps/api/src/db/setup-rls.sql ./apps/api/src/db/setup-rls.sql

USER api

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
