FROM dhi.io/caddy:2.11.2-debian13

COPY ./build /usr/share/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
