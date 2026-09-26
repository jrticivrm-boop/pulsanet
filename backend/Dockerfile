FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Respaldos .zip: pg_dump/psql 18 y bsdtar (tar -a); el tar de busybox no crea zip.
RUN apk add --no-cache postgresql18-client libarchive-tools \
 && ln -sf /usr/bin/bsdtar /usr/local/bin/tar
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
RUN mkdir -p /app/uploads /app/data && chown -R node:node /app/uploads /app/data
EXPOSE 4000
USER node
CMD ["node", "src/server.js"]
