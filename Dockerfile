# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json prisma.config.ts ./
RUN npm ci

# Generate Prisma client → be/generated/prisma/ (outside src/, tsc won't touch it)
COPY prisma ./prisma
RUN npx prisma generate

# Compile TypeScript source: src/ → dist/
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Production deps (includes @prisma/adapter-pg, pg, tsx for seeding)
COPY package*.json prisma.config.ts ./
RUN npm ci --omit=dev

# Prisma schema + seed script
COPY prisma ./prisma

# Compiled TypeScript output
COPY --from=builder /app/dist ./dist

# Generated Prisma client — place at be/generated/prisma/ so both consumers resolve correctly:
#   dist/lib/prisma.js  imports  ../../generated/prisma/index.js  → /app/generated/prisma/ ✓
#   prisma/seed.ts      imports  ../generated/prisma/index.js     → /app/generated/prisma/ ✓
COPY --from=builder /app/generated/prisma ./generated/prisma

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 5001

ENTRYPOINT ["./docker-entrypoint.sh"]
