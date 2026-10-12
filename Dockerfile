# One image builds the web app and runs the server that serves it together with the API.
FROM node:22-slim

WORKDIR /app

# Manifests first, so installed dependencies stay cached until a package.json changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# better-sqlite3 ships prebuilt binaries inside its package, so no install script has to run
# (and the slim image has no compiler for the fallback build). The check fails the build,
# not the deploy, if the native module cannot load on this platform.
RUN npm ci --ignore-scripts \
 && node -e "new (require('better-sqlite3'))(':memory:').prepare('select 1').get()"

COPY . .
RUN npm run build

ENV NODE_ENV=production

# The database must live on a mounted volume, set with DB_PATH. /data is deliberately not
# created in this image: a missing volume then stops the server instead of quietly using
# the temporary disk, which every redeploy wipes. The container runs as root because a
# volume attached to a non-root user hits permission errors on Railway.
CMD ["node", "--import", "tsx", "apps/api/src/index.ts"]
