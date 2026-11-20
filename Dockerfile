FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/src ./src
COPY --from=build /app/scripts/start.mjs ./scripts/start.mjs

USER node
EXPOSE 3000
CMD ["node", "--import", "tsx", "scripts/start.mjs"]
