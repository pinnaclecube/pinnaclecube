FROM node:20-alpine AS base

RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/shared/package.json ./lib/shared/
COPY artifacts/api-server/package.json ./artifacts/api-server/

# Install all workspace deps (only production + build tools needed)
RUN pnpm install --frozen-lockfile

# Copy source
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Build the api-server (esbuild bundles everything into dist/index.mjs)
RUN pnpm --filter @workspace/api-server run build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Only copy the compiled bundle — no source or node_modules needed
COPY --from=base /app/artifacts/api-server/dist ./dist
COPY --from=base /app/artifacts/api-server/package.json ./

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
