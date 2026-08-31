# syntax=docker/dockerfile:1

# Axiōma API — oRPC surface, gRPC gateways, the only component that writes.
# Build context is axioma/api. The project is standalone: its own lockfile, no
# workspace parent, nothing outside this directory is needed.

ARG NODE_VERSION=24.13.0
ARG PNPM_VERSION=11.24.0

# ---------------------------------------------------------------- dependencies
FROM node:${NODE_VERSION}-bookworm-slim AS deps
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
# The registry defaults assume a fast link. On a slow one the larger tarballs
# time out mid-install and the whole layer fails.
ENV npm_config_fetch_timeout=600000 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_network_concurrency=4
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app
# pnpm-workspace.yaml carries the pnpm 11 build allowlist (esbuild), not a
# package list. Without it esbuild's postinstall is skipped and tsdown fails.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# A platform-native package is an optionalDependency: if its download fails,
# pnpm skips it and the install still reports success. The missing binding then
# surfaces at `pnpm build` — by which point this layer is cached, so every
# retry reuses the broken tree. Assert them here so a bad install fails the
# layer instead.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile \
 && for pkg in "@rolldown+binding-linux-x64-gnu" "@esbuild+linux-x64"; do \
        find node_modules/.pnpm/${pkg}@*/node_modules -type f -print -quit 2>/dev/null | grep -q . \
        || { echo "native package ${pkg} unpacked empty; the install was incomplete" >&2; exit 1; }; \
    done

# ----------------------------------------------------------------------- build
FROM deps AS build
WORKDIR /app
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY proto ./proto
RUN pnpm build

# --------------------------------------------------------------------- runtime
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV NODE_ENV=production
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app

# Full dependency tree, not --prod. drizzle-kit is a devDependency and the same
# image runs the migration hook; splitting it out would mean a fifth image.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml drizzle.config.ts ./
COPY --from=build /app/dist ./dist

# grpc.ts resolves proto/axioma.proto relative to process.cwd() once bundled,
# so proto/ must sit beside the working directory and WORKDIR must not be
# overridden by the chart.
COPY proto ./proto

# drizzle-kit migrate reads the journal under out/ and resolves the schema path
# declared in drizzle.config.ts, so both trees ship in the image.
COPY src/db/migrations ./src/db/migrations
COPY src/db/schema ./src/db/schema

# Document blob store default is <cwd>/.data/documents; the chart mounts a
# volume here and sets AXIOMA_DOCUMENT_DIR to match.
RUN mkdir -p /app/.data/documents && chown -R node:node /app/.data

USER node
EXPOSE 3000 50051
CMD ["node", "dist/index.mjs"]
