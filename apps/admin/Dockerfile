# The app admin of shop for the deployer of the kit, built from the root of the repo, one pnpm workspace
# (project-scaffold part 2, spec 2.3): static files, served by Caddy in the container. The deployer builds one image for
# each commit and runs it in all three environments, so nothing here may differ by environment: VITE_ values are written
# into the build, and the code calls the API on /api of its own origin.
FROM node:24-bookworm-slim AS build

# Corepack, which Node 24 ships, runs the pnpm that packageManager of package.json names, without asking.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm

WORKDIR /app

# The packages of the lockfile first, so a change of code alone keeps this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

# Every app is copied: one may import code another shares. --ignore-scripts: the root prepare script installs the Git
# hooks of the kit, which are not in the build context.
COPY apps/ apps/
RUN pnpm install --offline --frozen-lockfile --ignore-scripts
RUN pnpm --filter ./apps/admin run build

FROM caddy:2.10-alpine

# The deployer runs every container with --cap-drop ALL and --security-opt no-new-privileges. The binary of this image
# carries the file capability to bind ports below 1024, which a process with no capability may not exec: drop it, since
# 5173 needs none.
RUN setcap -r /usr/bin/caddy

COPY apps/admin/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/admin/dist/ /srv/

# A user with no rights of its own; Caddy keeps nothing on disk (persist_config off, no certificates).
ENV XDG_CONFIG_HOME=/tmp XDG_DATA_HOME=/tmp
USER 65534:65534
EXPOSE 5173
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
