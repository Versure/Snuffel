# syntax=docker/dockerfile:1
# Snuffel: the Angular app served by a pinned PocketBase. Build context is the repo root:
#   docker build -f deploy/Dockerfile .

# --- build: compile the app and fetch the checksum-verified PocketBase binary ---
FROM --platform=$BUILDPLATFORM node:24.22.0-alpine AS build
# No git hooks inside the image build (there is no .git either).
ENV HUSKY=0
WORKDIR /src

# Optional extra CA (build secret "extra_ca") for networks behind a TLS-inspecting proxy.
# Without the secret nothing changes; the release workflow does not use it.
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --no-audit --no-fund

COPY . .
# M6: `npm run content:build` comes here, before the app build.
RUN npm run build
# NODE_USE_ENV_PROXY lets Node's fetch honour HTTPS_PROXY if one is set; without it, no effect.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    NODE_USE_ENV_PROXY=1 node tools/fetch-pocketbase.mjs --platform linux_amd64 --out /out

# --- runtime: alpine with only the binary, migrations, hooks and the built app ---
FROM alpine:3.24 AS runtime
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 1000 snuffel \
    && adduser -S -D -H -u 1000 -G snuffel snuffel \
    && mkdir -p /pb/pb_data \
    && chown snuffel:snuffel /pb/pb_data

COPY --from=build /out/pocketbase /pb/pocketbase
COPY pocketbase/pb_migrations /pb/pb_migrations
COPY pocketbase/pb_hooks /pb/pb_hooks
COPY --from=build /src/web/dist/snuffel/browser /pb/pb_public

USER snuffel
WORKDIR /pb
EXPOSE 8090
VOLUME /pb/pb_data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --start-interval=2s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8090/api/health > /dev/null || exit 1

# --indexFallback is on by default: unknown paths such as /stijl get index.html (SPA routes).
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public", "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations"]
