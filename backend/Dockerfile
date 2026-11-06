# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22.22.1-alpine AS web
WORKDIR /src
COPY web/package.json web/package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true --fetch-retries=1 --fetch-timeout=30000
COPY web/ ./
RUN npm run build && node scripts/licenses.mjs

FROM --platform=$BUILDPLATFORM golang:1.27.3-alpine AS toolchain
FROM --platform=$BUILDPLATFORM alpine:3.24 AS build
ARG TARGETOS
ARG TARGETARCH
ENV CGO_ENABLED=0 GOPATH=/go PATH=/usr/local/go/bin:$PATH
COPY --from=toolchain /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN --mount=type=bind,from=toolchain,source=/usr/local/go,target=/usr/local/go \
    --mount=type=cache,target=/go/pkg/mod \
    --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    go mod download
COPY backend/cmd ./cmd
COPY backend/internal ./internal
COPY scripts/licenses.sh ./licenses.sh
RUN --mount=type=bind,from=toolchain,source=/usr/local/go,target=/usr/local/go \
    --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    export CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH; go build -trimpath -ldflags="-s -w" -o /out/atlas ./cmd/atlas \
    && go build -trimpath -ldflags="-s -w" -o /out/healthcheck ./cmd/healthcheck \
    && go build -trimpath -ldflags="-s -w" -o /out/archive ./cmd/archive \
    && sh ./licenses.sh

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build --chmod=0555 /out/atlas /atlas
COPY --from=build --chmod=0555 /out/healthcheck /healthcheck
COPY --from=build --chmod=0555 /out/archive /archive
COPY --from=web /src/dist /web
COPY --from=build /out/licenses /licenses
COPY --from=build /out/licenses /web/licenses/backend
COPY --chmod=0444 LICENSE /licenses/Atlas-LICENSE
COPY --chmod=0444 LICENSE /web/licenses/Atlas-LICENSE
ENV ATLAS_WEB_DIR=/web
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/atlas"]
