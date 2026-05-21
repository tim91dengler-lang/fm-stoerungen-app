# syntax=docker/dockerfile:1.7

# ---------- builder ----------
FROM node:20-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

COPY . .

ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# ---------- runtime ----------
# nginx-unprivileged: ships with `nginx` user pre-configured and listens on 8080
FROM nginxinc/nginx-unprivileged:alpine AS runtime

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Image runs as user `nginx` (uid 101) by default; declare it explicitly for static analyzers
USER nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
