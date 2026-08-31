# syntax=docker/dockerfile:1

# Axiōma dashboard — a Vite SPA served as static files. The API base URL is NOT
# baked in: index.html loads /config.js, which deploy/runtime-config.sh writes
# from the environment at container start. One image, any environment.
# Build context is axioma/dashboard.

ARG NODE_VERSION=24.13.0
ARG PNPM_VERSION=11.24.0
ARG NGINX_VERSION=1.29

# ----------------------------------------------------------------------- build
FROM node:${NODE_VERSION}-bookworm-slim AS build
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
RUN --mount=type=cache,id=pnpm-store-dashboard,target=/pnpm/store \
    pnpm install --frozen-lockfile \
 && for pkg in "@rolldown+binding-linux-x64-gnu" "@tailwindcss+oxide-linux-x64-gnu" "lightningcss-linux-x64-gnu"; do \
        find node_modules/.pnpm/${pkg}@*/node_modules -type f -print -quit 2>/dev/null | grep -q . \
        || { echo "native package ${pkg} unpacked empty; the install was incomplete" >&2; exit 1; }; \
    done
COPY . .
# The router plugin generates src/routeTree.gen.ts during this build; it is
# gitignored and excluded from the context so a stale copy cannot leak in.
RUN pnpm build

# --------------------------------------------------------------------- runtime
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=0755 deploy/runtime-config.sh /docker-entrypoint.d/40-axioma-runtime-config.sh
# Owned by the nginx user so the entrypoint can rewrite config.js at start.
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
EXPOSE 8080
