FROM oven/bun:1.3.11-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM dhi.io/caddy:2.11.2-debian13

COPY --from=build /app/build /usr/share/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
