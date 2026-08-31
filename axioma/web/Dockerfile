# syntax=docker/dockerfile:1


ARG NODE_VERSION=24.13.0
ARG PNPM_VERSION=11.24.0

FROM node:${NODE_VERSION}-bookworm-slim AS deps
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV npm_config_fetch_timeout=600000 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_network_concurrency=4
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store-web,target=/pnpm/store \
    pnpm install --frozen-lockfile \
 && for pkg in "@rolldown+binding-linux-x64-gnu" "@tailwindcss+oxide-linux-x64-gnu" "lightningcss-linux-x64-gnu"; do \
        find node_modules/.pnpm/${pkg}@*/node_modules -type f -print -quit 2>/dev/null | grep -q . \
        || { echo "native package ${pkg} unpacked empty; the install was incomplete" >&2; exit 1; }; \
    done

FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
