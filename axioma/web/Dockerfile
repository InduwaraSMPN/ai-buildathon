# syntax=docker/dockerfile:1

# Axiōma website — the public marketing site, and the only place the service
# status page is published. Unlike the portal and the dashboard this is not a
# static bundle: TanStack Start renders it on a Nitro server, because /status
# reads the API from the server side rather than from the visitor's browser.
# That is what keeps the marketing origin out of the API's CORS allowlist.
#
# The API URL is NOT baked in: lib/status.ts reads AXIOMA_API_URL from the
# environment on each request, so one image serves any environment.
# Build context is axioma/web.

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
# package list. Without it esbuild's postinstall is skipped and vite fails.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# A platform-native package is an optionalDependency: if its download fails,
# pnpm skips it and the install still reports success. The missing binding then
# surfaces at `pnpm build` — by which point this layer is cached, so every retry
# reuses the broken tree. Assert them here so a bad install fails the layer.
RUN --mount=type=cache,id=pnpm-store-web,target=/pnpm/store \
    pnpm install --frozen-lockfile \
 && for pkg in "@rolldown+binding-linux-x64-gnu" "@tailwindcss+oxide-linux-x64-gnu" "lightningcss-linux-x64-gnu"; do \
        find node_modules/.pnpm/${pkg}@*/node_modules -type f -print -quit 2>/dev/null | grep -q . \
        || { echo "native package ${pkg} unpacked empty; the install was incomplete" >&2; exit 1; }; \
    done

# ----------------------------------------------------------------------- build
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm build

# --------------------------------------------------------------------- runtime
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
# Nitro's node-server preset reads both. 3000 is its default; naming it here
# keeps the chart's containerPort and this image from drifting apart.
ENV HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
# Nitro bundles the server and its dependencies into .output, so no node_modules
# tree ships with the runtime image.
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
