# syntax=docker/dockerfile:1

# One image that serves the API and the frontend from a single origin.
#   docker build -t fullstack-calculator .
#   docker run --rm -p 8080:8080 fullstack-calculator

# 1. Build the frontend. Debian rather than Alpine: the TypeScript 7 and
#    Rolldown native binaries target glibc.
FROM node:22-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2. Build the backend as a static binary. The module has no dependencies,
#    so there is no go.sum to copy or download step to cache.
FROM golang:1.27-alpine AS backend
WORKDIR /src/backend
COPY backend/ ./
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# 3. Ship only the binary and the built assets, as an unprivileged user.
FROM gcr.io/distroless/static-debian13:nonroot
LABEL org.opencontainers.image.title="fullstack-calculator" \
      org.opencontainers.image.description="Calculator: Go REST API and React frontend" \
      org.opencontainers.image.source="https://github.com/aozmekik/fullstack-calculator"
COPY --from=backend /out/server /app/server
COPY --from=frontend /src/frontend/dist /app/web
ENV PORT=8080 STATIC_DIR=/app/web
EXPOSE 8080
ENTRYPOINT ["/app/server"]
